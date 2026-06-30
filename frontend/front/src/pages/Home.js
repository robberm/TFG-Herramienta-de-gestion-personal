import React, { useEffect, useMemo, useState } from "react";
import "../css/Home.css";
import PieChart from "../features/objectives/components/PieChart.jsx";
import HomeHeader from "../features/home/HomeHeader.jsx";
import DailyWidget from "../features/home/DailyWidget.jsx";
import RemindersPanel from "../features/home/RemindersPanel.js";
import useTodayEvents from "../hooks/useTodayEvents.jsx";
import { getCurrentUserProfile } from "../api/userApi";
import { getManagedUsers, getManagedUserGoals } from "../api/adminApi";
import { calculateGlobalGoalsProgress } from "../features/objectives/utils/objectiveHelpers";
import { resolveProfileImageUrl } from "../utils/profileImage";
import { useLanguage } from "../context/languageContext";

const AdminGoalsStats = ({ goals, t }) => {
  const metrics = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((goal) => goal.status === "Done").length;
    const inProgress = goals.filter((goal) => goal.status === "InProgress").length;
    const notStarted = goals.filter(
      (goal) => (goal.status || "NotStarted") === "NotStarted",
    ).length;

    return {
      total,
      completed,
      inProgress,
      notStarted,
      progress: calculateGlobalGoalsProgress(goals),
    };
  }, [goals]);

  return (
    <section className="adminGoalsStats">
      <h3>{t.homeGoalsStats}</h3>
      <div className="adminGoalsStatsGrid">
        <article className="adminGoalsMetricCard">
          <span>{t.homeTotal}</span>
          <strong>{metrics.total}</strong>
        </article>
        <article className="adminGoalsMetricCard">
          <span>{t.goalStatusNotStarted}</span>
          <strong>{metrics.notStarted}</strong>
        </article>
        <article className="adminGoalsMetricCard">
          <span>{t.homeInProgress}</span>
          <strong>{metrics.inProgress}</strong>
        </article>
        <article className="adminGoalsMetricCard">
          <span>{t.homeDone}</span>
          <strong>{metrics.completed}</strong>
        </article>
      </div>

      <div className="adminGoalsProgressBlock">
        <div className="progressBarContainer goalsSummaryProgressBar">
          <div
            className="progressBarFill"
            style={{ width: `${metrics.progress}%` }}
          ></div>
        </div>
        <span className="progressText">{t.homeGlobalProgress}</span>
      </div>
    </section>
  );
};

