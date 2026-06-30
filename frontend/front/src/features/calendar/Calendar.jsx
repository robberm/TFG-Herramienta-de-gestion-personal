import React, { useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

import EventModal from "./EventModal";
import CalendarHeader from "./CalendarHeader";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DailyCalendarView from "./DailyCalendarView";
import TagColorCustomizer from "./TagColorCustomizer";
import useCalendarEvents from "../../hooks/useCalendarEvents";
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
  } = useCalendarEvents();

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
            events={events}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
          />
        )}

        {viewMode === "week" && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onTimeSlotClick={handleWeekTimeSlotClick}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
          />
        )}

        {viewMode === "day" && (
          <DailyCalendarView
            currentDate={currentDate}
            events={events}
            onTimeSlotClick={handleDayTimeSlotClick}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
          />
        )}
      </div>

      <TagColorCustomizer />

      {showModal && (
        <EventModal
          event={selectedEvent}
          selectedDate={selectedDate}
          onClose={handleCloseModal}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          isAdmin={isAdmin}
          managedUsers={managedUsers}
          defaultManagedUserId={selectedManagedUserId}
        />
      )}
    </div>
  );
};

export default Calendar;
