/**
 * Contraste reactivo del tema translúcido.
 *
 * El proceso principal envía una rejilla con la luminancia de lo que hay detrás de la
 * ventana. Aquí se calcula la luminancia bajo cada zona de la interfaz y se marca con
 * data-backdrop="light|dark" y --backdrop-luma, que theme.css usa para elegir texto y
 * velos con contraste suficiente.
 */
const ZONE_SELECTORS = [".windowTitleBar", ".sideBar", ".mainContent", "[data-backdrop-zone]"];

// Umbrales sobre luminancia relativa (WCAG). El texto blanco y el negro empatan en contraste
// hacia 0.18; la histéresis evita parpadeos cuando el fondo ronda ese valor.
const LIGHT_ENTER = 0.3;
const LIGHT_EXIT = 0.2;

/** Mezcla media y percentil alto: una zona con manchas claras también necesita texto oscuro. */
function scoreCells(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const highPercentile = sorted[Math.floor((sorted.length - 1) * 0.8)];
  return mean * 0.6 + highPercentile * 0.4;
}

function getCellsForRect(sample, rect) {
  const { cols, rows, cells } = sample;
  const viewportWidth = window.innerWidth || 1;
  const viewportHeight = window.innerHeight || 1;
  const values = [];

  for (let row = 0; row < rows; row += 1) {
    const centerY = ((row + 0.5) / rows) * viewportHeight;
    if (centerY < rect.top || centerY > rect.bottom) continue;

    for (let col = 0; col < cols; col += 1) {
      const centerX = ((col + 0.5) / cols) * viewportWidth;
      if (centerX >= rect.left && centerX <= rect.right) {
        values.push(cells[row * cols + col]);
      }
    }
  }

  // Zonas más pequeñas que una celda: se usa la celda que cae en su centro.
  if (!values.length) {
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((rect.left + rect.width / 2) / viewportWidth) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((rect.top + rect.height / 2) / viewportHeight) * rows)));
    values.push(cells[row * cols + col]);
  }

  return values;
}

function applyTone(element, luma) {
  const wasLight = element.dataset.backdrop === "light";
  const isLight = wasLight ? luma > LIGHT_EXIT : luma >= LIGHT_ENTER;
  element.dataset.backdrop = isLight ? "light" : "dark";
  element.style.setProperty("--backdrop-luma", luma.toFixed(3));
}

export function startBackdropContrast(electronAPI) {
  const touched = new Set();
  let lastSample = null;
  let frame = 0;

  const apply = () => {
    frame = 0;
    if (!lastSample) return;

    const bodyLuma = scoreCells(lastSample.cells);
    if (bodyLuma !== null) {
      applyTone(document.body, bodyLuma);
      touched.add(document.body);
    }

    document.querySelectorAll(ZONE_SELECTORS.join(",")).forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const luma = scoreCells(getCellsForRect(lastSample, rect));
      if (luma === null) return;
      applyTone(element, luma);
      touched.add(element);
    });
  };

  const scheduleApply = () => {
    if (!frame) frame = requestAnimationFrame(apply);
  };

  const unsubscribe = electronAPI.onBackdropSample((sample) => {
    if (!sample?.cells?.length) return;
    lastSample = sample;
    scheduleApply();
  });

  // El proceso principal solo reenvía cambios del fondo: si la interfaz cambia (login,
  // navegación, panel nuevo) se recalcula con la última muestra.
  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", scheduleApply);

  return () => {
    unsubscribe();
    observer.disconnect();
    window.removeEventListener("resize", scheduleApply);
    if (frame) cancelAnimationFrame(frame);
    touched.forEach((element) => {
      delete element.dataset.backdrop;
      element.style.removeProperty("--backdrop-luma");
    });
  };
}
