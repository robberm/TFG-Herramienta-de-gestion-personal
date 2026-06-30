import React, { useEffect, useRef, useState } from "react";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLanguage } from "../../context/languageContext";

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
 * Calcula el estilo visual de un evento dentro de la vista semanal.
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
 * @param {Array<Object>} dayEvents eventos de un día
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

  const positioned = [];
  // Aqui guardo los eventos que se pisan entre si para calcular el layout juntos.
  let overlappingEvents = [];
  // Aqui guardo el minuto final del bloque actual de eventos solapados.
  let overlappingEventsEnd = -1;

  const applyLayout = () => {
    if (overlappingEvents.length === 0) return;

    // Calculo cuantas columnas necesita el grupo antes de pintarlo.
    const totalColumns = Math.max(...overlappingEvents.map((item) => item.column)) + 1;

    overlappingEvents.forEach((item) => {
      // Cada evento ocupa una columna distinta dentro del mismo tramo horario.
      const baseStyle = getTimedEventStyle(item.event);
      const widthPct = 100 / totalColumns;
      const leftPct = item.column * widthPct;

      positioned.push({
        id: item.event.id,
        style: {
          ...baseStyle,
          left: `calc(${leftPct}% + 4px)`,
          width: `calc(${widthPct}% - 8px)`,
        },
      });
    });

    overlappingEvents = [];
    overlappingEventsEnd = -1;
  };

  sorted.forEach((item) => {
    if (overlappingEvents.length === 0 || item.startMinutes < overlappingEventsEnd) {
      const usedColumns = new Set(
        overlappingEvents
          .filter((current) => current.endMinutes > item.startMinutes)
          .map((current) => current.column),
      );

      let column = 0;
      while (usedColumns.has(column)) {
        column += 1;
      }

      overlappingEvents = overlappingEvents.filter((current) => current.endMinutes > item.startMinutes);
      overlappingEvents.push({ ...item, column });
      overlappingEventsEnd = Math.max(overlappingEventsEnd, item.endMinutes);
      return;
    }

    applyLayout();
    overlappingEvents.push({ ...item, column: 0 });
    overlappingEventsEnd = item.endMinutes;
  });

  applyLayout();

  return new Map(positioned.map((item) => [item.id, item.style]));
};

const WeekView = ({ currentDate, events, onTimeSlotClick, onEventClick, isAdmin = false }) => {
  const { language, t } = useLanguage();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const currentTime = new Date();

  const gridViewportRef = useRef(null);
  const timelineRef = useRef(null);
  const calendarLocale = language === "es" ? es : enUS;
  const [headerScrollLeft, setHeaderScrollLeft] = useState(0);
  const [headerPaddingRight, setHeaderPaddingRight] = useState(0);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i));
  }

  const shortDayNames = weekDays.map((day) => format(day, "EEEEE", { locale: calendarLocale }));

  const getEventsForDay = (day) => {
    return events.filter((event) =>
      isSameDay(parseCalendarDate(event.startTime), day),
    );
  };

  const formatEventTime = (event) => {
    if (event.isAllDay) return t.calendarAllDay;
    return format(parseCalendarDate(event.startTime), "HH:mm");
  };

  const getAllDayEventsForDay = (day) =>
    getEventsForDay(day).filter((event) => event.isAllDay);

  useEffect(() => {
    const updateScrollbarCompensation = () => {
      if (!gridViewportRef.current) return;

      const scrollbarWidth =
        gridViewportRef.current.offsetWidth -
        gridViewportRef.current.clientWidth;

      setHeaderPaddingRight(Math.max(scrollbarWidth, 0));
    };

    updateScrollbarCompensation();
    window.addEventListener("resize", updateScrollbarCompensation);

    return () => {
      window.removeEventListener("resize", updateScrollbarCompensation);
    };
  }, []);

  const handleGridScroll = (e) => {
    const { scrollLeft, scrollTop } = e.currentTarget;

    setHeaderScrollLeft(scrollLeft);

    if (timelineRef.current) {
      timelineRef.current.scrollTop = scrollTop;
    }
  };

  return (
    <div className="calendar-week">
      <div className="week-view-header">
        <div className="week-time-gutter"></div>

        <div className="week-header-days-viewport">
          <div
            className="week-view-header-days"
            style={{
              transform: `translateX(-${headerScrollLeft}px)`,
              paddingRight: `${headerPaddingRight}px`,
            }}
          >
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`week-day-header ${isToday ? "today" : ""}`}
                >
                  <div className="week-day-name">
                    {shortDayNames[index]}
                  </div>
                  <div className="week-day-number">{format(day, "d")}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="week-all-day-container">
        <div className="week-time-gutter week-all-day-gutter"></div>
        <div className="week-all-day-strip-viewport">
          <div
            className="week-all-day-strip"
            style={{
              transform: `translateX(-${headerScrollLeft}px)`,
              paddingRight: `${headerPaddingRight}px`,
            }}
          >
            <div className="week-all-day-row">
              {weekDays.map((day, index) => {
                const dayAllDayEvents = getAllDayEventsForDay(day);
                return (
                  <div key={`all-day-${index}`} className="week-all-day-cell">
                    {dayAllDayEvents.map((event) => (
                      <div
                        key={`all-day-${event.id}`}
                        className={`week-all-day-event-chip ${event.category || ""}`}
                        onClick={(e) => onEventClick(event, e)}
                      >
                        <div className="week-event-time">{t.calendarAllDay}</div>
                        <div className="week-event-title">{event.title}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="week-view-container">
        <div className="week-view-timeline" ref={timelineRef}>
          {hours.map((hour) => (
            <div key={hour} className="week-time-slot-row">
              <div className="week-time-label">
                {`${hour.toString().padStart(2, "0")}:00`}
              </div>
            </div>
          ))}
        </div>

        <div className="week-right-panel">
          <div
            className="week-grid-viewport"
            ref={gridViewportRef}
            onScroll={handleGridScroll}
          >
            <div className="week-view-grid">
            {weekDays.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day).filter(
                (event) => !event.isAllDay,
              );
              const eventLayoutMap = buildEventLayoutMap(dayEvents);
              const isToday = isSameDay(day, currentTime);

              return (
                <div key={dayIndex} className="week-day-column">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="week-time-cell"
                      onClick={() => onTimeSlotClick(day, hour)}
                    >
                      <div className="week-time-cell-half"></div>
                    </div>
                  ))}

                  <div className="week-events-container">
                    {dayEvents.map((event) => {
                      const style =
                        eventLayoutMap.get(event.id) || getTimedEventStyle(event);

                      return (
                        <div
                          key={event.id}
                          className={`week-event ${event.category || ""}`}
                          style={style}
                          onClick={(e) => onEventClick(event, e)}
                        >
                          <div className="week-event-time">
                            {formatEventTime(event)}
                          </div>
                          <div className="week-event-title">{event.title}</div>
                          {event.assignedByAdmin && !isAdmin && (
                            <div className="week-event-assigned">{t.calendarAssignedTag}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isToday && (
                    <div
                      className="week-current-time-indicator"
                      style={{
                        top: `${
                          (currentTime.getHours() * 60 +
                            currentTime.getMinutes()) *
                          PX_PER_MINUTE
                        }px`,
                      }}
                    >
                      <div className="week-current-time-line"></div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekView;
