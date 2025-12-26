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

const handleLine = $("handleLine");
const handleKnob = $("handleKnob");
const handleGrab = $("handleGrab");
const splitPct = $("splitPct");

const zoomInBtn = $("zoomIn");
const zoomOutBtn = $("zoomOut");
const resetBtn = $("resetView");
const panUpBtn = $("panUp");
const panDownBtn = $("panDown");
const panLeftBtn = $("panLeft");
const panRightBtn = $("panRight");

let ready = false;

let avifUrl = null;
let demoAvifUrl = null;
let demoJpgUrl = null;

let currentJobId = 0;

// split + transform
let split = 50;
let scale = 1;
let tx = 0;
let ty = 0;

// sliding lock
let isSliding = false;

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
function clampScale(s) {
  return Math.max(0.25, Math.min(12, s));
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

function applyTransform() {
  content.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function resetView() {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

function zoomAtCenter(mult) {
  const prev = scale;
  const next = clampScale(scale * mult);
  const k = next / prev;
  tx *= k;
  ty *= k;
  scale = next;
  applyTransform();
}

function panBy(dx, dy) {
  tx += dx;
  ty += dy;
  applyTransform();
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

/* split: left original (under), right avif (top) */
function setSplit(val) {
  split = Math.max(0, Math.min(100, Number(val)));

  const clip = `inset(0 0 0 ${split}%)`;
  imgAvif.style.clipPath = clip;
  imgAvif.style.webkitClipPath = clip;

  const rect = vp.getBoundingClientRect();
  const x = rect.width * (split / 100);

  handleLine.style.left = `${x}px`;
  handleKnob.style.left = `${x}px`;
  handleGrab.style.left = `${x}px`;

  if (splitPct) splitPct.textContent = `${Math.round(split)}%`;
}

function setSplitFromClientX(clientX) {
  const rect = vp.getBoundingClientRect();
  const ratio = (clientX - rect.left) / Math.max(1, rect.width);
  setSplit(ratio * 100);
}

/* Handle drag only */
handleGrab.addEventListener("pointerdown", (e) => {
  isSliding = true;
  handleGrab.setPointerCapture(e.pointerId);
  setSplitFromClientX(e.clientX);
});
handleGrab.addEventListener("pointermove", (e) => {
  if (!isSliding) return;
  setSplitFromClientX(e.clientX);
});
function endSlide() { isSliding = false; }
handleGrab.addEventListener("pointerup", endSlide);
handleGrab.addEventListener("pointercancel", endSlide);

/* Wheel zoom desktop */
vp.addEventListener("wheel", (e) => {
  if (isSliding) return;
  e.preventDefault();
  const direction = Math.sign(e.deltaY);
  zoomAtCenter(direction > 0 ? 0.92 : 1.08);
}, { passive:false });

/* Pinch/pan mobile */
const pointers = new Map();
let startDist = 0;
let startScale = 1;
let startTx = 0;
let startTy = 0;
let isDragging = false;

function toLocal(e, el) {
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left - rect.width/2, y: e.clientY - rect.top - rect.height/2 };
}
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

vp.addEventListener("pointerdown", (e) => {
  if (isSliding) return;
  vp.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, toLocal(e, vp));

  if (pointers.size === 1) isDragging = true;

  if (pointers.size === 2) {
    const [p1,p2] = [...pointers.values()];
    startDist = dist(p1,p2);
    startScale = scale;
    startTx = tx;
    startTy = ty;
  }
});

vp.addEventListener("pointermove", (e) => {
  if (isSliding) return;
  if (!pointers.has(e.pointerId)) return;

  const prev = pointers.get(e.pointerId);
  const cur = toLocal(e, vp);
  pointers.set(e.pointerId, cur);

  if (pointers.size === 1 && isDragging) {
    tx += (cur.x - prev.x);
    ty += (cur.y - prev.y);
    applyTransform();
    return;
  }

  if (pointers.size === 2) {
    const [a,b] = [...pointers.values()];
    const m = midpoint(a,b);
    const d = dist(a,b);
    const base = Math.max(1, startDist);
    const newScale = clampScale(startScale * (d / base));

    const k = newScale / startScale;
    tx = m.x - (m.x - startTx) * k;
    ty = m.y - (m.y - startTy) * k;

    scale = newScale;
    applyTransform();
  }
});

function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) isDragging = false;
  if (pointers.size === 1) isDragging = true;
}
vp.addEventListener("pointerup", onPointerUp);
vp.addEventListener("pointercancel", onPointerUp);

/* Buttons */
zoomInBtn.addEventListener("click", () => zoomAtCenter(1.15));
zoomOutBtn.addEventListener("click", () => zoomAtCenter(0.87));
resetBtn.addEventListener("click", () => resetView());

const PAN_STEP = 70;
panUpBtn.addEventListener("click", () => panBy(0, -PAN_STEP));
panDownBtn.addEventListener("click", () => panBy(0, PAN_STEP));
panLeftBtn.addEventListener("click", () => panBy(-PAN_STEP, 0));
panRightBtn.addEventListener("click", () => panBy(PAN_STEP, 0));

/* Decode helpers */
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

/* Demo loader (no conversion) */
async function loadDemo() {
  try {
    showConverting("Demo yükleniyor…");

    const [jpgRes, avifRes] = await Promise.all([
      fetch("./demo.jpg", { cache: "no-store" }),
      fetch("./demo.avif", { cache: "no-store" }),
    ]);

    if (!jpgRes.ok || !avifRes.ok) {
      statusEl.textContent = "Demo bulunamadı. demo.jpg ve demo.avif aynı klasörde olmalı (isimler birebir).";
      return;
    }

    const [jpgBlob, avifBlob] = await Promise.all([jpgRes.blob(), avifRes.blob()]);
    const { w, h } = await getBitmapSizeFromBlob(jpgBlob);
    setContentSize(w, h);

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

    setKpi(jpgBlob.size, avifBlob.size);
    downloadEl.innerHTML = `<a href="${demoAvifUrl}" download="demo.avif">AVİF’i indir</a>`;

    resetView();
    setSplit(50);

    statusEl.textContent = "Demo hazır. Handle’ı sürükle: sol/orijinal, sağ/AVIF.";
  } catch (e) {
    statusEl.textContent = "Demo yüklenirken hata: " + (e?.message || e);
  } finally {
    hideConverting();
  }
}

/* Convert uploaded file (auto) */
async function convertFileToAvif(file) {
  const jobId = ++currentJobId;

  clearAvif();
  setKpi(null, null);

  const origUrl = URL.createObjectURL(file);
  imgOriginal.src = origUrl;
  setHasSrc(imgOriginal, true);

  const tmpBm = await createImageBitmap(file);
  const w = tmpBm.width, h = tmpBm.height;
  tmpBm.close?.();
  setContentSize(w, h);

  metaLeft.textContent = `(${fmtKB(file.size)} • ${w}×${h})`;
  metaRight.textContent = "";

  resetView();
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

    statusEl.textContent = "Tamamlandı. Handle + zoom/yön tuşlarıyla incele.";
  } catch (e) {
    statusEl.textContent = `Hata: ${e?.message || e}`;
  } finally {
    if (jobId === currentJobId) hideConverting();
  }
}

/* Boot */
async function boot() {
  setContentSize(1, 1);
  resetView();
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
