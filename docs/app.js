import encode, { init } from "https://esm.sh/@jsquash/avif@2.1.1/encode?bundle";

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const pctEl = $("pct");
const sizesEl = $("sizes");
const meterFill = $("meterFill");
const downloadEl = $("download");

const fileInput = $("file");

const overlay = $("overlay");
const convSub = $("convSub");

const vp = $("vp");
const content = $("content");

const imgOriginal = $("imgOriginal");
const imgAvif = $("imgAvif");

const metaLeft = $("metaLeft");
const metaRight = $("metaRight");

const splitRange = $("splitRange");
const handleLine = $("handleLine");
const handleKnob = $("handleKnob");

let ready = false;
let avifUrl = null;
let currentJobId = 0;

function fmtKB(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
function pctSmaller(origBytes, avifBytes) {
  if (!origBytes || !avifBytes) return 0;
  return (1 - (avifBytes / origBytes)) * 100;
}
function setHasSrc(imgEl, yes) {
  imgEl.classList.toggle("has-src", !!yes);
}

function setContentSize(w, h) {
  content.style.width = `${w}px`;
  content.style.height = `${h}px`;

  imgOriginal.style.width = `${w}px`;
  imgOriginal.style.height = `${h}px`;

  imgAvif.style.width = `${w}px`;
  imgAvif.style.height = `${h}px`;
}

function setKpi(fromBytes, toBytes) {
  if (!fromBytes || !toBytes) {
    pctEl.textContent = "—";
    sizesEl.textContent = "—";
    meterFill.style.width = "0%";
    return;
  }
  const smaller = pctSmaller(fromBytes, toBytes);
  pctEl.textContent = `${smaller >= 0 ? "-" : "+"}${Math.abs(smaller).toFixed(1)}%`;
  sizesEl.textContent = `${fmtKB(fromBytes)} → ${fmtKB(toBytes)}`;
  const bar = Math.max(0, Math.min(100, smaller));
  meterFill.style.width = `${bar.toFixed(0)}%`;
}

function showConverting(file) {
  overlay.classList.add("show");
  convSub.textContent = `Çevriliyor: ${file.name} (${fmtKB(file.size)})`;
}
function hideConverting() {
  overlay.classList.remove("show");
}

function clearAvif() {
  if (avifUrl) URL.revokeObjectURL(avifUrl);
  avifUrl = null;
  imgAvif.removeAttribute("src");
  setHasSrc(imgAvif, false);
  metaRight.textContent = "";
  downloadEl.innerHTML = "";
}

/* Split: sol = original (altta), sağ = avif (üstte) */
function setSplit(v) {
  const val = Math.max(0, Math.min(100, Number(v)));

  // AVIF sadece sağ tarafta görünsün:
  // sol tarafı val% kadar kes
  const clip = `inset(0 0 0 ${val}%)`;
  imgAvif.style.clipPath = clip;
  imgAvif.style.webkitClipPath = clip;

  const rect = vp.getBoundingClientRect();
  const x = rect.width * (val / 100);
  handleLine.style.left = `${x}px`;
  handleKnob.style.left = `${x}px`;
}

splitRange.addEventListener("input", (e) => setSplit(e.target.value));
window.addEventListener("resize", () => setSplit(splitRange.value));

async function getBitmapSize(file) {
  const bm = await createImageBitmap(file);
  const w = bm.width, h = bm.height;
  bm.close?.();
  return { w, h };
}

async function fileToImageData(file) {
  const bm = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bm.width;
  canvas.height = bm.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bm, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bm.close?.();
  return imageData;
}

async function convertFileToAvif(file) {
  const jobId = ++currentJobId;

  clearAvif();
  setKpi(null, null);

  // boyutu al ve sahneyi ölçülendir
  const { w, h } = await getBitmapSize(file);
  setContentSize(w, h);

  // original göster
  const origUrl = URL.createObjectURL(file);
  imgOriginal.src = origUrl;
  setHasSrc(imgOriginal, true);
  metaLeft.textContent = `(${fmtKB(file.size)} • ${w}×${h})`;

  // split ortada
  splitRange.value = "50";
  setSplit(50);

  showConverting(file);
  statusEl.textContent = "Çevirme başladı…";
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const imageData = await fileToImageData(file);
    const avifBytes = await encode(imageData, { quality: 40 });

    if (jobId !== currentJobId) return;

    const outBlob = new Blob([avifBytes], { type: "image/avif" });
    avifUrl = URL.createObjectURL(outBlob);

    imgAvif.src = avifUrl;
    setHasSrc(imgAvif, true);
    metaRight.textContent = `(${fmtKB(outBlob.size)})`;

    setKpi(file.size, outBlob.size);

    const stem = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
    downloadEl.innerHTML = `<a href="${avifUrl}" download="${stem}.avif">AVİF’i indir</a>`;

    statusEl.textContent = "Tamamlandı. Slider’ı çek: sol/orijinal, sağ/AVIF.";
  } catch (e) {
    statusEl.textContent = `Hata: ${e?.message || e}`;
  } finally {
    if (jobId === currentJobId) hideConverting();
  }
}

async function boot() {
  setContentSize(1, 1);
  setSplit(50);
  setHasSrc(imgOriginal, false);
  setHasSrc(imgAvif, false);
  setKpi(null, null);

  statusEl.textContent = "AVIF motoru yükleniyor…";
  try {
    await init();
    ready = true;
    statusEl.textContent = "Hazır. Resim seç: otomatik AVIF’e çevrilecek.";
  } catch (e) {
    ready = false;
    statusEl.textContent = "AVIF motoru yüklenemedi: " + (e?.message || e);
  }
}

fileInput.addEventListener("change", async () => {
  if (!fileInput.files?.length) return;
  if (!ready) {
    statusEl.textContent = "AVIF motoru henüz hazır değil…";
    return;
  }
  await convertFileToAvif(fileInput.files[0]);
});

window.addEventListener("DOMContentLoaded", boot);
