import init, { encode } from "https://cdn.jsdelivr.net/npm/@jsquash/avif@1.1.2-single-thread-only/dist/avif.js";

const status = document.getElementById("status");
const kpi = document.getElementById("kpi");
const btn = document.getElementById("btn");
const play = document.getElementById("play");
const fileInput = document.getElementById("file");

const imgOriginal = document.getElementById("imgOriginal");
const imgAvif = document.getElementById("imgAvif");
const curtain = document.getElementById("curtain");
const divider = document.getElementById("divider");

const wipe = document.getElementById("wipe");
const wipeVal = document.getElementById("wipeVal");
const download = document.getElementById("download");

let ready = false;
let avifUrl = null;

function setWipe(pct) {
  const v = Math.max(0, Math.min(100, pct));
  curtain.style.width = `${v}%`;
  divider.style.left = `${v}%`;
  wipe.value = String(v);
  wipeVal.textContent = `${v}%`;
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function pctSmaller(origBytes, avifBytes) {
  // % smaller = (1 - avif/orig)*100
  if (!origBytes) return 0;
  return Math.max(0, (1 - (avifBytes / origBytes)) * 100);
}

status.textContent = "AVIF motoru yükleniyor…";

await init();
ready = true;
status.textContent = "Hazır. Bir resim seç.";
btn.disabled = false;

fileInput.addEventListener("change", async () => {
  // reset
  if (!fileInput.files.length) return;

  if (avifUrl) URL.revokeObjectURL(avifUrl);
  avifUrl = null;
  download.textContent = "";
  kpi.textContent = "";
  play.disabled = true;

  setWipe(0);
  wipe.disabled = true;

  const file = fileInput.files[0];
  const origUrl = URL.createObjectURL(file);
  imgOriginal.src = origUrl;
  imgAvif.removeAttribute("src");

  status.textContent = `Seçildi: ${file.name} (${fmtKB(file.size)})`;
});

wipe.addEventListener("input", () => {
  setWipe(Number(wipe.value));
});

btn.addEventListener("click", async () => {
  if (!ready || !fileInput.files.length) return;

  const file = fileInput.files[0];
  status.textContent = "Çeviriliyor…";

  // Decode to bitmap (fast path)
  const bitmap = await createImageBitmap(file);

  // “Bizim profile yakın” hedef:
  // quality ≈ 40, chroma 4:2:0 (420)
  // speed burada WASM tarafında farklı ölçekte; stabil olması için orta değer.
  const avifData = await encode(bitmap, {
    quality: 40,
    speed: 6,
    chromaSubsampling: "420"
  });

  const blob = new Blob([avifData], { type: "image/avif" });
  avifUrl = URL.createObjectURL(blob);
  imgAvif.src = avifUrl;

  const smaller = pctSmaller(file.size, blob.size);
  kpi.textContent = `Original: ${fmtKB(file.size)} → AVIF: ${fmtKB(blob.size)} • ${smaller.toFixed(1)}% daha küçük`;

  // download link
  const stem = file.name.replace(/\.[^.]+$/, "") || "demo";
  download.innerHTML = `<a href="${avifUrl}" download="${stem}.avif">AVIF’i indir</a>`;

  status.textContent = "Tamamlandı. Perdeyi sürükle veya animasyonu çalıştır.";
  wipe.disabled = false;
  play.disabled = false;

  // Auto show a little reveal
  setWipe(15);
});

play.addEventListener("click", () => {
  // Curtain opening animation: 0 -> 100
  play.disabled = true;
  const start = performance.now();
  const dur = 900; // ms

  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    // easeOutCubic
    const eased = 1 - Math.pow(1 - p, 3);
    setWipe(Math.round(eased * 100));
    if (p < 1) requestAnimationFrame(tick);
    else play.disabled = false;
  };

  setWipe(0);
  requestAnimationFrame(tick);
});
