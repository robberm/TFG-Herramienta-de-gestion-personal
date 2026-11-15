import { apiRequest } from "./apiClient";

const AI_URL = "/ai";

/**
 * cli: usa la suscripción del usuario a través de su CLI oficial instalado en el PC
 * (sin clave de API). installCommand se muestra si el CLI no está instalado.
 */
export const AI_PROVIDERS = [
  { id: "OPENAI", label: "OpenAI (ChatGPT) · API key", defaultModel: "gpt-4.1-mini" },
  { id: "ANTHROPIC", label: "Anthropic (Claude) · API key", defaultModel: "claude-opus-5-5" },
  { id: "GEMINI", label: "Google (Gemini) · API key", defaultModel: "gemini-2.5-flash" },
  {
    id: "CLAUDE_CODE",
    label: "Claude Code · Claude Pro/Max",
    defaultModel: "",
    cli: true,
    installCommand: "npm install -g @anthropic-ai/claude-code",
  },
  {
    id: "CODEX",
    label: "Codex CLI · ChatGPT",
    defaultModel: "",
    cli: true,
    installCommand: "npm install -g @openai/codex",
  },
];

const aiBridge = () =>
  typeof window !== "undefined" ? window.electronAPI?.ai ?? null : null;

/** La IA solo existe en la app de escritorio: la clave se guarda cifrada por Electron. */
export const isAiSupported = () => aiBridge() !== null;

/** Se emite al guardar o quitar la clave para que la pregunta diaria se vuelva a consultar. */
export const AI_SETTINGS_CHANGED_EVENT = "gmo:ai-settings-changed";

const notifySettingsChanged = (settings) => {
  window.dispatchEvent(new Event(AI_SETTINGS_CHANGED_EVENT));
  return settings;
};

export const getAiSettings = () => aiBridge()?.getSettings() ?? Promise.resolve(null);

export const saveAiSettings = (settings) =>
  aiBridge().saveSettings(settings).then(notifySettingsChanged);

export const clearAiSettings = () => aiBridge().clearSettings().then(notifySettingsChanged);

/**
 * Cabeceras X-AI-* con la clave descifrada por el proceso principal. Se piden en cada
 * llamada (no se cachean en el renderer) y nunca se guardan en localStorage.
 */
export const aiHeaders = async () => {
  const credentials = await aiBridge()?.getCredentials();
  if (!credentials) return {};
  return {
    "X-AI-Provider": credentials.provider,
    "X-AI-Model": credentials.model || "",
    "X-AI-Key": credentials.apiKey,
  };
};

const withAi = async (path, options = {}) =>
  apiRequest(path, {
    ...options,
    headers: { ...(options.headers || {}), ...(await aiHeaders()) },
  });

/** { installed, loggedIn, loginCommand, detail } del CLI en este PC. */
export const fetchCliStatus = (provider) =>
  apiRequest(`${AI_URL}/cli/status?provider=${encodeURIComponent(provider)}`, {
    method: "GET",
    includeJson: false,
  });

/** Abre una terminal con el login del CLI; el usuario vuelve y comprueba el estado. */
export const openCliLogin = (provider) => aiBridge().openCliLogin(provider);

export const testAiConnection = () =>
  withAi(`${AI_URL}/test`, { method: "POST", includeJson: false });

export const fetchDailyQuestion = () =>
  withAi(`${AI_URL}/daily-question`, { method: "GET", includeJson: false });

export const answerDailyQuestion = (id, text) =>
  withAi(`${AI_URL}/daily-question/${id}/answer`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

export const fetchDailyQuestionHistory = () =>
  apiRequest(`${AI_URL}/daily-question/history`, { method: "GET", includeJson: false });

export const fetchLearningTopics = () =>
  apiRequest(`${AI_URL}/topics`, { method: "GET", includeJson: false });

export const saveLearningTopics = (topics) =>
  apiRequest(`${AI_URL}/topics`, { method: "PUT", body: JSON.stringify({ topics }) });

export const fetchChatHistory = () =>
  apiRequest(`${AI_URL}/chat`, { method: "GET", includeJson: false });

export const sendChatMessage = (text) =>
  withAi(`${AI_URL}/chat`, { method: "POST", body: JSON.stringify({ text }) });

export const clearChatHistory = () =>
  apiRequest(`${AI_URL}/chat`, { method: "DELETE", includeJson: false });

export const fetchAiMemories = () =>
  apiRequest(`${AI_URL}/memories`, { method: "GET", includeJson: false });

export const deleteAiMemory = (id) =>
  apiRequest(`${AI_URL}/memories/${id}`, { method: "DELETE", includeJson: false });

export const clearAiMemories = () =>
  apiRequest(`${AI_URL}/memories`, { method: "DELETE", includeJson: false });
