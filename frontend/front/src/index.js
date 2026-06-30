import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./AppRouter";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { ErrorMessageGenerator } from "./components/ErrorContext";
import MainLayout from "./components/layout/MainLayout";
import FocusModeListener from "./components/layout/FocusModeListener";

import "./css/index.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { DarkModeProvider } from "./DarkModeContext";
import { LanguageProvider } from "./context/languageContext";

const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

const Router = isElectronEnvironment ? HashRouter : BrowserRouter;

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <LanguageProvider>
    <DarkModeProvider>
      <ErrorMessageGenerator>
        <Router>
          <FocusModeListener />
          <MainLayout>
            <AppRouter />
          </MainLayout>
        </Router>
      </ErrorMessageGenerator>
    </DarkModeProvider>
  </LanguageProvider>,
);
