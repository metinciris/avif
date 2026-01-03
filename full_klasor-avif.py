# avif_recursive.py
# Klasör seç -> ALT KLASÖRLER DAHİL tüm .jpg/.jpeg/.png dosyalarını AVIF'e çevirir (paralel + progress + ETA)
# Başarıyla çevrilen orijinali SİLER (src.unlink()).

import os
import sys
import time
import shutil
import tempfile
import threading
import queue
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk

from PIL import Image
import pillow_avif  # noqa: F401  (registers AVIF plugin)

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png"}

# ---- Renkli tarama için varsayılanlar (istersen değiştir) ----
QUALITY = 40                 # 35-45 iyi başlangıç
SPEED = 3                    # 2-4 arası
SUBSAMPLING = "4:2:0"        # daha renk korusun: "4:4:4"
CODEC = "auto"               # genelde "auto" iyi; istersen "svt" deneyebilirsin

CONFIRM_OVER = 100           # 100+ ise sor

# CPU'ya göre otomatik paralellik: çok abartmamak için tavan koyuyoruz
MAX_WORKERS_CAP = 8          # istersen 12 yapabilirsin

# Alt klasörlere de gir
RECURSIVE = True

# -------------------------------------------------------------


def short_beep():
    try:
        import winsound
        winsound.Beep(1200, 90)  # kısa
    except Exception:
        print("\a", end="", flush=True)


