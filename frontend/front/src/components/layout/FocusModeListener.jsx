import { useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useLocation } from "react-router-dom";
import breakSoundUrl from "../../assets/sounds/universfield-positive-notification.mp3";
import { useLanguage } from "../../context/languageContext";
import { formatBreakDuration } from "../../utils/breakDuration";

const breakSound = typeof Audio !== "undefined" ? new Audio(breakSoundUrl) : null;
if (breakSound) {
  breakSound.preload = "auto";
  breakSound.volume = 0.8;
}

// La ventana de aviso es una URL data: que no puede cargar el mp3, así que suena aquí.
const playBreakSound = () => {
  if (!breakSound) return;
  breakSound.currentTime = 0;
  breakSound.play().catch(() => {});
};

const buildBreakNotification = (event, t) => {
  if (event.phase === "BREAK_END") {
    return {
      eyebrow: t.focusBreakEndEyebrow,
      title: t.focusBreakEndTitle,
      description: t.focusBreakEndMessage,
    };
  }

  return {
    eyebrow: t.focusBreakEyebrow,
    title: t.focusBreakTitle,
    description: t.focusBreakMessage.replace(
      "{duration}",
      formatBreakDuration(event.breakDurationSeconds),
    ),
  };
};

const FocusModeListener = () => {
  const clientRef = useRef(null);
  const location = useLocation();
  const { t } = useLanguage();
  // El socket vive más que un render: así usa siempre el idioma actual.
  const textsRef = useRef(t);
  textsRef.current = t;

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

            playBreakSound();

            const texts = textsRef.current;
            const notification = buildBreakNotification(event, texts);

            if (
              typeof window !== "undefined" &&
              window.electronAPI &&
              typeof window.electronAPI.showReminderWindow === "function"
            ) {
              window.electronAPI.showReminderWindow({
                ...notification,
                kind: "break",
                closeLabel: texts.focusBreakClose,
              });
              return;
            }

            if (window.Notification && Notification.permission === "granted") {
              new Notification(notification.title, { body: notification.description });
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
