import { apiRequest } from "./apiClient";

export const getManagedUsers = async () => {
  return apiRequest("/admin/users", { method: "GET" });
};

export const createManagedUser = async (payload) => {
  return apiRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const deleteManagedUser = async (userId) => {
  return apiRequest(`/admin/users/${userId}`, {
    method: "DELETE",
  });
};


export const createAdminOrganization = async (organizationName) => {
  return apiRequest("/admin/organization", {
    method: "POST",
    body: JSON.stringify({ organizationName }),
  });
};

export const getManagedUserGoals = async (userId) => {
  return apiRequest(`/admin/users/${userId}/goals`, { method: "GET" });
};
