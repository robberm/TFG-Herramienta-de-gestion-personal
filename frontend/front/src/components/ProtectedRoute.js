import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { clearCurrentUserProfileCache, getCurrentUserProfile } from "../api/userApi";


const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

const ProtectedRoute = ({
  children,
  requireAdmin = false,
  disallowAdmin = false,
  allowAdminWithoutOrganization = false,
}) => {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (isMounted) setStatus("unauthorized");
        return;
      }

      try {
        // Siempre se valida el token contra el backend (el perfil queda cacheado en memoria
        // por token, así que solo cuesta una petición por sesión). Antes, con el rol en
        // localStorage se saltaba la validación y un token inválido dejaba la app llena de 401.
        const profile = await getCurrentUserProfile();
        const role = profile?.role || "PERSONAL";
        const organizationId = profile?.organizationId ?? "";
        localStorage.setItem("role", role);
        localStorage.setItem("organizationId", organizationId);

        const isAdmin = role === "ADMIN";
        const hasOrganization = Boolean(organizationId);

        if (requireAdmin && !isAdmin) {
          if (isMounted) setStatus("forbidden");
          return;
        }

        if (disallowAdmin && isAdmin) {
          if (isMounted) setStatus("admin_redirect");
          return;
        }

        if (
          isAdmin &&
          !hasOrganization &&
          !allowAdminWithoutOrganization &&
          requireAdmin
        ) {
          if (isMounted) setStatus("setup_org");
          return;
        }

        if (isMounted) setStatus("ok");
      } catch (error) {
        // 401 = el backend ha rechazado el token (firmado con otro secreto, usuario borrado,
        // token revocado...). Mantener la sesión solo provocaría 401 en todas las pantallas.
        const isRejectedToken = error?.status === 401;
        const hasToken = Boolean(localStorage.getItem("token"));
        if (isElectronEnvironment && hasToken && !isRejectedToken) {
          // El backend local aún no responde (arrancando): se mantiene la sesión.
          console.warn("[ProtectedRoute] Validación remota fallida en Electron. Se mantiene sesión local.", error);
          if (isMounted) setStatus("ok");
          return;
        }

        clearCurrentUserProfileCache();
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        localStorage.removeItem("organizationId");
        if (isMounted) setStatus("unauthorized");
      }
    };

    validateSession();

    return () => {
      isMounted = false;
    };
  }, [allowAdminWithoutOrganization, disallowAdmin, requireAdmin]);

  if (status === "loading") {
    return null;
  }

  if (status === "unauthorized") {
    return <Navigate to="/" replace />;
  }

  if (status === "forbidden") {
    return <Navigate to="/home" replace />;
  }

  if (status === "admin_redirect") {
    return <Navigate to="/admin" replace />;
  }

  if (status === "setup_org") {
    return <Navigate to="/admin/setup-organization" replace />;
  }

  return children;
};

export default ProtectedRoute;
