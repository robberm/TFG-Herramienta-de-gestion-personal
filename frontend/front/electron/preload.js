const { contextBridge, ipcRenderer } = require("electron");

const isAutoStartSupported =
  process.platform === "win32" && !process.defaultApp;

contextBridge.exposeInMainWorld("electronAPI", {
  startBlock: (payload) => ipcRenderer.send("start-block", payload),

  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),

  setWindowTransparencyMode: ({ transparent, route }) =>
    ipcRenderer.send("window:set-transparency-mode", { transparent, route }),

  isWindowMaximized: () => ipcRenderer.invoke("window:is-maximized"),

  showReminderWindow: (reminder) =>
    ipcRenderer.send("show-reminder-window", reminder),

  onWindowMaximizedChange: (callback) => {
    ipcRenderer.removeAllListeners("window:maximized");
    ipcRenderer.on("window:maximized", (_, isMaximized) => {
      callback(isMaximized);
    });
  },

  electronSettings: {
    isAutoStartSupported,
    getAutoStart: () => {
      if (!isAutoStartSupported) {
        return Promise.resolve(false);
      }

      return ipcRenderer.invoke("settings:get-auto-start");
    },
    setAutoStart: (enabled) => {
      if (!isAutoStartSupported) {
        return Promise.resolve(false);
      }

      return ipcRenderer.invoke("settings:set-auto-start", enabled);
    },
  },
});
