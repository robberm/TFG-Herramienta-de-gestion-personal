import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { clearActiveSessionUser } from "../../api/authApi";
import { getCurrentUserProfile } from "../../api/userApi";
import { resolveProfileImageUrl } from "../../utils/profileImage";

import "../../css/UserMenu.css";
import { useLanguage } from "../../context/languageContext";

function UserMenu() {
  const { t } = useLanguage();
  const [userMenuIsOpen, setUserMenuIsOpen] = useState(false);
  const [username, setUsername] = useState(
    localStorage.getItem("username") || t.userDefault,
  );
  const [profileImage, setProfileImage] = useState(localStorage.getItem("profileImage") || "");

  const navigate = useNavigate();
  const location = useLocation();

  const userInitial = username.charAt(0).toUpperCase();

  useEffect(() => {
    setUserMenuIsOpen(false);
  }, [location]);

  useEffect(() => {
    loadCurrentUserProfile();
  }, [location]);

  const loadCurrentUserProfile = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setProfileImage("");
      return;
    }

    const usernameFromStorage = localStorage.getItem("username");
    const profileImageFromStorage = localStorage.getItem("profileImage");

    if (usernameFromStorage) {
      setUsername(usernameFromStorage);
    }

    setProfileImage(profileImageFromStorage || "");

    try {
      const profile = await getCurrentUserProfile({ forceRefresh: true });
      const resolvedProfileImage = profile?.profileImagePath
        ? resolveProfileImageUrl(profile.profileImagePath)
        : "";

      if (profile?.username) {
        localStorage.setItem("username", profile.username);
        setUsername(profile.username);
      }

      if (resolvedProfileImage) {
        localStorage.setItem("profileImage", resolvedProfileImage);
      } else {
        localStorage.removeItem("profileImage");
      }

      setProfileImage(resolvedProfileImage);
    } catch (_) {
      // Si el backend aún arranca, mantenemos caché local sin romper UI.
    }
  };

  const handleLogout = async () => {
    try {
      await clearActiveSessionUser();
    } catch (err) {
      console.warn(t.logoutFailed, err);
    }

    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("profileImage");
    localStorage.removeItem("role");
    localStorage.removeItem("organizationId");

    setProfileImage("");
    navigate("/", { replace: true });
  };

  return (
    <div className="userMenuFrame">
      <button
        type="button"
        className="userMenuTrigger"
        onClick={() => setUserMenuIsOpen(!userMenuIsOpen)}
      >
        <div className="userAvatar">
          {profileImage ? (
            <img
              src={profileImage}
              alt={`${username} profile`}
              className="userAvatarImage"
            />
          ) : (
            <span className="userAvatarFallback">{userInitial}</span>
          )}
        </div>

        <div className="userInfo">
          <span className="userName">{username}</span>
          <span className="userRole">{t.myAccount}</span>
        </div>

        <i
          className={`fa fa-chevron-down userFlecha ${userMenuIsOpen ? "open" : ""}`}
        ></i>
      </button>

      {userMenuIsOpen && (
        <div className="userMenuPop">
          <Link
            to="/settings"
            className="menuItem"
            onClick={() => setUserMenuIsOpen(false)}
          >
            <i className="fa fa-cog"></i>
            <span>{t.settings}</span>
          </Link>

          <div className="menuItem logout" onClick={handleLogout}>
            <i className="fa fa-sign-out-alt"></i>
            <span>{t.signOut}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
