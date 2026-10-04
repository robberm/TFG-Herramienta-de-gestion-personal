import { apiRequest } from "./apiClient";

const TODOS_URL = "/todos";

export const fetchTodos = () => apiRequest(TODOS_URL, { method: "GET", includeJson: false });

export const createTodo = (title) =>
  apiRequest(TODOS_URL, { method: "POST", body: JSON.stringify({ title }) });

export const updateTodo = (id, changes) =>
  apiRequest(`${TODOS_URL}/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteTodo = (id) =>
  apiRequest(`${TODOS_URL}/${id}`, { method: "DELETE", includeJson: false });

export const deleteCompletedTodos = () =>
  apiRequest(`${TODOS_URL}/completed`, { method: "DELETE", includeJson: false });
