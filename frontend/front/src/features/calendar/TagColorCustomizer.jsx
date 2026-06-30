import React, { useEffect, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { useLanguage } from "../../context/languageContext";

const STORAGE_KEY = "calendar.tag-colors.v1";
const COLLAPSED_KEY = "calendar.tag-colors.collapsed";

// Object.freeze hace el array inmutable (no añadir ni quitar elementos)
const TAG_COLOR_CONFIG = Object.freeze([
  { key: "FOCUS", cssVar: "--event-focus-color", defaultColor: "#7c3aed" },
  { key: "MANDATORY", cssVar: "--event-mandatory-color", defaultColor: "#e74c3c" },
  { key: "WORK", cssVar: "--event-work-color", defaultColor: "#0ea5a4" },
  { key: "STUDY", cssVar: "--event-study-color", defaultColor: "#f39c12" },
  { key: "PERSONAL", cssVar: "--event-personal-color", defaultColor: "#2ecc71" },
  { key: "HEALTH", cssVar: "--event-health-color", defaultColor: "#9b59b6" },
]);

/**
 * Regex Validator de color hexadecimal. 
 */
const isValidHexColor = (value) =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || "").trim());

/**
 * Obtiene el color base de cada variable CSS desde el tema actual.
 *
 * @returns {Record<string, string>} mapa cssVar -> color
 */
const getThemeBaseColors = () => {
  const fallback = TAG_COLOR_CONFIG.reduce((acc, item) => {
    acc[item.cssVar] = item.defaultColor;
    return acc;
  }, {});

  if (typeof window === "undefined") return fallback;

  const computed = window.getComputedStyle(document.documentElement);

  return TAG_COLOR_CONFIG.reduce((acc, item) => {
    const raw = computed.getPropertyValue(item.cssVar).trim();
    acc[item.cssVar] = isValidHexColor(raw) ? raw : item.defaultColor;
    return acc;
  }, {});
};

/**
 * Aplica los colores sobre las variables CSS del elemento que los carga.
 */
const applyColorsToRoot = (colors) => {
  if (typeof window === "undefined") return;

  const rootStyle = document.documentElement.style;
  Object.entries(colors).forEach(([cssVar, color]) => {
    if (isValidHexColor(color)) {
      rootStyle.setProperty(cssVar, color);
    }
  });
};

/**
 * Lee colores guardados en localStorage y devuelve solo entradas válidas.
 *
 * @returns {Record<string, string>} mapa cssVar -> color persistido
 */
const readStoredColors = () => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce((acc, [cssVar, color]) => {
      if (isValidHexColor(color)) {
        acc[cssVar] = color;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

/**
 * Guarda colores de tags del calendario para reutilizarlos en próximas sesiones.
 *
 * @param {Record<string, string>} colors mapa cssVar -> color
 * @returns {void}
 */
const persistColors = (colors) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
};

/**
 * Panel simple para personalizar colores de categorías del calendario.
 * Se muestra debajo del calendario y actualiza variables CSS en tiempo real.
 *
 * @returns {JSX.Element}
 */
const TagColorCustomizer = () => {
  const { t } = useLanguage();
  const baseColors = useMemo(() => getThemeBaseColors(), []);
  const [colors, setColors] = useState(baseColors);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [activeCss, setActiveCss] = useState(null);

  useEffect(() => {
    const stored = readStoredColors();
    const merged = { ...baseColors, ...stored };
    setColors(merged);
    applyColorsToRoot(merged);
  }, [baseColors]);

  /**
   * Actualiza un color concreto de categoría y lo persiste.
   *
   * @param {string} cssVar variable CSS a modificar
   * @param {string} color nuevo color hexadecimal
   * @returns {void}
   */
  const handleChangeColor = (cssVar, color) => {
    const normalized = String(color || "").trim();
    if (!isValidHexColor(normalized)) return;

    const next = {
      ...colors,
      [cssVar]: normalized,
    };

    setColors(next);
    applyColorsToRoot(next);
    persistColors(next);
  };

  /**
   * Restaura colores por defecto del tema y borra persistencia local.
   *
   * @returns {void}
   */
  const handleReset = () => {
    // Recompute base colors from the current theme to ensure we reset to
    // the canonical theme values (in case variables were edited).
    const fresh = getThemeBaseColors();
    setColors(fresh);
    applyColorsToRoot(fresh);
    setActiveCss(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      }
    } catch {
      // ignore
    }
  };

  const activeTag = TAG_COLOR_CONFIG.find((item) => item.cssVar === activeCss) || null;
  const specialText =
    activeTag?.key === "FOCUS"
      ? t.calendarTagFocusDescription
      : activeTag?.key === "MANDATORY"
        ? t.calendarTagMandatoryDescription
        : "";

  return (
    <section className="calendar-tag-color-module" aria-label="Tag color settings">
      <div className="calendar-tag-color-module-header">
        <h4>{t.calendarTagColors}</h4>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" onClick={handleReset}>
            {t.calendarTagReset}
          </button>
          <button type="button" onClick={toggleCollapsed} aria-pressed={collapsed}>
            <i className={`fa fa-chevron-down userFlecha ${!collapsed ? "open" : ""}`} />
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="calendar-tag-color-grid">
            {TAG_COLOR_CONFIG.map((item) => (
              <button
                key={item.cssVar}
                type="button"
                className={`calendar-tag-color-item ${
                  item.key === "FOCUS" || item.key === "MANDATORY" ? "special" : ""
                } ${activeCss === item.cssVar ? "active" : ""}`}
                onClick={() => setActiveCss(activeCss === item.cssVar ? null : item.cssVar)}
                title={`Editar color ${item.key}`}
              >
                <span>{item.key}</span>
                <div
                  className="calendar-tag-swatch"
                  style={{ background: colors[item.cssVar] || item.defaultColor }}
                />
              </button>
            ))}
          </div>

          <div className={`calendar-tag-color-pickerWrap ${activeCss ? "open" : ""}`}>
            {activeCss && (
              <>
                <div className="calendar-tag-color-picker">
                  <HexColorPicker
                    color={colors[activeCss] || "#ffffff"}
                    onChange={(next) => handleChangeColor(activeCss, next)}
                  />
                  <div className="calendar-tag-color-hexRow">
                    <input
                      type="text"
                      value={colors[activeCss] || ""}
                      onChange={(e) => handleChangeColor(activeCss, e.target.value)}
                    />
                  </div>
                </div>

                {specialText && (
                  <aside className="calendar-tag-color-note" aria-live="polite">
                    <strong>{activeTag.key}</strong>
                    <p>{specialText}</p>
                  </aside>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default TagColorCustomizer;
