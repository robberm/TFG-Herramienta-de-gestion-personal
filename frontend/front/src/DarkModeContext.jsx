import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { startBackdropContrast } from "./theme/backdropContrast";
import { createContinuousBackdropSource } from "./theme/continuousBackdropSource";

const DarkModeContext = createContext();

const THEMES = ["light", "dark", "truedark", "translucent", "acrylic", "custom"];
// Acrylic reutiliza los estilos de componentes del tema translúcido y solo cambia tokens.
const THEME_BASE_CLASSES = {
  acrylic: ["translucent"],
};
// Modo de ventana que pide cada tema al proceso principal de Electron.
const THEME_WINDOW_MODES = {
  translucent: "transparent",
  acrylic: "acrylic",
};

const getWindowModeForTheme = (theme) => THEME_WINDOW_MODES[theme] || "opaque";
// Temas que necesitan aceleración por hardware (ventana con transparencia real).
export const GPU_THEMES = Object.keys(THEME_WINDOW_MODES);
// Tema al que se vuelve si la aceleración está desactivada.
const NO_GPU_FALLBACK_THEME = "dark";

const DEFAULT_GRAPHICS_STATE = {
  loaded: false,
  hardwareAcceleration: true,
  hardwareAccelerationActive: true,
  continuousBackdrop: false,
  restartRequired: false,
};
const THEME_STORAGE_KEY = "appTheme";
const CUSTOM_COLOR_STORAGE_KEY = "customThemeColor";
const DEFAULT_CUSTOM_COLOR = "#6c63ff";
const REACTIVE_CONTRAST_STORAGE_KEY = "reactiveContrast";

const isValidTheme = (theme) => THEMES.includes(theme);
const isValidHexColor = (color) => /^#[0-9a-f]{6}$/i.test(color || "");

const getStoredTheme = () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (isValidTheme(storedTheme)) return storedTheme;

  const translucentMode = localStorage.getItem("translucentMode") === "true";
  const darkMode = localStorage.getItem("darkMode") === "true";

  if (translucentMode) return "translucent";
  if (darkMode) return "dark";
  return "light";
};

const getStoredCustomColor = () => {
  const storedColor = localStorage.getItem(CUSTOM_COLOR_STORAGE_KEY);
  return isValidHexColor(storedColor) ? storedColor : DEFAULT_CUSTOM_COLOR;
};

const getStoredReactiveContrast = () =>
  localStorage.getItem(REACTIVE_CONTRAST_STORAGE_KEY) !== "false";

const applyThemeToBody = (theme, customColor) => {
  document.body.classList.remove(...THEMES);
  document.body.classList.add(...(THEME_BASE_CLASSES[theme] || []), theme);
  document.body.style.setProperty("--custom-theme-color", customColor);
};

const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

