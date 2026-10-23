import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";

// Debe coincidir con HOUR_HEIGHT_PX de WeekView y DailyCalendarView.
const HOUR_HEIGHT_PX = 80;
const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;
const MINUTES_PER_DAY = 24 * 60;
const SNAP_MINUTES = 15;
// Distancia mínima antes de considerar que el usuario arrastra y no hace click.
const DRAG_THRESHOLD_PX = 4;
// Duración de la animación con la que la copia flotante "aterriza" al soltar.
const LANDING_DURATION_MS = 180;

const TIME_DROP_SELECTOR = "[data-calendar-drop='time']";

const toDate = (value) =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);

const snapMinutes = (minutes) =>
  Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Clave de día usada en los atributos data-calendar-day de las vistas.
 *
 * @param {Date} date día a convertir
 * @returns {string} fecha en formato yyyy-MM-dd
 */
export const getCalendarDayKey = (date) => format(date, "yyyy-MM-dd");

const parseDayKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Busca bajo el puntero la columna o celda del calendario donde se puede soltar.
 *
 * @param {number} clientX posición horizontal del puntero
 * @param {number} clientY posición vertical del puntero
 * @param {string|null} dropKind "time" para columnas horarias, null para cualquier día
 * @returns {HTMLElement|null} elemento destino
 */
const findDropTarget = (clientX, clientY, dropKind) =>
  document
    .elementsFromPoint(clientX, clientY)
    .find(
      (element) =>
        element.dataset?.calendarDay &&
        (!dropKind || element.dataset.calendarDrop === dropKind),
    ) || null;

const findEventElement = (eventId) =>
  document.querySelector(`[data-calendar-event="${CSS.escape(String(eventId))}"]`);

/**
 * Calcula el nuevo inicio/fin de un evento con hora al moverlo a otra franja o día.
 */
const computeTimedMove = (session, clientX, clientY) => {
  const column = findDropTarget(clientX, clientY, "time");
  if (!column) return null;

  const pointerMinutes =
    (clientY - column.getBoundingClientRect().top) / PX_PER_MINUTE;
  const maxStart = MINUTES_PER_DAY - Math.min(session.durationMinutes, MINUTES_PER_DAY);
  const startMinutes = clamp(
    snapMinutes(pointerMinutes - session.grabOffsetMinutes),
    0,
    maxStart,
  );

  const start = parseDayKey(column.dataset.calendarDay);
  start.setMinutes(startMinutes);

  return {
    start,
    end: new Date(start.getTime() + session.durationMinutes * 60000),
  };
};

/**
 * Minuto del puntero dentro de la columna horaria donde empezó el arrastre.
 */
const getPointerMinutesInColumn = (session, clientY) =>
  snapMinutes(
    (clientY - session.columnElement.getBoundingClientRect().top) / PX_PER_MINUTE,
  );

/**
 * Minutos de inicio y fin del evento original contados desde las 00:00 de su día.
 */
const getOriginalDayMinutes = (session) => {
  const dayStart = startOfDay(session.originalStart);
  return {
    dayStart,
    startMinutes: (session.originalStart - dayStart) / 60000,
    endMinutes: (session.originalEnd - dayStart) / 60000,
  };
};

/**
 * Calcula el nuevo fin de un evento al estirar su borde inferior.
 */
const computeResizeEnd = (session, clientY) => {
  const { dayStart, startMinutes } = getOriginalDayMinutes(session);
  const endMinutes = clamp(
    getPointerMinutesInColumn(session, clientY),
    startMinutes + SNAP_MINUTES,
    MINUTES_PER_DAY,
  );

  return {
    start: session.originalStart,
    end: new Date(dayStart.getTime() + endMinutes * 60000),
  };
};

/**
 * Calcula el nuevo inicio de un evento al estirar su borde superior.
 */
const computeResizeStart = (session, clientY) => {
  const { dayStart, endMinutes } = getOriginalDayMinutes(session);
  const startMinutes = clamp(
    getPointerMinutesInColumn(session, clientY),
    0,
    Math.min(endMinutes, MINUTES_PER_DAY) - SNAP_MINUTES,
  );

  return {
    start: new Date(dayStart.getTime() + startMinutes * 60000),
    end: session.originalEnd,
  };
};

