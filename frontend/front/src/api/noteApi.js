import { apiRequest } from "./apiClient";

const NOTES_URL = "/notes";

export const fetchNotes = () => apiRequest(NOTES_URL, { method: "GET", includeJson: false });

export const createNote = (note) =>
  apiRequest(NOTES_URL, { method: "POST", body: JSON.stringify(note) });

export const updateNote = (id, note) =>
  apiRequest(`${NOTES_URL}/${id}`, { method: "PUT", body: JSON.stringify(note) });

export const deleteNote = (id) =>
  apiRequest(`${NOTES_URL}/${id}`, { method: "DELETE", includeJson: false });
