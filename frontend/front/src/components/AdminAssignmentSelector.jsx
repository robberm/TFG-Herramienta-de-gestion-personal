import React, { useMemo, useState } from "react";
import "../css/AdminAssignmentSelector.css";
import { useLanguage } from "../context/languageContext";
import CustomSelectDropdown from "./shared/CustomSelectDropdown";

const AdminAssignmentSelector = ({
  mode,
  onModeChange,
  singleUserId,
  onSingleUserChange,
  selectedUserIds = [],
  onToggleUser,
  managedUsers = [],
  singlePlaceholder,
}) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return managedUsers;
    return managedUsers.filter((user) => user.username.toLowerCase().includes(term));
  }, [managedUsers, query]);

  const selectedUsers = useMemo(
    () => managedUsers.filter((user) => selectedUserIds.includes(String(user.id))),
    [managedUsers, selectedUserIds],
  );

  const modeOptions = [
    { value: "single", label: t.commonUser },
    { value: "multiple", label: t.commonMultipleUsers },
    { value: "all", label: t.commonAllOrganization },
  ];

  const singleUserOptions = managedUsers.map((user) => ({
    value: String(user.id),
    label: user.username,
  }));

  return (
    <div className="admin-assignment-panel">
      <CustomSelectDropdown
        label={t.commonAssignment}
        value={mode}
        options={modeOptions}
        onChange={(value) => {
          onModeChange(value);
        }}
      />

      {mode === "single" && (
        <CustomSelectDropdown
          label={t.commonUser}
          value={String(singleUserId ?? "")}
          options={singleUserOptions}
          placeholder={singlePlaceholder || t.commonSelectUser}
          onChange={(value) => {
            onSingleUserChange(value);
          }}
        />
      )}

      {mode === "all" && <div className="admin-assignment-all-confirm">✓ {t.commonAllOrganization}</div>}

      {mode === "multiple" && (
        <div className="admin-assignment-multi">
          <input type="text" className="admin-assignment-input" placeholder="Buscar usuarios..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {selectedUsers.length > 0 && (
            <div className="admin-assignment-tags">
              {selectedUsers.map((user) => (
                <button type="button" key={user.id} className="admin-assignment-tag" onClick={() => onToggleUser(user.id)}>
                  {user.username} <span>×</span>
                </button>
              ))}
            </div>
          )}
          <div className="admin-assignment-results">
            {filteredUsers.map((user) => {
              const checked = selectedUserIds.includes(String(user.id));
              return (
                <button type="button" key={user.id} className={`admin-assignment-result ${checked ? "selected" : ""}`} onClick={() => onToggleUser(user.id)}>
                  <span>{user.username}</span>
                  {checked && <span>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssignmentSelector;