/**
 * Calcula el nuevo inicio/fin al mover un evento a otro día conservando la hora.
 */
const computeDayMove = (session, clientX, clientY) => {
  const cell = findDropTarget(clientX, clientY, null);
  if (!cell) return null;

  const dayShift = differenceInCalendarDays(
    parseDayKey(cell.dataset.calendarDay),
    session.originalStart,
  );

  return {
    start: addDays(session.originalStart, dayShift),
    end: addDays(session.originalEnd, dayShift),
  };
};

const isResizeMode = (mode) => mode === "resize-start" || mode === "resize-end";

/**
 * Crea la copia flotante del evento que sigue al puntero mientras se arrastra.
 * Se cuelga de body con position: fixed para que no la recorte el scroll de la vista.
 */
const createDragGhost = (sourceElement) => {
  const rect = sourceElement.getBoundingClientRect();
  const ghost = sourceElement.cloneNode(true);

  ghost.removeAttribute("data-calendar-event");
  ghost.classList.remove("is-dragging");
  ghost.classList.add("calendar-drag-ghost");
  ghost.querySelectorAll(".calendar-event-resize-handle").forEach((handle) => handle.remove());

  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    right: "auto",
    bottom: "auto",
    margin: "0",
    transform: "translate3d(0, 0, 0)",
  });

  document.body.appendChild(ghost);
  // Se fuerza un frame para que la transición de "levantar" el evento se vea.
  requestAnimationFrame(() => ghost.classList.add("is-lifted"));

  return { element: ghost, rect };
};

/**
 * Lleva la copia flotante hasta el rectángulo indicado y la elimina al terminar.
 */
const landDragGhost = (ghost, targetRect, onDone) => {
  if (!ghost) {
    onDone();
    return;
  }

  const { element, rect } = ghost;

  if (!targetRect || prefersReducedMotion()) {
    element.remove();
    onDone();
    return;
  }

  element.classList.remove("is-lifted");
  element.classList.add("is-landing");
  Object.assign(element.style, {
    transform: `translate3d(${targetRect.left - rect.left}px, ${targetRect.top - rect.top}px, 0)`,
    width: `${targetRect.width}px`,
    height: `${targetRect.height}px`,
  });

  setTimeout(() => {
    element.remove();
    onDone();
  }, LANDING_DURATION_MS);
};

/**
 * Evita el click que el navegador dispara justo después de soltar un arrastre,
 * para que no se abra el modal del evento ni el de creación del día.
 */
const swallowNextClick = () => {
  const stopClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  window.addEventListener("click", stopClick, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stopClick, true), 0);
};

/**
 * Gestiona el arrastrar y soltar de eventos del calendario.
 *
 * Modos:
 * - "move": mueve un evento con hora a otra franja y/o día (vistas semana y día).
 * - "resize-start" / "resize-end": cambia la hora de inicio o de fin estirando
 *   el borde superior o inferior.
 * - "day": mueve el evento a otro día conservando la hora (vista mes y "todo el día").
 *
 * En "move" y "day" una copia del evento sigue al puntero mientras el original
 * marca, ajustado a la rejilla, el hueco donde caerá.
 *
 * @param {Object} options
 * @param {(event: Object) => boolean} options.canDragEvent indica si el evento es movible
 * @param {(event: Object, start: Date, end: Date) => void} options.onEventMove persiste el cambio
 * @returns {{dragPreview: Object|null, beginEventDrag: Function}}
 */
