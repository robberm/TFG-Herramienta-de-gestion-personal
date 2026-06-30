import React from "react";
import { useError } from "./ErrorContext";
import "../css/ErrorToast.css";

function ErrorBox() {
  const { errorMessage, setErrorMessage } = useError();

  if (!errorMessage) return null;

  return (
    <div className="error-toast" role="alert" aria-live="assertive">
      <span>{errorMessage}</span>
      <button
        className="error-toast-close"
        onClick={() => setErrorMessage("")}
        aria-label="Cerrar error"
      >
        &times;
      </button>
    </div>
  );
}

export default ErrorBox;
