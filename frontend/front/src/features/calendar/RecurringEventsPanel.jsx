import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLanguage } from "../../context/languageContext";
import ConfirmDialog from "../../components/shared/ConfirmDialog";
import { capitalizeCalendarLabel } from "../../utils/dateLabels";
import { getCalendarTagLabel } from "./utils/calendarLabels";

const COLLAPSED_KEY = "calendarSeriesPanelCollapsed";
const SHOW_ENDED_KEY = "calendarSeriesShowEnded";

const WEEKDAY_LABELS = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
};

const readStoredFlag = (key) => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const storeFlag = (key, value) => {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
};

/**
 * Convierte una fecha yyyy-MM-dd del backend en Date local (sin desfase de zona).
 */
const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Días de la semana (ISO, 1 = lunes) en los que cae la serie.
 */
const getSeriesWeekdays = (series) => {
  switch (series.recurrenceType) {
    case "DAILY":
      return [1, 2, 3, 4, 5, 6, 7];
    case "WEEKDAYS":
      return [1, 2, 3, 4, 5];
    case "WEEKLY": {
      const day = series.startTime?.getDay?.();
      return day == null ? [] : [day === 0 ? 7 : day];
    }
    default:
      return Array.isArray(series.recurrenceWeekdays) ? series.recurrenceWeekdays : [];
  }
};

const isSeriesReadOnly = (series, isAdmin) =>
  series.assignedByAdmin === true &&
  Boolean(series.assignedByAdminUsername) &&
  series.assignedByAdminUsername !== series.assignedToUsername &&
  !isAdmin;

/**
 * Panel bajo el calendario con las series de eventos recurrentes: permite revisar
 * su configuración, editarla (regenera las ocurrencias) o borrar la serie entera.
 */
