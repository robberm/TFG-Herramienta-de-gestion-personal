import { apiRequest } from "./apiClient";

/**
 * Login de usuario.
 * Devuelve token + datos básicos de sesión.
 */
export const loginUser = (username, password) =>
  apiRequest("/users/login", {
    method: "POST",
    includeAuth: false,
    body: JSON.stringify({ username, password }),
  });

/**
 * Registro público de usuario personal.
 */
export const registerUser = (username, password) =>
  apiRequest("/users/register", {
    method: "POST",
    includeAuth: false,
    body: JSON.stringify({ username, password }),
  });

/**
 * Marca el usuario autenticado como activo en backend.
 */
export const registerActiveSessionUser = () =>
  apiRequest("/session/active-user", {
    method: "POST",
    includeJson: false,
  });

/**
 * Limpia usuario activo en backend al cerrar sesión.
 */
export const clearActiveSessionUser = () =>
  apiRequest("/session/clear", {
    method: "POST",
    includeJson: false,
  });
