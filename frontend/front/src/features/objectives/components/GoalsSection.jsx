import React, { useMemo, useState } from "react";
import {
  getGoalTrackingPercent,
  sortGoalsByPriority,
} from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";

const GoalsSection = ({ goals, onCreate, onEdit, onDelete, isAdmin = false, showAssignedUserColumn = false }) => {
  const { t } = useLanguage();
  const [showCompleted, setShowCompleted] = useState(false);

  const activeGoals = useMemo(
    () => sortGoalsByPriority(goals.filter((goal) => goal.status !== "Done" && goal.active !== false)),
    [goals],
  );
  const completedGoals = useMemo(
    () => sortGoalsByPriority(goals.filter((goal) => goal.status === "Done" || goal.active === false)),
    [goals],
  );

  const priorityLabel = (priority) =>
    priority === "Alta" ? t.priorityHigh : priority === "Media" ? t.priorityMedium : priority === "Baja" ? t.priorityLow : priority;
  const statusLabel = (status) =>
    status === "NotStarted" ? t.goalStatusNotStarted : status === "InProgress" ? t.goalStatusInProgress : status === "Done" ? t.goalStatusDone : status;
  const assignedUserLabel = (goal) => {
    const names = Array.isArray(goal.assignedToUsernames) ? goal.assignedToUsernames.filter(Boolean) : [];
    return names.length > 1 ? t.commonMultipleUsers : names[0] || goal.assignedToUsername || "—";
  };

  const renderGoals = (items) => (
    <div className="goalPanelList">
      {items.map((goal) => {
        const percent = getGoalTrackingPercent(goal);
        const completed = goal.status === "Done";
        return (
          <article key={goal.id} className={`goalPanel ${showAssignedUserColumn ? "withAssignee" : ""} ${completed ? "isCompleted" : ""}`} data-priority={goal.priority}>
            <div className="goalPanelMain">
              <div className="goalPanelEyebrow">
                <span className={`goalPriorityDot priority-${String(goal.priority || "").toLowerCase()}`} />
                <span>{priorityLabel(goal.priority)}</span>
                {goal.assignedByAdmin && !isAdmin && <span className="goalAssignedPill">{t.goalsAssigned}</span>}
              </div>
              <h3>{goal.titulo}</h3>
              <p>{goal.description || "—"}</p>
              {goal.assignedByAdminUsername && (
                <small className="goalOwnerMeta">{t.commonBy}: {goal.assignedByAdminUsername}</small>
              )}
            </div>

            <div className="goalPanelProgress">
              <div className="goalProgressHeading">
                <span>{t.commonProgress}</span>
                <strong>{Math.round(percent)}%</strong>
              </div>
              <div className="goalProgressTrack" aria-label={`${Math.round(percent)}%`}>
                <span style={{ width: `${percent}%` }} />
              </div>
              <div className="goalProgressFooter">
                <span className={`goalStatusPill status-${goal.status}`}>{statusLabel(goal.status)}</span>
                <span>{goal.isNumeric ? `${Number(goal.valorProgreso || 0)} / ${Number(goal.valorObjetivo || 0)}` : statusLabel(goal.status)}</span>
              </div>
            </div>

            {showAssignedUserColumn && (
              <div className="goalPanelAssignee">
                <span>{t.commonUser}</span>
                <strong><i className="fa fa-user" /> {assignedUserLabel(goal)}</strong>
              </div>
            )}

            <div className="goalPanelActions">
              <button type="button" className="panelIconButton" onClick={() => onEdit(goal)} title={t.commonEdit} aria-label={t.commonEdit}>
                <i className="fa fa-pen" />
              </button>
              {(isAdmin || !goal.assignedByAdmin) && (
                <button type="button" className="panelIconButton danger" onClick={() => onDelete(goal)} title={t.commonDelete} aria-label={t.commonDelete}>
                  <i className="fa fa-trash" />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <section className="objectivesSection goalsWorkspace">
      <div className="sectionHeader modernSectionHeader">
        <div>
          <span className="sectionKicker">{activeGoals.length} {t.goalsTitle}</span>
          <h2>{t.goalsTitle}</h2>
          <p>{t.goalsSubtitle}</p>
        </div>
        <button className="addButton" onClick={onCreate}><i className="fa fa-plus" /> {t.goalsNew}</button>
      </div>

      {activeGoals.length ? renderGoals(activeGoals) : <div className="emptyState objectivesEmptyState"><p>{t.goalsEmpty}</p></div>}

      {completedGoals.length > 0 && (
        <div className="completedGoalsBlock">
          <button type="button" className="completedGoalsToggle" onClick={() => setShowCompleted((current) => !current)}>
            <span>{showCompleted ? t.goalsHideCompleted : `${t.goalsShowCompleted} (${completedGoals.length})`}</span>
            <i className={`fa fa-chevron-${showCompleted ? "up" : "down"}`} />
          </button>
          {showCompleted && renderGoals(completedGoals)}
        </div>
      )}
    </section>
  );
};

export default GoalsSection;
