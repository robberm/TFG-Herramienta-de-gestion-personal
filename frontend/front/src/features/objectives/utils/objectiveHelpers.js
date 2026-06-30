export const GOAL_STATUS_LABELS = {
  NotStarted: "Sin empezar",
  InProgress: "En progreso",
  Done: "Completado",
};

export const GOAL_STATUS_COLORS = {
  NotStarted: "#6c757d",
  InProgress: "#f5a623",
  Done: "#43e97b",
};

export const PRIORITY_COLORS = {
  Alta: "#f5576c",
  Media: "#f5a623",
  Baja: "#43e97b",
};

export const PRIORITY_ORDER = {
  Alta: 0,
  Media: 1,
  Baja: 2,
};

export const GOAL_STATUS_PROGRESS = {
  NotStarted: 0,
  InProgress: 50,
  Done: 100,
};

export const GOAL_STATUS_ORDER = {
  InProgress: 0,
  NotStarted: 1,
  Done: 2,
};

export const EMPTY_GOAL_FORM = {
  titulo: "",
  description: "",
  priority: "Media",
  status: "NotStarted",
  isNumeric: false,
  valorProgreso: "",
  valorObjetivo: "",
  active: true,
};

export const EMPTY_HABIT_FORM = {
  titulo: "",
  description: "",
  active: true,
};

export const toInputNumberValue = (value) =>
  value === null || value === undefined ? "" : value;

export const isGoalNumeric = (goal) =>
  Boolean(goal?.isNumeric ?? goal?.numeric ?? false);

export const normalizeGoalForm = (form) => ({
  titulo: form.titulo.trim(),
  description: form.description.trim(),
  priority: form.priority,
  status: form.status,
  isNumeric: Boolean(form.isNumeric),
  valorProgreso:
    form.isNumeric && form.valorProgreso !== ""
      ? Number(form.valorProgreso)
      : null,
  valorObjetivo:
    form.isNumeric && form.valorObjetivo !== ""
      ? Number(form.valorObjetivo)
      : null,
  active: Boolean(form.active),
});

export const normalizeHabitForm = (form) => ({
  titulo: form.titulo.trim(),
  description: form.description.trim(),
  active: Boolean(form.active),
});

export const getPriorityColor = (priority) =>
  PRIORITY_COLORS[priority] || "#7c7c7c";

export const calculateGoalProgressPercent = (goal) => {
  if (!isGoalNumeric(goal)) return 0;
  if (!goal?.valorObjetivo || goal.valorObjetivo <= 0) return 0;

  const rawPercent =
    (Number(goal.valorProgreso || 0) * 100) / Number(goal.valorObjetivo);
  return Math.max(0, Math.min(100, rawPercent));
};

export const getGoalTrackingPercent = (goal) => {
  if (!goal) return 0;

  if (isGoalNumeric(goal)) {
    return Math.round(calculateGoalProgressPercent(goal));
  }

  return GOAL_STATUS_PROGRESS[goal.status] ?? 0;
};

export const calculateGlobalGoalsProgress = (goals) => {
  const trackedGoals = goals.filter((goal) => goal.active !== false);

  if (trackedGoals.length === 0) {
    return 0;
  }

  const totalProgress = trackedGoals.reduce(
    (acc, goal) => acc + getGoalTrackingPercent(goal),
    0,
  );

  return Math.round(totalProgress / trackedGoals.length);
};

export const sortGoalsByPriority = (goals) => {
  return [...goals].sort((leftGoal, rightGoal) => {
    const leftPriority = PRIORITY_ORDER[leftGoal.priority] ?? 99;
    const rightPriority = PRIORITY_ORDER[rightGoal.priority] ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftStatus = GOAL_STATUS_ORDER[leftGoal.status] ?? 99;
    const rightStatus = GOAL_STATUS_ORDER[rightGoal.status] ?? 99;

    if (leftStatus !== rightStatus) {
      return leftStatus - rightStatus;
    }

    const leftDate = leftGoal.audTim ? new Date(leftGoal.audTim) : 0;
    const rightDate = rightGoal.audTim ? new Date(rightGoal.audTim) : 0;

    return rightDate - leftDate;
  });
};

export const formatIsoDate = (date) => {
  const target = typeof date === "string" ? new Date(date) : date;
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getStartOfWeek = (date = new Date()) => {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  return current;
};

export const getEndOfWeek = (startOfWeek) => {
  const end = new Date(startOfWeek);
  end.setDate(end.getDate() + 6);
  end.setHours(0, 0, 0, 0);
  return end;
};

export const getWeekDays = (startOfWeek) => {
  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return labels.map((label, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);

    return {
      label,
      date,
      isoDate: formatIsoDate(date),
    };
  });
};

export const buildHabitCompletionMap = (logs) => {
  return logs.reduce((acc, log) => {
    if (log.completed === null || log.completed === undefined) {
      return acc;
    }

    const objectiveId = log.objective?.id;
    if (!objectiveId) {
      return acc;
    }

    if (!acc[objectiveId]) {
      acc[objectiveId] = {};
    }

    acc[objectiveId][log.logDate] = Boolean(log.completed);
    return acc;
  }, {});
};

export const buildWeeklyHabitStats = (habits, logs, startOfWeek) => {
  const weekDays = getWeekDays(startOfWeek);

  return weekDays.map((day) => {
    const completed = logs.filter(
      (log) => log.logDate === day.isoDate && log.completed === true,
    ).length;

    return {
      ...day,
      completed,
      total: habits.length,
    };
  });
};

export const buildGoalStatusDistribution = (goals) => {
  const counts = goals.reduce(
    (acc, goal) => {
      const status = goal.status || "NotStarted";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {
      NotStarted: 0,
      InProgress: 0,
      Done: 0,
    },
  );

  const total = goals.length || 1;
  const segments = [
    {
      key: "Done",
      label: GOAL_STATUS_LABELS.Done,
      value: counts.Done,
      percent: counts.Done / total,
      color: GOAL_STATUS_COLORS.Done,
    },
    {
      key: "InProgress",
      label: GOAL_STATUS_LABELS.InProgress,
      value: counts.InProgress,
      percent: counts.InProgress / total,
      color: GOAL_STATUS_COLORS.InProgress,
    },
    {
      key: "NotStarted",
      label: GOAL_STATUS_LABELS.NotStarted,
      value: counts.NotStarted,
      percent: counts.NotStarted / total,
      color: GOAL_STATUS_COLORS.NotStarted,
    },
  ];

  return segments;
};
