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
let avifUrl = null; // generated avif url
let demoAvifUrl = null; // demo avif object url
let demoJpgUrl = null;  // demo jpg object url
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

function showConverting(label) {
  overlay.classList.add("show");
  convSub.textContent = label;
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

  // AVIF sadece sağ tarafta görünsün: sol tarafı val% kadar kes
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

async function getBitmapSizeFromBlob(blob) {
  const bm = await createImageBitmap(blob);
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

/* ========= Demo loader: no conversion ========= */
async function loadDemo() {
  // Demo varsa otomatik göster (conversion yok)
  try {
    showConverting("Demo yükleniyor…");

    const [jpgRes, avifRes] = await Promise.all([
      fetch("./demo.jpg", { cache: "no-store" }),
      fetch("./demo.avif", { cache: "no-store" }),
    ]);

    if (!jpgRes.ok || !avifRes.ok) {
      hideConverting();
      statusEl.textContent = "Demo bulunamadı. demo.jpg ve demo.avif aynı klasörde olmalı.";
      return;
    }

    const [jpgBlob, avifBlob] = await Promise.all([jpgRes.blob(), avifRes.blob()]);

    // size for content
    const { w, h } = await getBitmapSizeFromBlob(jpgBlob);
    setContentSize(w, h);

    // revoke previous demo urls
    if (demoJpgUrl) URL.revokeObjectURL(demoJpgUrl);
    if (demoAvifUrl) URL.revokeObjectURL(demoAvifUrl);

    demoJpgUrl = URL.createObjectURL(jpgBlob);
    demoAvifUrl = URL.createObjectURL(avifBlob);

    imgOriginal.src = demoJpgUrl;
    imgAvif.src = demoAvifUrl;
    setHasSrc(imgOriginal, true);
    setHasSrc(imgAvif, true);

    metaLeft.textContent = `(${fmtKB(jpgBlob.size)} • ${w}×${h})`;
    metaRight.textContent = `(${fmtKB(avifBlob.size)})`;

    // KPI
    setKpi(jpgBlob.size, avifBlob.size);

    // Split center
    splitRange.value = "50";
    setSplit(50);

    // Download: demo avif
    downloadEl.innerHTML = `<a href="${demoAvifUrl}" download="demo.avif">AVİF’i indir</a>`;

    statusEl.textContent = "Demo hazır. Slider’ı çek: sol/orijinal, sağ/AVIF.";
  } catch (e) {
    statusEl.textContent = "Demo yüklenirken hata: " + (e?.message || e);
  } finally {
    hideConverting();
  }
}

/* ========= Convert uploaded file (auto) ========= */
async function convertFileToAvif(file) {
  const jobId = ++currentJobId;

  clearAvif();
  setKpi(null, null);

  // original show
  const origUrl = URL.createObjectURL(file);
  imgOriginal.src = origUrl;
  setHasSrc(imgOriginal, true);

  // size + scene size
  const tmpBm = await createImageBitmap(file);
  const w = tmpBm.width, h = tmpBm.height;
  tmpBm.close?.();
  setContentSize(w, h);

  metaLeft.textContent = `(${fmtKB(file.size)} • ${w}×${h})`;
  metaRight.textContent = "";

  // split center
  splitRange.value = "50";
  setSplit(50);

  showConverting(`Çevriliyor: ${file.name} (${fmtKB(file.size)})`);
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

    statusEl.textContent = "Tamamlandı. Slider ile karşılaştır.";
  } catch (e) {
    statusEl.textContent = `Hata: ${e?.message || e}`;
  } finally {
    if (jobId === currentJobId) hideConverting();
  }
}

/* ========= Boot ========= */
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

  // Demo otomatik aç
  await loadDemo();
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
