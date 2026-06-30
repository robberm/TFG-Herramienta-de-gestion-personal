import React, { useState, useRef } from "react";
import "../css/App.css";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/apiClient";
import { registerActiveSessionUser, registerUser } from "../api/authApi";
import { useLanguage } from "../context/languageContext";

const Register = () => {
  const { t } = useLanguage();
  // Definir estado para username y password
  const [registerUsername, setRegisterUsername] = useState(""); // Estado para el nombre de usuario
  const [registerPw, setRegisterPw] = useState(""); // Estado para la contraseña
  const [error, setError] = useState("");

  // Usamos useRef para el campo de contraseña
  const passwordInputRef = useRef(null);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    const normalizedUsername = registerUsername.trim();
    const normalizedPassword = registerPw.trim();

    if (!normalizedUsername) {
      setError(t.registerUsernameRequired);
      return;
    }

    if (normalizedUsername.includes(" ")) {
      setError(t.registerUsernameNoSpaces);
      return;
    }

    if (!normalizedPassword) {
      setError(t.registerPasswordRequired);
      return;
    }

    try {
      setError("");
      const data = await registerUser(normalizedUsername, normalizedPassword);
      const token = data.token.trim();

      localStorage.setItem("token", token);
      localStorage.setItem("username", data.username);

      //  Marco sesión activa en backend
      await registerActiveSessionUser();

      // 3) Ir a home ya logged in
      navigate("/home");
    } catch (err) {
      console.log(err);
      setError(getApiErrorMessage(err, t.loginConnectionError));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (e.target.name === "username") {
        passwordInputRef.current.focus(); // Foco en la contraseña
      } else {
        handleRegister(e); // Si es la contraseña, realiza el registro
      }
    }
  };

  const colorRegisterTexto = {
    color: "#FFFFFF", // Color blanco para el texto de la página de registro
  };

  return (
    <div className="register-form">
      <h2 style={colorRegisterTexto}>{t.registerTitle}</h2>
      <form onSubmit={handleRegister}>
        <input
          className="app-input"
          name="username"
          type="text"
          placeholder={t.username}
          value={registerUsername}
          onChange={(e) => setRegisterUsername(e.target.value)} // Actualiza el estado
          onKeyDown={handleKeyDown} // Manejo de la tecla Enter
        />
        <input
          className="app-input"
          id="password"
          ref={passwordInputRef}
          name="password"
          type="password"
          placeholder={t.loginPassword}
          value={registerPw}
          onChange={(e) => setRegisterPw(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="new-password"
        />
        <button className="app-button" type="submit">
          {t.registerTitle}
        </button>
      </form>
      <h4 style={colorRegisterTexto}>
        {t.registerPasswordHelp}
      </h4>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default Register;
