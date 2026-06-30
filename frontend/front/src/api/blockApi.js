import { apiRequest } from "./apiClient";

/**
 * Endpoints del módulo de bloqueo/restricción de aplicaciones.
 */
export const getInstalledApps = () =>
  apiRequest("/api/installed-apps", { method: "GET", includeJson: false });

export const getBlockedApps = () =>
  apiRequest("/api/blocked-apps", { method: "GET", includeJson: false });

export const addBlockedApp = (executableName) =>
  apiRequest("/api/blocked-apps", {
    method: "POST",
    body: JSON.stringify({ executableName }),
  });

export const removeBlockedApp = (appName) =>
  apiRequest(`/api/blocked-apps/${encodeURIComponent(appName)}`, {
    method: "DELETE",
    includeJson: false,
  });

export const resetBlockedApps = () =>
  apiRequest("/api/blocked-apps/reset", {
    method: "DELETE",
    includeJson: false,
  });

export const getFocusState = () =>
  apiRequest("/api/block/focus-state", { method: "GET", includeJson: false });

export const updateFocusSettings = (payload) =>
  apiRequest("/api/block/focus-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
