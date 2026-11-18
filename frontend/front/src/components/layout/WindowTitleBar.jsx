import React, { useEffect, useState } from "react";
import "../../css/WindowTitleBar.css";
import { app_name } from "../../constants/textConstants";

const WindowTitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI
      .isWindowMaximized()
      .then(setIsMaximized)
      .catch(() => {});

    window.electronAPI.onWindowMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleToggleMaximize = () => {
    window.electronAPI?.toggleMaximizeWindow?.();

    window.setTimeout(() => {
      window.electronAPI?.isWindowMaximized?.().then(setIsMaximized).catch(() => {});
    }, 120);
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };


  const handleDoubleClick = () => {
    window.electronAPI?.toggleMaximizeWindow();
  };

  return (
    <header className="windowTitleBar">
      <div className="windowTitleBarDragArea" onDoubleClick={handleDoubleClick}>
        <div className="windowTitleBarBrand">
          
          <span className="windowTitleBarTitle">{app_name}</span>
        </div>
      </div>

      <div className="windowTitleBarActions">

        <button
          type="button"
          className="windowControlButton"
          onClick={handleMinimize}
          aria-label="Minimizar"
          title="Minimizar"
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>

        <button
          type="button"
          className="windowControlButton"
          onClick={handleToggleMaximize}
          aria-label={isMaximized ? "Restaurar" : "Maximizar"}
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? (
            <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1" />
              <rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="windowControlButton windowControlButtonClose"
          onClick={handleClose}
          aria-label="Cerrar"
          title="Cerrar"
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default WindowTitleBar;
