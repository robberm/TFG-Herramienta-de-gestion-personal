const API_BASE_URL = "http://localhost:8080";
const API_TEXTS = {
  en: {
    noSession: "No active session.",
    genericError: "An unexpected error occurred.",
  },
  es: {
    noSession: "No hay sesión activa.",
    genericError: "Ha ocurrido un error inesperado.",
  },
};

const getLanguage = () => (localStorage.getItem("appLanguage") === "es" ? "es" : "en");
const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

const text = (key) => API_TEXTS[getLanguage()][key];

/**
 * Error de API tipado para que la UI pueda decidir:
 * - qué texto mostrar
 * - si renderizar errores de formulario (details)
 * - si tratar un 401/403 de forma especial
 */
export class ApiClientError extends Error {
  constructor(message, status = null, details = null, path = null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
    this.path = path;
  }
}

/**
 * Devuelve el token actual o lanza error si no hay sesión.
 */
const getTokenOrThrow = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new ApiClientError(text("noSession"), 401);
  }
  return token;
};

/**
 * Crea cabeceras estándar para peticiones al backend.
 */
const buildHeaders = ({ includeAuth = true, includeJson = true, extraHeaders = {} } = {}) => {
  const appLanguage = localStorage.getItem("appLanguage");
  const normalizedLanguage = appLanguage === "es" ? "es" : "en";
  const headers = {
    "Accept-Language": normalizedLanguage,
    ...extraHeaders,
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  if (isElectronEnvironment) {
    headers["X-Client-Platform"] = "desktop";
  }

  if (includeAuth) {
    headers.Authorization = `Bearer ${getTokenOrThrow()}`;
  }

  return headers;
};

const parseErrorResponse = async (response) => {
  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      return new ApiClientError(
        body.message || text("genericError"),
        response.status,
        body.details || null,
        body.path || null,
      );
    }
  } catch (_) {
    // Si no es JSON, intentamos texto plano.
  }

  try {
    const text = await response.text();
    if (text) {
      return new ApiClientError(text, response.status);
    }
  } catch (_) {
    // Ignorado: usamos fallback.
  }

  return new ApiClientError(text("genericError"), response.status);
};

const parseSuccessResponse = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

/**
 * Cliente HTTP centralizado con manejo homogéneo de errores.
 */
export const apiRequest = async (path, options = {}) => {
  const {
    includeAuth = true,
    includeJson = true,
    headers = {},
    ...rest
  } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders({
      includeAuth,
      includeJson,
      extraHeaders: headers,
    }),
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return parseSuccessResponse(response);
};

/**
 * Helper para sacar mensaje "bonito" sin romper UI antigua.
 */
export const getApiErrorMessage = (error, fallback = text("genericError")) => {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};
