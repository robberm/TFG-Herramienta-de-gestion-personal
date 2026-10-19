/**
 * Muestreo continuo del fondo para el contraste reactivo del tema translúcido.
 *
 * En lugar de que el proceso principal haga una captura cada 1,5 s (ocultando la ventana un
 * instante, lo que produce un parón), este renderer abre un flujo de vídeo de la pantalla,
 * como al compartirla. La ventana está excluida de las capturas de forma permanente
 * (setContentProtection), así que el flujo muestra lo que hay detrás de ella.
 *
 * Cada fotograma se reduce por GPU (drawImage) a una miniatura de la zona de la ventana y
 * se calcula la misma rejilla que backdropSampler.js: luminancia y color medio por celda,
 * promediando en espacio lineal. Expone la misma interfaz que electronAPI.onBackdropSample,
 * así que startBackdropContrast() funciona igual con ambos.
 */
const GRID_COLS = 32;
const GRID_ROWS = 20;
// Cada celda se calcula sobre un bloque de 4x4 píxeles de la miniatura.
const CELL_PIXELS = 4;
const CANVAS_WIDTH = GRID_COLS * CELL_PIXELS;
const CANVAS_HEIGHT = GRID_ROWS * CELL_PIXELS;
const CAPTURE_MAX_WIDTH = 640;
const CAPTURE_MAX_FPS = 10;
const FOCUSED_INTERVAL_MS = 100;
// Sin foco (p. ej. con un juego delante) basta con unas pocas lecturas por segundo.
const UNFOCUSED_INTERVAL_MS = 500;

/** sRGB (0-255) a luminancia lineal, como en WCAG. */
const SRGB_TO_LINEAR = Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
});

const linearToSrgb = (channel) => {
  const value = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
};

/** Rejilla de luminancia y color medio a partir de la miniatura RGBA del canvas. */
export function computeGridFromImageData(data, width = CANVAS_WIDTH, cols = GRID_COLS, rows = GRID_ROWS) {
  const cellWidth = width / cols;
  const cellHeight = data.length / 4 / width / rows;
  const cells = new Array(cols * rows);
  const colors = new Array(cols * rows * 3);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;

      for (let y = row * cellHeight; y < (row + 1) * cellHeight; y += 1) {
        for (let x = col * cellWidth; x < (col + 1) * cellWidth; x += 1) {
          const offset = (y * width + x) * 4;
          red += SRGB_TO_LINEAR[data[offset]];
          green += SRGB_TO_LINEAR[data[offset + 1]];
          blue += SRGB_TO_LINEAR[data[offset + 2]];
          count += 1;
        }
      }

      const cell = row * cols + col;
      red /= count;
      green /= count;
      blue /= count;
      cells[cell] = Math.round((0.2126 * red + 0.7152 * green + 0.0722 * blue) * 1000) / 1000;
      colors[cell * 3] = linearToSrgb(red);
      colors[cell * 3 + 1] = linearToSrgb(green);
      colors[cell * 3 + 2] = linearToSrgb(blue);
    }
  }

  return { cells, colors };
}

/** Zona de la ventana dentro del fotograma, en píxeles de vídeo. */
export function getRegionInVideo(info, videoWidth, videoHeight) {
  const { windowBounds: win, displayBounds: area } = info;
  const left = Math.max(win.x, area.x);
  const top = Math.max(win.y, area.y);
  const right = Math.min(win.x + win.width, area.x + area.width);
  const bottom = Math.min(win.y + win.height, area.y + area.height);
  if (right <= left || bottom <= top) return null;

  const scaleX = videoWidth / area.width;
  const scaleY = videoHeight / area.height;
  return {
    x: (left - area.x) * scaleX,
    y: (top - area.y) * scaleY,
    width: Math.max(1, (right - left) * scaleX),
    height: Math.max(1, (bottom - top) * scaleY),
  };
}

export function createContinuousBackdropSource(electronAPI) {
  const listeners = new Set();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  let info = null;
  let stream = null;
  let timer = null;
  let focused = true;
  let destroyed = false;
  let failed = false;
  let lastKey = "";
  let unsubscribeFallback = null;

  const emit = (sample) => listeners.forEach((listener) => listener(sample));

  const sample = () => {
    if (!info || !video.videoWidth || document.hidden) return;
    const region = getRegionInVideo(info, video.videoWidth, video.videoHeight);
    if (!region) return;

    context.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const { cells, colors } = computeGridFromImageData(context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data);
    const key = colors.join(",");
    if (key === lastKey) return;

    lastKey = key;
    emit({ cols: GRID_COLS, rows: GRID_ROWS, cells, colors });
  };

  const schedule = () => {
    clearInterval(timer);
    timer = setInterval(sample, focused ? FOCUSED_INTERVAL_MS : UNFOCUSED_INTERVAL_MS);
  };

  const stopStream = () => {
    clearInterval(timer);
    timer = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
  };

  // Si el flujo no se puede abrir, la ventana vuelve al muestreo por capturas del proceso
  // principal y se reenvían sus muestras: el contraste reactivo sigue funcionando.
  const fallBackToSnapshots = () => {
    if (failed || destroyed) return;
    failed = true;
    stopStream();
    electronAPI.reportContinuousBackdropFailure?.();
    unsubscribeFallback = electronAPI.onBackdropSample?.(emit) || null;
  };

  const startStream = async () => {
    if (destroyed || failed || stream) return;
    try {
      info = await electronAPI.getBackdropCaptureInfo();
      if (destroyed) return;
      if (!info?.sourceId) {
        fallBackToSnapshots();
        return;
      }

      focused = info.focused !== false;
      const aspect = info.displayBounds.height / info.displayBounds.width;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: info.sourceId,
            maxWidth: CAPTURE_MAX_WIDTH,
            maxHeight: Math.round(CAPTURE_MAX_WIDTH * aspect),
            maxFrameRate: CAPTURE_MAX_FPS,
          },
        },
      });
      if (destroyed) {
        stopStream();
        return;
      }

      video.srcObject = stream;
      await video.play();
      lastKey = "";
      schedule();
    } catch (_error) {
      fallBackToSnapshots();
    }
  };

  const unsubscribeWindow = electronAPI.onBackdropWindowChange?.((nextInfo) => {
    if (!nextInfo) return;
    const displayChanged = info && nextInfo.sourceId !== info.sourceId;
    info = nextInfo;
    lastKey = "";
    if (displayChanged) {
      // La ventana ha pasado a otra pantalla: hay que capturar esa.
      stopStream();
      startStream();
    }
  });

  const unsubscribeFocus = electronAPI.onBackdropFocusChange?.((isFocused) => {
    focused = isFocused;
    if (stream) schedule();
  });

  // Minimizada u oculta no tiene sentido mantener la captura abierta.
  const handleVisibility = () => {
    if (document.hidden) stopStream();
    else startStream();
  };
  document.addEventListener("visibilitychange", handleVisibility);

  startStream();

  return {
    onBackdropSample(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      destroyed = true;
      stopStream();
      unsubscribeWindow?.();
      unsubscribeFocus?.();
      unsubscribeFallback?.();
      document.removeEventListener("visibilitychange", handleVisibility);
      listeners.clear();
    },
  };
}
