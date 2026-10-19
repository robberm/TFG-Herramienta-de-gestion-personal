/**
 * Velo de color del tema translúcido.
 *
 * En vez de un velo gris, se pinta detrás de la interfaz el mismo gradiente de colores que
 * hay detrás de la ventana, conservando tono y saturación (OKLCH) y moviendo solo la
 * claridad hasta donde haga falta para que el texto de cada zona se lea. Donde el fondo ya
 * contrasta, el velo es totalmente transparente. Es un canvas diminuto (una celda = un
 * píxel) que la GPU escala y desenfoca.
 */

// Claridad OKLab del velo y claridad que debe alcanzar la mezcla para cada tono de texto.
const DARK_VEIL_LIGHTNESS = 0.26;
const DARK_TARGET_LIGHTNESS = 0.46;
const LIGHT_VEIL_LIGHTNESS = 0.95;
const LIGHT_TARGET_LIGHTNESS = 0.8;
const MAX_VEIL_ALPHA = 0.85;
// Un pelo más de croma: al oscurecer o aclarar el color tiende a apagarse.
const CHROMA_BOOST = 1.12;
const EDGE_PADDING_CELLS = 2;
const TRANSITION_MS = 450;

const srgbToLinear = (value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (channel) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

function rgbToOklab(red, green, blue) {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab a sRGB lineal (sin recortar, para poder comprobar si cae dentro de gama). */
function oklabToLinear(lightness, a, b) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const isInGamut = (channels) => channels.every((channel) => channel >= -0.0001 && channel <= 1.0001);

/** Misma tonalidad y la mayor saturación que quepa en sRGB a la claridad pedida. */
function colorAtLightness(lab, lightness) {
  const [, a, b] = lab;
  let low = 0;
  let high = CHROMA_BOOST;

  if (!isInGamut(oklabToLinear(lightness, a * high, b * high))) {
    for (let step = 0; step < 8; step += 1) {
      const mid = (low + high) / 2;
      if (isInGamut(oklabToLinear(lightness, a * mid, b * mid))) low = mid;
      else high = mid;
    }
    high = low;
  }

  return oklabToLinear(lightness, a * high, b * high).map((channel) =>
    Math.round(Math.min(1, Math.max(0, linearToSrgb(channel))) * 255),
  );
}

/** Color y opacidad del velo para una celda según el tono de texto de su zona. */
export function computeVeil(red, green, blue, tone) {
  const lab = rgbToOklab(red, green, blue);
  const lightness = lab[0];
  const isDark = tone !== "light";
  const veilLightness = isDark ? DARK_VEIL_LIGHTNESS : LIGHT_VEIL_LIGHTNESS;
  const targetLightness = isDark ? DARK_TARGET_LIGHTNESS : LIGHT_TARGET_LIGHTNESS;

  // Opacidad mínima para que la mezcla fondo/velo llegue a la claridad objetivo.
  const needed = isDark
    ? (lightness - targetLightness) / Math.max(0.001, lightness - veilLightness)
    : (targetLightness - lightness) / Math.max(0.001, veilLightness - lightness);
  const alpha = Math.min(MAX_VEIL_ALPHA, Math.max(0, needed));

  return [...colorAtLightness(lab, veilLightness), alpha];
}

const easeOutCubic = (progress) => 1 - (1 - progress) ** 3;

export function createBackdropTintLayer() {
  const canvas = document.createElement("canvas");
  canvas.className = "backdropTint";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const context = canvas.getContext("2d");
  let current = null;
  let from = null;
  let target = null;
  let gridSize = null;
  let animationStart = 0;
  let frame = 0;

  const draw = (values) => {
    const { cols, rows } = gridSize;
    const width = cols + EDGE_PADDING_CELLS * 2;
    const height = rows + EDGE_PADDING_CELLS * 2;
    const image = context.createImageData(width, height);

    // El borde repite las celdas extremas para que el desenfoque no aclare los bordes.
    for (let y = 0; y < height; y += 1) {
      const row = Math.min(rows - 1, Math.max(0, y - EDGE_PADDING_CELLS));
      for (let x = 0; x < width; x += 1) {
        const col = Math.min(cols - 1, Math.max(0, x - EDGE_PADDING_CELLS));
        const source = (row * cols + col) * 4;
        const offset = (y * width + x) * 4;
        image.data[offset] = values[source];
        image.data[offset + 1] = values[source + 1];
        image.data[offset + 2] = values[source + 2];
        image.data[offset + 3] = Math.round(values[source + 3] * 255);
      }
    }

    context.putImageData(image, 0, 0);
  };

  const animate = (now) => {
    const progress = Math.min(1, (now - animationStart) / TRANSITION_MS);
    const eased = easeOutCubic(progress);
    current = target.map((value, index) => from[index] + (value - from[index]) * eased);
    draw(current);
    frame = progress < 1 ? requestAnimationFrame(animate) : 0;
  };

  /** `toneForCell(index)` devuelve "light" o "dark" según la zona que cubre esa celda. */
  const update = (sample, toneForCell) => {
    const { cols, rows, colors } = sample;
    if (!colors?.length) return;

    if (!gridSize || gridSize.cols !== cols || gridSize.rows !== rows) {
      gridSize = { cols, rows };
      current = null;
      canvas.width = cols + EDGE_PADDING_CELLS * 2;
      canvas.height = rows + EDGE_PADDING_CELLS * 2;
      canvas.style.setProperty("--tint-cols", cols);
      canvas.style.setProperty("--tint-rows", rows);
      canvas.style.setProperty("--tint-padding", EDGE_PADDING_CELLS);
    }

    const next = new Array(cols * rows * 4);
    for (let cell = 0; cell < cols * rows; cell += 1) {
      const veil = computeVeil(
        colors[cell * 3],
        colors[cell * 3 + 1],
        colors[cell * 3 + 2],
        toneForCell(cell),
      );
      next[cell * 4] = veil[0];
      next[cell * 4 + 1] = veil[1];
      next[cell * 4 + 2] = veil[2];
      next[cell * 4 + 3] = veil[3];
    }

    target = next;
    from = current || next;
    animationStart = performance.now();
    if (!frame) frame = requestAnimationFrame(animate);
  };

  const destroy = () => {
    if (frame) cancelAnimationFrame(frame);
    canvas.remove();
  };

  return { update, destroy };
}
