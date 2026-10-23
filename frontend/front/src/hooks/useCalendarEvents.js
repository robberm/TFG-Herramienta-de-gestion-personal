import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
} from "date-fns";
import { enUS, es } from "date-fns/locale";
import {
  fetchEventsByRange,
  saveCalendarEvent,
  deleteCalendarEvent,
  fetchEventSeries,
  updateEventSeries,
  deleteEventSeries,
} from "../api/eventApi";
import { getApiErrorMessage } from "../api/apiClient";
import { getCurrentUserProfile } from "../api/userApi";
import { getManagedUsers } from "../api/adminApi";
import { useLanguage } from "../context/languageContext";
import { useError } from "../components/ErrorContext";
import { capitalizeCalendarLabel } from "../utils/dateLabels";

const useCalendarEvents = () => {
  const { language } = useLanguage();
  const { setErrorMessage } = useError();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  // Serie abierta en el modal desde el panel de eventos programados.
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [series, setSeries] = useState([]);
  const [viewMode, setViewMode] = useState("month");
  const [profile, setProfile] = useState(null);
  const [managedUsers, setManagedUsers] = useState([]);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState(null);

  const isAdmin = profile?.role === "ADMIN";
  const calendarLocale = language === "es" ? es : enUS;

  const collapseAdminAssignedEvents = useCallback((incomingEvents) => {
    if (!Array.isArray(incomingEvents)) {
      return [];
    }

    const groupedByBatch = new Map();

    incomingEvents.forEach((event) => {


            const normalizedStart = event.startTime || "";
      const normalizedEnd = event.endTime || "";
      const normalizedCategory = event.category || "";
      const normalizedTitle = event.title || "";
      const normalizedDescription = event.description || "";
      const normalizedLocation = event.location || "";

      const fallbackBulkKey =
        event.assignedByAdmin &&
        `bulk-${normalizedStart}-${normalizedEnd}-${normalizedCategory}-${normalizedTitle}-${normalizedDescription}-${normalizedLocation}-${event.assignedByAdminUsername || ""}-${event.isAllDay ? "allDay" : "timed"}`;

      const groupKey = event.assignmentBatchId
        ? `batch-${event.assignmentBatchId}`
       : fallbackBulkKey || `event-${event.id}`;

      if (!groupedByBatch.has(groupKey)) {
        groupedByBatch.set(groupKey, {
          ...event,
          assignedUsersCount: 1,
          assignedToUsername: event.assignedToUsername || null,
          assignedUserIds:
            event.assignedToUserId != null ? [event.assignedToUserId] : [],
        });
        return;
      }

      const current = groupedByBatch.get(groupKey);
      groupedByBatch.set(groupKey, {
        ...current,
        assignedUsersCount: (current.assignedUsersCount || 1) + 1,
        assignedToUsername: "Varios usuarios",
        assignedUserIds: [
          ...(current.assignedUserIds || []),
          ...(event.assignedToUserId != null ? [event.assignedToUserId] : []),
        ],
      });
    });

    return Array.from(groupedByBatch.values());
  }, []);

  useEffect(() => {
    const loadScope = async () => {
      try {
        const currentProfile = await getCurrentUserProfile();
        setProfile(currentProfile);

        if (currentProfile?.role === "ADMIN") {
          const users = await getManagedUsers();
          const normalizedUsers = Array.isArray(users) ? users : [];
          setManagedUsers(normalizedUsers);
          setSelectedManagedUserId((previousId) => {
            if (
              previousId != null &&
              normalizedUsers.some((user) => user.id === previousId)
            ) {
              return previousId;
            }
            return previousId ?? null;
          });
          return;
        }

        setManagedUsers([]);
        setSelectedManagedUserId(null);
      } catch (error) {
        console.error("Error loading calendar scope:", error);
      }
    };

    loadScope();
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      let start;
      let end;

      if (viewMode === "month") {
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
      } else if (viewMode === "week") {
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
      } else {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        start = dayStart;
        end = dayEnd;
      }

      const data = await fetchEventsByRange(
        start,
        end,
        isAdmin ? selectedManagedUserId : null,
      );

      if (isAdmin && selectedManagedUserId == null) {
        setEvents(collapseAdminAssignedEvents(data));
      } else {
        setEvents(data);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  }, [
    collapseAdminAssignedEvents,
    currentDate,
    isAdmin,
    selectedManagedUserId,
    viewMode,
  ]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchSeries = useCallback(async () => {
    if (profile == null) return;

    try {
      const data = await fetchEventSeries(isAdmin ? selectedManagedUserId : null);
      setSeries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching event series:", error);
    }
  }, [isAdmin, profile, selectedManagedUserId]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  /** Recarga las ocurrencias visibles y el panel de series tras cualquier cambio. */
  const refreshCalendar = useCallback(
    () => Promise.all([fetchEvents(), fetchSeries()]),
    [fetchEvents, fetchSeries],
  );

  const handleDateClick = useCallback((day) => {
    setSelectedDate(day);
    setSelectedEvent(null);
    setSelectedSeries(null);
    setShowModal(true);
  }, []);

  const handleEventClick = useCallback((event, e) => {
    if (e) {
      e.stopPropagation();
    }

    setSelectedEvent(event);
    setSelectedSeries(null);
    setShowModal(true);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentDate((prevDate) => {
      if (viewMode === "month") {
        return subMonths(prevDate, 1);
      }
      if (viewMode === "week") {
        return addDays(prevDate, -7);
      }
      return addDays(prevDate, -1);
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate((prevDate) => {
      if (viewMode === "month") {
        return addMonths(prevDate, 1);
      }
      if (viewMode === "week") {
        return addDays(prevDate, 7);
      }
      return addDays(prevDate, 1);
    });
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleSaveEvent = useCallback(
    async (eventData) => {
      try {
        await saveCalendarEvent(eventData);
        setShowModal(false);
        await refreshCalendar();
      } catch (error) {
        console.error("Error saving event:", error);
        setErrorMessage(getApiErrorMessage(error));
      }
    },
    [refreshCalendar, setErrorMessage],
  );

  const handleDeleteEvent = useCallback(
    async (eventId) => {
      if (!eventId) return;

      try {
        await deleteCalendarEvent(eventId);
        setShowModal(false);
        await refreshCalendar();
      } catch (error) {
        console.error("Error deleting event:", error);
        setErrorMessage(getApiErrorMessage(error));
      }
    },
    [refreshCalendar, setErrorMessage],
  );

  const handleEditSeries = useCallback((seriesToEdit) => {
    setSelectedSeries(seriesToEdit);
    setSelectedEvent(null);
    setShowModal(true);
  }, []);

  /**
   * Guarda la nueva configuración de una serie: el backend regenera sus ocurrencias.
   */
  const handleSaveSeries = useCallback(
    async (eventData) => {
      if (!selectedSeries) return;

      try {
        await updateEventSeries(selectedSeries.seriesId, eventData);
        setShowModal(false);
        setSelectedSeries(null);
        await refreshCalendar();
      } catch (error) {
        console.error("Error saving event series:", error);
        setErrorMessage(getApiErrorMessage(error));
      }
    },
    [refreshCalendar, selectedSeries, setErrorMessage],
  );

  const handleDeleteSeries = useCallback(
    async (seriesId) => {
      if (!seriesId) return;

      try {
        await deleteEventSeries(seriesId);
        setShowModal(false);
        setSelectedSeries(null);
        await refreshCalendar();
      } catch (error) {
        console.error("Error deleting event series:", error);
        setErrorMessage(getApiErrorMessage(error));
      }
    },
    [refreshCalendar, setErrorMessage],
  );

  /**
   * Un usuario normal no puede mover eventos que le ha asignado un administrador
   * (misma regla que el modo solo lectura de EventModal).
   */
  const canMoveEvent = useCallback(
    (event) => {
      const isEventAssignedByAdmin =
        event?.assignedByAdmin === true &&
        Boolean(event?.assignedByAdminUsername) &&
        event?.assignedByAdminUsername !== event?.assignedToUsername;

      return !isEventAssignedByAdmin || isAdmin;
    },
    [isAdmin],
  );

  /**
   * Guarda el nuevo horario de un evento arrastrado. Se aplica primero en local
   * para que el evento no "salte" de vuelta mientras responde el backend.
   */
  const handleMoveEvent = useCallback(
    async (event, startTime, endTime) => {
      setEvents((prevEvents) =>
        prevEvents.map((item) =>
          item.id === event.id ? { ...item, startTime, endTime } : item,
        ),
      );

      const assignedUserIds =
        Array.isArray(event.assignedUserIds) && event.assignedUserIds.length > 0
          ? event.assignedUserIds
          : event.assignedToUserId != null
            ? [event.assignedToUserId]
            : null;

      try {
        await saveCalendarEvent({
          id: event.id,
          title: event.title,
          description: event.description,
          startTime: format(startTime, "yyyy-MM-dd'T'HH:mm:ss"),
          endTime: format(endTime, "yyyy-MM-dd'T'HH:mm:ss"),
          location: event.location,
          category: event.category,
          isAllDay: Boolean(event.isAllDay),
          reminderMinutesBeforeList: event.reminderMinutesBeforeList ?? [],
          targetUserId: null,
          targetUserIds: isAdmin ? assignedUserIds : null,
          assignToAllUsers: false,
          recurrenceType: "NONE",
          recurrenceEndDate: null,
          recurrenceWeekdays: null,
        });
      } catch (error) {
        console.error("Error moving event:", error);
        setErrorMessage(getApiErrorMessage(error));
      } finally {
        await refreshCalendar();
      }
    },
    [isAdmin, refreshCalendar, setErrorMessage],
  );

 const handleDayTimeSlotClick = useCallback(
   (hour) => {
     const newDate = new Date(currentDate);
     newDate.setHours(hour, 0, 0, 0);
     setSelectedDate(newDate);
     setSelectedEvent(null);
     setSelectedSeries(null);
     setShowModal(true);
   },
   [currentDate],
 );

  const handleWeekTimeSlotClick = useCallback((day, hour) => {
    const newDate = new Date(day);
    newDate.setHours(hour, 0, 0, 0);
    setSelectedDate(newDate);
    setSelectedEvent(null);
    setSelectedSeries(null);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedSeries(null);
  }, []);

  const getHeaderDateText = useCallback(() => {
    if (viewMode === "month") {
      return capitalizeCalendarLabel(format(currentDate, "MMMM yyyy", { locale: calendarLocale }));
    }

    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });

      return `${capitalizeCalendarLabel(format(start, "MMM d", { locale: calendarLocale }))} - ${capitalizeCalendarLabel(format(
        end,
        "MMM d, yyyy",
        { locale: calendarLocale },
      ))}`;
    }

    return capitalizeCalendarLabel(format(currentDate, "EEEE, MMMM d, yyyy", { locale: calendarLocale }));
  }, [calendarLocale, currentDate, viewMode]);

  return {
    currentDate,
    selectedDate,
    events,
    profile,
    isAdmin,
    managedUsers,
    selectedManagedUserId,
    setSelectedManagedUserId,
    showModal,
    selectedEvent,
    selectedSeries,
    series,
    viewMode,
    setViewMode,
    fetchEvents,
    refreshCalendar,
    handleDateClick,
    handleEventClick,
    handlePrevious,
    handleNext,
    handleToday,
    handleSaveEvent,
    handleDeleteEvent,
    canMoveEvent,
    handleMoveEvent,
    handleEditSeries,
    handleSaveSeries,
    handleDeleteSeries,
    handleDayTimeSlotClick,
    handleWeekTimeSlotClick,
    handleCloseModal,
    getHeaderDateText,
  };
};

export default useCalendarEvents;
