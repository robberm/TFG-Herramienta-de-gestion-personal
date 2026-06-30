import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DarkModeContext = createContext();

const THEME_CLASSES = ["light", "dark", "translucent"];

const getStoredTheme = () => {
  const translucentMode = localStorage.getItem("translucentMode") === "true";
  const darkMode = localStorage.getItem("darkMode") === "true";

  if (translucentMode) return "translucent";
  if (darkMode) return "dark";
  return "light";
};

const applyThemeToBody = (theme) => {
  document.body.classList.remove(...THEME_CLASSES);
  document.body.classList.add(theme);
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

  useEffect(() => {
    applyThemeToBody(theme);
    localStorage.setItem("darkMode", String(theme === "dark"));
    localStorage.setItem("translucentMode", String(theme === "translucent"));
    if (window.electronAPI?.setWindowTransparencyMode) {
      window.electronAPI.setWindowTransparencyMode({
        transparent: theme === "translucent",
        route: getCurrentRoute(),
      });
    }
  }, [theme]);

  const switchTheme = useCallback((nextTheme) => {
    const wasTransparent = theme === "translucent";
    const willBeTransparent = nextTheme === "translucent";

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
      toggleDarkMode,
      toggleTranslucentMode,
      setTheme: switchTheme,
      theme,
    }),
    [switchTheme, theme, toggleDarkMode, toggleTranslucentMode],
  );

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => useContext(DarkModeContext);
