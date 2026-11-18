import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./css/App.css";
import Login from "./pages/Login";
import Register from "./pages/Register";
import WindowTitleBar from "./components/layout/WindowTitleBar";
import AuthOrbit from "./components/shared/AuthOrbit";
import GmoMark from "./components/shared/GmoMark";
import RevealHeadline from "./components/shared/RevealHeadline";
import { useLanguage } from "./context/languageContext";
import { app_name } from "./constants/textConstants";
import { registerActiveSessionUser } from "./api/authApi";

const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

const AUTH_MODES = ["login", "register"];

function App() {
  // El formulario visible: inicio de sesión por defecto, registro desde el selector.
  const [showForm, setShowForm] = useState("login");
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isElectronEnvironment) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    const role = localStorage.getItem("role") || "PERSONAL";
    const organizationId = localStorage.getItem("organizationId") || "";
    const isAdmin = role === "ADMIN";

    const nextPath = isAdmin
      ? organizationId
        ? "/admin"
        : "/admin/setup-organization"
      : "/home";

    registerActiveSessionUser().catch(() => {});
    navigate(nextPath, { replace: true });
  }, [navigate]);

  const handleModeKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = showForm === "login" ? "register" : "login";
    setShowForm(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  };

  const content = (
    <div className="contenedor-app authScreen">
      <main className="authColumn">
        <AuthOrbit />
        <div className="authHero">
          <GmoMark size={48} className="authMark" />
        </div>

        <RevealHeadline className="authTitle" text={`${t.appWelcomeTo} ${app_name}`} />
        <p className="authLead">{t.appTagline}</p>

        <section className="authCard" aria-label={t.authModeLabel}>
          <div className="authSwitch" role="tablist" aria-label={t.authModeLabel}>
            <span
              className="authSwitchThumb"
              data-mode={showForm}
              aria-hidden="true"
            />
            {AUTH_MODES.map((mode) => (
              <button
                key={mode}
                id={`auth-tab-${mode}`}
                type="button"
                role="tab"
                aria-selected={showForm === mode}
                aria-controls="auth-panel"
                tabIndex={showForm === mode ? 0 : -1}
                className="authSwitchOption"
                onClick={() => setShowForm(mode)}
                onKeyDown={handleModeKeyDown}
              >
                {mode === "login" ? t.loginTitle : t.registerTitle}
              </button>
            ))}
          </div>

          <div id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${showForm}`}>
            {showForm === "login" && <Login />}
            {showForm === "register" && <Register />}
          </div>
        </section>
      </main>
    </div>
  );

  if (!isElectronEnvironment) {
    return content;
  }

  return (
    <div className="authShell">
      <div className="authWindowFrame">
        <WindowTitleBar />
        <div className="authWindowContent">{content}</div>
      </div>
    </div>
  );
}

export default App;
