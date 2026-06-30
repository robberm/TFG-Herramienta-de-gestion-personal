import React, { useEffect, useState } from "react";
import { useDarkMode } from "../DarkModeContext";
import "../css/Settings.css";
import { resolveProfileImageUrl } from "../utils/profileImage";
import {
  changeCurrentPassword,
  changeCurrentUsername,
  deleteCurrentUserProfileImage,
  deleteCurrentUser,
  getCurrentUserProfile,
  updateCurrentUserProfileImage,
} from "../api/userApi";
import { getApiErrorMessage } from "../api/apiClient";
import { useLanguage } from "../context/languageContext";
import CustomSelectDropdown from "../components/shared/CustomSelectDropdown";

const Settings = () => {
  const { darkMode, translucentMode, toggleDarkMode, toggleTranslucentMode } =
    useDarkMode();
  const { language, setLanguage, t } = useLanguage();

  const [username, setUsername] = useState(
    localStorage.getItem("username") || "",
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileImage, setProfileImage] = useState("");

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameError, setUsernameError] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [autoStartSupported, setAutoStartSupported] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  useEffect(() => {
    loadCurrentUserProfile();
  }, []);

  useEffect(() => {
    const loadAutoStart = async () => {
      if (!window?.electronAPI?.electronSettings?.isAutoStartSupported) {
        return;
      }

      if (!window?.electronAPI?.electronSettings?.getAutoStart) return;

      try {
        const enabled = await window.electronAPI.electronSettings.getAutoStart();
        setAutoStartSupported(true);
        setAutoStartEnabled(!!enabled);
      } catch (_error) {
        setAutoStartSupported(false);
      }
    };

    loadAutoStart();
  }, []);

  const loadCurrentUserProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const data = await getCurrentUserProfile({ forceRefresh: true });

      if (data?.username) {
        setUsername(data.username);
        localStorage.setItem("username", data.username);
      }

      if (data?.profileImagePath) {
        const profileUrl = resolveProfileImageUrl(data.profileImagePath);
        setProfileImage(profileUrl);
        localStorage.setItem("profileImage", profileUrl);
      } else {
        setProfileImage("");
        localStorage.removeItem("profileImage");
      }
    } catch (error) {
      setProfileMessage(getApiErrorMessage(error, t.messages.profileLoadError));
      setProfileError(true);
    }
  };

  const handleProfileImageChange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      const data = await updateCurrentUserProfileImage(file);

      if (data?.username) {
        localStorage.setItem("username", data.username);
      }

      if (data?.profileImagePath) {
        const profileUrl = resolveProfileImageUrl(data.profileImagePath);
        setProfileImage(profileUrl);
        localStorage.setItem("profileImage", profileUrl);
      } else {
        setProfileImage("");
        localStorage.removeItem("profileImage");
      }

      setProfileMessage(
        data?.message || t.messages.profileUpdateSuccess,
      );
      setProfileError(false);
      e.target.value = "";
    } catch (error) {
      setProfileMessage(getApiErrorMessage(error, t.messages.profileUpdateError));
      setProfileError(true);
      e.target.value = "";
    }
  };

  const handleRemoveProfileImage = async () => {
    try {
      const data = await deleteCurrentUserProfileImage();

      setProfileImage("");
      setProfileMessage(data?.message || t.messages.profileDeleteSuccess);
      setProfileError(false);
    } catch (error) {
      setProfileMessage(getApiErrorMessage(error, t.messages.profileDeleteError));
      setProfileError(true);
    }
  };

  const handleUsernameSave = async () => {
    if (!username || !currentPassword) {
      setUsernameMessage(
        t.messages.usernameMissingData,
      );
      setUsernameError(true);
      return;
    }

    try {
      setUsernameMessage("");
      const data = await changeCurrentUsername(username, currentPassword);
      const message = data?.message || t.messages.usernameUpdateSuccess;

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);

      setUsername(data.username);
      setUsernameMessage(message);
      setUsernameError(false);
      setCurrentPassword("");
    } catch (error) {
      setUsernameMessage(getApiErrorMessage(error, t.messages.usernameUpdateError));
      setUsernameError(true);
    }
  };

  const handlePasswordSave = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage(t.messages.passwordMissingData);
      setPasswordError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(t.messages.passwordNoMatch);
      setPasswordError(true);
      return;
    }

    try {
      setPasswordMessage("");
      const data = await changeCurrentPassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      const message = data?.message || t.messages.passwordUpdateSuccess;

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);

      setPasswordMessage(message);
      setPasswordError(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordMessage(getApiErrorMessage(error, t.messages.passwordUpdateError));
      setPasswordError(true);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteMessage(t.messages.accountDeletePasswordPrompt);
      setDeleteError(true);
      return;
    }

    try {
      setDeleteMessage("");
      await deleteCurrentUser(deletePassword);
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("profileImage");
      localStorage.removeItem("role");
      localStorage.removeItem("organizationId");
      window.location.href = "/";
    } catch (error) {
      setDeleteMessage(getApiErrorMessage(error, t.messages.accountDeleteError));
      setDeleteError(true);
    }
  };

  return (
    <div className="settingsPage">
      <div className="settingsContainer">
        <h1 className="settingsTitle">{t.settings}</h1>

        
        <section className="settingsCard">
          <div className="settingsCardHeader">
            <h2>{t.language}</h2>
          </div>

          <div className="settingsRow">
            <div>
              <span className="settingsLabel">{t.language}</span>
            </div>

            <div className="settingsSelectWrap">
              <CustomSelectDropdown
                value={language}
                onChange={setLanguage}
                options={[
                  { value: "es", label: t.spanish },
                  { value: "en", label: t.english },
                ]}
              />
            </div>
          </div>
        </section>
<section className="settingsCard">
          <div className="settingsCardHeader">
            <h2>{t.appearance}</h2>
            <p>{t.appearanceDesc}</p>
          </div>

          <div className="settingsRow">
            <div>
              <span className="settingsLabel">{t.darkTheme}</span>
              <p className="settingsHint">{t.darkThemeHint}</p>
            </div>

            <button
              type="button"
              className={`settingsSwitch ${darkMode ? "active" : ""}`}
              onClick={toggleDarkMode}
            >
              <span className="settingsSwitchThumb"></span>
            </button>
          </div>

          <div className="settingsRow">
            <div>
              <span className="settingsLabel">{t.translucentTheme}</span>
              <p className="settingsHint">
                {t.translucentThemeHint}
              </p>
            </div>

            <button
              type="button"
              className={`settingsSwitch ${translucentMode ? "active" : ""}`}
              onClick={toggleTranslucentMode}
            >
              <span className="settingsSwitchThumb"></span>
            </button>
          </div>

          <div className="settingsRow">
            <div>
              <span className="settingsLabel">{t.autoStartWindows}</span>
              <p className="settingsHint">{t.autoStartWindowsHint}</p>
            </div>

            <button
              type="button"
              className={`settingsSwitch ${autoStartEnabled ? "active" : ""}`}
              disabled={!autoStartSupported}
              onClick={async () => {
                if (!autoStartSupported) return;
                const nextValue = !autoStartEnabled;
                try {
                  const enabled =
                    await window.electronAPI.electronSettings.setAutoStart(nextValue);
                  setAutoStartEnabled(!!enabled);
                } catch (_error) {}
              }}
            >
              <span className="settingsSwitchThumb"></span>
            </button>
          </div>
        </section>

        <section className="settingsCard">
          <div className="settingsCardHeader">
            <h2>{t.profile}</h2>
            <p>{t.profileDesc}</p>
          </div>

          <div className="profileSection">
            <div className="profileAvatarPreview">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile preview"
                  className="profileAvatarImage"
                />
              ) : (
                <span className="profileAvatarFallback">
                  {(username || "U").charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="profileActions">
              <label className="settingsButton primary">
                {t.uploadPhoto}
                <input
                  type="file"
                  accept="image/*"
                  className="hiddenFileInput"
                  onChange={handleProfileImageChange}
                />
              </label>

              <button
                type="button"
                className="settingsButton secondary"
                onClick={handleRemoveProfileImage}
              >
                {t.removePhoto}
              </button>
            </div>
          </div>
          {profileMessage && (
            <p className={`accountMessage ${profileError ? "error" : "success"}`}>
              {profileMessage}
            </p>
          )}
        </section>

        <section className="settingsCard">
          <div className="settingsCardHeader">
            <h2>{t.account}</h2>
            <p>{t.accountDesc}</p>
          </div>

          <div className="settingsFieldGroup">
            <label className="settingsFieldLabel" htmlFor="username">
              {t.username}
            </label>
            <input
              id="username"
              type="text"
              className="settingsInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.placeholders.newUsername}
            />
          </div>

          <div className="settingsFieldGroup">
            <label
              className="settingsFieldLabel"
              htmlFor="usernameCurrentPassword"
            >
              {t.currentPassword}
            </label>
            <input
              id="usernameCurrentPassword"
              type="password"
              className="settingsInput"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t.placeholders.currentPassword}
            />
          </div>

          <button
            type="button"
            className="settingsButton primary"
            onClick={handleUsernameSave}
          >
            {t.saveUsername}
          </button>
          {usernameMessage && (
            <p className={`accountMessage ${usernameError ? "error" : "success"}`}>
              {usernameMessage}
            </p>
          )}
        </section>

        <section className="settingsCard">
          <div className="settingsCardHeader">
            <h2>{t.security}</h2>
            <p>{t.securityDesc}</p>
          </div>

          <div className="settingsFieldGroup">
            <label className="settingsFieldLabel" htmlFor="currentPassword">
              {t.currentPassword}
            </label>
            <input
              id="currentPassword"
              type="password"
              className="settingsInput"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t.placeholders.currentPassword}
            />
          </div>

          <div className="settingsFieldGroup">
            <label className="settingsFieldLabel" htmlFor="newPassword">
              {t.newPassword}
            </label>
            <input
              id="newPassword"
              type="password"
              className="settingsInput"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t.placeholders.newPassword}
            />
          </div>

          <div className="settingsFieldGroup">
            <label className="settingsFieldLabel" htmlFor="confirmPassword">
              {t.confirmPassword}
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="settingsInput"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t.placeholders.confirmPassword}
            />
          </div>

          <button
            type="button"
            className="settingsButton primary"
            onClick={handlePasswordSave}
          >
            {t.changePassword}
          </button>
          {passwordMessage && (
            <p className={`accountMessage ${passwordError ? "error" : "success"}`}>
              {passwordMessage}
            </p>
          )}
        </section>

        <section className="settingsCard deleteAccountCard">
          <div className="settingsCardHeader">
            <h2>{t.accountDeleteTitle}</h2>
            <p>{t.accountDeleteDesc}</p>
          </div>

          <div className="settingsFieldGroup">
            <label className="settingsFieldLabel" htmlFor="deleteAccountPassword">
              {t.currentPassword}
            </label>
            <input
              id="deleteAccountPassword"
              type="password"
              className="settingsInput"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t.messages.accountDeletePasswordPrompt}
              autoComplete="current-password"
            />
          </div>

          <p className="settingsHint deleteAccountHint">
            {t.messages.accountDeleteConfirm}
          </p>

          <button type="button" className="settingsButton danger" onClick={handleDeleteAccount}>
            {t.accountDeleteButton}
          </button>

          {deleteMessage && (
            <p className={`accountMessage ${deleteError ? "error" : "success"}`}>
              {deleteMessage}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default Settings;