const RecurringEventsPanel = ({ series, isAdmin = false, onEdit, onDelete }) => {
  const { t, language } = useLanguage();
  const calendarLocale = language === "es" ? es : enUS;
  const [collapsed, setCollapsed] = useState(() => readStoredFlag(COLLAPSED_KEY));
  const [showEnded, setShowEnded] = useState(() => readStoredFlag(SHOW_ENDED_KEY));
  const [seriesToDelete, setSeriesToDelete] = useState(null);

  // Una serie ha terminado cuando ya no le queda ninguna ocurrencia por llegar.
  const isEnded = (item) => item.nextStartTime == null;
  const endedCount = series.filter(isEnded).length;
  const visibleSeries = useMemo(
    () => (showEnded ? series : series.filter((item) => item.nextStartTime != null)),
    [series, showEnded],
  );

  const recurrenceLabels = {
    DAILY: t.calendarRepeatDaily,
    WEEKLY: t.calendarRepeatWeekly,
    WEEKDAYS: t.calendarRepeatWeekdays,
    CUSTOM: t.calendarRepeatCustom,
  };
  const weekdayLabels = WEEKDAY_LABELS[language === "es" ? "es" : "en"];

  const formatDay = (date) =>
    date ? capitalizeCalendarLabel(format(date, "d MMM yyyy", { locale: calendarLocale })) : "";

  const formatTimeRange = (item) =>
    item.isAllDay
      ? t.calendarAllDay
      : `${format(item.startTime, "HH:mm")} – ${format(item.endTime, "HH:mm")}`;

  const formatNext = (date) =>
    capitalizeCalendarLabel(format(date, "EEE d MMM · HH:mm", { locale: calendarLocale }));

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      storeFlag(COLLAPSED_KEY, !current);
      return !current;
    });
  };

  const toggleShowEnded = () => {
    setShowEnded((current) => {
      storeFlag(SHOW_ENDED_KEY, !current);
      return !current;
    });
  };

  const handleConfirmDelete = () => {
    const target = seriesToDelete;
    setSeriesToDelete(null);
    if (target) onDelete(target.seriesId);
  };

  return (
    <section className="calendar-series-module" aria-label={t.calendarSeriesTitle}>
      <div className="calendar-tag-color-module-header calendar-series-header">
        <div className="calendar-series-heading">
          <h4>{t.calendarSeriesTitle}</h4>
          <span className="calendar-series-count">{series.length - endedCount}</span>
        </div>
        <div className="calendar-series-header-actions">
          {endedCount > 0 && (
            <button type="button" onClick={toggleShowEnded} aria-pressed={showEnded}>
              {showEnded ? t.calendarSeriesHideEnded : `${t.calendarSeriesShowEnded} (${endedCount})`}
            </button>
          )}
          <button type="button" onClick={toggleCollapsed} aria-pressed={collapsed}>
            <i className={`fa fa-chevron-down userFlecha ${!collapsed ? "open" : ""}`} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <p className="calendar-series-hint">{t.calendarSeriesHint}</p>

          {visibleSeries.length === 0 ? (
            <div className="calendar-series-empty">{t.calendarSeriesEmpty}</div>
          ) : (
            <div className="calendar-series-grid">
              {visibleSeries.map((item) => {
                const readOnly = isSeriesReadOnly(item, isAdmin);
                const activeWeekdays = getSeriesWeekdays(item);
                const ended = isEnded(item);
                const hasEnd = item.occurrenceCount != null;
                const doneRatio =
                  hasEnd && item.occurrenceCount > 0
                    ? (item.occurrenceCount - item.upcomingCount) / item.occurrenceCount
                    : 0;

                return (
                  <article
                    key={item.seriesId}
                    className={`calendar-series-card ${ended ? "is-ended" : ""}`}
                    style={{
                      "--series-color": `var(--event-${String(item.category || "work").toLowerCase()}-color)`,
                    }}
                  >
                    <button
                      type="button"
                      className="calendar-series-card-main"
                      onClick={() => onEdit(item)}
                      title={readOnly ? item.title : `${t.calendarSeriesEdit}: ${item.title}`}
                    >
                      <div className="calendar-series-card-top">
                        <span className="calendar-series-title">{item.title}</span>
                        <span className="calendar-series-tag">
                          {getCalendarTagLabel(item.category, t)}
                        </span>
                      </div>

                      <div className="calendar-series-rule">
                        <span>{recurrenceLabels[item.recurrenceType] || item.recurrenceType}</span>
                        <span className="calendar-series-weekdays" aria-hidden="true">
                          {weekdayLabels.map((label, index) => (
                            <span
                              key={index}
                              className={activeWeekdays.includes(index + 1) ? "active" : ""}
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      </div>

                      <div className="calendar-series-meta">
                        <span>{formatTimeRange(item)}</span>
                        <span>
                          {formatDay(item.startTime)} →{" "}
                          {item.recurrenceEndDate
                            ? formatDay(parseLocalDate(item.recurrenceEndDate))
                            : t.calendarSeriesNoEnd}
                        </span>
                        {item.editedOccurrenceCount > 0 && (
                          <span>
                            {item.editedOccurrenceCount} {t.calendarSeriesEdited}
                          </span>
                        )}
                        {isAdmin && item.assignedUsernames?.length > 0 && (
                          <span>
                            {t.calendarSeriesAssignedTo}: {item.assignedUsernames.join(", ")}
                          </span>
                        )}
                      </div>

                      <div className="calendar-series-progress">
                        {hasEnd && (
                          <div className="calendar-series-progress-bar">
                            <span style={{ width: `${Math.round(doneRatio * 100)}%` }} />
                          </div>
                        )}
                        <span className="calendar-series-progress-label">
                          {ended
                            ? t.calendarSeriesEnded
                            : `${t.calendarSeriesNext}: ${formatNext(item.nextStartTime)}`}
                        </span>
                        {hasEnd && (
                          <span className="calendar-series-progress-count">
                            {item.upcomingCount}/{item.occurrenceCount} {t.calendarSeriesPending}
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="calendar-series-actions">
                      {readOnly ? (
                        <span className="calendar-series-readonly">{t.calendarAssignedTag}</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => onEdit(item)}>
                            {t.calendarSeriesEdit}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => setSeriesToDelete(item)}
                          >
                            {t.commonDelete}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={seriesToDelete != null}
        title={t.confirmDeleteTitle}
        message={`${t.confirmDeleteMessagePrefix} "${seriesToDelete?.title || ""}"?`}
        warning={t.calendarSeriesDeleteWarning}
        confirmLabel={t.commonDelete}
        cancelLabel={t.commonCancel}
        onCancel={() => setSeriesToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};

export default RecurringEventsPanel;
