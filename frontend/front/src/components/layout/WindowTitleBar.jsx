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
          <span className="windowTitleBarDot" />
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
          —
        </button>

        <button
          type="button"
          className="windowControlButton"
          onClick={handleToggleMaximize}
          aria-label={isMaximized ? "Restaurar" : "Maximizar"}
          title={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path d="M3.29289 3.29289C3.48043 3.10536 3.73478 3 4 3H13C13.2652 3 13.5196 3.10536 13.7071 3.29289C13.8946 3.48043 14 3.73479 14 4V5C14 5.55228 14.4477 6 15 6C15.5523 6 16 5.55228 16 5V4C16 3.20435 15.6839 2.44129 15.1213 1.87868C14.5587 1.31607 13.7956 1 13 1H4C3.20435 1 2.44129 1.31607 1.87868 1.87868C1.31607 2.44129 1 3.20435 1 4V13C1 13.7956 1.31607 14.5587 1.87868 15.1213C2.44129 15.6839 3.20435 16 4 16H5C5.55228 16 6 15.5523 6 15C6 14.4477 5.55228 14 5 14H4C3.73479 14 3.48043 13.8946 3.29289 13.7071C3.10536 13.5196 3 13.2652 3 13V4C3 3.73478 3.10536 3.48043 3.29289 3.29289Z" fill="currentColor"></path>
                <path fillRule="evenodd" clipRule="evenodd" d="M11 8C9.34315 8 8 9.34315 8 11V20C8 21.6569 9.34315 23 11 23H20C21.6569 23 23 21.6569 23 20V11C23 9.34315 21.6569 8 20 8H11ZM10 11C10 10.4477 10.4477 10 11 10H20C20.5523 10 21 10.4477 21 11V20C21 20.5523 20.5523 21 20 21H11C10.4477 21 10 20.5523 10 20V11Z" fill="currentColor"></path>
              </g>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g id="SVGRepo_bgCarrier" strokeWidth="0" />
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
              <g id="SVGRepo_iconCarrier">
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
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
          ✕
        </button>
      </div>
    </header>
  );
};

export default WindowTitleBar;
