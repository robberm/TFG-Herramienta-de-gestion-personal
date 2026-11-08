const path = require("path");
const fs = require("fs");
const { safeStorage } = require("electron");

/**
 * Proveedor de IA del usuario. La clave de API se cifra con safeStorage (DPAPI en Windows,
 * ligada a la cuenta de Windows) y se guarda en %APPDATA%/GMO/ai.json: nunca se manda a la
 * BD compartida. El backend local la recibe por cabecera solo cuando la necesita.
 */
const FILE_NAME = "ai.json";
const PROVIDERS = ["OPENAI", "ANTHROPIC", "GEMINI"];

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
  if (trimmedKey) {
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

module.exports = { getAiSettings, saveAiSettings, clearAiSettings, getAiCredentials };
