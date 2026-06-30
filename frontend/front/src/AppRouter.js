import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import App from "./App";
import Objectives from "./pages/Objectives";
import Settings from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";
import Calendar from "./features/calendar/Calendar";
import Block from "./pages/Block";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminOrganizationSetupPage from "./pages/AdminOrganizationSetupPage";

const AppRouter = () => {
  return (
    <Routes>
      {/*------------- Rutas públicas ------------- */}
      <Route path="/" element={<App />} />

      {/*------------- Rutas protegidas------------- */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      <Route
        path="/objectives"
        element={
          <ProtectedRoute>
            <Objectives />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        }
      />

      <Route
        path="/block"
        element={
          <ProtectedRoute disallowAdmin>
            <Block />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/setup-organization"
        element={
          <ProtectedRoute requireAdmin allowAdminWithoutOrganization>
            <AdminOrganizationSetupPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminUsersPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
