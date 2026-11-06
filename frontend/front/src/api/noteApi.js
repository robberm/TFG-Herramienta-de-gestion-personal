import { apiRequest } from "./apiClient";

const NOTES_URL = "/notes";

export const fetchNotes = () => apiRequest(NOTES_URL, { method: "GET", includeJson: false });

// `options` permite pasar keepalive: la petición sobrevive a que se cierre la ventana.
export const createNote = (note, options = {}) =>
  apiRequest(NOTES_URL, { ...options, method: "POST", body: JSON.stringify(note) });

export const updateNote = (id, note, options = {}) =>
  apiRequest(`${NOTES_URL}/${id}`, { ...options, method: "PUT", body: JSON.stringify(note) });

export const deleteNote = (id) =>
  apiRequest(`${NOTES_URL}/${id}`, { method: "DELETE", includeJson: false });
