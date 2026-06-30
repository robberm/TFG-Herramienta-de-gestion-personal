import React, { useEffect, useMemo, useState } from "react";
import "../css/AdminUsers.css";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUsers,
} from "../api/adminApi";
import { useLanguage } from "../context/languageContext";

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const initialForm = {
  username: "",
  password: "",
};

function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users],
  );

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await getManagedUsers();
      setUsers(Array.isArray(response) ? response : []);
    } catch (error) {
      setErrorMessage(error.message || t.adminUsersLoadError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.username.trim() || !form.password.trim()) {
      setErrorMessage(t.adminUsersRequired);
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createManagedUser({
        username: form.username.trim(),
        password: form.password,
      });

      setUsers((current) => [...current, created]);
      setForm(initialForm);
      setSuccessMessage(`${t.adminUser} ${created.username} ${t.adminCreated}`);
    } catch (error) {
      setErrorMessage(error.message || t.adminCreateError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    setErrorMessage("");
    setSuccessMessage("");

    const confirmed = window.confirm(
      `${t.adminConfirmDeletePrefix} ${username}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteManagedUser(userId);
      setUsers((current) => current.filter((user) => user.id !== userId));
      setSuccessMessage(`${t.adminUser} ${username} ${t.adminDeleted}`);
    } catch (error) {
      setErrorMessage(error.message || t.adminDeleteError);
    }
  };

  return (
    <div className="adminUsersPage">
      <header className="adminUsersHeader">
        <h1>{t.adminUsersTitle}</h1>
        <p>{t.adminUsersSubtitle}</p>
      </header>

      <section className="adminUsersCard">
        <h2>{t.adminCreateManaged}</h2>

        <form className="adminUsersForm" onSubmit={handleCreateUser}>
          <label>
            {t.username}
            <input
              type="text"
              value={form.username}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              placeholder="usuario.subordinado"
            />
          </label>

          <label>
            {t.loginPassword}
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder={t.loginPassword}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t.commonCreating : t.adminCreate}
          </button>
        </form>
      </section>

      <section className="adminUsersCard">
        <div className="adminUsersListHeader">
          <h2>{t.adminManagedUsers}</h2>
        </div>

        {errorMessage && <p className="adminFeedback error">{errorMessage}</p>}
        {successMessage && (
          <p className="adminFeedback success">{successMessage}</p>
        )}

        {isLoading ? (
          <div className="adminLoading">
            <div className="adminSpinner" />
            <span>{t.adminLoadingUsers}</span>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="adminEmptyState">
            <UsersIcon />
            <p>{t.adminNoUsers}</p>
          </div>
        ) : (
          <div className="adminUsersTableWrap">
            <table className="adminUsersTable">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>{t.adminOrganization}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.organizationName || "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteUser(user.id, user.username)}
                      >
                        {t.adminDeleteBtn}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUsersPage;
