import React, { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, YAxis } from "recharts";

// Un solo tono para toda la gráfica (el acento); el CSS de .weeklyBarCell lo aplica por tema.
const BAR_FILL = "#1b6e66";

const HabitBarChart = ({
  data,
  totalHabits,
  selectedDate,
  todayIso,
  onSelectDate,
}) => {
  const chartData = useMemo(
    () =>
      data.map((day) => ({
        ...day,
        // Un cero se dibuja como cero: sin barra mínima falsa.
        chartValue: totalHabits > 0 ? (day.completed / totalHabits) * 100 : 0,
        isSelected: day.isoDate === selectedDate,
        isFuture: day.isoDate > todayIso,
      })),
    [data, selectedDate, todayIso, totalHabits],
  );

  return (
    <div className="habitBarChart" aria-label="Weekly habit completion chart">
      {chartData.map((day) => {
        return (
          <button
            key={day.isoDate}
            type="button"
            className={`weeklyBarItem ${day.isSelected ? "selectedWeeklyBarItem" : ""}`}
            onClick={() => onSelectDate(day.isoDate)}
            disabled={day.isFuture}
            aria-pressed={day.isSelected}
            title={day.isoDate}
          >
            <div className="habitBarMiniChart" aria-hidden="true">
              {/* Aqui monto la grafica de Recharts para cada dia y la hago responsive. */}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[day]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={40}>
                  {/* YAxis pertenece rechart, define la escala vertical de la grafica (0 - 100) */}
                  <YAxis hide domain={[0, 100]} />
                  <Bar
                    dataKey="chartValue"
                    radius={[8, 8, 8, 8]}
                    activeBar={false}
                    isAnimationActive
                    animationDuration={400}
                  >
                    {/* Color plano del acento; los días futuros se atenúan. */}
                    <Cell
                      className={`weeklyBarCell ${day.isoDate === todayIso ? "isToday" : ""}`}
                      fill={BAR_FILL}
                      opacity={day.isFuture ? 0.45 : 1}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <span className="weeklyBarValue">{day.completed}</span>
            <span className="weeklyBarLabel">{day.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default HabitBarChart;
