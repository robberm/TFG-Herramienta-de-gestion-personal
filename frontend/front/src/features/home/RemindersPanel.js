import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import "../../css/Home.css";
import { useLanguage } from "../../context/languageContext";
import LocationIcon from "../../components/shared/LocationIcon";

/**
 * Convierte una fecha recibida del backend a Date de forma robusta.
 *
 * @param {string|Date} value fecha a convertir
 * @returns {Date|null} fecha parseada o null si no es válida
 */
const parseReminderDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
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
  }

  return new Date(value);
};

const RemindersPanel = ({ todayEvents, isLoadingTodayEvents }) => {
  const { t } = useLanguage();
  const reminderEvents = useMemo(() => {
    const hasReminder = (event) => (
      Array.isArray(event.reminderMinutesBeforeList) &&
      event.reminderMinutesBeforeList.length > 0
    );

    const uniqueByEventId = new Map();
    [...todayEvents]
      .filter(hasReminder)
      .forEach((event) => {
        if (!uniqueByEventId.has(event.id)) {
          uniqueByEventId.set(event.id, event);
        }
      });

    return [...uniqueByEventId.values()]
      .sort((a, b) => {
        const aDate = parseReminderDate(a.startTime);
        const bDate = parseReminderDate(b.startTime);
        return aDate - bDate;
      });
  }, [todayEvents]);

  return (
    <div className="remindersSection">
      <h2>{t.homeReminders}</h2>

      {isLoadingTodayEvents ? (
        <div className="remindersEmptyState">{t.homeLoadingEvents}</div>
      ) : reminderEvents.length === 0 ? (
        <div className="remindersEmptyState">
          {t.homeNoRemindersToday}
        </div>
      ) : (
        <div className="remindersList">
          {reminderEvents.map((event) => {
            const startDate = parseReminderDate(event.startTime);
            const endDate = parseReminderDate(event.endTime);

            return (
              <div key={event.id} className="reminderCard">
                <div className="reminderCardTime">
                  {event.isAllDay
                    ? t.calendarAllDay
                    : `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`}
                </div>

                <div className="reminderCardTitle">{event.title}</div>
                {event.location && (
                  <div className="reminderCardLocation">
                    <LocationIcon /> {event.location}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RemindersPanel;
