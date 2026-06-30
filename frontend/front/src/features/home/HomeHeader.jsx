import React from "react";
import { useLanguage } from "../../context/languageContext";

const HomeHeader = () => {
  const { t } = useLanguage();
  const username = localStorage.getItem("username");

  return (
    <>
      <div className="personalHeader">
        <h1>
          {t.homeNiceToSeeYou}&nbsp;
          <span className="slide-in-bottom" aria-hidden="false">
            <span className="slide-inner">
              <span className="slide-original">{username}</span>
              <span className="slide-duplicate">{username}</span>
            </span>
          </span>!
        </h1>
      </div>

      <div className="dashboardHeader">
        <h1>Dashboard</h1>
      </div>
    </>
  );
};

export default HomeHeader;
