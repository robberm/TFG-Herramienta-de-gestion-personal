import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GOAL_STATUS_COLORS,
  getGoalTrackingPercent,
  getPriorityColor,
  sortGoalsByPriority,
} from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";

const GoalsSection = ({
  goals,
  onCreate,
  onEdit,
  onDelete,
  isAdmin = false,
  showAssignedUserColumn = false,
}) => {
  const { t } = useLanguage();
  const [showCompleted, setShowCompleted] = useState(false);
  const mainWrapperRef = useRef(null);
  const mainTableRef = useRef(null);
  const completedWrapperRef = useRef(null);
  const completedTableRef = useRef(null);
  const [mainHasOverflow, setMainHasOverflow] = useState(false);
  const [completedHasOverflow, setCompletedHasOverflow] = useState(false);

  useEffect(() => {
    const syncOverflow = (wrapper, table, setter) => {
      if (!wrapper || !table) return;
      setter(table.scrollWidth > wrapper.clientWidth + 1);
    };

    const update = () => {
      syncOverflow(mainWrapperRef.current, mainTableRef.current, setMainHasOverflow);
      syncOverflow(
        completedWrapperRef.current,
        completedTableRef.current,
        setCompletedHasOverflow,
      );
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [goals, showCompleted, showAssignedUserColumn]);

  const getPriorityLabel = (priority) => {
    if (priority === "Alta") return t.priorityHigh;
    if (priority === "Media") return t.priorityMedium;
    if (priority === "Baja") return t.priorityLow;
    return priority;
  };

  const getStatusLabel = (status) => {
    if (status === "NotStarted") return t.goalStatusNotStarted;
    if (status === "InProgress") return t.goalStatusInProgress;
    if (status === "Done") return t.goalStatusDone;
    return status;
  };

  /**
   * Goals activos:
   * - no completados
   * - activos
   * - ordenados por prioridad
   */
  const activeGoals = useMemo(
    () =>
      sortGoalsByPriority(
        goals.filter((goal) => goal.status !== "Done" && goal.active !== false),
      ),
    [goals],
  );

  /**
   * Goals completados o inactivos, que se mostrarán en la sección plegable.
   */
  const completedGoals = useMemo(
    () =>
      sortGoalsByPriority(
        goals.filter((goal) => goal.status === "Done" || goal.active === false),
      ),
    [goals],
  );

  const getAssignedUserLabel = (goal) => {
    const assignedUsernames = Array.isArray(goal.assignedToUsernames)
      ? goal.assignedToUsernames.filter(Boolean)
      : [];

    if (assignedUsernames.length > 1) {
      return t.commonMultipleUsers;
    }

    return assignedUsernames[0] || goal.assignedToUsername || "—";
  };

  /**
   * Renderiza las filas de la tabla.
   * En la columna progreso pintamos la progress bar tanto para numéricos
   * como para no numéricos, utilizando el helper getGoalTrackingPercent().
   */
  const renderGoalRows = (goalList) =>
    goalList.map((goal) => {
      const trackingPercent = getGoalTrackingPercent(goal);

      return (
        <div
          key={goal.id}
          className={`tableRow ${goal.status === "Done" ? "completedTableRow" : ""}`}
        >
          <div className="tableCell">
            <strong className={goal.status === "Done" ? "completedText" : ""}>
              {goal.titulo}
              {goal.assignedByAdmin && !isAdmin && (
                <span className="ownerTag assigned">{t.goalsAssigned}</span>
              )}
            </strong>
          </div>

          {showAssignedUserColumn && (
            <div className="tableCell">
              <span className={goal.status === "Done" ? "completedText" : ""}>
                {getAssignedUserLabel(goal)}
              </span>
            </div>
          )}

          <div className="tableCell">
            <span className={goal.status === "Done" ? "completedText" : ""}>
              {goal.description || "—"}
              {goal.assignedByAdmin && goal.assignedByAdminUsername && (
                <div className="goalMetaText">{t.commonBy}: {goal.assignedByAdminUsername}</div>
              )}
            </span>
          </div>

          <div className="tableCell">
            <span
              className="priorityBadge"
              style={{
                backgroundColor: getPriorityColor(goal.priority),
              }}
            >
              {getPriorityLabel(goal.priority)}
            </span>
          </div>

          <div className="tableCell">
            <span
              className="statusBadge"
              style={{
                backgroundColor: GOAL_STATUS_COLORS[goal.status] || "#6c757d",
              }}
            >
              {getStatusLabel(goal.status)}
            </span>
          </div>

          <div className="tableCell">
            <div className="goalProgressBlock">
              <div className="progressBarContainer">
                <div
                  className="progressBarFill"
                  style={{ width: `${trackingPercent}%` }}
                ></div>
              </div>

              <span className="progressText">
                {goal.isNumeric
                  ? `${Number(goal.valorProgreso || 0)} / ${Number(goal.valorObjetivo || 0)}`
                  : getStatusLabel(goal.status)}
              </span>
            </div>
          </div>

          <div className="tableCell actionsCell">
            <button
              className="actionButton editButton"
              onClick={() => onEdit(goal)}
              title={t.commonEdit}
            >
              <i className="fa fa-edit"></i>
            </button>

            {(isAdmin || !goal.assignedByAdmin) && (
              <button
                className="actionButton deleteButton"
                onClick={() => onDelete(goal)}
                title={t.commonDelete}
              >
                <i className="fa fa-trash"></i>
              </button>
            )}
          </div>
        </div>
      );
    });

  return (
    <section className="objectivesSection">
      <div className="sectionHeader">
        <div>
          <h2>{t.goalsTitle}</h2>
          <p>{t.goalsSubtitle}</p>
        </div>

        <button className="addButton" onClick={onCreate}>
          <i className="fa fa-plus"></i> {t.goalsNew}
        </button>
      </div>

      <div
        ref={mainWrapperRef}
        className={`tableWrapper ${mainHasOverflow ? "hasOverflow" : "noOverflow"}`}
      >
        <div ref={mainTableRef} className="todoTable">
          <div className="tableRow tableHeader">
            <div className="tableCell">{t.commonTitle}</div>
            {showAssignedUserColumn && <div className="tableCell">{t.commonUser}</div>}
            <div className="tableCell">{t.commonDescription}</div>
            <div className="tableCell">{t.commonPriority}</div>
            <div className="tableCell">{t.commonStatus}</div>
            <div className="tableCell">{t.commonProgress}</div>
            <div className="tableCell">{t.commonActions}</div>
          </div>

          {activeGoals.length === 0 ? (
            <div className="emptyState">
              <p>{t.goalsEmpty}</p>
            </div>
          ) : (
            renderGoalRows(activeGoals)
          )}
        </div>
      </div>

      {completedGoals.length > 0 && (
        <div className="completedGoalsBlock">
          <button
            type="button"
            className="completedGoalsToggle"
            onClick={() => setShowCompleted((prev) => !prev)}
          >
            <span>
              {showCompleted
                ? t.goalsHideCompleted
                : `${t.goalsShowCompleted} (${completedGoals.length})`}
            </span>
            <i
              className={`fa ${showCompleted ? "fa-chevron-up" : "fa-chevron-down"}`}
            ></i>
          </button>

          {showCompleted && (
            <div
              ref={completedWrapperRef}
              className={`tableWrapper ${completedHasOverflow ? "hasOverflow" : "noOverflow"}`}
            >
              <div ref={completedTableRef} className="todoTable">
                <div className="tableRow tableHeader">
                  <div className="tableCell">{t.commonTitle}</div>
                  {showAssignedUserColumn && <div className="tableCell">{t.commonUser}</div>}
                  <div className="tableCell">{t.commonDescription}</div>
                  <div className="tableCell">{t.commonPriority}</div>
                  <div className="tableCell">{t.commonStatus}</div>
                  <div className="tableCell">{t.commonProgress}</div>
                  <div className="tableCell">{t.commonActions}</div>
                </div>
                {renderGoalRows(completedGoals)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default GoalsSection;
