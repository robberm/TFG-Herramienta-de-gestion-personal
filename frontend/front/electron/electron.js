const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const net = require("net");
const { promisify } = require("util");

let mainWindow = null;
let blockWindow = null;
let backendProcess = null;

let currentWindowTransparent = false;
let isRecreatingWindow = false;
/** Mensajes centralizados para no dejar textos de error sueltos por el archivo. */
const ERROR_MESSAGES = {
  COMPOSE_NOT_FOUND: "No se ha encontrado compose.yml en:",
  DOCKER_NOT_READY:
    "Docker no está disponible tras intentar iniciar Docker Desktop.",
  DOCKER_SETUP_TITLE: "Error inicializando Docker/MySQL",
  DOCKER_SETUP_BODY:
    "No se pudo preparar la base de datos automáticamente. Revisa Docker Desktop y el archivo startup.log en %APPDATA%/GMO.",
  BACKEND_NOT_FOUND: "No se ha encontrado el backend en:",
  DATABASE_TIMEOUT: "MySQL no disponible en localhost:",
  BACKEND_START_FAILED: "Error arrancando el backend:",
  BACKEND_STOP_FAILED: "Error cerrando el backend:",
};

/** Textos técnicos de arranque que se guardan en fichero, sin sacar nada por consola. */
const STARTUP_MESSAGES = {
  DOCKER_DESKTOP_NOT_FOUND:
    "Docker Desktop.exe no encontrado en rutas conocidas.",
  DOCKER_DESKTOP_LAUNCHED: "Docker Desktop lanzado:",
  DOCKER_READY: "Docker daemon disponible.",
  DOCKER_CHECKING: "Validando disponibilidad de Docker...",
  DOCKER_LAUNCHING:
    "Docker no disponible al inicio. Intentando lanzar Docker Desktop...",
  DOCKER_LAUNCH_FAILED: "No se pudo lanzar Docker Desktop:",
  COMPOSE_RUNNING: "Ejecutando docker compose con archivo:",
  COMPOSE_DONE: "docker compose up -d ejecutado.",
  DATABASE_READY: "MySQL disponible. Continuando arranque.",
  BACKEND_TIMEOUT: "Backend no respondió a tiempo; se abrirá la UI igualmente.",
  BACKEND_READY: "Backend disponible en localhost:",
  DOCKER_SETUP_FAILED: "Error preparando Docker/MySQL:",
};

// Así los comandos de Docker se pueden usar con await y queda más limpio.
const execAsync = promisify(exec);

// Puertos y tiempos de espera del arranque local: Docker/MySQL primero, backend después.
const MYSQL_PORT = 3310;
const DB_TIMEOUT_MS = 90_000;
const DB_POLL_INTERVAL_MS = 1_500;
const DOCKER_TIMEOUT_MS = 120_000;
const BACKEND_PORT = 8080;
const BACKEND_TIMEOUT_MS = 60_000;

/**
 * Guarda trazas de arranque en disco. Esto ayuda en instalaciones empaquetadas,
 * donde no hay terminal, pero evita dejar mensajes sueltos por consola.
 */
function logStartup(message) {
  const formatted = `[${new Date().toISOString()}] ${message}`;

  try {
    const logPath = path.join(app.getPath("userData"), "startup.log");
    fs.appendFileSync(logPath, `${formatted}\n`, "utf8");
  } catch (_) {
    // Si no se puede escribir el log, la app debe seguir arrancando igualmente.
  }
}

/**
 * Devuelve la ruta de compose.yml según entorno:
 * - Desarrollo: frontend/front/resources/docker/compose.yml
 * - Producción empaquetada: process.resourcesPath/docker/compose.yml
 */
function getDockerComposePath() {
  const devPath = path.resolve(
    __dirname,
    "..",
    "resources",
    "docker",
    "compose.yml",
  );
  const prodPath = path.join(process.resourcesPath, "docker", "compose.yml");

  if (isDevMode() && fs.existsSync(devPath)) {
    return devPath;
  }

  if (fs.existsSync(prodPath)) {
    return prodPath;
  }

  return devPath;
}

