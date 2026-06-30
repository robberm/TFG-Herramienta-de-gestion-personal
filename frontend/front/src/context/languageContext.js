import { createContext, useContext, useMemo, useState } from "react";
import { TEXT_CONSTANTS } from "../constants/textConstants";

const STORAGE_KEY = "appLanguage";

const resolveDeviceLanguage = () => {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage === "es" || fromStorage === "en") return fromStorage;

  const browserLang = (navigator.language || "en").toLowerCase();
  return browserLang.startsWith("es") ? "es" : "en";
};

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: TEXT_CONSTANTS.en,
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(resolveDeviceLanguage);

  const value = useMemo(
    () => ({
      language,
      setLanguage: (nextLang) => {
        const normalized = nextLang === "es" ? "es" : "en";
        localStorage.setItem(STORAGE_KEY, normalized);
        setLanguage(normalized);
      },
      t: TEXT_CONSTANTS[language] || TEXT_CONSTANTS.en,
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
