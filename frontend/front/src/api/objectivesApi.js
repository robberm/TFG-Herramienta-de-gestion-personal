import { apiRequest } from "./apiClient";

/* Goals */
export const getGoals = (targetUserId = null) =>
  apiRequest(
    targetUserId ? `/goals?targetUserId=${encodeURIComponent(targetUserId)}` : "/goals",
  );

export const getGoalById = (goalId) => apiRequest(`/goals/${goalId}`);

export const createGoal = (payload) =>
  apiRequest("/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateGoal = (goalId, payload) =>
  apiRequest(`/goals/${goalId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updateGoalProgress = (goalId, payload) =>
  apiRequest(`/goals/${goalId}/progress`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteGoal = (goalId) =>
  apiRequest(`/goals/${goalId}`, {
    method: "DELETE",
  });

/* Habits */
export const getHabits = () => apiRequest("/habits");

export const getActiveHabits = () => apiRequest("/habits/active");

export const getHabitById = (habitId) => apiRequest(`/habits/${habitId}`);

export const createHabit = (payload) =>
  apiRequest("/habits", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateHabit = (habitId, payload) =>
  apiRequest(`/habits/${habitId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const markHabitCompletion = (habitId, payload) =>
  apiRequest(`/habits/${habitId}/completion`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteHabit = (habitId) =>
  apiRequest(`/habits/${habitId}`, {
    method: "DELETE",
  });

/* Logs */
export const getObjectiveLogsByRange = (startDate, endDate) =>
  apiRequest(`/objective-logs/range?startDate=${startDate}&endDate=${endDate}`);

export const getObjectiveLogsByObjectiveId = (objectiveId) =>
  apiRequest(`/objective-logs/objective/${objectiveId}`);
