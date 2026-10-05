const { desktopCapturer, screen } = require("electron");

/**
 * Muestreo de lo que hay detrás de la ventana transparente para el contraste reactivo.
 *
 * Una página web no puede leer el escritorio que tiene debajo, así que el proceso principal
 * captura la pantalla a baja resolución y calcula la luminancia de una rejilla de celdas
 * sobre la zona que ocupa la ventana. Para que la captura muestre lo que hay *detrás* y no
 * la propia app, la ventana se excluye un instante de la captura (setContentProtection usa
 * WDA_EXCLUDEFROMCAPTURE en Windows 10 2004+).
 */
const GRID_COLS = 16;
const GRID_ROWS = 10;
const SAMPLE_INTERVAL_MS = 1500;
// Sin foco (p. ej. con un juego delante) se muestrea mucho menos: cada captura cuesta ~300 ms.
const UNFOCUSED_SAMPLE_INTERVAL_MS = 5000;
const BOUNDS_CHANGE_DEBOUNCE_MS = 180;
// Margen para que DWM recomponga sin la ventana antes de capturar.
const EXCLUDE_SETTLE_MS = 60;
const THUMBNAIL_MAX_WIDTH = 640;
const PIXEL_STEP = 2;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** sRGB (0-255) a luminancia lineal, como en WCAG. */
const SRGB_TO_LINEAR = Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});

/**
 * Calcula la luminancia media de cada celda de la rejilla dentro de `region`.
 * El bitmap de NativeImage en Windows viene en orden BGRA.
 */
function computeLuminanceGrid(bitmap, imageWidth, region, cols = GRID_COLS, rows = GRID_ROWS) {
  const cells = new Array(cols * rows).fill(0);
  const counts = new Array(cols * rows).fill(0);

  for (let y = region.y; y < region.y + region.height; y += PIXEL_STEP) {
    const row = Math.min(rows - 1, Math.floor(((y - region.y) / region.height) * rows));

    for (let x = region.x; x < region.x + region.width; x += PIXEL_STEP) {
      const col = Math.min(cols - 1, Math.floor(((x - region.x) / region.width) * cols));
      const offset = (y * imageWidth + x) * 4;
      const luminance =
        0.0722 * SRGB_TO_LINEAR[bitmap[offset]] +
        0.7152 * SRGB_TO_LINEAR[bitmap[offset + 1]] +
        0.2126 * SRGB_TO_LINEAR[bitmap[offset + 2]];

      cells[row * cols + col] += luminance;
      counts[row * cols + col] += 1;
    }
  }

  return cells.map((total, index) =>
    counts[index] ? Math.round((total / counts[index]) * 1000) / 1000 : 0,
  );
}

function getThumbnailSize(display) {
  const { width, height } = display.size;
  const scale = Math.min(1, THUMBNAIL_MAX_WIDTH / width);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Parte de la ventana visible en la pantalla, en píxeles de la miniatura. */
function getRegionInThumbnail(windowBounds, display, imageSize) {
  const area = display.bounds;
  const left = Math.max(windowBounds.x, area.x);
  const top = Math.max(windowBounds.y, area.y);
  const right = Math.min(windowBounds.x + windowBounds.width, area.x + area.width);
  const bottom = Math.min(windowBounds.y + windowBounds.height, area.y + area.height);

  if (right <= left || bottom <= top) return null;

  const scaleX = imageSize.width / area.width;
  const scaleY = imageSize.height / area.height;
  const x = Math.floor((left - area.x) * scaleX);
  const y = Math.floor((top - area.y) * scaleY);

  return {
    x,
    y,
    width: Math.max(1, Math.min(imageSize.width - x, Math.round((right - left) * scaleX))),
    height: Math.max(1, Math.min(imageSize.height - y, Math.round((bottom - top) * scaleY))),
  };
}

function createBackdropSampler(win) {
  let timer = null;
  let debounceTimer = null;
  let sampling = false;
  let enabled = true;
  let lastPayloadKey = "";
  let lastSampleAt = 0;

  const canSample = () =>
    enabled && !win.isDestroyed() && win.isVisible() && !win.isMinimized();

  const sample = async () => {
    if (sampling || !canSample()) return;
    sampling = true;
    lastSampleAt = Date.now();

    try {
      const bounds = win.getBounds();
      const display = screen.getDisplayMatching(bounds);
      const thumbnailSize = getThumbnailSize(display);

      win.setContentProtection(true);
      await delay(EXCLUDE_SETTLE_MS);

      let sources;
      try {
        sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize });
      } finally {
        if (!win.isDestroyed()) win.setContentProtection(false);
      }

      const source =
        sources.find((item) => item.display_id === String(display.id)) ||
        (sources.length === 1 ? sources[0] : null);
      if (!source || source.thumbnail.isEmpty() || win.isDestroyed()) return;

      const imageSize = source.thumbnail.getSize();
      const region = getRegionInThumbnail(bounds, display, imageSize);
      if (!region) return;

      const cells = computeLuminanceGrid(source.thumbnail.toBitmap(), imageSize.width, region);
      const payloadKey = cells.join(",");
      if (payloadKey === lastPayloadKey) return;

      lastPayloadKey = payloadKey;
      win.webContents.send("backdrop:sample", { cols: GRID_COLS, rows: GRID_ROWS, cells });
    } catch (_error) {
      // Si la captura falla (permisos, pantalla bloqueada...) se mantiene el último contraste.
    } finally {
      sampling = false;
    }
  };

  const tick = () => {
    if (win.isDestroyed()) return;
    const interval = win.isFocused() ? SAMPLE_INTERVAL_MS : UNFOCUSED_SAMPLE_INTERVAL_MS;
    if (Date.now() - lastSampleAt >= interval - 50) sample();
  };

  const scheduleSoon = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(sample, BOUNDS_CHANGE_DEBOUNCE_MS);
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(tick, SAMPLE_INTERVAL_MS);
    win.on("moved", scheduleSoon);
    win.on("resized", scheduleSoon);
    win.on("focus", scheduleSoon);
    win.on("restore", scheduleSoon);
    win.webContents.on("did-finish-load", scheduleSoon);
  };

  const stop = () => {
    clearInterval(timer);
    clearTimeout(debounceTimer);
    timer = null;
    if (win.isDestroyed()) return;
    win.removeListener("moved", scheduleSoon);
    win.removeListener("resized", scheduleSoon);
    win.removeListener("focus", scheduleSoon);
    win.removeListener("restore", scheduleSoon);
    win.webContents.removeListener("did-finish-load", scheduleSoon);
  };

  const setEnabled = (nextEnabled) => {
    enabled = !!nextEnabled;
    lastPayloadKey = "";
    if (enabled) scheduleSoon();
  };

  win.once("closed", stop);

  return { start, stop, setEnabled, sampleNow: scheduleSoon };
}

module.exports = { createBackdropSampler, computeLuminanceGrid, getRegionInThumbnail };
