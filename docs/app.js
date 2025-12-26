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
const scene = $("scene");
const imgOriginal = $("imgOriginal");
const imgAvif = $("imgAvif");
const metaLeft = $("metaLeft");
const metaRight = $("metaRight");

const splitRange = $("splitRange");
const handleLine = $("handleLine");
const handleKnob = $("handleKnob");

let ready = false;
let avifUrl = null;

// transform
let scale = 1;
let tx = 0;
let ty = 0;

// cancel
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
function clampScale(s) {
  return Math.max(0.25, Math.min(12, s));
}
function setHasSrc(imgEl, yes) {
  imgEl.classList.toggle("has-src", !!yes);
}

/* Scene sizing: critical fix */
function setSceneSize(w, h) {
  scene.style.width = `${w}px`;
  scene.style.height = `${h}px`;

  imgOriginal.style.width = `${w}px`;
  imgOriginal.style.height = `${h}px`;

  imgAvif.style.width = `${w}px`;
  imgAvif.style.height = `${h}px`;
}

function applyTransform() {
  // Now -50% works because scene has real size
  const t = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`;
  scene.style.transform = t;
}
function resetView() {
  scale = 1;
  tx = 0;
  ty = 0;
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
  downloadEl.textContent = "";
}

/* Split: AVIF layer shows RIGHT side, original shows LEFT under it */
function setSplit(val) {
  const v = Math.max(0, Math.min(100, Number(val)));

  // Show AVIF on the RIGHT side: clip left part by v%
  const clip = `inset(0 0 0 ${v}%)`;
  imgAvif.style.clipPath = clip;
  imgAvif.style.webkitClipPath = clip;

  // Handle UI position
  const rect = vp.getBoundingClientRect();
  const x = rect.width * (v / 100);
  handleLine.style.left = `${x}px`;
  handleKnob.style.left = `${x}px`;
}
splitRange.addEventListener("input", (e) => setSplit(e.target.value));
window.addEventListener("resize", () => setSplit(splitRange.value));

/* Pointer pan/zoom/pinch */
const pointers = new Map();
let isDragging = false;
let startDist = 0;
let startScale = 1;
let startTx = 0;
let startTy = 0;

function toLocal(e, el) {
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left - rect.width/2, y: e.clientY - rect.top - rect.height/2 };
}
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

function onPointerDown(e) {
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
}
function onPointerMove(e) {
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

    tx = m.x - (m.x - startTx) * (newScale / startScale);
    ty = m.y - (m.y - startTy) * (newScale / startScale);
    scale = newScale;
    applyTransform();
  }
}
function onPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) isDragging = false;
  if (pointers.size === 1) isDragging = true;
}
function onWheel(e) {
  e.preventDefault();
  const direction = Math.sign(e.deltaY);
  const factor = direction > 0 ? 0.92 : 1.08;
  scale = clampScale(scale * factor);
  applyTransform();
}

vp.addEventListener("pointerdown", onPointerDown);
vp.addEventListener("pointermove", onPointerMove);
vp.addEventListener("pointerup", onPointerUp);
vp.addEventListener("pointercancel", onPointerUp);
vp.addEventListener("wheel", onWheel, { passive:false });
vp.addEventListener("dblclick", (e) => { e.preventDefault(); resetView(); });

/* Decode for size + to ensure we know dimensions */
async function getBitmapSize(file) {
  const bm = await createImageBitmap(file);
  const w = bm.width, h = bm.height;
  bm.close?.();
  return { w, h };
}

async function fileToImageData(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently:true });
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return imageData;
}

async function convertFileToAvif(file) {
  const jobId = ++currentJobId;

  clearAvif();
  setKpi(null, null);

  // Make sure scene has real size BEFORE we transform/clip
  const { w, h } = await getBitmapSize(file);
  setSceneSize(w, h);

  // Original show
  const origUrl = URL.createObjectURL(file);
  imgOriginal.src = origUrl;
  setHasSrc(imgOriginal, true);
  metaLeft.textContent = `(${fmtKB(file.size)} • ${w}×${h})`;

  // split center
  splitRange.value = "50";
  setSplit(50);

  // reset view
  resetView();

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
    downloadEl.innerHTML = `<a href="${avifUrl}" download="${stem}.avif">AVIF’i indir</a>`;

    statusEl.textContent = "Tamamlandı. Slider’ı sağ/sol yapınca iki tarafı görmelisin.";
  } catch (e) {
    statusEl.textContent = `Hata: ${e?.message || e}`;
  } finally {
    if (jobId === currentJobId) hideConverting();
  }
}

async function boot() {
  // default scene size to avoid weird 0% translate until first image
  setSceneSize(1, 1);
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
    console.error(e);
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
