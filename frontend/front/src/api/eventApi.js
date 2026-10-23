import { format, parse, parseISO, isValid } from "date-fns";
import { apiRequest } from "./apiClient";

const EVENTS_BASE_URL = "/events";

/**
 * Convierte una fecha a texto local compatible con LocalDateTime del backend.
 *
 * @param {Date} date fecha a convertir
 * @returns {string} fecha en formato yyyy-MM-dd'T'HH:mm:ss
 */
const toLocalDateTimeParam = (date) => {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
};

/**
 * Parsea una fecha recibida del backend de forma segura.
 *
 * @param {string|Date} value valor a parsear
 * @returns {Date|null} fecha parseada o null si no es válida
 */
const safeParseDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  try {
    const iso = parseISO(value);
    if (isValid(iso)) return iso;
  } catch (e) {
    // ignore
  }

  try {
    const withMicros = parse(value, "yyyy-MM-dd HH:mm:ss.SSSSSS", new Date());
    if (isValid(withMicros)) return withMicros;
  } catch (e) {
    // ignore
  }

  try {
    const withoutMicros = parse(value, "yyyy-MM-dd HH:mm:ss", new Date());
    if (isValid(withoutMicros)) return withoutMicros;
  } catch (e) {
    // ignore
  }

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
};

const mapEventDates = (event) => ({
  ...event,
  startTime: safeParseDate(event.startTime),
  endTime: safeParseDate(event.endTime),
});

export const fetchEventsByRange = async (startDate, endDate, targetUserId = null) => {
  const start = encodeURIComponent(toLocalDateTimeParam(startDate));
  const end = encodeURIComponent(toLocalDateTimeParam(endDate));
  const targetParam =
    targetUserId != null
      ? `&targetUserId=${encodeURIComponent(targetUserId)}`
      : "";

  const data = await apiRequest(
    `${EVENTS_BASE_URL}/range?start=${start}&end=${end}${targetParam}`,
    { method: "GET", includeJson: false },
  );
  return data.map(mapEventDates);
};

const OCCURRENCE_ID_PATTERN = /^series:(\d+):(\d{4}-\d{2}-\d{2})$/;

/**
 * Las ocurrencias calculadas de una serie no tienen fila propia: su id es
 * "series:{seriesId}:{yyyy-MM-dd}" y se gestionan con los endpoints de ocurrencia.
 *
 * @param {string|number} eventId id del evento
 * @returns {{seriesId: string, date: string}|null} partes del id o null si es un evento normal
 */
export const parseOccurrenceId = (eventId) => {
  const match = typeof eventId === "string" ? eventId.match(OCCURRENCE_ID_PATTERN) : null;
  return match ? { seriesId: match[1], date: match[2] } : null;
};

const occurrenceUrl = ({ seriesId, date }) =>
  `${EVENTS_BASE_URL}/series/${seriesId}/occurrences/${date}`;

export const saveCalendarEvent = async (eventData) => {
  const occurrence = parseOccurrenceId(eventData.id);
  if (occurrence) {
    // Editar una ocurrencia la convierte en un evento propio; el id textual no viaja.
    return apiRequest(occurrenceUrl(occurrence), {
      method: "PUT",
      body: JSON.stringify({ ...eventData, id: null }),
    });
  }

  const isEditing = Boolean(eventData.id);

  return apiRequest(
    isEditing ? `${EVENTS_BASE_URL}/${eventData.id}` : EVENTS_BASE_URL,
    {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(eventData),
    },
  );
};

export const deleteCalendarEvent = async (eventId) => {
  const occurrence = parseOccurrenceId(eventId);
  return apiRequest(occurrence ? occurrenceUrl(occurrence) : `${EVENTS_BASE_URL}/${eventId}`, {
    method: "DELETE",
    includeJson: false,
  });
};

/**
 * Series de eventos recurrentes (una entrada por serie, no por ocurrencia).
 *
 * @param {number|null} targetUserId usuario gestionado (solo admin)
 * @returns {Promise<Array<Object>>} resúmenes de serie
 */
export const fetchEventSeries = async (targetUserId = null) => {
  const targetParam =
    targetUserId != null
      ? `?targetUserId=${encodeURIComponent(targetUserId)}`
      : "";

  const data = await apiRequest(`${EVENTS_BASE_URL}/series${targetParam}`, {
    method: "GET",
    includeJson: false,
  });
  return data.map((series) => ({
    ...mapEventDates(series),
    nextStartTime: safeParseDate(series.nextStartTime),
  }));
};

/**
 * Cambia la configuración de toda la serie (sus ocurrencias se calculan de nuevo).
 */
export const updateEventSeries = async (seriesId, eventData) =>
  apiRequest(`${EVENTS_BASE_URL}/series/${encodeURIComponent(seriesId)}`, {
    method: "PUT",
    body: JSON.stringify(eventData),
  });

export const deleteEventSeries = async (seriesId) =>
  apiRequest(`${EVENTS_BASE_URL}/series/${encodeURIComponent(seriesId)}`, {
    method: "DELETE",
    includeJson: false,
  });

export const fetchEventCategories = () =>
  apiRequest(`${EVENTS_BASE_URL}/categories`, {
    method: "GET",
    includeJson: false,
  });
