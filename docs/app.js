import encode, { init } from "https://esm.sh/@jsquash/avif@2.1.1/encode?bundle";

const status = document.getElementById("status");
const kpi = document.getElementById("kpi");
const btn = document.getElementById("btn");
const fileInput = document.getElementById("file");

const imgOriginal = document.getElementById("imgOriginal");
const imgAvif = document.getElementById("imgAvif");
const download = document.getElementById("download");

const vp1 = document.getElementById("vp1");
const vp2 = document.getElementById("vp2");

let ready = false;
let avifUrl = null;

// --- pan/zoom state (shared) ---
let scale = 1;
let tx = 0;   // pixels
let ty = 0;

let isDragging = false;
let lastX = 0;
let lastY = 0;

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}
function pctSmaller(origBytes, avifBytes) {
  if (!origBytes) return 0;
  return Math.max(0, (1 - (avifBytes / origBytes)) * 100);
}

function applyTransform() {
  // center-based transform: move image center to viewport center then apply pan/zoom
  // We'll place image at (50%,50%) and then transform with translate+scale
  const t = `translate(${tx}px, ${ty}px) scale(${scale}) translate(-50%, -50%)`;
  imgOriginal.style.transform = t;
  imgAvif.style.transform = t;
}

function resetView() {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

function clampScale(s) {
  return Math.max(0.2, Math.min(8, s));
}

function wheelZoom(e) {
  e.preventDefault();

  const oldScale = scale;
  const delta = e.deltaY;
  const factor = delta > 0 ? 0.90 : 1.10;
  const newScale = clampScale(oldScale * factor);

  // Zoom around cursor position inside viewport
  const rect = e.currentTarget.getBoundingClientRect();
  const cx = e.clientX - rect.left - rect.width / 2;
  const cy = e.clientY - rect.top - rect.height / 2;

  // Adjust pan so point under cursor stays stable
  tx = cx - (cx - tx) * (newScale / oldScale);
  ty = cy - (cy - ty) * (newScale / oldScale);

  scale = newScale;
  applyTransform();
}

function startDrag(e) {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
}
function moveDrag(e) {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  tx += dx;
  ty += dy;
  applyTransform();
}
function endDrag() {
  isDragging = false;
}

async function imageFileToImageData(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
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

// ---- attach controls to both viewports ----
for (const vp of [vp1, vp2]) {
  vp.addEventListener("wheel", wheelZoom, { passive: false });
  vp.addEventListener("mousedown", startDrag);
  vp.addEventListener("mousemove", moveDrag);
  vp.addEventListener("mouseleave", endDrag);
  window.addEventListener("mouseup", endDrag);

  vp.addEventListener("dblclick", (e) => {
    e.preventDefault();
    resetView();
  });
}

// ---- file selection ----
fileInput.addEventListener("change", async () => {
  if (!fileInput.files.length) return;

  if (avifUrl) URL.revokeObjectURL(avifUrl);
  avifUrl = null;
  download.textContent = "";
  kpi.textContent = "";
  imgAvif.removeAttribute("src");

  const file = fileInput.files[0];
  imgOriginal.src = URL.createObjectURL(file);

  resetView();
  status.textContent = `Seçildi: ${file.name} (${fmtKB(file.size)})`;
});

// ---- convert ----
btn.addEventListener("click", async () => {
  if (!ready || !fileInput.files.length) return;

  const file = fileInput.files[0];
  status.textContent = "Çeviriliyor…";

  const imageData = await imageFileToImageData(file);

  // bizim profile yakın hedef: quality ≈ 40
  const avifBytes = await encode(imageData, { quality: 40 });

  const blob = new Blob([avifBytes], { type: "image/avif" });
  avifUrl = URL.createObjectURL(blob);
  imgAvif.src = avifUrl;

  const smaller = pctSmaller(file.size, blob.size);
  kpi.textContent =
    `Original: ${fmtKB(file.size)} → AVIF: ${fmtKB(blob.size)} • ${smaller.toFixed(1)}% daha küçük`;

  const stem = file.name.replace(/\.[^.]+$/, "") || "demo";
  download.innerHTML = `<a href="${avifUrl}" download="${stem}.avif">AVIF’i indir</a>`;

  status.textContent = "Tamamlandı. Zoom/pan ile iki görüntüyü birlikte karşılaştır.";
});
