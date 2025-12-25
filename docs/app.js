// ✅ esm.sh bağımlılıkları bundle eder, GitHub Pages'te çalışır
import encode, { init } from "https://esm.sh/@jsquash/avif@2.1.1/encode?bundle";

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
  if (!origBytes) return 0;
  return Math.max(0, (1 - (avifBytes / origBytes)) * 100);
}

// ---- init ----
status.textContent = "AVIF motoru yükleniyor…";
try {
  await init();
  ready = true;
  status.textContent = "Hazır. Bir resim seç.";
  btn.disabled = false;
} catch (e) {
  status.textContent = "AVIF motoru yüklenemedi: " + (e?.message || e);
  console.error(e);
}

// ---- file selection ----
fileInput.addEventListener("change", async () => {
  if (!fileInput.files.length) return;

  if (avifUrl) URL.revokeObjectURL(avifUrl);
  avifUrl = null;
  download.textContent = "";
  kpi.textContent = "";
  play.disabled = true;

  setWipe(0);
  wipe.disabled = true;

  const file = fileInput.files[0];
  imgOriginal.src = URL.createObjectURL(file);
  imgAvif.removeAttribute("src");

  status.textContent = `Seçildi: ${file.name} (${fmtKB(file.size)})`;
});

wipe.addEventListener("input", () => setWipe(Number(wipe.value)));

// ---- convert ----
btn.addEventListener("click", async () => {
  if (!ready || !fileInput.files.length) return;

  const file = fileInput.files[0];
  status.textContent = "Çeviriliyor…";

  const bitmap = await createImageBitmap(file);

  // encode() ImageData ister
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // “bizim profile yakın”: quality ≈ 40
  const avifBytes = await encode(imageData, { quality: 40 });

  const blob = new Blob([avifBytes], { type: "image/avif" });
  avifUrl = URL.createObjectURL(blob);
  imgAvif.src = avifUrl;

  const smaller = pctSmaller(file.size, blob.size);
  kpi.textContent =
    `Original: ${fmtKB(file.size)} → AVIF: ${fmtKB(blob.size)} • ${smaller.toFixed(1)}% daha küçük`;

  const stem = file.name.replace(/\.[^.]+$/, "") || "demo";
  download.innerHTML = `<a href="${avifUrl}" download="${stem}.avif">AVIF’i indir</a>`;

  status.textContent = "Tamamlandı. Perdeyi sürükle veya animasyonu çalıştır.";
  wipe.disabled = false;
  play.disabled = false;

  setWipe(15);
});

// ---- curtain animation ----
play.addEventListener("click", () => {
  play.disabled = true;
  const start = performance.now();
  const dur = 900;

  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    setWipe(Math.round(eased * 100));
    if (p < 1) requestAnimationFrame(tick);
    else play.disabled = false;
  };

  setWipe(0);
  requestAnimationFrame(tick);
});
