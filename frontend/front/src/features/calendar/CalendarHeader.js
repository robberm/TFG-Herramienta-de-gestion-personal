import React from "react";
import { useLanguage } from "../../context/languageContext";

const ChevronIcon = ({ direction }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path
      d={direction === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CalendarHeader = ({
  dateText,
  viewMode,
  onPrevious,
  onToday,
  onNext,
  onChangeView,
}) => {
  const { t } = useLanguage();

  const views = [
    { id: "day", label: t.calendarDay },
    { id: "week", label: t.calendarWeek },
    { id: "month", label: t.calendarMonth },
  ];

  return (
    <div className="calendar-header">
      <h1 className="current-date">{dateText}</h1>

      <div className="calendar-header-controls">
        <div className="navigation">
          <button
            type="button"
            className="calendar-nav-arrow"
            onClick={onPrevious}
            aria-label={t.calendarPrevious}
            title={t.calendarPrevious}
          >
            <ChevronIcon direction="left" />
          </button>
          <button type="button" className="calendar-nav-today" onClick={onToday}>
            {t.calendarToday}
          </button>
          <button
            type="button"
            className="calendar-nav-arrow"
            onClick={onNext}
            aria-label={t.calendarNext}
            title={t.calendarNext}
          >
            <ChevronIcon direction="right" />
          </button>
        </div>

        <div className="view-options" role="group">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={viewMode === view.id ? "active" : ""}
              aria-pressed={viewMode === view.id}
              onClick={() => onChangeView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;