/** Comprueba que el CLI de Docker está operativo para este proceso Electron. */
async function isDockerAvailable() {
  try {
    await execAsync("docker version", { windowsHide: true, shell: "cmd.exe" });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Intenta abrir Docker Desktop en Windows para que el daemon quede disponible.
 * No bloquea indefinidamente: la espera real la gestiona waitForDockerReady().
 */
async function launchDockerDesktop() {
  if (process.platform !== "win32") {
    return false;
  }

  const candidates = [
    path.join(
      process.env["ProgramFiles"] || "",
      "Docker",
      "Docker",
      "Docker Desktop.exe",
    ),
    path.join(
      process.env["ProgramW6432"] || "",
      "Docker",
      "Docker",
      "Docker Desktop.exe",
    ),
    path.join(
      process.env["LocalAppData"] || "",
      "Docker",
      "Docker",
      "Docker Desktop.exe",
    ),
  ].filter(Boolean);

  const dockerDesktopPath = candidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!dockerDesktopPath) {
    logStartup(STARTUP_MESSAGES.DOCKER_DESKTOP_NOT_FOUND);
    return false;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(dockerDesktopPath, [], {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });

  logStartup(
    `${STARTUP_MESSAGES.DOCKER_DESKTOP_LAUNCHED} ${dockerDesktopPath}`,
  );
  return true;
}

/** Espera hasta que Docker CLI/daemon esté operativo. */
async function waitForDockerReady(timeoutMs = DOCKER_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isDockerAvailable()) {
      logStartup(STARTUP_MESSAGES.DOCKER_READY);
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

/** Lanza el docker compose en segundo plano para levantar MySQL. */
async function startDockerCompose() {
  const composePath = getDockerComposePath();

  if (!fs.existsSync(composePath)) {
    throw new Error(`${ERROR_MESSAGES.COMPOSE_NOT_FOUND} ${composePath}`);
  }

  logStartup(`${STARTUP_MESSAGES.COMPOSE_RUNNING} ${composePath}`);
  await execAsync(`docker compose -f "${composePath}" up -d`, {
    windowsHide: true,
    shell: "cmd.exe",
  });
}

/** Comprueba conectividad TCP a un puerto del host. */
function canConnectToPort(port, host = "127.0.0.1", timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    const onError = () => {
      socket.destroy();
      resolve(false);
    };

    socket.once("error", onError);
    socket.once("timeout", onError);
    socket.connect(port, host);
  });
}

/** Espera hasta que MySQL esté realmente aceptando conexiones TCP. */
async function waitForDatabase(timeoutMs = DB_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnectToPort(MYSQL_PORT)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, DB_POLL_INTERVAL_MS));
  }

  throw new Error(
    `${ERROR_MESSAGES.DATABASE_TIMEOUT}${MYSQL_PORT} tras ${Math.round(timeoutMs / 1000)}s`,
  );
}

/** Orquesta validación Docker + levantado compose + espera de base de datos. */
async function ensureDockerDatabaseReady() {
  logStartup(STARTUP_MESSAGES.DOCKER_CHECKING);
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    logStartup(STARTUP_MESSAGES.DOCKER_LAUNCHING);

    try {
      await launchDockerDesktop();
    } catch (error) {
      logStartup(
        `${STARTUP_MESSAGES.DOCKER_LAUNCH_FAILED} ${error?.message || String(error)}`,
      );
    }

    const dockerReady = await waitForDockerReady();
    if (!dockerReady) {
      throw new Error(ERROR_MESSAGES.DOCKER_NOT_READY);
    }
  }

  const dbReady = await canConnectToPort(MYSQL_PORT);
  logStartup(
    `Estado inicial MySQL localhost:${MYSQL_PORT} => ${dbReady ? "UP" : "DOWN"}`,
  );
  if (!dbReady) {
    await startDockerCompose();
    logStartup(STARTUP_MESSAGES.COMPOSE_DONE);
  }

  await waitForDatabase();
  logStartup(STARTUP_MESSAGES.DATABASE_READY);
}
/** Indica si la app corre en modo desarrollo (no empaquetado). */
function isDevMode() {
  return !app.isPackaged;
}

