import React, { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { format, parseISO } from "date-fns";
import "../../css/ReminderListener.css";
import LocationIcon from "../shared/LocationIcon";

/**
 * Convierte LocalDateTime del backend a Date sin desfases.
 *
 * @param {string|Date} value valor recibido
 * @returns {Date|null} fecha parseada
 */
const parseReminderDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
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
  }

  return new Date(value);
};

const ReminderListener = () => {
  const clientRef = useRef(null);
  const [fallbackNotifications, setFallbackNotifications] = useState([]);

  useEffect(() => {
    const socketFactory = () => new SockJS("http://localhost:8080/ws");

    const stompClient = new Client({
      webSocketFactory: socketFactory,
      reconnectDelay: 5000,
      debug: () => {},
      onConnect: () => {
        stompClient.subscribe("/topic/reminders", (message) => {
          try {
            const reminder = JSON.parse(message.body);

            if (
              typeof window !== "undefined" &&
              window.electronAPI &&
              typeof window.electronAPI.showReminderWindow === "function"
            ) {
              window.electronAPI.showReminderWindow(reminder);
              return;
            }

            setFallbackNotifications((prev) => [
              ...prev,
              {
                ...reminder,
                localId: `${reminder.eventId}_${Date.now()}`,
              },
            ]);
          } catch (error) {
            console.error("Failed to parse reminder notification:", error);
          }
        });
      },
      onStompError: (frame) => {
        console.error("Reminder websocket error:", frame);
      },
    });

    stompClient.activate();
    clientRef.current = stompClient;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, []);

  useEffect(() => {
    if (fallbackNotifications.length === 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setFallbackNotifications((prev) => prev.slice(1));
    }, 7000);

    return () => clearTimeout(timer);
  }, [fallbackNotifications]);

  const closeFallbackNotification = (localId) => {
    setFallbackNotifications((prev) =>
      prev.filter((notification) => notification.localId !== localId),
    );
  };

  return (
    <div className="reminderToastStack">
      {fallbackNotifications.map((notification) => {
        const startDate = parseReminderDate(notification.startTime);

        return (
          <div key={notification.localId} className="reminderToast">
            <button
              type="button"
              className="reminderToastClose"
              onClick={() => closeFallbackNotification(notification.localId)}
            >
              ×
            </button>

            <div className="reminderToastEyebrow">Próximo evento</div>
            <div className="reminderToastTitle">{notification.title}</div>

            {startDate && (
              <div className="reminderToastTime">
                {notification.allDay
                  ? "Todo el día"
                  : `Empieza a las ${format(startDate, "HH:mm")}`}
              </div>
            )}

            {notification.location && (
              <div className="reminderToastLocation">
                <LocationIcon /> {notification.location}
              </div>
            )}

            {notification.description && (
              <div className="reminderToastDescription">
                {notification.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReminderListener;
