import React, { useEffect, useRef } from "react";
import "./ConfirmDialog.css";

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  warning,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const timeoutId = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirmDialogOverlay" onClick={onCancel}>
      <div
        className="confirmDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmDialogTitle"
        aria-describedby="confirmDialogMessage"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirmDialogBody">
          <h3 id="confirmDialogTitle">{title}</h3>
          <p id="confirmDialogMessage">{message}</p>
          {warning && <p className="confirmDialogWarning">{warning}</p>}
        </div>

        <div className="confirmDialogActions">
          <button
            type="button"
            className="confirmDialogButton secondary"
            onClick={onCancel}
            ref={cancelButtonRef}
            disabled={isProcessing}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirmDialogButton danger"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
