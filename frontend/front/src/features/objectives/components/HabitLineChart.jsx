import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildHabitCompletionMap } from "../utils/objectiveHelpers";

const LINE_COLORS = [
  "#f5576c",
  "#4facfe",
  "#43e97b",
  "#fa709a",
  "#667eea",
  "#fee140",
  "#38f9d7",
  "#764ba2",
];

/**
 * Traza una línea por hábito con los días completados acumulados en la semana.
 * Los días futuros quedan a null para que la línea se corte en el día actual.
 */
const HabitLineChart = ({ data, habits, logs, selectedDate, todayIso, onSelectDate }) => {
  const chartData = useMemo(() => {
    const completionMap = buildHabitCompletionMap(logs);
    const runningTotals = {};

    return data.map((day) => {
      const point = { isoDate: day.isoDate, label: day.label };
      const isFuture = day.isoDate > todayIso;

      habits.forEach((habit) => {
        if (completionMap[habit.id]?.[day.isoDate] === true) {
          runningTotals[habit.id] = (runningTotals[habit.id] || 0) + 1;
        }
        point[`habit-${habit.id}`] = isFuture ? null : runningTotals[habit.id] || 0;
      });

      return point;
    });
  }, [data, habits, logs, todayIso]);

  // Al pulsar un día de la gráfica lo seleccionamos igual que con las barras (salvo días futuros).
  const handleChartClick = (state) => {
    const index = state?.activeTooltipIndex ?? state?.activeIndex;
    const day = chartData[Number(index)];
    if (day && day.isoDate <= todayIso) onSelectDate(day.isoDate);
  };

  const selectedLabel = chartData.find((day) => day.isoDate === selectedDate)?.label;

  return (
    <div className="habitLineChart" aria-label="Weekly habit completion line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 12, bottom: 0, left: -24 }}
          onClick={handleChartClick}
        >
          <CartesianGrid className="habitLineGrid" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={({ x, y, payload }) => (
              <text
                x={x}
                y={y + 12}
                textAnchor="middle"
                className={`weeklyBarLabel ${payload.value === selectedLabel ? "habitLineSelectedTick" : ""}`}
              >
                {payload.value}
              </text>
            )}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, 7]}
            tickLine={false}
            axisLine={false}
            tick={{ className: "weeklyBarLabel" }}
          />
          <Tooltip
            cursor={{ className: "habitLineCursor" }}
            wrapperClassName="habitLineTooltip"
            labelFormatter={(label, payload) => payload?.[0]?.payload?.isoDate || label}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "0.75rem" }} />
          {habits.map((habit, index) => (
            <Line
              key={habit.id}
              type="monotone"
              dataKey={`habit-${habit.id}`}
              name={habit.titulo}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={400}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HabitLineChart;
