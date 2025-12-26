/* ==========
   Helpers
========== */
const $ = (id) => document.getElementById(id);

const fileInput = $("file");
const btnConvert = $("convert");
const btnReset = $("reset");
const btnZoomIn = $("zoomIn");
const btnZoomOut = $("zoomOut");

const statusEl = $("status");
const kpiEl = $("kpi");
const pctEl = $("pct");
const sizesEl = $("sizes");
const kpiHintEl = $("kpiHint");

const metaLeft = $("metaLeft");
const metaRight = $("metaRight");
const downloadEl = $("download");

const vp1 = $("vp1");
const vp2 = $("vp2");
const cv1 = $("cv1");
const cv2 = $("cv2");

const imgOriginal = $("imgOriginal");
const imgAvif = $("imgAvif");

let avifUrl = null;

// shared transform state (both panes same)
let scale = 1;
let tx = 0;
let ty = 0;

function fmtKB(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
function pctSmaller(fromBytes, toBytes) {
  if (!fromBytes || !toBytes) return 0;
  return (1 - (toBytes / fromBytes)) * 100;
}
function clampScale(s) {
  return Math.max(0.25, Math.min(12, s));
}
function setHasSrc(imgEl, yes) {
  imgEl.classList.toggle("has-src", !!yes);
}
function clearImagesUI() {
  imgOriginal.removeAttribute("src");
  imgAvif.removeAttribute("src");
  setHasSrc(imgOriginal, false);
  setHasSrc(imgAvif, false);
  metaLeft.textContent = "";
  metaRight.textContent = "";
}

function setKpi(fromBytes, toBytes, note = "") {
  if (!fromBytes || !toBytes) {
    pctEl.textContent = "—";
    sizesEl.textContent = "—";
    kpiHintEl.textContent = note || "";
    return;
  }
  const smaller = pctSmaller(fromBytes, toBytes);
  pctEl.textContent = `${smaller >= 0 ? "-" : "+"}${Math.abs(smaller).toFixed(1)}%`;
  sizesEl.textContent = `${fmtKB(fromBytes)} → ${fmtKB(toBytes)}`;
  kpiHintEl.textContent = note || "";
}

function applyTransform() {
  // we keep a "canvas" centered at 50%/50% and then apply translate+scale
  // translate is in viewport-local pixels.
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

function nudgeZoom(delta) {
  const prev = scale;
  scale = clampScale(scale * delta);
  // keep center stable-ish
  tx *= scale / prev;
  ty *= scale / prev;
  applyTransform();
}

/* ==========
   Pointer pan/zoom (mobile + desktop)
========== */
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

  if (pointers.size === 1) {
    isDragging = true;
  }
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

    // adjust translate so midpoint stays anchored
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

// Bind events to both viewports (same transform)
for (const vp of [vp1, vp2]) {
  vp.addEventListener("pointerdown", onPointerDown);
  vp.addEventListener("pointermove", onPointerMove);
  vp.addEventListener("pointerup", onPointerUp);
  vp.addEventListener("pointercancel", onPointerUp);
  vp.addEventListener("wheel", onWheel, { passive: false });
  vp.addEventListener("dblclick", (e) => { e.preventDefault(); resetView(); });
}

/* ==========
   Demo auto-load (no conversion)
   Requires: demo.jpg and demo.avif in same folder
========== */
async function loadDemo() {
  clearImagesUI();
  resetView();
  downloadEl.textContent = "";
  statusEl.textContent = "Demo yükleniyor…";

  try {
    // fetch blobs to compute sizes + create object URLs
    const [jpgRes, avifRes] = await Promise.all([
      fetch("./demo.jpg", { cache: "no-store" }),
      fetch("./demo.avif", { cache: "no-store" }),
    ]);

    if (!jpgRes.ok || !avifRes.ok) {
      statusEl.textContent = "Demo dosyaları bulunamadı. demo.jpg ve demo.avif aynı klasörde olmalı.";
      setKpi(null, null, "");
      return;
    }

    const [jpgBlob, avifBlob] = await Promise.all([jpgRes.blob(), avifRes.blob()]);
    const jpgUrl = URL.createObjectURL(jpgBlob);
    const avifObjUrl = URL.createObjectURL(avifBlob);

    // keep reference to revoke later
    if (avifUrl) URL.revokeObjectURL(avifUrl);
    avifUrl = avifObjUrl;

    imgOriginal.src = jpgUrl;
    imgAvif.src = avifObjUrl;
    setHasSrc(imgOriginal, true);
    setHasSrc(imgAvif, true);

    metaLeft.textContent = `(${fmtKB(jpgBlob.size)})`;
    metaRight.textContent = `(${fmtKB(avifBlob.size)})`;

    setKpi(jpgBlob.size, avifBlob.size, "Demo (dönüşüm yok)");
    statusEl.textContent = "Demo hazır. Mobilde pinch-zoom + pan ile karşılaştır.";

    downloadEl.innerHTML = `<a class="btn secondary" href="${avifObjUrl}" download="demo.avif" style="text-decoration:none; display:inline-block;">AVIF’i indir</a>`;
  } catch (err) {
    statusEl.textContent = "Demo yüklenirken hata oluştu.";
    setKpi(null, null, "");
  }
}

/* ==========
   Optional: Convert selected file to AVIF (your existing pipeline)
   NOTE: If you already have WASM encoder code, keep it here.
   I’m leaving hooks so mevcut encode() fonksiyonunu takabilirsin.
========== */

// If you already have these in your current app.js, keep them:
// - fileToImageData(file)
// - encode(imageData, {quality})
// Aşağıda “placeholder” değil: var olanını kullan diye kontrol ediyor.

async function fileToImageData(file) {
  // Safe generic loader (works for jpg/png/webp etc.)
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// You MUST provide your own encoder (WASM or lib) as encode().
// If your previous code had it, paste it above and remove this guard.
async function encodeGuard(imageData, opts) {
  if (typeof encode === "function") {
    return await encode(imageData, opts);
  }
  throw new Error("encode() bulunamadı. Mevcut WASM AVIF encoder fonksiyonunu bu dosyaya eklemelisin.");
}

fileInput.addEventListener("change", async () => {
  if (!fileInput.files?.length) return;

  // clear right pane until conversion is done
  if (avifUrl) URL.revokeObjectURL(avifUrl);
  avifUrl = null;

  downloadEl.textContent = "";
  statusEl.textContent = "";
  setKpi(null, null, "");

  imgAvif.removeAttribute("src");
  setHasSrc(imgAvif, false);
  metaRight.textContent = "";

  const file = fileInput.files[0];
  const obj = URL.createObjectURL(file);

  imgOriginal.src = obj;
  setHasSrc(imgOriginal, true);
  metaLeft.textContent = `(${fmtKB(file.size)})`;

  resetView();
  statusEl.textContent = `Seçildi: ${file.name} (${fmtKB(file.size)}). Sağ tarafta demo.avif kaldıysa yenilemek için Sıfırla veya çevir.`;

  // not revoking obj yet, because img uses it. Revoke on next change if you want.
});

btnConvert.addEventListener("click", async () => {
  if (!fileInput.files?.length) {
    statusEl.textContent = "Önce bir resim seç.";
    return;
  }

  const file = fileInput.files[0];
  statusEl.textContent = "AVIF’e çevriliyor… (tarayıcı içinde)";
  btnConvert.disabled = true;

  try {
    const imageData = await fileToImageData(file);

    // quality: tweak as desired
    const avifBytes = await encodeGuard(imageData, { quality: 40 });

    const outBlob = new Blob([avifBytes], { type: "image/avif" });
    const url = URL.createObjectURL(outBlob);

    if (avifUrl) URL.revokeObjectURL(avifUrl);
    avifUrl = url;

    imgAvif.src = url;
    setHasSrc(imgAvif, true);

    metaRight.textContent = `(${fmtKB(outBlob.size)})`;

    setKpi(file.size, outBlob.size, "Seçili dosyadan üretildi");
    downloadEl.innerHTML = `<a class="btn secondary" href="${url}" download="${file.name.replace(/\.[^.]+$/, "")}.avif" style="text-decoration:none; display:inline-block;">AVIF’i indir</a>`;
    statusEl.textContent = "Bitti. Zoom/pan ile karşılaştır.";
  } catch (err) {
    statusEl.textContent = (err && err.message) ? err.message : "Dönüşümde hata oluştu.";
  } finally {
    btnConvert.disabled = false;
  }
});

btnReset.addEventListener("click", () => {
  resetView();
  statusEl.textContent = "Görünüm sıfırlandı.";
});

btnZoomIn.addEventListener("click", () => nudgeZoom(1.15));
btnZoomOut.addEventListener("click", () => nudgeZoom(0.87));

/* Boot */
window.addEventListener("DOMContentLoaded", () => {
  resetView();
  loadDemo();
});
