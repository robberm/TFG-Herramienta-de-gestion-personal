const API_BASE_URL = "http://localhost:8080";

export const resolveProfileImageUrl = (profileImagePath) => {
  if (!profileImagePath) {
    return "";
  }

  if (
    profileImagePath.startsWith("http://") ||
    profileImagePath.startsWith("https://") ||
    profileImagePath.startsWith("data:") ||
    profileImagePath.startsWith("blob:")
  ) {
    return profileImagePath;
  }

  const normalizedPath = profileImagePath.replace(/^\/+/, "");

  if (normalizedPath.startsWith("uploads/")) {
    return `${API_BASE_URL}/${normalizedPath}`;
  }

  return `${API_BASE_URL}/uploads/${normalizedPath}`;
};
