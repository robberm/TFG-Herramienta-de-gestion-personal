import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getObjectiveLogsByRange } from "../../../api/objectivesApi";
import { useLanguage } from "../../../context/languageContext";
import { buildHabitCompletionMap, formatIsoDate } from "../utils/objectiveHelpers";

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

/** Fecha (sin hora) en la que se creó el hábito; si no se conoce, no limita nada. */
const habitStartIso = (habit) => (habit.audTim ? String(habit.audTim).slice(0, 10) : null);

/**
 * Progreso mensual de los hábitos: una fila por hábito con un cuadro por día y, debajo,
 * una fila con la parte de los hábitos cumplidos cada día. Los porcentajes solo cuentan
 * los días ya transcurridos (y desde que existe cada hábito), así que nunca se inflan.
 *
 * Carga los registros del mes con el mismo endpoint de rango que usa la página y les
 * superpone los `logs` de la página, para reflejar al momento los hábitos marcados hoy.
 */
const HabitMonthView = ({ habits, logs }) => {
  const { language, t } = useLanguage();
  const today = useMemo(() => new Date(), []);
  const todayIso = formatIsoDate(today);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [monthLogs, setMonthLogs] = useState([]);
  const [status, setStatus] = useState("loading");

  const monthStartIso = formatIsoDate(month);
  const monthEndIso = formatIsoDate(endOfMonth(month));
  const isCurrentMonth =
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  const loadMonth = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getObjectiveLogsByRange(monthStartIso, monthEndIso);
      setMonthLogs(Array.isArray(data) ? data : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [monthEndIso, monthStartIso]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const days = useMemo(() => {
    const total = endOfMonth(month).getDate();
    return Array.from({ length: total }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
      const weekday = date.getDay();
      return {
        iso: formatIsoDate(date),
        number: index + 1,
        isWeekend: weekday === 0 || weekday === 6,
      };
    });
  }, [month]);

  const monthLabel = useMemo(() => {
    const label = new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(month);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [language, month]);

  const { rows, dailyShare, overallRate, best } = useMemo(() => {
    const completion = buildHabitCompletionMap([...monthLogs, ...logs]);

    const habitRows = habits.map((habit) => {
      const createdIso = habitStartIso(habit);
      let done = 0;
      let possible = 0;

      const cells = days.map((day) => {
        const isFuture = day.iso > todayIso;
        const beforeHabit = createdIso ? day.iso < createdIso : false;
        const isDone = completion[habit.id]?.[day.iso] === true;
        const counts = !isFuture && !beforeHabit;

        if (counts) possible += 1;
        if (counts && isDone) done += 1;

        return {
          iso: day.iso,
          state: isFuture || beforeHabit ? "empty" : isDone ? "done" : "missed",
        };
      });

      return {
        habit,
        cells,
        done,
        possible,
        rate: possible > 0 ? Math.round((done * 100) / possible) : null,
      };
    });

    const share = days.map((day, index) => {
      const counted = habitRows.filter((row) => row.cells[index].state !== "empty");
      const doneCount = counted.filter((row) => row.cells[index].state === "done").length;
      return {
        iso: day.iso,
        total: counted.length,
        done: doneCount,
        ratio: counted.length > 0 ? doneCount / counted.length : null,
      };
    });

    const totalDone = habitRows.reduce((acc, row) => acc + row.done, 0);
    const totalPossible = habitRows.reduce((acc, row) => acc + row.possible, 0);
    const ranked = habitRows.filter((row) => row.rate !== null).sort((a, b) => b.rate - a.rate);

    return {
      rows: habitRows,
      dailyShare: share,
      overallRate: totalPossible > 0 ? Math.round((totalDone * 100) / totalPossible) : null,
      best: ranked[0] || null,
    };
  }, [days, habits, logs, monthLogs, todayIso]);

  const gridStyle = { "--month-days": days.length };

  return (
    <article className="dashboardCard habitMonthCard">
      <header className="habitMonthHeader">
        <div className="habitMonthHeading">
          <h3>{t.habitMonthTitle}</h3>
          {overallRate !== null && status === "ready" && (
            <p className="habitMonthSummary">
              <strong className="num">{overallRate}%</strong> {t.habitMonthSummary}
              {best && (
                <>
                  <span aria-hidden="true"> · </span>
                  {t.habitMonthBest}: <strong>{best.habit.titulo}</strong>{" "}
                  <span className="num">({best.rate}%)</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="habitMonthNav">
          <button
            type="button"
            className="weeklyNavButton"
            onClick={() => setMonth((current) => addMonths(current, -1))}
            aria-label={t.habitMonthPrevious}
            title={t.habitMonthPrevious}
          >
            ‹
          </button>
          <span className="habitMonthLabel">{monthLabel}</span>
          <button
            type="button"
            className="weeklyNavButton"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            disabled={isCurrentMonth}
            aria-label={t.habitMonthNext}
            title={t.habitMonthNext}
          >
            ›
          </button>
        </div>
      </header>

      {habits.length === 0 ? (
        <p className="habitMonthEmpty">{t.habitMonthEmpty}</p>
      ) : status === "error" ? (
        <p className="habitMonthEmpty habitMonthError">
          {t.habitMonthError}{" "}
          <button type="button" className="habitMonthRetry" onClick={loadMonth}>
            {t.habitMonthRetry}
          </button>
        </p>
      ) : (
        <>
          <div
            className={`habitMonthScroller ${status === "loading" ? "isLoading" : ""}`}
            aria-busy={status === "loading"}
          >
            <div className="habitMonthGrid" role="table" aria-label={`${t.habitMonthTitle} · ${monthLabel}`} style={gridStyle}>
              <div className="habitMonthRow habitMonthDaysRow" role="row">
                <span className="habitMonthName" role="columnheader" />
                {days.map((day) => (
                  <span
                    key={day.iso}
                    role="columnheader"
                    className={`habitMonthDayNumber ${day.isWeekend ? "isWeekend" : ""} ${
                      day.iso === todayIso ? "isToday" : ""
                    }`}
                  >
                    {day.number}
                  </span>
                ))}
                <span className="habitMonthRate" role="columnheader">%</span>
              </div>

              {rows.map((row) => (
                <div className="habitMonthRow" role="row" key={row.habit.id}>
                  <span className="habitMonthName" role="rowheader" title={row.habit.titulo}>
                    {row.habit.titulo}
                  </span>
                  {row.cells.map((cell) => (
                    <span
                      key={cell.iso}
                      role="cell"
                      className={`habitMonthCell is-${cell.state} ${cell.iso === todayIso ? "isToday" : ""}`}
                      title={`${row.habit.titulo} · ${cell.iso}`}
                      aria-label={`${cell.iso}: ${
                        cell.state === "done"
                          ? t.habitMonthLegendDone
                          : cell.state === "missed"
                            ? t.habitMonthLegendMissed
                            : "—"
                      }`}
                    />
                  ))}
                  <span className="habitMonthRate num" role="cell">
                    {row.rate === null ? "—" : `${row.rate}%`}
                  </span>
                </div>
              ))}

              <div className="habitMonthRow habitMonthTotalRow" role="row">
                <span className="habitMonthName" role="rowheader">{t.habitMonthAll}</span>
                {dailyShare.map((day) => (
                  <span
                    key={day.iso}
                    role="cell"
                    className={`habitMonthCell isShare ${day.ratio === null ? "is-empty" : ""} ${
                      day.iso === todayIso ? "isToday" : ""
                    }`}
                    style={day.ratio === null ? undefined : { "--share": day.ratio }}
                    title={day.ratio === null ? day.iso : `${day.iso} · ${day.done}/${day.total}`}
                    aria-label={day.ratio === null ? day.iso : `${day.iso}: ${day.done}/${day.total}`}
                  />
                ))}
                <span className="habitMonthRate num" role="cell">
                  {overallRate === null ? "—" : `${overallRate}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="habitMonthLegend" aria-hidden="true">
            <span><i className="habitMonthSwatch is-done" /> {t.habitMonthLegendDone}</span>
            <span><i className="habitMonthSwatch is-missed" /> {t.habitMonthLegendMissed}</span>
            <span>
              <i className="habitMonthSwatch isShare" style={{ "--share": 0.35 }} />
              <i className="habitMonthSwatch isShare" style={{ "--share": 1 }} /> {t.habitMonthLegendShare}
            </span>
          </div>
        </>
      )}
    </article>
  );
};

export default HabitMonthView;