function getRouteToLoad(route = "/") {
  return typeof route === "string" && route.trim() ? route : "/";
}

function getAppIconPath() {
  const pngIconPath = path.join(
    __dirname,
    "..",
    "resources",
    "build",
    "icono_final_v2.png",
  );

  return fs.existsSync(pngIconPath) ? pngIconPath : undefined;
}

function getEmbeddedJavaPath() {
  if (process.platform !== "win32") {
    return "java";
  }

  const javaPath = path.join(
    process.resourcesPath,
    "runtime",
    "jre21",
    "bin",
    "java.exe",
  );

  return fs.existsSync(javaPath) ? javaPath : "java";
}

function getBackendJarPath() {
  const jarName = "tfgapp-0.0.1-SNAPSHOT.jar";

  if (isDevMode()) {
    return path.resolve(__dirname, "..", "resources", "backend", jarName);
  }

  return path.join(process.resourcesPath, "backend", jarName);
}

function startBackend() {
  if (backendProcess) {
    return;
  }

  const jarPath = getBackendJarPath();

  if (!fs.existsSync(jarPath)) {
    logStartup(`${ERROR_MESSAGES.BACKEND_NOT_FOUND} ${jarPath}`);
    return;
  }

  const javaPath = isDevMode() ? "java" : getEmbeddedJavaPath();

  backendProcess = spawn(javaPath, ["-Xms64m", "-Xmx256m", "-jar", jarPath], {
    cwd: path.dirname(jarPath),
    windowsHide: true,
    detached: false,
    stdio: "ignore",
  });

  backendProcess.on("error", (error) => {
    logStartup(
      `${ERROR_MESSAGES.BACKEND_START_FAILED} ${error?.message || String(error)}`,
    );
    backendProcess = null;
  });

  backendProcess.on("exit", () => {
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess) {
    return;
  }

  try {
    backendProcess.kill();
  } catch (error) {
    logStartup(
      `${ERROR_MESSAGES.BACKEND_STOP_FAILED} ${error?.message || String(error)}`,
    );
  } finally {
    backendProcess = null;
  }
}

function loadRenderer(win, route = "/") {
  const finalRoute = getRouteToLoad(route);

  if (isDevMode()) {
    win.loadURL(`http://localhost:3000/#${finalRoute}`);
    return;
  }

  win.loadFile(path.join(__dirname, "..", "build", "index.html")).then(() => {
    if (finalRoute !== "/") {
      win.webContents
        .executeJavaScript(
          `
          (() => {
            const route = ${JSON.stringify(finalRoute)};
            try {
              window.location.hash = route;
            } catch (_) {
              // Si el hash falla, no merece la pena romper la ventana por esto.
            }
          })();
        `,
        )
        .catch(() => {});
    }
  });
}

function attachWindowEvents(win) {
  win.webContents.on("before-input-event", (event, input) => {
    const wc = win.webContents;

    if (
      input.control &&
      (input.key === "+" || (input.shift && input.key === "="))
    ) {
      event.preventDefault();
      wc.setZoomLevel(wc.getZoomLevel() + 0.5);
    }

    if (input.control && input.key === "-") {
      event.preventDefault();
      wc.setZoomLevel(wc.getZoomLevel() - 0.5);
    }

    if (input.control && input.key === "0") {
      event.preventDefault();
      wc.setZoomLevel(0);
    }
  });

  win.on("maximize", () => {
    if (!win.isDestroyed()) {
      win.webContents.send("window:maximized", true);
    }
  });

  win.on("unmaximize", () => {
    if (!win.isDestroyed()) {
      win.webContents.send("window:maximized", false);
    }
  });
}

function createMainWindow({
  transparentMode = false,
  route = "/",
  bounds = null,
  maximized = false,
  hidden = false,
} = {}) {
  const win = new BrowserWindow({
    width: bounds?.width || 1200,
    height: bounds?.height || 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    frame: false,
    transparent: transparentMode,
    backgroundColor: transparentMode ? "#00000000" : "#111111",
    hasShadow: true,
    thickFrame: true,
    roundedCorners: true,
    resizable: true,
    show: !hidden,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: true,
      backgroundThrottling: false,
    },
  });

  attachWindowEvents(win);
  loadRenderer(win, route);

  if (maximized) {
    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) {
        win.maximize();
      }
    });
  }

  return win;
}

