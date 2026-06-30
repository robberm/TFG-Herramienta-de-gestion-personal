import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUserProfile } from "../api/userApi";


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
        let role = localStorage.getItem("role");
        let organizationId = localStorage.getItem("organizationId");

        if (!role) {
          const profile = await getCurrentUserProfile();
          role = profile?.role || "PERSONAL";
          organizationId = profile?.organizationId ?? "";
          localStorage.setItem("role", role);
          localStorage.setItem("organizationId", organizationId);
        }

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
        const hasToken = Boolean(localStorage.getItem("token"));
        if (isElectronEnvironment && hasToken) {
          console.warn("[ProtectedRoute] Validación remota fallida en Electron. Se mantiene sesión local.", error);
          if (isMounted) setStatus("ok");
          return;
        }

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
