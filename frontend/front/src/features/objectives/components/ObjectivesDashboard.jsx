import React, { useMemo, useState } from "react";
import {
  buildWeeklyHabitStats,
  calculateGlobalGoalsProgress,
  formatIsoDate,
  getStartOfWeek,
} from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";
import HabitBarChart from "./HabitBarChart";
import HabitLineChart from "./HabitLineChart";
import HabitMonthView from "./HabitMonthView";

const ObjectivesDashboard = ({
  goals,
  habits,
  logs,
  habitWeekStart,
  selectedHabitDate,
  onSelectHabitDate,
  onPreviousHabitWeek,
  onNextHabitWeek,
}) => {
  const { language, t } = useLanguage();
  const [habitChartType, setHabitChartType] = useState("bar");
  const todayIso = formatIsoDate(new Date());
  const currentWeekStart = getStartOfWeek(new Date());
  const isCurrentHabitWeek =
    formatIsoDate(habitWeekStart) === formatIsoDate(currentWeekStart);
  const habitWeekEnd = useMemo(() => {
    const end = new Date(habitWeekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [habitWeekStart]);
  const habitWeekRangeLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
      day: "numeric",
      month: "short",
    });

    return `${formatter.format(habitWeekStart)} – ${formatter.format(habitWeekEnd)}`;
  }, [habitWeekEnd, habitWeekStart, language]);

  /**
   * Calcula todas las métricas que usamos en el dashboard.
   * La gráfica semanal usa la semana seleccionada con flechas, pero las rachas y el resumen de hoy siguen mirando al día real.
   */
  const metrics = useMemo(() => {
    const weeklyStats = buildWeeklyHabitStats(habits, logs, habitWeekStart);

    const completedToday = logs.filter(
      (log) => log.logDate === todayIso && log.completed === true,
    ).length;

    const totalCompletedWeek = weeklyStats.reduce(
      (acc, day) => acc + day.completed,
      0,
    );

    const totalPossibleWeek = weeklyStats.reduce(
      (acc, day) => acc + day.total,
      0,
    );

    const weeklyRate =
      totalPossibleWeek > 0
        ? Math.round((totalCompletedWeek * 100) / totalPossibleWeek)
        : 0;

    const bestHabitStreak =
      habits.length > 0
        ? Math.max(...habits.map((habit) => Number(habit.bestStreak || 0)))
        : 0;

    const currentBestHabitStreak =
      habits.length > 0
        ? Math.max(...habits.map((habit) => Number(habit.currentStreak || 0)))
        : 0;
    const currentBestHabit = habits.find(
      (habit) => Number(habit.currentStreak || 0) === currentBestHabitStreak,
    );
    const bestStreakHabit = habits.find(
      (habit) => Number(habit.bestStreak || 0) === bestHabitStreak,
    );

    const notStartedGoals = goals.filter(
      (goal) => (goal.status || "NotStarted") === "NotStarted",
    ).length;

    const completedGoals = goals.filter((goal) => goal.status === "Done").length;

    const goalsInProgress = goals.filter(
      (goal) => goal.status === "InProgress",
    ).length;

    const totalGoals = goals.length;

    const globalGoalsProgress = calculateGlobalGoalsProgress(goals);

    const todayPercent =
      habits.length > 0
        ? Math.round((completedToday / habits.length) * 100)
        : 0;

    return {
      completedToday,
      weeklyRate,
      bestHabitStreak,
      weeklyStats,
      notStartedGoals,
      completedGoals,
      goalsInProgress,
      totalGoals,
      globalGoalsProgress,
      currentBestHabitStreak,
      currentBestHabitTitle: currentBestHabit?.titulo || "—",
      bestStreakHabitTitle: bestStreakHabit?.titulo || "—",
      todayPercent,
    };
  }, [goals, habitWeekStart, habits, logs, todayIso]);

  /**
   * Renderiza el anillo de progreso reutilizable para las cards superiores.
   */
  const renderRing = (percent) => {
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return (
      <div className="summaryRing" aria-hidden="true">
        <svg viewBox="0 0 60 60">
          <circle className="ringBg" cx="30" cy="30" r={radius} />
          <circle
            className="ringProgress"
            cx="30"
            cy="30"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
      </div>
    );
  };

  return (
    <section className="objectivesDashboard">
      <div className="summaryCardsGrid">
        <article className="summaryCard">
          <div className="summaryCardContent">
            <div className="summaryTextBlock">
              <span className="summaryLabel">{t.dashboardCurrentBestStreak}</span>
              <strong className="summaryValue">
                {metrics.currentBestHabitStreak}
              </strong>
              <small className="summarySubLabel">{metrics.currentBestHabitTitle}</small>
            </div>
          </div>
        </article>

        <article className="summaryCard">
          <div className="summaryCardContent">
            <div className="summaryTextBlock">
              <span className="summaryLabel">{t.dashboardDoneToday}</span>
              <strong className="summaryValue">
                {metrics.completedToday}/{habits.length}
              </strong>
            </div>
            {renderRing(metrics.todayPercent)}
          </div>
        </article>

        <article className="summaryCard">
          <div className="summaryCardContent">
            <div className="summaryTextBlock">
              <span className="summaryLabel">{t.dashboardWeeklyRate}</span>
              <strong className="summaryValue">{metrics.weeklyRate}%</strong>
            </div>
            {renderRing(metrics.weeklyRate)}
          </div>
        </article>

        <article className="summaryCard">
          <div className="summaryCardContent">
            <div className="summaryTextBlock">
              <span className="summaryLabel">{t.dashboardBestStreak}</span>
              <strong className="summaryValue">
                {metrics.bestHabitStreak}
              </strong>
              <small className="summarySubLabel">{metrics.bestStreakHabitTitle}</small>
            </div>
          </div>
        </article>
      </div>

      <div className="dashboardGrid">
        <article className="dashboardCard">
          <div className="cardHeader">
            <h3>{t.dashboardGoalsSummary}</h3>
          </div>

          <div className="goalsSummaryPanel">
            <div className="goalsSummaryTop">
              <div className="goalsSummaryMainMetric">
                <span className="goalsSummaryLabel">{t.homeGlobalProgress}</span>
                <strong className="goalsSummaryBigValue">
                  {metrics.globalGoalsProgress}%
                </strong>
              </div>
            </div>

            <div className="goalsSummaryProgressBlock">
              <div className="progressBarContainer goalsSummaryProgressBar">
                <div
                  className="progressBarFill"
                  style={{ width: `${metrics.globalGoalsProgress}%` }}
                ></div>
              </div>
              <span className="progressText">
                {t.dashboardGoalsAverageProgress}
              </span>
            </div>

            <div className="goalsMetricsGrid">
              <div className="goalsMetricCard">
                <span className="goalsMetricLabel">{t.goalStatusNotStarted}</span>
                <strong className="goalsMetricValue">
                  {metrics.notStartedGoals}
                </strong>
              </div>

              <div className="goalsMetricCard">
                <span className="goalsMetricLabel">{t.homeInProgress}</span>
                <strong className="goalsMetricValue">
                  {metrics.goalsInProgress}
                </strong>
              </div>

              <div className="goalsMetricCard">
                <span className="goalsMetricLabel">{t.homeDone}</span>
                <strong className="goalsMetricValue">
                  {metrics.completedGoals}
                </strong>
              </div>

              <div className="goalsMetricCard">
                <span className="goalsMetricLabel">{t.homeTotal}</span>
                <strong className="goalsMetricValue">
                  {metrics.totalGoals}
                </strong>
              </div>
            </div>
          </div>
        </article>

        <article className="dashboardCard">
          <div className="cardHeader weeklyActivityHeader">
            <button
              type="button"
              className="weeklyNavButton"
              onClick={onPreviousHabitWeek}
              aria-label={t.dashboardPreviousWeek}
              title={t.dashboardPreviousWeek}
            >
              ‹
            </button>
            <h3>{habitWeekRangeLabel}</h3>
            <button
              type="button"
              className="weeklyNavButton"
              onClick={onNextHabitWeek}
              disabled={isCurrentHabitWeek}
              aria-label={t.dashboardNextWeek}
              title={t.dashboardNextWeek}
            >
              ›
            </button>
          </div>

          <div className="habitChartToggle" role="group" aria-label={t.dashboardChartType}>
            {[
              ["bar", t.dashboardChartBars],
              ["line", t.dashboardChartLines],
            ].map(([type, label]) => (
              <button
                key={type}
                type="button"
                className={`habitChartToggleButton ${habitChartType === type ? "isActive" : ""}`}
                onClick={() => setHabitChartType(type)}
                aria-pressed={habitChartType === type}
              >
                {label}
              </button>
            ))}
          </div>

          {habitChartType === "bar" ? (
            <HabitBarChart
              data={metrics.weeklyStats}
              totalHabits={habits.length}
              selectedDate={selectedHabitDate}
              todayIso={todayIso}
              onSelectDate={onSelectHabitDate}
            />
          ) : (
            <HabitLineChart
              data={metrics.weeklyStats}
              habits={habits}
              logs={logs}
              selectedDate={selectedHabitDate}
              todayIso={todayIso}
              onSelectDate={onSelectHabitDate}
            />
          )}
        </article>
      </div>

      <HabitMonthView habits={habits} logs={logs} />
    </section>
  );
};

export default ObjectivesDashboard;