def format_eta(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    m, s = divmod(int(seconds + 0.5), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}sa {m}dk"
    if m > 0:
        return f"{m}dk {s}sn"
    return f"{s}sn"


def choose_workers(n_tasks: int) -> int:
    cpu = os.cpu_count() or 4
    # scan görsellerde disk de etkiler; cpu-1 iyi denge, ama en az 1
    w = max(1, min(cpu - 1, MAX_WORKERS_CAP, n_tasks))
    return w


def worker_convert(src_str: str, dst_str: str, quality: int, speed: int, subsampling: str, codec: str):
    """
    Process içinde çalışır: src -> temp avif -> dst, sonra src sil.
    Hata olursa exception fırlatır.
    """
    src = Path(src_str)
    dst = Path(dst_str)
    out_dir = dst.parent

    with Image.open(src) as im:
        # mod normalize
        if im.mode in ("P", "LA"):
            im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")

        tmp_dir = out_dir / ".avif_tmp"
        tmp_dir.mkdir(exist_ok=True)

        fd, tmp_name = tempfile.mkstemp(prefix=dst.stem + "_", suffix=".avif", dir=tmp_dir)
        os.close(fd)
        tmp_path = Path(tmp_name)

        save_kwargs = {
            "quality": quality,
            "speed": speed,
            "subsampling": subsampling,
            "codec": codec,
        }

        im.save(tmp_path, "AVIF", **save_kwargs)

        # temp -> final (aynı diskte atomic)
        tmp_path.replace(dst)

    # sadece başarıyla bittiyse orijinali sil
    src.unlink()


def list_images(folder: Path, recursive: bool):
    files = []
    if not recursive:
        for name in os.listdir(folder):
            p = folder / name
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
                files.append(p)
        return files

    for root, _, names in os.walk(folder):
        for name in names:
            p = Path(root) / name
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
                files.append(p)
    return files


def plan_outputs_per_folder(files):
    """
    Çakışmasız çıktı isimlerini ÖNCEDEN planlar.
    Recursive olduğunda HER KLASÖR için ayrı çakışma seti tutar.
    Çıktı: aynı klasöre .avif yaz (src'nin yanında)
    """
    used_by_dir = {}
    stem_next_by_dir = {}

    # Her klasörde var olan dosyaları (avif dahil) çakışma kontrolüne al
    for src in files:
        d = src.parent
        if d not in used_by_dir:
            used_by_dir[d] = set(p.name.lower() for p in d.iterdir() if p.is_file())
            stem_next_by_dir[d] = {}

    planned = []
    for src in files:
        out_dir = src.parent
        used = used_by_dir[out_dir]
        stem_next = stem_next_by_dir[out_dir]

        base = src.stem
        i = stem_next.get(base, 1)

        while True:
            if i == 1:
                name = f"{base}.avif"
            else:
                name = f"{base}({i}).avif"
            key = name.lower()
            if key not in used:
                used.add(key)
                stem_next[base] = i + 1
                planned.append((src, out_dir / name))
                break
            i += 1

    return planned


def cleanup_tmp_dirs(touched_dirs):
    for d in touched_dirs:
        tmp_dir = d / ".avif_tmp"
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    # ---- klasör seç ----
    root = tk.Tk()
    root.withdraw()
    root.update()

    folder = filedialog.askdirectory(title="AVIF'e çevrilecek klasörü seç (ALT KLASÖRLER DAHİL)")
    if not folder:
        return
    base_dir = Path(folder)

    files = list_images(base_dir, recursive=RECURSIVE)
    if not files:
        messagebox.showinfo("Bilgi", "Bu klasörde (ve alt klasörlerinde) dönüştürülecek resim bulunamadı.")
        return

    if len(files) > CONFIRM_OVER:
        ok = messagebox.askyesno("Onay", f"{len(files)} resim bulundu.\nDevam edilsin mi?")
        if not ok:
            return

    # ---- GUI panel ----
    win = tk.Toplevel()
    win.title("AVIF Dönüştürülüyor (Alt klasörler dahil)")
    win.resizable(False, False)

    title = tk.Label(win, text="Dönüştürme devam ediyor…", padx=12, pady=8, anchor="w")
    title.pack(fill="x")

    info = tk.Label(win, text="Hazırlanıyor…", padx=12, pady=4, anchor="w")
    info.pack(fill="x")

    pb = ttk.Progressbar(win, length=520, mode="determinate")
    pb.pack(padx=12, pady=10)

    sub = tk.Label(win, text="", padx=12, pady=4, anchor="w")
    sub.pack(fill="x")

    win.update()

    # ---- planla (çakışmasız) ----
    plan = plan_outputs_per_folder(files)
    total = len(plan)
    pb["maximum"] = total
    pb["value"] = 0

    touched_dirs = {dst.parent for _, dst in plan}

    # ---- worker thread -> main thread queue ----
    q = queue.Queue()

    def run_jobs():
        start = time.perf_counter()
        done = 0
        fail = 0
        workers = choose_workers(total)

        q.put(("meta", total, workers))

        try:
            with ProcessPoolExecutor(max_workers=workers) as ex:
                futures = []
                for (src, dst) in plan:
                    futures.append(
                        ex.submit(
                            worker_convert,
                            str(src),
                            str(dst),
                            QUALITY,
                            SPEED,
                            SUBSAMPLING,
                            CODEC,
                        )
                    )

                future_map = {f: plan[i][0] for i, f in enumerate(futures)}

                for f in as_completed(futures):
                    src_path = future_map.get(f)
                    src_name = str(src_path.relative_to(base_dir)) if src_path else ""
                    try:
                        f.result()
                        done += 1
                        q.put(("ok", done, fail, src_name, start))
                    except Exception:
                        fail += 1
                        q.put(("fail", done, fail, src_name, start))

        finally:
            cleanup_tmp_dirs(touched_dirs)
            q.put(("done", done, fail, start))

    t = threading.Thread(target=run_jobs, daemon=True)
    t.start()

    # ---- GUI update loop ----
    def poll():
        try:
            while True:
                msg = q.get_nowait()
                kind = msg[0]

                if kind == "meta":
                    _, total_, workers = msg
                    info.config(text=f"{total_} dosya • Otomatik hızlandırma: {workers} process")

                elif kind in ("ok", "fail"):
                    _, done, fail, src_name, start = msg
                    pb["value"] = done + fail

                    elapsed = time.perf_counter() - start
                    completed = done + fail
                    avg = elapsed / completed if completed else 0.0
                    remaining = (total - completed) * avg
                    sub.config(text=f"{completed}/{total} • Hata: {fail} • ETA: {format_eta(remaining)}")
                    info.config(text=f"Şu an: {src_name}")

                elif kind == "done":
                    short_beep()
                    win.destroy()
                    sys.exit(0)

        except queue.Empty:
            win.after(80, poll)

    poll()
    win.mainloop()


if __name__ == "__main__":
    import multiprocessing as mp
    mp.freeze_support()
    main()