const Home = () => {
  const { t } = useLanguage();
  const { todayEvents, refreshTodayEvents, isLoadingTodayEvents } =
    useTodayEvents();

  const [profile, setProfile] = useState(null);
  const [managedUsers, setManagedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserGoals, setSelectedUserGoals] = useState([]);
  const [isLoadingAdminGoals, setIsLoadingAdminGoals] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  const isAdmin = profile?.role === "ADMIN";

  useEffect(() => {
    const loadHomeScope = async () => {
      try {
        const currentProfile = await getCurrentUserProfile();
        setProfile(currentProfile);

        if (currentProfile?.role === "ADMIN") {
          const users = await getManagedUsers();
          const normalizedUsers = Array.isArray(users) ? users : [];
          setManagedUsers(normalizedUsers);

        }
      } catch (error) {
        console.error("Error loading home scope:", error);
      }
    };

    loadHomeScope();
  }, []);

  useEffect(() => {
    const loadGoals = async () => {
      if (!isAdmin || !selectedUser?.id) {
        setSelectedUserGoals([]);
        return;
      }

      setIsLoadingAdminGoals(true);
      try {
        const goals = await getManagedUserGoals(selectedUser.id);
        setSelectedUserGoals(Array.isArray(goals) ? goals : []);
      } catch (error) {
        console.error("Error loading managed user goals:", error);
        setSelectedUserGoals([]);
      } finally {
        setIsLoadingAdminGoals(false);
      }
    };

    loadGoals();
  }, [isAdmin, selectedUser]);

  const handleExportMonthlyAdminCsv = async () => {
    if (!isAdmin || managedUsers.length === 0) return;

    const today = new Date();
    const monthLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const orgSlug = (profile?.organizationName || "organization")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setIsExportingReport(true);

    try {
      const goalsPerUser = await Promise.all(
        managedUsers.map(async (user) => ({
          user,
          goals: await getManagedUserGoals(user.id),
        })),
      );

      const escapeCsv = (value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
      const rows = [
        "userId,username,month,goalsTotal,goalsDone,goalsInProgress,highPriorityCompleted,mediumPriorityCompleted,lowPriorityCompleted",
      ];

      goalsPerUser.forEach(({ user, goals }) => {
        const safeGoals = Array.isArray(goals) ? goals : [];
        const goalsDone = safeGoals.filter((goal) => goal.status === "Done");
        const highDone = goalsDone.filter((goal) => goal.priority === "Alta").length;
        const mediumDone = goalsDone.filter((goal) => goal.priority === "Media").length;
        const lowDone = goalsDone.filter((goal) => goal.priority === "Baja").length;

        rows.push(
          [
            user.id,
            escapeCsv(user.username),
            monthLabel,
            safeGoals.length,
            goalsDone.length,
            safeGoals.filter((goal) => goal.status === "InProgress").length,
            highDone,
            mediumDone,
            lowDone,
          ].join(","),
        );
      });

      rows.push("");
      rows.push("userId,username,goalId,goalTitle,priority,status,description");

      goalsPerUser.forEach(({ user, goals }) => {
        const safeGoals = Array.isArray(goals) ? goals : [];
        safeGoals.forEach((goal) => {
          rows.push(
            [
              user.id,
              escapeCsv(user.username),
              goal.id,
              escapeCsv(goal.titulo),
              escapeCsv(goal.priority),
              escapeCsv(goal.status),
              escapeCsv(goal.description || ""),
            ].join(","),
          );
        });
      });

      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${orgSlug || "organization"}-goals-report-${monthLabel}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting monthly report:", error);
    } finally {
      setIsExportingReport(false);
    }
  };

if (isAdmin) {
  return (
    <>
      <HomeHeader />

      <div className="adminHomeSection">
        <div className="adminHomeActions">
          <button
            className="refreshButton"
            onClick={handleExportMonthlyAdminCsv}
            disabled={isExportingReport}
          >
            <i className="fa fa-download"></i>{" "}
            {isExportingReport ? t.homeLoading : t.adminExportMonthlyCsv}
          </button>
        </div>
        <div className="adminUsersCardsGrid">
          {managedUsers.length === 0 && (
            <p className="adminHomeEmptyState">
              {t.homeNoManagedUsers}
            </p>
          )}

          {managedUsers.map((user) => {
            const isSelected = selectedUser?.id === user.id;

            return (
              <div
                key={user.id}
                className={`adminUserCard ${isSelected ? "expanded" : ""}`}
                onClick={() => !isSelected && setSelectedUser(user)}
              >
                <div className="adminUserCardHeader">
                  {user.profileImagePath ? (
                    <img
                      src={resolveProfileImageUrl(user.profileImagePath)}
                      alt={user.username}
                    />
                  ) : (
                    <div className="adminUserAvatarFallback">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="adminUserCardInfo">
                    <strong>{user.username}</strong>
                    <span>{user.organizationName || t.homeNoOrganization}</span>
                  </div>
                  <button
                    className="adminCloseBtn"
                    onClick={(e) => { e.stopPropagation(); setSelectedUser(null); }}
                  >
                    ×
                  </button>
                </div>

                <div className="adminUserCardBody">
                  {isSelected && (
                    isLoadingAdminGoals ? (
                      <p className="adminLoadingState">{t.homeLoading}</p>
                    ) : (
                      <AdminGoalsStats goals={selectedUserGoals} t={t} />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

  return (
    <>
      <HomeHeader />

      <div className="homeHeroSection">
        <div className="homeHeroGrid">
          <div className="homeLeftColumn">
            <div className="chartSection">
              <div className="chartContainer">
                <PieChart />
              </div>
            </div>

            <RemindersPanel
              todayEvents={todayEvents}
              isLoadingTodayEvents={isLoadingTodayEvents}
            />
          </div>

          <DailyWidget
            events={todayEvents}
            onEventsChanged={refreshTodayEvents}
          />
        </div>
      </div>
    </>
  );
};

export default Home;
