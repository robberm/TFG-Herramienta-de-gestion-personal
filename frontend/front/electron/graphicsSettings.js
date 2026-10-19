const path = require("path");
const fs = require("fs");

/**
 * Preferencias gráficas que el proceso principal necesita ANTES de que la app esté lista
 * (la aceleración por hardware solo se puede desactivar antes de app.ready), así que no
 * pueden vivir en el localStorage del renderer: se guardan en %APPDATA%/GMO/graphics.json.
 */
const FILE_NAME = "graphics.json";

const DEFAULTS = {
  // Sin aceleración se ahorra el proceso GPU, pero los temas translúcido y acrílico no se ofrecen.
  hardwareAcceleration: true,
  // Muestreo continuo del fondo (flujo de vídeo) en lugar de capturas cada 1,5 s.
  continuousBackdrop: false,
};

const getSettingsPath = (app) => path.join(app.getPath("userData"), FILE_NAME);

function loadGraphicsSettings(app) {
  try {
    const stored = JSON.parse(fs.readFileSync(getSettingsPath(app), "utf8"));
    return {
      hardwareAcceleration:
        typeof stored.hardwareAcceleration === "boolean"
          ? stored.hardwareAcceleration
          : DEFAULTS.hardwareAcceleration,
      continuousBackdrop:
        typeof stored.continuousBackdrop === "boolean"
          ? stored.continuousBackdrop
          : DEFAULTS.continuousBackdrop,
    };
  } catch (_) {
    // Primer arranque o fichero corrupto: valores por defecto.
    return { ...DEFAULTS };
  }
}

function saveGraphicsSettings(app, settings) {
  const settingsPath = getSettingsPath(app);
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        hardwareAcceleration: !!settings.hardwareAcceleration,
        continuousBackdrop: !!settings.continuousBackdrop,
      },
      null,
      2,
    ),
    "utf8",
  );
}

module.exports = { loadGraphicsSettings, saveGraphicsSettings };
