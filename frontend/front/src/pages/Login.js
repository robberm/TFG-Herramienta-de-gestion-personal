import React, { useRef, useState } from "react";
import "../css/App.css";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../api/apiClient";
import { loginUser, registerActiveSessionUser } from "../api/authApi";
import { getCurrentUserProfile } from "../api/userApi";
import { resolveProfileImageUrl } from "../utils/profileImage";
import { useLanguage } from "../context/languageContext";

const Login = () => {
  const { t } = useLanguage();
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [error, setError] = useState("");
  const passwordInputRef = useRef(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setError("");
      const data = await loginUser(loginUsername, loginPw);

      const token = data.token.trim();
      localStorage.setItem("token", token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("role", data.role || "PERSONAL");
      localStorage.setItem("organizationId", data.organizationId ?? "");

      const profile = await getCurrentUserProfile({ forceRefresh: true });
      if (profile?.profileImagePath) {
        localStorage.setItem(
          "profileImage",
          resolveProfileImageUrl(profile.profileImagePath),
        );
      } else {
        localStorage.removeItem("profileImage");
      }

      const isAdmin = (data.role || profile?.role) === "ADMIN";
      const hasOrganization = Boolean(data.organizationId ?? profile?.organizationId);
      const nextPath = isAdmin
        ? hasOrganization
          ? "/admin"
          : "/admin/setup-organization"
        : "/home";

      await registerActiveSessionUser();
      navigate(nextPath);
    } catch (err) {
      const loginMessage =
        err?.status === 401
          ? t.loginInvalidCredentials
          : getApiErrorMessage(err, t.loginConnectionError);
      setError(loginMessage);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (e.target.name === "username") {
        passwordInputRef.current?.focus();
      } else {
        handleLogin(e);
      }
    }
  };

  return (
    <div className="login-form authForm">
      <h2 className="srOnly">{t.loginTitle}</h2>
      <form className="authFormFields" onSubmit={handleLogin} noValidate>
        <label className="authField">
          <span className="authFieldLabel">{t.username}</span>
          <input
            className="app-input"
            name="username"
            type="text"
            autoComplete="username"
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>
        <label className="authField">
          <span className="authFieldLabel">{t.loginPassword}</span>
          <input
            className="app-input"
            id="password"
            ref={passwordInputRef}
            name="password"
            type="password"
            value={loginPw}
            onChange={(e) => setLoginPw(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
          />
        </label>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="app-button authSubmit" type="submit">
          {t.loginTitle}
        </button>
      </form>
    </div>
  );
};

export default Login;
