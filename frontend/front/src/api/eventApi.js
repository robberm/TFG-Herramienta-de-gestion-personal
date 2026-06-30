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

export const saveCalendarEvent = async (eventData) => {
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
  return apiRequest(`${EVENTS_BASE_URL}/${eventId}`, {
    method: "DELETE",
    includeJson: false,
  });
};

export const fetchEventCategories = () =>
  apiRequest(`${EVENTS_BASE_URL}/categories`, {
    method: "GET",
    includeJson: false,
  });
