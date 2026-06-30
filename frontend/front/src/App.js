import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./css/App.css";
import Login from "./pages/Login";
import Register from "./pages/Register";
import WindowTitleBar from "./components/layout/WindowTitleBar";
import { useLanguage } from "./context/languageContext";
import { app_name } from "./constants/textConstants";
import { registerActiveSessionUser } from "./api/authApi";

const CONFIG_ANIMACION = {
  retrasoInicial: 500,
  duracionAparecer: 1500,
  duracionEscalar: 1000,
  duracionDesaparecer: 2000,
  nombreApp: app_name,
  colorTexto: "#ffffff",
  colorNombreApp: "#000000",
  colorFondo: "#111111",
  escala: 1.05,
};

const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

function App() {
  const [showForm, setShowForm] = useState(null);
  const [config] = useState(CONFIG_ANIMACION);
  const [etapaAnimacion, setEtapaAnimacion] = useState(0);
  const [showButtons, setShowButtons] = useState(true);
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
  useEffect(() => {
    if (etapaAnimacion === 0) {
      const temporizador1 = setTimeout(() => {
        setEtapaAnimacion(1);
      }, config.retrasoInicial);
      return () => clearTimeout(temporizador1);
    } else if (etapaAnimacion === 1) {
      const temporizador2 = setTimeout(() => {
        setEtapaAnimacion(2);
      }, config.duracionAparecer);
      return () => clearTimeout(temporizador2);
    } else if (etapaAnimacion === 2) {
      const temporizador3 = setTimeout(() => {
        setEtapaAnimacion(3);
      }, config.duracionEscalar);
      return () => clearTimeout(temporizador3);
    } else if (etapaAnimacion === 3) {
      const temporizador4 = setTimeout(() => {
        setEtapaAnimacion(0);
      }, config.duracionDesaparecer);
      return () => clearTimeout(temporizador4);
    }
  }, [etapaAnimacion, config]);

  const obtenerClasesAnimacion = () => {
    switch (etapaAnimacion) {
      case 0:
        return "texto-bienvenida oculto";
      case 1:
        return "texto-bienvenida aparecer elevar";
      case 2:
        return "texto-bienvenida aparecer elevar escalar";
      case 3:
        return "texto-bienvenida desvanecer elevar escalar";
      default:
        return "texto-bienvenida oculto";
    }
  };

  const estiloTexto = {
    color: config.colorTexto,
    "--factor-escala": config.escala,
  };

  const estiloNombreApp = {
    color: "transparent",
    WebkitTextStroke: "1px #000000",
    textStroke: "2px #000000",
  };

  const handleFormSelection = (form) => {
    setShowForm(form);
    setShowButtons(false);
  };

  const goBack = () => {
    setShowForm(null);
    setShowButtons(true);
  };

  const content = (
    <div className="contenedor-app">
      <video className="video-bg" autoPlay loop muted playsInline>
        <source src="rrs/white-waves-background.mp4" type="video/mp4" />
      </video>

      <div className={obtenerClasesAnimacion()} style={estiloTexto}>
          {t.appWelcomeTo}{" "}
        <span className="nombre-app" style={estiloNombreApp}>
          {config.nombreApp}
        </span>
      </div>

      {showButtons && (
        <div className="form-selection">
          <button
            className="app-button"
            onClick={() => handleFormSelection("login")}
          >
            {t.loginTitle}
          </button>
          <button
            className="app-button"
            onClick={() => handleFormSelection("register")}
          >
            {t.registerTitle}
          </button>
        </div>
      )}

      {showForm === "login" && <Login />}
      {showForm === "register" && <Register />}

      {showForm && (
        <button className="app-button" onClick={goBack}>
          {t.commonBack}
        </button>
      )}
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
