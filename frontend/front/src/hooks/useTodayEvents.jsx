import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEventsByRange } from "../api/eventApi";

const useTodayEvents = () => {
  const [events, setEvents] = useState([]);
  const [isLoadingTodayEvents, setIsLoadingTodayEvents] = useState(false);

  const refreshTodayEvents = useCallback(async () => {
    try {
      setIsLoadingTodayEvents(true);

      const now = new Date();

      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const todayEvents = await fetchEventsByRange(startOfToday, endOfToday);
      setEvents(todayEvents);
    } catch (error) {
      console.error("Error fetching today events:", error);
    } finally {
      setIsLoadingTodayEvents(false);
    }
  }, []);

  useEffect(() => {
    refreshTodayEvents();
  }, [refreshTodayEvents]);

  const sortedTodayEvents = useMemo(() => {
    return [...events].sort((firstEvent, secondEvent) => {
      if (firstEvent.isAllDay && !secondEvent.isAllDay) return -1;
      if (!firstEvent.isAllDay && secondEvent.isAllDay) return 1;
      return firstEvent.startTime - secondEvent.startTime;
    });
  }, [events]);

  return {
    todayEvents: sortedTodayEvents,
    isLoadingTodayEvents,
    refreshTodayEvents,
  };
};

export default useTodayEvents;
