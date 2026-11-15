const path = require("path");
const fs = require("fs");
const { safeStorage } = require("electron");

/**
 * Proveedor de IA del usuario. La clave de API se cifra con safeStorage (DPAPI en Windows,
 * ligada a la cuenta de Windows) y se guarda en %APPDATA%/GMO/ai.json: nunca se manda a la
 * BD compartida. El backend local la recibe por cabecera solo cuando la necesita.
 * Claude Code y Codex no tienen clave: el backend ejecuta su CLI con la sesión del usuario.
 */
const FILE_NAME = "ai.json";
const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI", "CLAUDE_CODE", "CODEX"];
/** Usan la suscripción con la que se haya iniciado sesión en su CLI: no hay clave. */
const CLI_PROVIDERS = ["CLAUDE_CODE", "CODEX"];
const usesLocalCli = (provider) => CLI_PROVIDERS.includes(provider);

const getSettingsPath = (app) => path.join(app.getPath("userData"), FILE_NAME);

function readStored(app) {
  try {
    const stored = JSON.parse(fs.readFileSync(getSettingsPath(app), "utf8"));
    return {
      provider: PROVIDERS.includes(stored.provider) ? stored.provider : null,
      model: typeof stored.model === "string" ? stored.model : "",
      encryptedKey: typeof stored.encryptedKey === "string" ? stored.encryptedKey : null,
    };
  } catch (_) {
    // Sin configurar o fichero corrupto.
    return { provider: null, model: "", encryptedKey: null };
  }
}

function writeStored(app, stored) {
  const settingsPath = getSettingsPath(app);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(stored, null, 2), "utf8");
}

/** Lo que puede ver la UI: nunca la clave. */
function getAiSettings(app) {
  const stored = readStored(app);
  return {
    provider: stored.provider,
    model: stored.model,
    hasKey: Boolean(stored.encryptedKey),
    // Listo para usarse: con clave o, en los proveedores de CLI, solo con elegirlo.
    configured: Boolean(stored.provider) && (usesLocalCli(stored.provider) || Boolean(stored.encryptedKey)),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  };
}

/** apiKey vacía = conservar la clave guardada (permite cambiar solo el modelo). */
function saveAiSettings(app, { provider, model, apiKey } = {}) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error("Proveedor de IA no válido.");
  }
  const stored = readStored(app);
  let encryptedKey = provider === stored.provider ? stored.encryptedKey : null;

  const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (usesLocalCli(provider)) {
    encryptedKey = null;
  } else if (trimmedKey) {
    if (!safeStorage.isEncryptionAvailable()) {
      // Sin cifrado del sistema no se guarda la clave en claro.
      throw new Error("El cifrado del sistema no está disponible en este equipo.");
    }
    encryptedKey = safeStorage.encryptString(trimmedKey).toString("base64");
  }

  writeStored(app, {
    provider,
    model: typeof model === "string" ? model.trim() : "",
    encryptedKey,
  });
  return getAiSettings(app);
}

function clearAiSettings(app) {
  try {
    fs.unlinkSync(getSettingsPath(app));
  } catch (_) {
    // Ya no existía.
  }
  return getAiSettings(app);
}

/** Credenciales descifradas para las cabeceras X-AI-*; null si no hay clave utilizable. */
function getAiCredentials(app) {
  const stored = readStored(app);
  if (usesLocalCli(stored.provider)) {
    return { provider: stored.provider, model: stored.model, apiKey: "" };
  }
  if (!stored.provider || !stored.encryptedKey || !safeStorage.isEncryptionAvailable()) {
    return null;
  }
  try {
    const apiKey = safeStorage.decryptString(Buffer.from(stored.encryptedKey, "base64"));
    return { provider: stored.provider, model: stored.model, apiKey };
  } catch (_) {
    // Cifrada por otra cuenta de Windows o corrupta: como si no hubiera clave.
    return null;
  }
}

/**
 * Abre una terminal con el login del CLI (Claude Code o Codex). El login es interactivo
 * (abre el navegador y a veces pide pegar un código), así que el usuario lo hace en una
 * terminal visible y luego vuelve a comprobar el estado desde Ajustes.
 */
function openCliLogin(provider) {
  if (!usesLocalCli(provider)) {
    throw new Error("Proveedor de IA no válido.");
  }
  const command = provider === "CLAUDE_CODE" ? ["claude", "auth", "login"] : ["codex", "login"];
  const { spawn } = require("child_process");
  const detachedOptions = { detached: true, stdio: "ignore" };

  if (process.platform === "win32") {
    // "start" abre una consola nueva; cmd /k la deja abierta para leer el resultado.
    // Argumentos sueltos (sin espacios) para que no se interpreten como título de ventana.
    spawn("cmd.exe", ["/c", "start", "cmd", "/k", ...command], detachedOptions).unref();
  } else if (process.platform === "darwin") {
    const script = `tell application "Terminal" to do script "${command.join(" ")}"`;
    spawn("osascript", ["-e", script, "-e", 'tell application "Terminal" to activate'], detachedOptions).unref();
  } else {
    spawn("x-terminal-emulator", ["-e", ...command], detachedOptions).unref();
  }
  return { command: command.join(" ") };
}

module.exports = { getAiSettings, saveAiSettings, clearAiSettings, getAiCredentials, openCliLogin };
