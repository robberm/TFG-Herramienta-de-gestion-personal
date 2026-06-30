import { useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useLocation } from "react-router-dom";

const FocusModeListener = () => {
  const clientRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const isPublicRoute = location.pathname === "/";
    const hasToken = !!localStorage.getItem("token");

    if (isPublicRoute || !hasToken) {
      return undefined;
    }

    const socketFactory = () => new SockJS("http://localhost:8080/ws");

    const stompClient = new Client({
      webSocketFactory: socketFactory,
      reconnectDelay: 5000,
      debug: () => {},
      onConnect: () => {
        stompClient.subscribe("/topic/block", (message) => {
          try {
            const payload = JSON.parse(message.body);
            if (payload.type === "BLOCK_SCREEN") {
              window.electronAPI?.startBlock({
                durationSeconds: payload.durationSeconds,
              });
            }
          } catch (_error) {
            if (message.body === "BLOCK_SCREEN") {
              window.electronAPI?.startBlock({ durationSeconds: 20 });
            }
          }
        });

        stompClient.subscribe("/topic/focus-events", (message) => {
          try {
            const event = JSON.parse(message.body);
            if (event.type !== "FOCUS_NOTIFICATION") {
              return;
            }

            if (
              typeof window !== "undefined" &&
              window.electronAPI &&
              typeof window.electronAPI.showReminderWindow === "function"
            ) {
              window.electronAPI.showReminderWindow({
                title: event.title,
                description: event.message,
                startTime: new Date().toISOString(),
                allDay: false,
              });
              return;
            }

            if (window.Notification && Notification.permission === "granted") {
              new Notification(event.title, { body: event.message });
            }
          } catch (error) {
            console.error("Failed to parse focus notification:", error);
          }
        });
      },
      onStompError: (frame) => {
        console.error("Focus-mode websocket error:", frame);
      },
    });

    stompClient.activate();
    clientRef.current = stompClient;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [location.pathname]);

  return null;
};

export default FocusModeListener;
