import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

const SIZE = 148;
const CENTER = SIZE / 2;
const RADIUS = 60;
const STROKE = 9;
const MINUTES_PER_DAY = 24 * 60;

const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();

/** Punto sobre el anillo para un minuto del día; las 00:00 quedan arriba. */
const pointAt = (minutes, radius = RADIUS) => {
  const angle = (minutes / MINUTES_PER_DAY) * Math.PI * 2 - Math.PI / 2;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
};

const arcPath = (startMinutes, endMinutes) => {
  const span = Math.max(endMinutes - startMinutes, 6);
  const [x1, y1] = pointAt(startMinutes);
  const [x2, y2] = pointAt(startMinutes + span);
  const largeArc = span > MINUTES_PER_DAY / 2 ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
};

const categoryColor = (category) =>
  `var(--event-${String(category || "work").toLowerCase()}-color, var(--accent))`;

/**
 * Anillo de 24 horas con los eventos de hoy como arcos y una marca en la hora actual.
 * Es el resumen visual de la tarjeta de calendario plegada en el inicio.
 *
 * @param {Array<Object>} events eventos de hoy (con startTime/endTime ya parseables)
 * @param {(value: string|Date) => Date} parseDate convierte las fechas del backend
 */
const DayRing = ({ events, parseDate, label, nowLabel }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const arcs = useMemo(
    () =>
      events
        .filter((event) => !event.isAllDay)
        .map((event) => {
          const start = minutesOfDay(parseDate(event.startTime));
          let end = minutesOfDay(parseDate(event.endTime));
          if (end <= start) end = MINUTES_PER_DAY;
          return { id: event.id, start, end, color: categoryColor(event.category), title: event.title };
        }),
    [events, parseDate],
  );

  const nowMinutes = minutesOfDay(now);
  const [nowX1, nowY1] = pointAt(nowMinutes, RADIUS - STROKE / 2 - 5);
  const [nowX2, nowY2] = pointAt(nowMinutes, RADIUS + STROKE / 2 + 5);
  const ticks = [0, 6, 12, 18];

  return (
    <svg
      className="dayRing"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
    >
      <circle className="dayRingTrack" cx={CENTER} cy={CENTER} r={RADIUS} strokeWidth={STROKE} fill="none" />

      {ticks.map((hour) => {
        const [x1, y1] = pointAt(hour * 60, RADIUS + STROKE / 2 + 3);
        const [x2, y2] = pointAt(hour * 60, RADIUS + STROKE / 2 + 7);
        return <line key={hour} className="dayRingTick" x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}

      {arcs.map((arc) => (
        <path
          key={arc.id}
          className="dayRingArc"
          d={arcPath(arc.start, arc.end)}
          stroke={arc.color}
          strokeWidth={STROKE}
          fill="none"
        >
          <title>{arc.title}</title>
        </path>
      ))}

      <line className="dayRingNow" x1={nowX1} y1={nowY1} x2={nowX2} y2={nowY2} />

      <text className="dayRingTime" x={CENTER} y={CENTER + 4} textAnchor="middle">
        {format(now, "HH:mm")}
      </text>
      {nowLabel && (
        <text className="dayRingNowLabel" x={CENTER} y={CENTER + 22} textAnchor="middle">
          {nowLabel}
        </text>
      )}
    </svg>
  );
};

export default DayRing;
