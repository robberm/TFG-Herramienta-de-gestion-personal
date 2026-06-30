import React, { useEffect, useRef, useState } from "react";
import { formatIsoDate } from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";

const HabitsSection = ({
  habits,
  habitCompletionMap,
  selectedHabitDate,
  onCreate,
  onEdit,
  onDelete,
  onToggleDate,
  isHabitUpdating,
}) => {
  const { t } = useLanguage();
  const todayIso = formatIsoDate(new Date());
  const selectedDate = selectedHabitDate || todayIso;
  const selectedDateLabel = selectedDate === todayIso ? t.commonToday : selectedDate;
  const wrapperRef = useRef(null);
  const tableRef = useRef(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const update = () => {
      if (!wrapperRef.current || !tableRef.current) return;
      setHasOverflow(tableRef.current.scrollWidth > wrapperRef.current.clientWidth + 1);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [habits]);

  return (
    <section className="objectivesSection">
      <div className="sectionHeader">
        <div>
          <h2>{t.habitsTitle}</h2>
          <p>{t.habitsSubtitle}</p>
        </div>

        <button className="addButton" onClick={onCreate}>
          <i className="fa fa-plus"></i> {t.habitsNew}
        </button>
      </div>

      <div
        ref={wrapperRef}
        className={`tableWrapper ${hasOverflow ? "hasOverflow" : "noOverflow"}`}
      >
        <div ref={tableRef} className="todoTable">
          <div className="tableRow tableHeader">
            <div className="tableCell">{selectedDateLabel}</div>
            <div className="tableCell">{t.commonTitle}</div>
            <div className="tableCell">{t.commonDescription}</div>
            <div className="tableCell">{t.habitsStreak}</div>
            <div className="tableCell">{t.habitsBest}</div>
            <div className="tableCell">{t.commonActions}</div>
          </div>

          {habits.length === 0 ? (
            <div className="emptyState">
              <p>{t.habitsEmpty}</p>
            </div>
          ) : (
            habits.map((habit) => {
              const isCompletedSelectedDate =
                habitCompletionMap[habit.id] &&
                habitCompletionMap[habit.id][selectedDate] === true;

              return (
                <div
                  key={habit.id}
                  className={`tableRow ${isCompletedSelectedDate ? "completedTableRow" : ""}`}
                >
                  <div className="tableCell checkboxCell">
                    <label className="habitCheckbox">
                      <input
                        type="checkbox"
                        checked={Boolean(isCompletedSelectedDate)}
                        disabled={isHabitUpdating}
                        onChange={() => onToggleDate(habit, !isCompletedSelectedDate)}
                      />
                      <span className="habitCheckboxVisual"></span>
                    </label>
                  </div>

                  <div className="tableCell">
                    <strong className={isCompletedSelectedDate ? "completedText" : ""}>
                      {habit.titulo}
                    </strong>
                  </div>

                  <div className="tableCell">
                    <span className={isCompletedSelectedDate ? "completedText" : ""}>
                      {habit.description || "—"}
                    </span>
                  </div>

                  <div className="tableCell">
                    <span className="streakBadge">
                      {habit.currentStreak || 0}
                    </span>
                  </div>

                  <div className="tableCell">
                    <span className="streakBadge secondary">
                      {habit.bestStreak || 0}
                    </span>
                  </div>

                  <div className="tableCell actionsCell">
                    <button
                      className="actionButton editButton"
                      onClick={() => onEdit(habit)}
                      title={t.commonEdit}
                    >
                      <i className="fa fa-edit"></i>
                    </button>

                    <button
                      className="actionButton deleteButton"
                      onClick={() => onDelete(habit)}
                      title={t.commonDelete}
                    >
                      <i className="fa fa-trash"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export default HabitsSection;
