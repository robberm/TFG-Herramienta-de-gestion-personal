import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DarkModeContext = createContext();

const THEME_CLASSES = ["light", "dark", "truedark", "translucent", "custom"];
const THEME_STORAGE_KEY = "appTheme";
const CUSTOM_COLOR_STORAGE_KEY = "customThemeColor";
const DEFAULT_CUSTOM_COLOR = "#6c63ff";

const isValidTheme = (theme) => THEME_CLASSES.includes(theme);
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

const applyThemeToBody = (theme, customColor) => {
  document.body.classList.remove(...THEME_CLASSES);
  document.body.classList.add(theme);
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

  useEffect(() => {
    applyThemeToBody(theme, customThemeColor);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(CUSTOM_COLOR_STORAGE_KEY, customThemeColor);
    localStorage.setItem("darkMode", String(theme === "dark" || theme === "truedark"));
    localStorage.setItem("translucentMode", String(theme === "translucent"));
  }, [customThemeColor, theme]);

  useEffect(() => {
    if (window.electronAPI?.setWindowTransparencyMode) {
      window.electronAPI.setWindowTransparencyMode({
        transparent: theme === "translucent",
        route: getCurrentRoute(),
      });
    }
  }, [theme]);

  const switchTheme = useCallback((nextTheme) => {
    if (!isValidTheme(nextTheme)) return;

    const wasTransparent = theme === "translucent";
    const willBeTransparent = nextTheme === "translucent";

    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);

    if (
      window.electronAPI?.setWindowTransparencyMode &&
      wasTransparent !== willBeTransparent
    ) {
      window.electronAPI.setWindowTransparencyMode({
        transparent: willBeTransparent,
        route: getCurrentRoute(),
      });
    }
  }, [theme]);

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
      toggleDarkMode,
      toggleTranslucentMode,
      setTheme: switchTheme,
      theme,
    }),
    [
      customThemeColor,
      setCustomThemeColor,
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
