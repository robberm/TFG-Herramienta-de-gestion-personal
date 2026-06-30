import { apiRequest } from "./apiClient";

let cachedProfile = null;
let cachedProfileToken = null;

export const clearCurrentUserProfileCache = () => {
  cachedProfile = null;
  cachedProfileToken = null;
};

export const getCurrentUserProfile = async ({ forceRefresh = false } = {}) => {
  const token = localStorage.getItem("token");

  if (!token) {
    clearCurrentUserProfileCache();
    throw new Error("No hay sesión activa.");
  }

  if (!forceRefresh && cachedProfile && cachedProfileToken === token) {
    return cachedProfile;
  }

  const data = await apiRequest("/users/me", { method: "GET" });

  cachedProfile = data;
  cachedProfileToken = token;
  return data;
};

/**
 * Sube imagen de perfil.
 * Nota: FormData => includeJson false para no forzar Content-Type manual.
 */
export const updateCurrentUserProfileImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const data = await apiRequest("/users/profile-image", {
    method: "PUT",
    includeJson: false,
    body: formData,
  });

  clearCurrentUserProfileCache();
  return data;
};

export const deleteCurrentUserProfileImage = async () => {
  const data = await apiRequest("/users/profile-image", {
    method: "DELETE",
    includeJson: false,
  });
  clearCurrentUserProfileCache();
  return data;
};

export const changeCurrentUsername = async (newUsername, currentPassword) => {
  const data = await apiRequest("/users/change/username", {
    method: "POST",
    body: JSON.stringify({ newUsername, currentPassword }),
  });
  clearCurrentUserProfileCache();
  return data;
};

export const changeCurrentPassword = async (
  currentPassword,
  newPassword,
  confirmPassword,
) => {
  const data = await apiRequest("/users/change/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  clearCurrentUserProfileCache();
  return data;
};

export const deleteCurrentUser = async (currentPassword) => {
  const data = await apiRequest("/users/me", {
    method: "DELETE",
    body: JSON.stringify({ currentPassword }),
  });
  clearCurrentUserProfileCache();
  return data;
};