function openInitialWindow() {
  mainWindow = createMainWindow({
    transparentMode: false,
    route: "/",
    hidden: false,
  });
}

function recreateMainWindow({ transparentMode, route = "/" }) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    currentWindowTransparent = transparentMode;
    mainWindow = createMainWindow({
      transparentMode,
      route,
      hidden: false,
    });
    return;
  }

  if (isRecreatingWindow) return;
  if (currentWindowTransparent === transparentMode) return;

  isRecreatingWindow = true;

  const oldWindow = mainWindow;
  const wasMaximized = oldWindow.isMaximized();
  const bounds = wasMaximized
    ? oldWindow.getNormalBounds()
    : oldWindow.getBounds();

  const newWindow = createMainWindow({
    transparentMode,
    route,
    bounds,
    maximized: wasMaximized,
    hidden: true,
  });

  const finalizeSwap = () => {
    if (newWindow.isDestroyed()) {
      isRecreatingWindow = false;
      return;
    }

    newWindow.show();
    mainWindow = newWindow;
    currentWindowTransparent = transparentMode;

    if (wasMaximized && !newWindow.isDestroyed()) {
      newWindow.maximize();
    }

    if (!oldWindow.isDestroyed()) {
      oldWindow.destroy();
    }

    isRecreatingWindow = false;
  };

  newWindow.once("ready-to-show", finalizeSwap);

  newWindow.webContents.once("did-fail-load", () => {
    if (!newWindow.isDestroyed()) {
      newWindow.destroy();
    }

    mainWindow = oldWindow;
    isRecreatingWindow = false;
  });
}

