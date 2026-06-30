import React from "react";
import { useLanguage } from "../../context/languageContext";

const CalendarHeader = ({
  dateText,
  viewMode,
  onPrevious,
  onToday,
  onNext,
  onChangeView,
}) => {
  const { t } = useLanguage();

  return (
    <div className="calendar-header">
      <div className="navigation">
        <button onClick={onPrevious}>{t.calendarPrevious}</button>
        <button onClick={onToday}>{t.calendarToday}</button>
        <button onClick={onNext}>{t.calendarNext}</button>
      </div>

      <div className="current-date">{dateText}</div>

      <div className="view-options">
        <button
          className={viewMode === "day" ? "active" : ""}
          onClick={() => onChangeView("day")}
        >
          {t.calendarDay}
        </button>
        <button
          className={viewMode === "week" ? "active" : ""}
          onClick={() => onChangeView("week")}
        >
          {t.calendarWeek}
        </button>
        <button
          className={viewMode === "month" ? "active" : ""}
          onClick={() => onChangeView("month")}
        >
          {t.calendarMonth}
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
