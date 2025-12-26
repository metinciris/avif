// GitHub Pages için stabil: esm.sh + bundle (senin çalışan yaklaşımın)
import encode, { init } from "https://esm.sh/@jsquash/avif@2.1.1/encode?bundle";

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const pctEl = $("pct");
const sizesEl = $("sizes");
const downloadEl = $("download");

const fileInput = $("file");

const overlay = $("overlay");
const convHint = $("convHint");
const convSub = $("convSub");

const imgOriginal = $("imgOriginal");
const imgAvif = $("imgAvif");
const metaLeft = $("metaLeft");
const metaRight = $("metaRight");

const vp1 = $("vp1");
const vp2 = $("vp2");
const cv1 = $("cv1");
const cv2 = $("cv2");

let ready = false;
let avifUrl = null;

// shared transform (both panes synced)
let scale = 1;
let tx = 0;
let ty = 0;

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

function applyTransform() {
  // canvas is centered with left/top 50%. We translate around that + scale.
  const t = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`;
  cv1.style.transform = t;
  cv2.style.transform = t;
}

function resetView() {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

function clampScale(s) {
  return Math.max(0.25, Math.min(12, s));
}

/* ===== Mobile + Desktop: Pointer pan/zoom (pinch) ===== */
const pointers = new Map(); // pointerId -> {x,y}
let isDragging = false;
let startDist = 0;
let startScale = 1;
let startTx = 0;
let startTy = 0;

function toLocal(e, el) {
  const rect = el.getBoundingClientRect();
  return {
    x: e.clientX - rect.left - rect.width / 2,
    y: e.clientY - rect.top - rect.height / 2,
  };
}
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function onPointerDown(e) {
  e.currentTarget.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, toLocal(e, e.currentTarget));

  if (pointers.size === 1) isDragging = true;

  if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    startDist = dist(p1, p2);
    startScale = scale;
    startTx = tx;
    startTy = ty;
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;

  const el = e.currentTarget;
  const prev = pointers.get(e.pointerId);
  const cur = toLocal(e, el);
  pointers.set(e.pointerId, cur);

  // one pointer: pan
  if (pointers.size === 1 && isDragging) {
    tx += (cur.x - prev.x);
    ty += (cur.y - prev.y);
    applyTransform();
    return;
  }

  // two pointers: pinch zoom around midpoint
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const m = midpoint(a, b);
    const d = dist(a, b);

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

for (const vp of [vp1, vp2]) {
  vp.addEventListener("pointerdown", onPointerDown);
  vp.addEventListener("pointermove", onPointerMove);
  vp.addEventListener("pointerup", onPointerUp);
  vp.addEventListener("pointercancel", onPointerUp);
  vp.addEventListener("wheel", onWheel, { passive: false });
  vp.addEventListener("dblclick", (e) => { e.preventDefault(); resetView(); });
}

/* ===== Image decode -> ImageData ===== */
async function fileToImageData(file) {
  // createImageBitmap: jpeg/png/webp/gif(ilk frame)/bmp vb. geniş destek
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/* ===== UI helpers ===== */
function setKpi(fromBytes, toBytes) {
  if (!fromBytes || !toBytes) {
    pctEl.textContent = "—";
    sizesEl.textContent = "—";
    return;
  }
  const smaller = pctSmaller(fromBytes, toBytes);
  // Daha çarpıcı: büyük yüzde + alt boyutlar
  pctEl.textContent = `${smaller >= 0 ? "-" : "+"}${Math.abs(smaller).toFixed(1)}%`;
  sizesEl.textContent = `${fmtKB(fromBytes)} → ${fmtKB(toBytes)}`;
}

function showConverting(file) {
  overlay.classList.add("show");
  convHint.textContent = "AVIF";
  convSub.textContent = `Çevriliyor: ${file.name} (${fmtKB(file.size)})`;
}

function hideConverting() {
  overlay.classList.remove("show");
}

function clearRight() {
  if (avifUrl) URL.revokeObjectURL(avifUrl);
  avifUrl = null;
  imgAvif.removeAttribute("src");
  setHasSrc(imgAvif, false);
  metaRight.textContent = "";
  downloadEl.textContent = "";
}

/* ===== Auto-convert on upload ===== */
let currentJobId = 0;

async function convertFileToAvif(file) {
  const jobId = ++currentJobId;

  clearRight();
  setKpi(null, null);

  // Original göster
  const origUrl = URL.createObjectURL(file);
  imgOriginal.src = origUrl;
  setHasSrc(imgOriginal, true);
  metaLeft.textContent = `(${fmtKB(file.size)})`;
  resetView();

  // dönüşüm overlay'i görünsün diye bir frame bekle
  showConverting(file);
  statusEl.textContent = "Çevirme başladı…";
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const imageData = await fileToImageData(file);

    // quality: istersen 35-55 arası oynat
    const avifBytes = await encode(imageData, { quality: 40 });

    // Eğer kullanıcı bu arada başka dosya seçtiyse sonucu basma
    if (jobId !== currentJobId) return;

    const outBlob = new Blob([avifBytes], { type: "image/avif" });
    avifUrl = URL.createObjectURL(outBlob);

    imgAvif.src = avifUrl;
    setHasSrc(imgAvif, true);
    metaRight.textContent = `(${fmtKB(outBlob.size)})`;

    setKpi(file.size, outBlob.size);

    const stem = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
    downloadEl.innerHTML = `<a href="${avifUrl}" download="${stem}.avif">AVIF’i indir</a>`;

    statusEl.textContent = "Tamamlandı. İki panel senkron zoom/pan ile karşılaştır.";
  } catch (e) {
    const msg = e?.message || String(e);
    statusEl.textContent = `Hata: ${msg}`;
  } finally {
    if (jobId === currentJobId) hideConverting();
  }
}

/* ===== Init encoder ===== */
async function boot() {
  resetView();
  clearRight();
  setHasSrc(imgOriginal, false);
  setHasSrc(imgAvif, false);

  statusEl.textContent = "AVIF motoru yükleniyor…";
  try {
    await init();
    ready = true;
    statusEl.textContent = "Hazır. Bir resim seç (otomatik çevrilecek).";
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
  const file = fileInput.files[0];
  await convertFileToAvif(file);
});

window.addEventListener("DOMContentLoaded", boot);
