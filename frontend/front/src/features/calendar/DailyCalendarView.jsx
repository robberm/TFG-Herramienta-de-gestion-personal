import React from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { useLanguage } from "../../context/languageContext";
import LocationIcon from "../../components/shared/LocationIcon";

const HOUR_HEIGHT_PX = 80;
const MINUTES_PER_HOUR = 60;
const PX_PER_MINUTE = HOUR_HEIGHT_PX / MINUTES_PER_HOUR;

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

/**
 * Devuelve los minutos transcurridos desde las 00:00 para una fecha dada.
 *
 * @param {Date} date fecha a evaluar
 * @returns {number} minutos del día
 */
const getMinutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

/**
 * Calcula el estilo visual de un evento dentro de la vista diaria.
 *
 * @param {Object} event evento a pintar
 * @returns {{top: string, height: string}} estilo css
 */
const getTimedEventStyle = (event) => {
  const start = parseCalendarDate(event.startTime);
  const end = parseCalendarDate(event.endTime);

  const startMinutes = getMinutesOfDay(start);
  let endMinutes = getMinutesOfDay(end);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const top = startMinutes * PX_PER_MINUTE;
  const height = Math.max(
    (endMinutes - startMinutes) * PX_PER_MINUTE,
    HOUR_HEIGHT_PX / 4,
  );

  return {
    top: `${top}px`,
    height: `${height}px`,
  };
};

/**
 * Distribuye eventos solapados en columnas para que coexistan visualmente.
 *
 * @param {Array<Object>} dayEvents eventos del día
 * @returns {Map<number, {top: string, height: string, left: string, width: string}>}
 */
const buildEventLayoutMap = (dayEvents) => {
  const sorted = [...dayEvents]
    .map((event) => {
      const start = parseCalendarDate(event.startTime);
      const end = parseCalendarDate(event.endTime);
      const startMinutes = getMinutesOfDay(start);
      let endMinutes = getMinutesOfDay(end);

      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
      }

      return {
        event,
        startMinutes,
        endMinutes,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -1;

  sorted.forEach((item) => {
    if (currentCluster.length === 0 || item.startMinutes < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMinutes);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [item];
    clusterEnd = item.endMinutes;
  });

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const positioned = [];

  clusters.forEach((cluster) => {
    const columnsEnd = [];
    const withColumns = cluster.map((item) => {
      let column = columnsEnd.findIndex((endMinutes) => endMinutes <= item.startMinutes);

      if (column === -1) {
        column = columnsEnd.length;
      }

      columnsEnd[column] = item.endMinutes;
      return { ...item, column };
    });

    const totalColumns = Math.max(columnsEnd.length, 1);

    withColumns.forEach((item) => {
      const baseStyle = getTimedEventStyle(item.event);
      const widthPct = 100 / totalColumns;
      const leftPct = item.column * widthPct;

      positioned.push({
        id: item.event.id,
        style: {
          ...baseStyle,
          left: `calc(${leftPct}% + 8px)`,
          width: `calc(${widthPct}% - 16px)`,
        },
      });
    });
  });

  return new Map(positioned.map((item) => [item.id, item.style]));
};

const DailyCalendarView = ({
  currentDate,
  events,
  onTimeSlotClick,
  onEventClick,
  isAdmin = false,
}) => {
  const { t } = useLanguage();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const currentTime = new Date();
  const isToday = isSameDay(currentDate, currentTime);

  const allDayEvents = events.filter(
    (event) =>
      event.isAllDay &&
      isSameDay(parseCalendarDate(event.startTime), currentDate),
  );

  const timedEvents = events.filter(
    (event) =>
      !event.isAllDay &&
      isSameDay(parseCalendarDate(event.startTime), currentDate),
  );
  const timedEventLayoutMap = buildEventLayoutMap(timedEvents);

  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return `${minutes * PX_PER_MINUTE}px`;
  };

  const formatEventTime = (event) => {
    if (event.isAllDay) return t.calendarAllDay;

    return `${format(parseCalendarDate(event.startTime), "HH:mm")} - ${format(
      parseCalendarDate(event.endTime),
      "HH:mm",
    )}`;
  };

  const handleTimeSlotClick = (hour) => {
    onTimeSlotClick(hour);
  };

  return (
    <div className="calendar-day">
      {allDayEvents.length > 0 && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            border: "1px solid var(--table-border-color, #e5e7eb)",
            borderRadius: "12px",
            background: "var(--card-bg, rgba(255,255,255,0.7))",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "8px",
              opacity: 0.8,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {t.calendarAllDay}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                className={`day-event ${event.category || ""}`}
                style={{
                  position: "relative",
                  top: "auto",
                  height: "auto",
                  inset: "auto",
                  cursor: "pointer",
                }}
                onClick={(e) => onEventClick(event, e)}
              >
                <div className="day-event-time">{formatEventTime(event)}</div>
                <div className="day-event-title">{event.title}</div>
                {event.assignedByAdmin && !isAdmin && (
                  <div className="day-event-assigned">{t.calendarAssignedTag}</div>
                )}
                {event.location && (
                  <div className="day-event-location"><LocationIcon /> {event.location}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="day-view-container">
        <div className="day-view-timeline">
          {hours.map((hour) => (
            <div key={hour} className="time-slot-row">
              <div className="time-label">
                {`${hour.toString().padStart(2, "0")}:00`}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            position: "relative",
            backgroundColor: "var(--bg-main)",
          }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              onClick={() => handleTimeSlotClick(hour)}
              style={{
                height: `${HOUR_HEIGHT_PX}px`,
                minHeight: `${HOUR_HEIGHT_PX}px`,
                cursor: "pointer",
                position: "relative",
                boxSizing: "border-box",
                borderBottom: "1px solid var(--border-color)",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "color-mix(in srgb, var(--event-work-color) 5%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: "1px",
                  backgroundColor: "var(--border-color-soft)",
                }}
              />
            </div>
          ))}

          <div
            className="day-view-events"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "transparent",
            }}
          >
            {timedEvents.map((event) => {
              const style =
                timedEventLayoutMap.get(event.id) || getTimedEventStyle(event);

              return (
                <div
                  key={event.id}
                  className={`day-event ${event.category || ""}`}
                  style={{
                    ...style,
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                  onClick={(e) => onEventClick(event, e)}
                >
                  <div className="day-event-time">{formatEventTime(event)}</div>
                  <div className="day-event-title">{event.title}</div>
                {event.assignedByAdmin && !isAdmin && (
                  <div className="day-event-assigned">{t.calendarAssignedTag}</div>
                )}
                  {event.location && (
                    <div className="day-event-location">
                      <LocationIcon /> {event.location}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isToday && (
            <div
              className="current-time-indicator"
              style={{ top: getCurrentTimePosition() }}
            >
              <div className="current-time-dot"></div>
              <div className="current-time-line"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyCalendarView;
