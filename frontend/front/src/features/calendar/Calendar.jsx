import React, { useEffect, useMemo } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

import EventModal from "./EventModal";
import CalendarHeader from "./CalendarHeader";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DailyCalendarView from "./DailyCalendarView";
import TagColorCustomizer from "./TagColorCustomizer";
import RecurringEventsPanel from "./RecurringEventsPanel";
import useCalendarEvents from "../../hooks/useCalendarEvents";
import useEventDrag from "../../hooks/useEventDrag";
import "../../css/Calendar.css";
import { useLanguage } from "../../context/languageContext";
import CustomSelectDropdown from "../../components/shared/CustomSelectDropdown";

const Calendar = () => {
  const { t } = useLanguage();
  const {
    currentDate,
    selectedDate,
    events,
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
  } = useCalendarEvents();

  const { dragPreview, beginEventDrag } = useEventDrag({
    canDragEvent: canMoveEvent,
    onEventMove: handleMoveEvent,
  });

  // Mientras se arrastra, el evento se pinta en su posición provisional.
  const displayedEvents = useMemo(() => {
    if (!dragPreview) return events;

    return events.map((event) =>
      event.id === dragPreview.eventId
        ? { ...event, startTime: dragPreview.startTime, endTime: dragPreview.endTime }
        : event,
    );
  }, [dragPreview, events]);

  // En modo serie el modal trabaja con el id de la serie en lugar del de un evento.
  const modalEvent = useMemo(
    () =>
      selectedSeries
        ? { ...selectedSeries, id: selectedSeries.seriesId }
        : selectedEvent,
    [selectedEvent, selectedSeries],
  );

  const dragProps = {
    onEventPointerDown: beginEventDrag,
    canDragEvent: canMoveEvent,
    draggingEventId: dragPreview?.eventId ?? null,
  };

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");

    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        stompClient.subscribe("/topic/calendar", () => {
          fetchEvents();
        });
      },
      onStompError: () => {},
    });

    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, [fetchEvents]);

  return (
    <div className="calendar-container">
      <CalendarHeader
        dateText={getHeaderDateText()}
        viewMode={viewMode}
        onPrevious={handlePrevious}
        onToday={handleToday}
        onNext={handleNext}
        onChangeView={setViewMode}
      />

      <div className="calendar-body">
        {isAdmin && (
          <div className="adminCalendarScopeSelector">
            <CustomSelectDropdown
              id="calendar-managed-user"
              label={t.calendarManagedUserLabel}
              value={selectedManagedUserId ?? ""}
              onChange={(value) =>
                setSelectedManagedUserId(value ? Number(value) : null)
              }
              options={[
                { value: "", label: t.calendarAllManagedUsers },
                ...managedUsers.map((user) => ({
                  value: String(user.id),
                  label: user.username,
                })),
              ]}
              placeholder={
                managedUsers.length === 0
                  ? t.calendarNoManagedUsers
                  : t.calendarAllManagedUsers
              }
              disabled={managedUsers.length === 0}
            />
          </div>
        )}

        {viewMode === "month" && (
          <MonthView
            currentDate={currentDate}
            selectedDate={selectedDate}
            events={displayedEvents}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
            {...dragProps}
          />
        )}

        {viewMode === "week" && (
          <WeekView
            currentDate={currentDate}
            events={displayedEvents}
            onTimeSlotClick={handleWeekTimeSlotClick}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
            {...dragProps}
          />
        )}

        {viewMode === "day" && (
          <DailyCalendarView
            currentDate={currentDate}
            events={displayedEvents}
            onTimeSlotClick={handleDayTimeSlotClick}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
            {...dragProps}
          />
        )}
      </div>

      <RecurringEventsPanel
        series={series}
        isAdmin={isAdmin}
        onEdit={handleEditSeries}
        onDelete={handleDeleteSeries}
      />

      <TagColorCustomizer />

      {showModal && (
        <EventModal
          event={modalEvent}
          selectedDate={selectedDate}
          onClose={handleCloseModal}
          onSave={selectedSeries ? handleSaveSeries : handleSaveEvent}
          onDelete={selectedSeries ? handleDeleteSeries : handleDeleteEvent}
          isAdmin={isAdmin}
          managedUsers={managedUsers}
          defaultManagedUserId={selectedManagedUserId}
          isSeries={selectedSeries != null}
        />
      )}
    </div>
  );
};

export default Calendar;
