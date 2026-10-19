const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/** Nombre del fichero de configuración (formato KEY=VALUE, como un .env). */
const CONFIG_FILE_NAME = "gmo.env";

/** Claves que se reenvían al backend y a docker compose. El resto se ignora. */
const FORWARDED_KEYS = [
  "DB_URL",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_MIGRATE",
  "MYSQL_ROOT_PASSWORD",
  "PROFILE_IMAGES_MODE",
  "PROFILE_IMAGES_SIGNER_URL",
  "PROFILE_IMAGES_SIGNER_KEY",
  "EVENTS_SCHEDULE_SYNC_SECONDS",
];

/**
 * Rutas donde se busca gmo.env, por prioridad:
 * 1. %APPDATA%/GMO/gmo.env -> configuración propia del usuario/equipo.
 * 2. resources/config/gmo.env -> la que se empaqueta con el instalador.
 * 3. frontend/front/resources/config/gmo.env -> desarrollo.
 */
function getConfigCandidates(app) {
  return [
    path.join(app.getPath("userData"), CONFIG_FILE_NAME),
    path.join(process.resourcesPath || "", "config", CONFIG_FILE_NAME),
    path.resolve(__dirname, "..", "resources", "config", CONFIG_FILE_NAME),
  ];
}

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

/** Lee el primer gmo.env que exista. Devuelve { values, sourcePath }. */
function loadRuntimeConfig(app) {
  for (const candidate of getConfigCandidates(app)) {
    try {
      if (fs.existsSync(candidate)) {
        return {
          values: parseEnvFile(fs.readFileSync(candidate, "utf8")),
          sourcePath: candidate,
        };
      }
    } catch (_) {
      // Si un candidato no se puede leer se prueba el siguiente.
    }
  }

  return { values: {}, sourcePath: null };
}

/**
 * Secreto JWT propio de cada instalación. Solo lo usa el backend local de este PC
 * para firmar y validar sus tokens, así que no hace falta compartirlo ni empaquetarlo.
 */
function getOrCreateJwtSecret(app) {
  const secretPath = path.join(app.getPath("userData"), "jwt.secret");

  try {
    const existing = fs.readFileSync(secretPath, "utf8").trim();
    if (existing.length >= 32) {
      return existing;
    }
  } catch (_) {
    // No existe todavía: se genera abajo.
  }

  const secret = crypto.randomBytes(48).toString("hex");
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, secret, { encoding: "utf8", mode: 0o600 });
  return secret;
}

/** La BD es remota si DB_URL apunta a algo que no sea este equipo. */
function isRemoteDatabase(config) {
  const url = config.values.DB_URL;
  if (!url) return false;

  return !/\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/)/i.test(url);
}

/** Claves obligatorias que faltan en la configuración cargada. */
function getMissingRequiredKeys(config) {
  return ["DB_USERNAME", "DB_PASSWORD"].filter(
    (key) => !config.values[key],
  );
}

/** Variables de entorno para lanzar el backend o docker compose. */
function buildChildEnv(config, extra = {}) {
  const env = { ...process.env };

  for (const key of FORWARDED_KEYS) {
    if (config.values[key] !== undefined) {
      env[key] = config.values[key];
    }
  }

  return { ...env, ...extra };
}

module.exports = {
  CONFIG_FILE_NAME,
  loadRuntimeConfig,
  getOrCreateJwtSecret,
  isRemoteDatabase,
  getMissingRequiredKeys,
  buildChildEnv,
};
