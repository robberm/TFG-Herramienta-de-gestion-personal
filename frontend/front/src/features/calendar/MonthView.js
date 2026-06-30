import React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLanguage } from "../../context/languageContext";

/**
 * Convierte una fecha del backend a objeto Date de forma estable.
 * Soporta correctamente LocalDateTime sin zona horaria y fechas ISO con zona.
 *
 * @param {string|Date} value fecha recibida del backend
 * @returns {Date} fecha parseada
 */
const parseCalendarDate = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value !== "string") {
    return new Date(value);
  }

  const localDateTimeRegex =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?$/;

  const match = value.match(localDateTimeRegex);

  if (match) {
    const [, year, month, day, hour, minute, second = "0", fraction = "0"] =
      match;

    const milliseconds = Number(fraction.slice(0, 3).padEnd(3, "0"));

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      milliseconds,
    );
  }

  return parseISO(value);
};

const MonthView = ({
  currentDate,
  selectedDate,
  events,
  onDateClick,
  onEventClick,
  isAdmin = false,
}) => {
  const { language, t } = useLanguage();
  const calendarLocale = language === "es" ? es : enUS;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  const daysOfWeek = [];
  const dateFormat = "d";
  const startOfTheWeek = startOfWeek(new Date(), { weekStartsOn: 1 });

  for (let i = 0; i < 7; i++) {
    const dayOfWeek = addDays(startOfTheWeek, i);

    daysOfWeek.push(
      <div className="day-header" key={`header-${i}`}>
        {format(dayOfWeek, "EEEEE", { locale: calendarLocale })}
      </div>,
    );
  }

  let day = startDate;

  while (day <= endDate) {
    const formattedDate = format(day, dateFormat);
    const cloneDay = day;

    const dayEvents = events.filter((event) =>
      isSameDay(parseCalendarDate(event.startTime), cloneDay),
    );

    days.push(
      <div
        className={`day ${!isSameMonth(day, monthStart) ? "disabled" : ""} ${
          isSameDay(day, selectedDate) ? "selected" : ""
        }`}
        key={day.toISOString()}
        onClick={() => onDateClick(cloneDay)}
      >
        <span className="day-number">{formattedDate}</span>

        <div className="events-container">
          {dayEvents.map((event) => (
            <div
              key={event.id}
              className={`event ${event.category || ""}`}
              onClick={(e) => onEventClick(event, e)}
            >
              {event.title}
              {event.assignedByAdmin && !isAdmin && <span className="eventOwnerTag">{t.calendarAssignedTag}</span>}
            </div>
          ))}
        </div>
      </div>,
    );

    day = addDays(day, 1);
  }

  return (
    <div className="calendar-month">
      <div className="days-header">{daysOfWeek}</div>
      <div className="days-grid">{days}</div>
    </div>
  );
};

export default MonthView;
