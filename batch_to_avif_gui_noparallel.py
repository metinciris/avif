import os
import sys
import time
import shutil
import tempfile
from pathlib import Path

import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk

from PIL import Image
import pillow_avif  # noqa: F401  (register AVIF)

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png"}

# Seçtiğin profil:
QUALITY = 40
SPEED = 3
SUBSAMPLING = "4:2:0"
CODEC = "auto"

CONFIRM_OVER = 100


def short_beep():
    try:
        import winsound
        winsound.Beep(1200, 90)
    except Exception:
        print("\a", end="", flush=True)


def unique_avif_path(out_dir: Path, stem: str) -> Path:
    p = out_dir / f"{stem}.avif"
    if not p.exists():
        return p
    i = 2
    while True:
        p2 = out_dir / f"{stem}({i}).avif"
        if not p2.exists():
            return p2
        i += 1


def convert_one(src: Path, out_dir: Path) -> None:
    with Image.open(src) as im:
        if im.mode in ("P", "LA"):
            im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")

        dst = unique_avif_path(out_dir, src.stem)

        tmp_dir = out_dir / ".avif_tmp"
        tmp_dir.mkdir(exist_ok=True)

        fd, tmp_name = tempfile.mkstemp(prefix=dst.stem + "_", suffix=".avif", dir=tmp_dir)
        os.close(fd)
        tmp_path = Path(tmp_name)

        im.save(
            tmp_path,
            "AVIF",
            quality=QUALITY,
            speed=SPEED,
            subsampling=SUBSAMPLING,
            codec=CODEC,
        )
        tmp_path.replace(dst)

    # sadece başarıyla yazdıktan sonra sil
    src.unlink()


def list_top_level_images(folder: Path):
    files = []
    for name in os.listdir(folder):
        p = folder / name
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
            files.append(p)
    return files


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


def main():
    root = tk.Tk()
    root.withdraw()
    root.update()

    folder = filedialog.askdirectory(title="AVIF'e çevrilecek klasörü seç (alt klasörlere girmez)")
    if not folder:
        return
    out_dir = Path(folder)

    files = list_top_level_images(out_dir)
    if not files:
        return

    if len(files) > CONFIRM_OVER:
        ok = messagebox.askyesno("Onay", f"{len(files)} resim bulundu.\nDevam edilsin mi?")
        if not ok:
            return

    # Panel
    win = tk.Toplevel()
    win.title("AVIF Dönüştürülüyor")
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

    total = len(files)
    pb["maximum"] = total
    pb["value"] = 0

    start = time.perf_counter()
    done = 0
    fail = 0

    for i, src in enumerate(files, start=1):
        info.config(text=f"Şu an: {src.name}")
        win.update_idletasks()

        try:
            convert_one(src, out_dir)
            done += 1
        except Exception:
            fail += 1

        pb["value"] = i
        elapsed = time.perf_counter() - start
        avg = elapsed / i
        remaining = (total - i) * avg
        sub.config(text=f"{i}/{total} • Hata: {fail} • ETA: {format_eta(remaining)}")

    tmp_dir = out_dir / ".avif_tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)

    short_beep()
    win.destroy()
    sys.exit(0)


if __name__ == "__main__":
    main()
