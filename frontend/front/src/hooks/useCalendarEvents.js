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

  const handleDateClick = useCallback((day) => {
    setSelectedDate(day);
    setSelectedEvent(null);
    setShowModal(true);
  }, []);

  const handleEventClick = useCallback((event, e) => {
    if (e) {
      e.stopPropagation();
    }

    setSelectedEvent(event);
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
        await fetchEvents();
      } catch (error) {
        console.error("Error saving event:", error);
        setErrorMessage(getApiErrorMessage(error));
      }
    },
    [fetchEvents, setErrorMessage],
  );

  const handleDeleteEvent = useCallback(
    async (eventId) => {
      if (!eventId) return;

      try {
        await deleteCalendarEvent(eventId);
        setShowModal(false);
        await fetchEvents();
      } catch (error) {
        console.error("Error deleting event:", error);
        setErrorMessage(getApiErrorMessage(error));
      }
    },
    [fetchEvents, setErrorMessage],
  );

 const handleDayTimeSlotClick = useCallback(
   (hour) => {
     const newDate = new Date(currentDate);
     newDate.setHours(hour, 0, 0, 0);
     setSelectedDate(newDate);
     setSelectedEvent(null);
     setShowModal(true);
   },
   [currentDate],
 );

  const handleWeekTimeSlotClick = useCallback((day, hour) => {
    const newDate = new Date(day);
    newDate.setHours(hour, 0, 0, 0);
    setSelectedDate(newDate);
    setSelectedEvent(null);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
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
    viewMode,
    setViewMode,
    fetchEvents,
    handleDateClick,
    handleEventClick,
    handlePrevious,
    handleNext,
    handleToday,
    handleSaveEvent,
    handleDeleteEvent,
    handleDayTimeSlotClick,
    handleWeekTimeSlotClick,
    handleCloseModal,
    getHeaderDateText,
  };
};

export default useCalendarEvents;