function createBlockWindow(payload = {}) {
  const durationSeconds = Math.max(1, Number(payload?.durationSeconds || 20));

  blockWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  blockWindow.setAlwaysOnTop(true, "screen-saver");
  blockWindow.setVisibleOnAllWorkspaces(true);
  blockWindow.loadFile(path.join(__dirname, "..", "public", "block.html"));

  if (process.platform === "win32") {
    const scriptPath = path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "tools",
      "blockScreen.ps1",
    );

    if (fs.existsSync(scriptPath)) {
      exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
    }
  }

  setTimeout(() => {
    if (blockWindow) {
      blockWindow.close();
      blockWindow = null;
    }
  }, durationSeconds * 1000);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createReminderWindow(reminder) {
  const display = screen.getPrimaryDisplay();
  const width = 360;
  const height = 220;
  const margin = 18;

  const x = Math.round(
    display.workArea.x + display.workArea.width - width - margin,
  );
  const y = Math.round(
    display.workArea.y + display.workArea.height - height - margin,
  );

  const reminderWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: true,
    focusable: true,
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  const title = escapeHtml(reminder?.title || "Evento");
  const description = escapeHtml(reminder?.description || "");
  const location = escapeHtml(reminder?.location || "");
  const isAllDay = !!reminder?.allDay;

  const startTime = reminder?.startTime
    ? new Date(reminder.startTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Reminder</title>
        <style>
          * {
            box-sizing: border-box;
            font-family: "Segoe UI", sans-serif;
          }

          body {
            margin: 0;
            background: transparent;
            overflow: hidden;
          }

          .card {
            width: 100%;
            height: 100%;
            padding: 18px;
            border-radius: 18px;
            background: rgba(22, 22, 22, 0.96);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .eyebrow {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(255,255,255,0.65);
          }

          .title {
            font-size: 20px;
            font-weight: 600;
            line-height: 1.2;
          }

          .time,
          .location,
          .description {
            font-size: 13px;
            color: rgba(255,255,255,0.82);
          }

          .actions {
            margin-top: auto;
            display: flex;
            justify-content: flex-end;
          }

          button {
            border: 1px solid rgba(255,255,255,0.14);
            background: transparent;
            color: white;
            border-radius: 999px;
            padding: 8px 14px;
            cursor: pointer;
          }

          button:hover {
            background: rgba(255,255,255,0.08);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="eyebrow">Próximo evento</div>
          <div class="title">${title}</div>
          <div class="time">${isAllDay ? "Todo el día" : `Empieza a las ${startTime}`}</div>
          ${location ? `<div class="location">📍 ${location}</div>` : ""}
          ${description ? `<div class="description">${description}</div>` : ""}
          <div class="actions">
            <button onclick="window.close()">Cerrar</button>
          </div>
        </div>
      </body>
    </html>
  `;

  reminderWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );

  reminderWindow.once("ready-to-show", () => {
    if (!reminderWindow.isDestroyed()) {
      reminderWindow.showInactive();
    }
  });

  setTimeout(() => {
    if (!reminderWindow.isDestroyed()) {
      reminderWindow.close();
    }
  }, 12000);
}

/** Espera hasta que el backend HTTP esté escuchando en localhost:8080. */
async function waitForBackendReady(timeoutMs = BACKEND_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnectToPort(BACKEND_PORT)) {
      logStartup(`${STARTUP_MESSAGES.BACKEND_READY}${BACKEND_PORT}.`);
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * Secuencia de arranque: Docker/MySQL -> Backend -> Renderer.
 */
app.whenReady().then(async () => {
  try {
    await ensureDockerDatabaseReady();
  } catch (error) {
    const details = error?.message || String(error);
    logStartup(`${STARTUP_MESSAGES.DOCKER_SETUP_FAILED} ${details}`);
    dialog.showErrorBox(
      ERROR_MESSAGES.DOCKER_SETUP_TITLE,
      `${ERROR_MESSAGES.DOCKER_SETUP_BODY}\n\nDetalle: ${details}`,
    );
  }

  startBackend();

  const backendReady = await waitForBackendReady();
  if (!backendReady) {
    logStartup(STARTUP_MESSAGES.BACKEND_TIMEOUT);
  }

  openInitialWindow();

  globalShortcut.register("F12", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (isRecreatingWindow) return;
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    openInitialWindow();
  }
});

ipcMain.on("start-block", createBlockWindow);

ipcMain.on("window:minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on("window:toggle-maximize", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("window:close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.on("window:set-transparency-mode", (_, payload) => {
  const transparentMode = !!payload?.transparent;
  const route = getRouteToLoad(payload?.route);
  recreateMainWindow({ transparentMode, route });
});

ipcMain.on("show-reminder-window", (_event, reminder) => {
  createReminderWindow(reminder);
});

ipcMain.handle("window:is-maximized", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  return mainWindow.isMaximized();
});

ipcMain.handle("settings:get-auto-start", () => {
  if (process.platform !== "win32" || !app.isPackaged) {
    return false;
  }

  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("settings:set-auto-start", (_event, enabled) => {
  if (process.platform !== "win32" || !app.isPackaged) {
    return false;
  }

  const openAtLogin = !!enabled;
  app.setLoginItemSettings({
    openAtLogin,
    path: process.execPath,
  });

  return app.getLoginItemSettings().openAtLogin;
});
