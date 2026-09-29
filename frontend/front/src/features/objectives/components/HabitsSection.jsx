import React, { useMemo } from "react";
import { formatIsoDate } from "../utils/objectiveHelpers";
import { useLanguage } from "../../../context/languageContext";

const HabitsSection = ({ habits, habitCompletionMap, selectedHabitDate, onCreate, onEdit, onDelete, onToggleDate, isHabitUpdating }) => {
  const { t } = useLanguage();
  const todayIso = formatIsoDate(new Date());
  const selectedDate = selectedHabitDate || todayIso;
  const selectedDateLabel = selectedDate === todayIso ? t.commonToday : selectedDate;
  const recentDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() - (6 - index));
    return {
      iso: formatIsoDate(date),
      day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).slice(0, 2),
      number: date.getDate(),
    };
  }), [selectedDate]);

  return (
    <section className="objectivesSection habitsWorkspace">
      <div className="sectionHeader modernSectionHeader">
        <div>
          <span className="sectionKicker">{selectedDateLabel}</span>
          <h2>{t.habitsTitle}</h2>
          <p>{t.habitsSubtitle}</p>
        </div>
        <button className="addButton" onClick={onCreate}><i className="fa fa-plus" /> {t.habitsNew}</button>
      </div>

      {habits.length > 0 ? (
        <div className="habitPanelGrid">
          {habits.map((habit) => {
            const completed = habitCompletionMap[habit.id]?.[selectedDate] === true;
            return (
              <article key={habit.id} className={`habitPanel ${completed ? "isCompleted" : ""}`}>
                <header className="habitPanelHeader">
                  <button type="button" className="habitCompletionButton" disabled={isHabitUpdating} aria-pressed={completed} onClick={() => onToggleDate(habit, !completed)}>
                    <i className={`fa ${completed ? "fa-check" : "fa-plus"}`} />
                  </button>
                  <div className="habitPanelTitle">
                    <span>{completed ? t.goalStatusDone : selectedDateLabel}</span>
                    <h3>{habit.titulo}</h3>
                  </div>
                  <div className="habitPanelActions">
                    <button type="button" className="panelIconButton" onClick={() => onEdit(habit)} title={t.commonEdit}><i className="fa fa-pen" /></button>
                    <button type="button" className="panelIconButton danger" onClick={() => onDelete(habit)} title={t.commonDelete}><i className="fa fa-trash" /></button>
                  </div>
                </header>

                <p className="habitPanelDescription">{habit.description || "—"}</p>

                <div className="habitWeekStrip" aria-label="Last seven days">
                  {recentDays.map((day) => {
                    const done = habitCompletionMap[habit.id]?.[day.iso] === true;
                    return (
                      <div key={day.iso} className={`habitDay ${done ? "done" : ""} ${day.iso === selectedDate ? "selected" : ""}`}>
                        <span>{day.day}</span>
                        <strong>{done ? <i className="fa fa-check" /> : day.number}</strong>
                      </div>
                    );
                  })}
                </div>

                <footer className="habitPanelStats">
                  <div><i className="fa fa-fire" /><span>{t.habitsStreak}</span><strong>{habit.currentStreak || 0}</strong></div>
                  <div><i className="fa fa-trophy" /><span>{t.habitsBest}</span><strong>{habit.bestStreak || 0}</strong></div>
                </footer>
              </article>
            );
          })}
        </div>
      ) : <div className="emptyState objectivesEmptyState"><p>{t.habitsEmpty}</p></div>}
    </section>
  );
};

export default HabitsSection;