const getCurrentRoute = () => {
  if (isElectronEnvironment) {
    return window.location.hash.replace(/^#/, "") || "/";
  }

  return `${window.location.pathname}${window.location.search}`;
};

export const DarkModeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getStoredTheme);
  const [customThemeColor, setCustomThemeColorState] = useState(getStoredCustomColor);
  const [reactiveContrast, setReactiveContrast] = useState(getStoredReactiveContrast);
  const [graphics, setGraphics] = useState(DEFAULT_GRAPHICS_STATE);

  // Ajustes gráficos del proceso principal (%APPDATA%/GMO/graphics.json).
  useEffect(() => {
    let cancelled = false;
    window.electronAPI?.graphics
      ?.get()
      .then((state) => {
        if (!cancelled && state) setGraphics({ ...state, loaded: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeToBody(theme, customThemeColor);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(CUSTOM_COLOR_STORAGE_KEY, customThemeColor);
    localStorage.setItem("darkMode", String(theme === "dark" || theme === "truedark"));
    localStorage.setItem("translucentMode", String(theme === "translucent"));
  }, [customThemeColor, theme]);

  useEffect(() => {
    if (window.electronAPI?.setWindowTransparencyMode) {
      const mode = getWindowModeForTheme(theme);
      window.electronAPI.setWindowTransparencyMode({
        transparent: mode !== "opaque",
        mode,
        route: getCurrentRoute(),
      });
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(REACTIVE_CONTRAST_STORAGE_KEY, String(reactiveContrast));
    window.electronAPI?.setBackdropSampling?.(reactiveContrast);
  }, [reactiveContrast]);

  // Solo el translúcido deja ver el escritorio sin filtrar; Acrylic ya garantiza un fondo oscuro.
  // La fuente de muestras es el flujo continuo (si está activado) o las capturas periódicas
  // del proceso principal; ambas tienen la misma interfaz.
  const useContinuousBackdrop =
    graphics.hardwareAccelerationActive && graphics.continuousBackdrop;

  useEffect(() => {
    if (theme !== "translucent" || !reactiveContrast) return undefined;
    const electronAPI = window.electronAPI;
    if (!electronAPI?.onBackdropSample) return undefined;

    const source = useContinuousBackdrop && electronAPI.getBackdropCaptureInfo
      ? createContinuousBackdropSource(electronAPI)
      : electronAPI;
    const stopContrast = startBackdropContrast(source);

    return () => {
      stopContrast();
      source.destroy?.();
    };
  }, [reactiveContrast, theme, useContinuousBackdrop]);

  const switchTheme = useCallback((nextTheme) => {
    if (!isValidTheme(nextTheme)) return;

    const currentMode = getWindowModeForTheme(theme);
    const nextMode = getWindowModeForTheme(nextTheme);

    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);

    if (window.electronAPI?.setWindowTransparencyMode && currentMode !== nextMode) {
      window.electronAPI.setWindowTransparencyMode({
        transparent: nextMode !== "opaque",
        mode: nextMode,
        route: getCurrentRoute(),
      });
    }
  }, [theme]);

  // Sin aceleración por hardware el proceso principal no abre ventanas con transparencia:
  // un tema translúcido/acrílico guardado se sustituye por el oscuro.
  useEffect(() => {
    if (graphics.loaded && !graphics.hardwareAccelerationActive && GPU_THEMES.includes(theme)) {
      switchTheme(NO_GPU_FALLBACK_THEME);
    }
  }, [graphics.hardwareAccelerationActive, graphics.loaded, switchTheme, theme]);

  const setHardwareAcceleration = useCallback(async (enabled) => {
    const state = await window.electronAPI?.graphics?.setHardwareAcceleration(enabled);
    if (state) setGraphics({ ...state, loaded: true });
    return state;
  }, []);

  const setContinuousBackdrop = useCallback(async (enabled) => {
    const state = await window.electronAPI?.graphics?.setContinuousBackdrop(enabled);
    if (state) setGraphics({ ...state, loaded: true });
    return state;
  }, []);

  const relaunchApp = useCallback(() => {
    window.electronAPI?.graphics?.relaunch();
  }, []);

  const setCustomThemeColor = useCallback((nextColor) => {
    if (!isValidHexColor(nextColor)) return;
    setCustomThemeColorState(nextColor);
  }, []);

  const toggleDarkMode = useCallback(() => {
    if (theme === "dark") {
      switchTheme("light");
      return;
    }

    switchTheme("dark");
  }, [switchTheme, theme]);

  const toggleTranslucentMode = useCallback(() => {
    if (theme === "translucent") {
      switchTheme("light");
      return;
    }

    switchTheme("translucent");
  }, [switchTheme, theme]);

  const value = useMemo(
    () => ({
      darkMode: theme === "dark",
      translucentMode: theme === "translucent",
      customThemeColor,
      setCustomThemeColor,
      reactiveContrast,
      setReactiveContrast,
      toggleDarkMode,
      toggleTranslucentMode,
      setTheme: switchTheme,
      theme,
      graphics,
      setHardwareAcceleration,
      setContinuousBackdrop,
      relaunchApp,
    }),
    [
      customThemeColor,
      graphics,
      reactiveContrast,
      relaunchApp,
      setContinuousBackdrop,
      setCustomThemeColor,
      setHardwareAcceleration,
      switchTheme,
      theme,
      toggleDarkMode,
      toggleTranslucentMode,
    ],
  );

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => useContext(DarkModeContext);
