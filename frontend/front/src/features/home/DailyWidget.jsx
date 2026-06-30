import React, { useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import EventModal from "../calendar/EventModal.jsx";
import { deleteCalendarEvent, saveCalendarEvent } from "../../api/eventApi.js";
import "../../css/Home.css";
import "../../css/Calendar.css";
import { capitalizeCalendarLabel } from "../../utils/dateLabels";
import LocationIcon from "../../components/shared/LocationIcon.jsx";
import { useLanguage } from "../../context/languageContext";

const HOUR_HEIGHT_PX = 28;
const MINUTES_PER_HOUR = 60;
const PX_PER_MINUTE = HOUR_HEIGHT_PX / MINUTES_PER_HOUR;
const MIN_EVENT_HEIGHT_PX = 8;
const MIN_EVENT_TITLE_MINUTES = 30;

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
 * Calcula la duración real del evento en minutos para decidir si cabe texto.
 *
 * @param {Object} event evento a evaluar
 * @returns {number} duración en minutos
 */
const getEventDurationMinutes = (event) => {
  const start = parseCalendarDate(event.startTime);
  const end = parseCalendarDate(event.endTime);
  const startMinutes = getMinutesOfDay(start);
  let endMinutes = getMinutesOfDay(end);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
};

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
    MIN_EVENT_HEIGHT_PX,
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

const DailyWidget = ({ events, onEventsChanged }) => {
  const { language, t } = useLanguage();
  const calendarLocale = language === "es" ? es : enUS;
  const [currentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const allDayEvents = useMemo(() => {
    return events.filter(
      (event) =>
        event.isAllDay &&
        isSameDay(parseCalendarDate(event.startTime), currentDate),
    );
  }, [events, currentDate]);

  const timedEvents = useMemo(() => {
    return events.filter(
      (event) =>
        !event.isAllDay &&
        isSameDay(parseCalendarDate(event.startTime), currentDate),
    );
  }, [events, currentDate]);
  const timedEventLayoutMap = useMemo(
    () => buildEventLayoutMap(timedEvents),
    [timedEvents],
  );

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const getCurrentTimePosition = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return `${minutes * PX_PER_MINUTE}px`;
  };

  const formatEventTime = (event) => {
    if (event.isAllDay) return "Todo el día";

    return `${format(parseCalendarDate(event.startTime), "HH:mm")} - ${format(
      parseCalendarDate(event.endTime),
      "HH:mm",
    )}`;
  };

  const handleTimeSlotClick = (hour) => {
    const newDate = new Date(currentDate);
    newDate.setHours(hour, 0, 0, 0);
    setSelectedDate(newDate);
    setSelectedEvent(null);
    setShowModal(true);
  };

  const handleEventClick = (event, e) => {
    if (e) {
      e.stopPropagation();
    }

    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleSaveEvent = async (eventData) => {
    try {
      await saveCalendarEvent(eventData);
      setShowModal(false);
      onEventsChanged();
    } catch {
      setShowModal(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!eventId) return;

    try {
      await deleteCalendarEvent(eventId);
      setShowModal(false);
      onEventsChanged();
    } catch {
      setShowModal(false);
    }
  };

  return (
    <>
      <div className="homeDailyWidget">
        <div className="homeDailyWidgetInner">
          <div className="homeDailyWidgetCollapsedContent">
            <div className="homeDailyPreviewShell">
              <div className="homeDailyPreviewCircle"></div>
            </div>

            <div className="homeDailyPreviewMeta">
              <div className="homeDailyPreviewTitle">{t.homeDailyCalendar}</div>
              <div className="homeDailyPreviewSubtitle">
                {events.length} {events.length === 1 ? t.homeEventSingular : t.homeEventPlural} {t.commonToday.toLowerCase()}
              </div>
            </div>
          </div>

          <div className="homeDailyWidgetExpandedContent">
            <div className="homeDailyExpandedHeader">
              <div>
                <div className="homeDailyWidgetEyebrow">{t.homeDailyView}</div>
                <div className="homeDailyWidgetDate">
                  {capitalizeCalendarLabel(format(currentDate, "EEEE, d 'de' MMMM", { locale: calendarLocale }))}
                </div>
              </div>
            </div>

            {allDayEvents.length > 0 && (
              <div className="homeDailyAllDayBlock">
                <div className="homeDailyAllDayLabel">Todo el día</div>

                <div className="homeDailyAllDayList">
                  {allDayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`day-event ${event.category || ""} homeAllDayEvent`}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      <div className="day-event-time">
                        {formatEventTime(event)}
                      </div>
                      <div className="day-event-title">{event.title}</div>

                      {event.location && (
                        <div className="day-event-location">
                          <LocationIcon /> {event.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="homeDailyTimeline">
              <div className="homeDailyTimelineLabels">
                {hours.map((hour) => (
                  <div key={hour} className="homeDailyTimelineLabel">
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </div>
                ))}
              </div>

              <div className="homeDailyTimelineGrid">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="homeDailyTimelineRow"
                    onClick={() => handleTimeSlotClick(hour)}
                  />
                ))}

                <div
                  className="homeDailyEventsLayer"
                  style={{ pointerEvents: "none" }}
                >
                  {timedEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`day-event ${event.category || ""} homeDailyEventCard`}
                      style={{
                        ...(timedEventLayoutMap.get(event.id) ||
                          getTimedEventStyle(event)),
                        pointerEvents: "auto",
                        cursor: "pointer",
                      }}
                      onClick={(e) => handleEventClick(event, e)}
                    >
                      <div className="day-event-time">
                        {formatEventTime(event)}
                      </div>
                      {getEventDurationMinutes(event) >= MIN_EVENT_TITLE_MINUTES && (
                        <div className="day-event-title">{event.title}</div>
                      )}

                      {event.location && (
                        <div className="day-event-location">
                          <LocationIcon /> {event.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isSameDay(currentDate, new Date()) && (
                  <div
                    className="homeDailyNowIndicator"
                    style={{ top: getCurrentTimePosition() }}
                  >
                    <div className="homeDailyNowDot"></div>
                    <div className="homeDailyNowLine"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <EventModal
          event={selectedEvent}
          selectedDate={selectedDate}
          onClose={() => setShowModal(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </>
  );
};

export default DailyWidget;