const useEventDrag = ({ canDragEvent, onEventMove }) => {
  const [dragPreview, setDragPreview] = useState(null);
  const sessionRef = useRef(null);
  const onEventMoveRef = useRef(onEventMove);

  useEffect(() => {
    onEventMoveRef.current = onEventMove;
  }, [onEventMove]);

  const beginEventDrag = useCallback(
    (e, event, mode) => {
      if (e.button !== 0 || !canDragEvent(event)) return;

      // Los tiradores de redimensionar están dentro del evento: no deben iniciar también un "move".
      e.stopPropagation();

      const originalStart = toDate(event.startTime);
      const originalEnd = toDate(event.endTime);
      const eventElement = e.currentTarget.closest("[data-calendar-event]");

      sessionRef.current = {
        event,
        mode,
        originX: e.clientX,
        originY: e.clientY,
        started: false,
        cancelled: false,
        latest: null,
        ghost: null,
        originalStart,
        originalEnd,
        eventElement,
        durationMinutes: Math.max(
          Math.round((originalEnd - originalStart) / 60000),
          SNAP_MINUTES,
        ),
        grabOffsetMinutes: eventElement
          ? (e.clientY - eventElement.getBoundingClientRect().top) / PX_PER_MINUTE
          : 0,
        columnElement: e.currentTarget.closest(TIME_DROP_SELECTOR),
      };
    },
    [canDragEvent],
  );

  useEffect(() => {
    const clearBodyState = () => {
      delete document.body.dataset.calendarDrag;
    };

    const handlePointerMove = (e) => {
      const session = sessionRef.current;
      if (!session || session.cancelled) return;

      if (!session.started) {
        const distance = Math.hypot(
          e.clientX - session.originX,
          e.clientY - session.originY,
        );
        if (distance < DRAG_THRESHOLD_PX) return;

        session.started = true;
        document.body.dataset.calendarDrag = session.mode;

        if (!isResizeMode(session.mode) && session.eventElement) {
          session.ghost = createDragGhost(session.eventElement);
        }
      }

      if (session.ghost) {
        session.ghost.element.style.transform = `translate3d(${
          e.clientX - session.originX
        }px, ${e.clientY - session.originY}px, 0)`;
      }

      let next = null;
      if (session.mode === "move") {
        next = computeTimedMove(session, e.clientX, e.clientY);
      } else if (session.mode === "resize-end" && session.columnElement) {
        next = computeResizeEnd(session, e.clientY);
      } else if (session.mode === "resize-start" && session.columnElement) {
        next = computeResizeStart(session, e.clientY);
      } else if (session.mode === "day") {
        next = computeDayMove(session, e.clientX, e.clientY);
      }

      if (!next) return;

      session.latest = next;
      setDragPreview({
        eventId: session.event.id,
        mode: session.mode,
        startTime: next.start,
        endTime: next.end,
      });
    };

    const handlePointerUp = () => {
      const session = sessionRef.current;
      if (!session) return;

      sessionRef.current = null;

      // Sin desplazamiento real es un click normal: se deja pasar.
      if (!session.started) {
        clearBodyState();
        return;
      }

      swallowNextClick();

      const { latest } = session;
      const hasChanged =
        !session.cancelled &&
        latest &&
        (latest.start.getTime() !== session.originalStart.getTime() ||
          latest.end.getTime() !== session.originalEnd.getTime());

      if (!hasChanged) {
        // Vuelve a su sitio: la copia regresa al rectángulo de partida.
        clearBodyState();
        setDragPreview(null);
        landDragGhost(session.ghost, session.ghost?.rect, () => {});
        return;
      }

      // El hueco marcado por el original es el destino de la copia flotante; se
      // mantiene como hueco hasta que la copia aterriza encima.
      const placeholder = findEventElement(session.event.id);
      onEventMoveRef.current(session.event, latest.start, latest.end);
      landDragGhost(session.ghost, placeholder?.getBoundingClientRect(), () => {
        clearBodyState();
        setDragPreview(null);
      });
    };

    const handleCancel = () => {
      const session = sessionRef.current;
      if (!session) return;

      sessionRef.current = null;
      clearBodyState();
      session.ghost?.element.remove();
      setDragPreview(null);
    };

    // Escape anula el arrastre; la sesión sigue viva hasta soltar para descartar ese click.
    const handleKeyDown = (e) => {
      const session = sessionRef.current;
      if (e.key !== "Escape" || !session?.started) return;

      session.cancelled = true;
      clearBodyState();
      setDragPreview(null);
      landDragGhost(session.ghost, session.ghost?.rect, () => {});
      session.ghost = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKeyDown);
      sessionRef.current?.ghost?.element.remove();
      clearBodyState();
    };
  }, []);

  return { dragPreview, beginEventDrag };
};

export default useEventDrag;
