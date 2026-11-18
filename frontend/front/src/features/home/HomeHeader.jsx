import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { useLanguage } from "../../context/languageContext";
import { capitalizeCalendarLabel } from "../../utils/dateLabels";
import RevealHeadline from "../../components/shared/RevealHeadline";

const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match.map(Number);
      return new Date(year, month - 1, day, hour, minute);
    }
    return parseISO(value);
  }
  return new Date(value);
};

/**
 * Cabecera del inicio: el saludo según la hora es el único h1 y la línea gris de debajo
 * resume el día con datos reales (fecha, eventos y el siguiente que queda).
 */
const HomeHeader = ({ events = null }) => {
  const { language, t } = useLanguage();
  const username = localStorage.getItem("username") || "";
  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 13 ? t.homeGreetingMorning : hour < 21 ? t.homeGreetingAfternoon : t.homeGreetingEvening;

  const dateLabel = capitalizeCalendarLabel(
    format(now, language === "es" ? "EEEE, d 'de' MMMM" : "EEEE, MMMM d", {
      locale: language === "es" ? es : enUS,
    }),
  );

  const summary = useMemo(() => {
    if (!Array.isArray(events)) return null;
    const count = events.length;
    const countLabel = `${count} ${count === 1 ? t.homeEventSingular : t.homeEventPlural}`;
    const next = events
      .filter((event) => !event.isAllDay && toDate(event.endTime) > new Date())
      .sort((a, b) => toDate(a.startTime) - toDate(b.startTime))[0];

    return { count, countLabel, next };
  }, [events, t]);

  return (
    <header className="homeHeader">
      <RevealHeadline
        className="homeGreeting"
        text={`${greeting}, ${username}`}
        onceKey="home-greeting"
      />
      <p className="homeHeaderLine">
        <span>{dateLabel}</span>
        {summary && (
          <>
            <span aria-hidden="true"> · </span>
            <span>{summary.countLabel}</span>
            <span aria-hidden="true"> · </span>
            {summary.next ? (
              <span>
                {t.homeNextUp}: <strong>{summary.next.title}</strong> {t.homeAtTime}{" "}
                <time>{format(toDate(summary.next.startTime), "HH:mm")}</time>
              </span>
            ) : (
              <span>{summary.count === 0 ? t.homeNoEventsToday : t.homeNothingLeftToday}</span>
            )}
          </>
        )}
      </p>
    </header>
  );
};

export default HomeHeader;
