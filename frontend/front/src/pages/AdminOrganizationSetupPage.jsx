import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAdminOrganization } from "../api/adminApi";
import { getCurrentUserProfile } from "../api/userApi";
import "../css/AdminUsers.css";
import { useLanguage } from "../context/languageContext";

// Icono de edificio
const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01"/>
    <path d="M16 6h.01"/>
    <path d="M12 6h.01"/>
    <path d="M12 10h.01"/>
    <path d="M12 14h.01"/>
    <path d="M16 10h.01"/>
    <path d="M16 14h.01"/>
    <path d="M8 10h.01"/>
    <path d="M8 14h.01"/>
  </svg>
);

function AdminOrganizationSetupPage() {
  const { t } = useLanguage();
  const [organizationName, setOrganizationName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const normalizedName = organizationName.trim();
    if (!normalizedName) {
      setErrorMessage(t.adminOrgNameRequired);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createAdminOrganization(normalizedName);
      if (response?.organizationId) {
        localStorage.setItem("organizationId", response.organizationId);
      }
      navigate("/admin", { replace: true });
    } catch (error) {
      if (error?.status === 409) {
        try {
          const profile = await getCurrentUserProfile({ forceRefresh: true });
          if (profile?.organizationId) {
            localStorage.setItem("organizationId", profile.organizationId);
            navigate("/admin", { replace: true });
            return;
          }
        } catch (_) {
          // Si falla el refresh, mantenemos el mensaje original de error.
        }
      }

      setErrorMessage(error.message || t.adminOrgCreateError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="adminUsersPage">
      <header className="adminUsersHeader centered">
        <div className="adminSetupIcon">
          <BuildingIcon />
        </div>
        <h1>{t.adminOrgSetupTitle}</h1>
        <p>
          {t.adminOrgSetupSubtitle}
        </p>
      </header>

      <section className="adminUsersCard compact">
        <h2>{t.adminOrgCreateTitle}</h2>

        <form className="adminUsersForm" onSubmit={handleSubmit}>
          <label>
            {t.adminOrgName}
            <input
              type="text"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder={t.adminOrgPlaceholder}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t.commonCreating : t.adminOrgCreateBtn}
          </button>
        </form>

        <p className={`adminFeedback error ${errorMessage ? "" : "hidden"}`} aria-live="polite">
          {errorMessage || "\u00a0"}
        </p>
      </section>
    </div>
  );
}

export default AdminOrganizationSetupPage;
