import React, { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, YAxis } from "recharts";

const BAR_GRADIENTS = [
  ["#f093fb", "#f5576c"],
  ["#fa709a", "#fee140"],
  ["#43e97b", "#38f9d7"],
  ["#4facfe", "#00f2fe"],
  ["#667eea", "#764ba2"],
  ["#f093fb", "#f5576c"],
  ["#fa709a", "#fee140"],
];

const HabitBarChart = ({
  data,
  totalHabits,
  selectedDate,
  todayIso,
  onSelectDate,
}) => {
  const chartData = useMemo(
    () =>
      data.map((day, index) => ({
        ...day,
        gradientId: `habit-bar-gradient-${day.isoDate}`,
        gradient: BAR_GRADIENTS[index % BAR_GRADIENTS.length],
        chartValue:
          totalHabits > 0 ? Math.max((day.completed / totalHabits) * 100, 5) : 5,
        isSelected: day.isoDate === selectedDate,
        isFuture: day.isoDate > todayIso,
      })),
    [data, selectedDate, todayIso, totalHabits],
  );

  return (
    <div className="habitBarChart" aria-label="Weekly habit completion chart">
      {chartData.map((day) => {
        const [startColor, endColor] = day.gradient;

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
                  <defs>
                    <linearGradient id={day.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={startColor} />
                      <stop offset="100%" stopColor={endColor} />
                    </linearGradient>
                  </defs>
                  {/* YAxis pertenece rechart, define la escala vertical de la grafica (0 - 100) */}
                  <YAxis hide domain={[0, 100]} />
                  <Bar
                    dataKey="chartValue"
                    radius={[10, 10, 10, 10]}
                    background={{ className: "weeklyBarTrack", radius: 10 }}
                    activeBar={false}
                    isAnimationActive
                    animationDuration={400}
                  >
                    {/* Esta celda aplicamos estilo de degradado dinamico y baja opacidad if: dia > diaactual. */}
                    <Cell
                      className="weeklyBarCell"
                      fill={`url(#${day.gradientId})`}
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
