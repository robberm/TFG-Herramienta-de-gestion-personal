import React, { useCallback, useEffect, useDeferredValue, useRef, useState } from "react";
import { createNote, deleteNote, fetchNotes, updateNote } from "../api/noteApi";
import { getApiErrorMessage } from "../api/apiClient";
import { useError } from "../components/ErrorContext";
import { useLanguage } from "../context/languageContext";
import "../css/Notes.css";

const COLORS = ["sand", "coral", "sky", "mint", "lilac"];
const EMPTY_NOTE = { id: null, title: "", content: "", color: "sand", pinned: false };
const AUTOSAVE_DELAY_MS = 1200;
const SAVED_CONFIRMATION_MS = 450;
const EDITOR_EXIT_MS = 180;

const noteSnapshot = ({ title, content, color, pinned }) =>
  JSON.stringify({ title, content, color, pinned });

const hasText = (note) => Boolean(note.title.trim() || note.content.trim());

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sortNotes = (notes) =>
  [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt),
  );

const NoteGlyph = ({ pinned }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {pinned ? (
      <path d="m9 3 6 1-1 5 3 3-5 1-2 7-2-7-4-2 4-3 1-5Z" />
    ) : (
      <path d="M6 3.5h9l3 3V20.5H6V3.5Zm9 0v4h3M9 11h6M9 15h6" />
    )}
  </svg>
);

const Notes = () => {
  const { t, language } = useLanguage();
  const { setErrorMessage } = useError();
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(EMPTY_NOTE);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  // idle | saving | saved | error
  const [saveStatus, setSaveStatus] = useState("idle");
  // null | saving | confirmed | exiting
  const [closePhase, setClosePhase] = useState(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const draftRef = useRef(EMPTY_NOTE);
  draftRef.current = draft;
  // Último contenido que el backend confirmó: evita peticiones si no ha cambiado nada.
  const savedSnapshotRef = useRef(noteSnapshot(EMPTY_NOTE));
  // Guardados en serie: una nota nueva no puede crearse dos veces con dos POST simultáneos.
  const saveQueueRef = useRef(Promise.resolve());
  const autosaveTimerRef = useRef(null);
  const closingRef = useRef(false);
  const editorSessionRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchNotes();
        setNotes(Array.isArray(data) ? data : []);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setErrorMessage]);

  const visibleNotes = notes.filter((note) =>
    `${note.title} ${note.content}`.toLowerCase().includes(deferredQuery),
  );

  const openNote = (note) => {
    const next = note ? { ...note } : { ...EMPTY_NOTE };
    editorSessionRef.current += 1;
    draftRef.current = next;
    savedSnapshotRef.current = noteSnapshot(next);
    setSaveStatus("idle");
    setSelected(note?.id ?? "new");
    setDraft(next);
  };

  // Una nota sin texto no se guarda: ni se crea vacía ni se borra lo que ya tenía.
  const isDirty = (note) =>
    hasText(note) && noteSnapshot(note) !== savedSnapshotRef.current;

  const persistDraft = useCallback((requestOptions) => {
    const run = async () => {
      const current = draftRef.current;
      if (!isDirty(current)) return;

      const session = editorSessionRef.current;
      setSaveStatus("saving");
      const saved = current.id
        ? await updateNote(current.id, current, requestOptions)
        : await createNote(current, requestOptions);

      setNotes((notesNow) =>
        sortNotes([saved, ...notesNow.filter((note) => note.id !== saved.id)]),
      );
      if (session !== editorSessionRef.current) return;

      savedSnapshotRef.current = noteSnapshot(current);
      // Solo el id: lo que se esté escribiendo ahora mismo no se toca.
      draftRef.current = { ...draftRef.current, id: saved.id };
      setDraft((latest) => ({ ...latest, id: saved.id, updatedAt: saved.updatedAt }));
      setSelected(saved.id);
      setSaveStatus("saved");
    };

    const result = saveQueueRef.current.then(run);
    saveQueueRef.current = result.catch(() => {});
    return result;
  }, []);

  const finishClosing = useCallback(async () => {
    setClosePhase("exiting");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    await wait(reducedMotion ? 0 : EDITOR_EXIT_MS);

    editorSessionRef.current += 1;
    draftRef.current = { ...EMPTY_NOTE };
    savedSnapshotRef.current = noteSnapshot(EMPTY_NOTE);
    closingRef.current = false;
    setClosePhase(null);
    setSaveStatus("idle");
    setSelected(null);
    setDraft({ ...EMPTY_NOTE });
  }, []);

  /**
   * Salir siempre guarda, también con Esc o al pulsar fuera. Si el guardado falla el editor
   * sigue abierto: cerrarlo perdería el texto.
   */
  const requestClose = useCallback(
    async ({ confirmSaved = false } = {}) => {
      if (closingRef.current) return;
      closingRef.current = true;
      clearTimeout(autosaveTimerRef.current);
      setClosePhase("saving");

      try {
        await persistDraft();
      } catch (_error) {
        closingRef.current = false;
        setClosePhase(null);
        setSaveStatus("error");
        return;
      }

      if (confirmSaved) {
        setClosePhase("confirmed");
        await wait(SAVED_CONFIRMATION_MS);
      }
      await finishClosing();
    },
    [finishClosing, persistDraft],
  );

  const closeWithoutSaving = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimeout(autosaveTimerRef.current);
    savedSnapshotRef.current = noteSnapshot(draftRef.current);
    finishClosing();
  };

  const removeDraft = async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    clearTimeout(autosaveTimerRef.current);
    setClosePhase("saving");

    // Un POST en curso puede estar a punto de darle su id a la nota.
    await saveQueueRef.current;
    const current = draftRef.current;

    try {
      if (current.id) {
        await deleteNote(current.id);
        setNotes((notesNow) => notesNow.filter((note) => note.id !== current.id));
      }
      savedSnapshotRef.current = noteSnapshot(current);
      await finishClosing();
    } catch (error) {
      closingRef.current = false;
      setClosePhase(null);
      setErrorMessage(getApiErrorMessage(error));
    }
  };

  useEffect(() => {
    if (selected === null || closingRef.current || !isDirty(draft)) return undefined;

    autosaveTimerRef.current = setTimeout(() => {
      persistDraft().catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(autosaveTimerRef.current);
  }, [draft, persistDraft, selected]);

  useEffect(() => {
    if (selected === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestClose, selected]);

  // Salidas sin pasar por el editor: cambio de ruta o cierre de la ventana.
  useEffect(() => {
    const flush = () => {
      clearTimeout(autosaveTimerRef.current);
      persistDraft({ keepalive: true }).catch(() => {});
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [persistDraft]);

  const isClosing = closePhase !== null;
  const isSaveConfirmed = closePhase === "confirmed" || closePhase === "exiting";
  const saveStatusLabel =
    isSaveConfirmed
      ? ""
      : saveStatus === "saving"
        ? t.commonSaving
        : saveStatus === "error"
          ? t.notesSaveFailed
          : saveStatus === "saved" && !isDirty(draft)
            ? t.notesSaved
            : "";

  const formatDate = (value) =>
    new Intl.DateTimeFormat(language === "es" ? "es-ES" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <main className="notesPage">
      <header className="notesHero">
        <div>
          <span className="notesEyebrow">{t.notesEyebrow}</span>
          <h1>{t.notesTitle}</h1>
          <p>{t.notesSubtitle}</p>
        </div>
        <button className="notesNewButton" onClick={() => openNote(null)}>
          <span>+</span>{t.notesNew}
        </button>
      </header>

      <div className="notesSearch">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.notesSearch} />
        <span>{visibleNotes.length}</span>
      </div>

      {loading ? (
        <div className="notesLoading"><i/><i/><i/></div>
      ) : visibleNotes.length ? (
        <section className="notesGrid">
          {visibleNotes.map((note, index) => (
            <button
              className={`noteCard note-${note.color}`}
              style={{ "--note-index": index }}
              key={note.id}
              onClick={() => openNote(note)}
            >
              <div className="noteCardTop">
                <span className="noteCardIcon"><NoteGlyph pinned={note.pinned} /></span>
                {note.pinned && <span className="notePinned">{t.notesPinned}</span>}
              </div>
              <h2>{note.title || t.notesUntitled}</h2>
              <p>{note.content || t.notesEmpty}</p>
              <time>{formatDate(note.updatedAt)}</time>
            </button>
          ))}
        </section>
      ) : (
        <section className="notesEmpty">
          <div className="notesEmptyStack"><i/><i/><i/></div>
          <h2>{query ? t.notesNoResults : t.notesEmptyTitle}</h2>
          <p>{query ? t.notesNoResultsHint : t.notesEmptyHint}</p>
          {!query && <button onClick={() => openNote(null)}>{t.notesFirst}</button>}
        </section>
      )}

      {selected !== null && (
        <div
          className={`noteEditorOverlay ${closePhase === "exiting" ? "is-closing" : ""}`}
          onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
        >
          <section className={`noteEditor note-${draft.color}`} aria-modal="true" role="dialog">
            <header>
              <button className="noteEditorClose" onClick={() => requestClose()} aria-label={t.notesClose} title={t.notesClose}>×</button>
              <div className="noteColorPicker">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={`noteColor note-${color} ${draft.color === color ? "active" : ""}`}
                    onClick={() => setDraft((current) => ({ ...current, color }))}
                    aria-label={color}
                  />
                ))}
              </div>
              <button
                className={`notePinButton ${draft.pinned ? "active" : ""}`}
                onClick={() => setDraft((current) => ({ ...current, pinned: !current.pinned }))}
              >
                <NoteGlyph pinned /> {draft.pinned ? t.notesUnpin : t.notesPin}
              </button>
            </header>
            <input
              className="noteEditorTitle"
              value={draft.title}
              maxLength={180}
              autoFocus
              readOnly={isClosing}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder={t.notesTitlePlaceholder}
            />
            <textarea
              value={draft.content}
              maxLength={50000}
              readOnly={isClosing}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              placeholder={t.notesBodyPlaceholder}
            />
            <footer>
              <button className="noteDeleteButton" onClick={removeDraft}>{t.commonDelete}</button>
              {saveStatus === "error" && (
                <button className="noteDiscardButton" onClick={closeWithoutSaving}>{t.notesCloseWithoutSaving}</button>
              )}
              <div className="noteEditorMeta">
                <span>{draft.content.length.toLocaleString()} {t.notesCharacters}</span>
                <span
                  className={`noteSaveStatus ${saveStatus === "error" ? "is-error" : ""}`}
                  role="status"
                >
                  {saveStatusLabel}
                </span>
              </div>
              <button
                className={`noteSaveButton ${isSaveConfirmed ? "is-saved" : ""}`}
                disabled={isClosing || !hasText(draft)}
                onClick={() => requestClose({ confirmSaved: true })}
              >
                {isSaveConfirmed ? (
                  <>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                    {t.notesSaved}
                  </>
                ) : closePhase === "saving" ? (
                  t.commonSaving
                ) : (
                  t.commonSave
                )}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
};

export default Notes;
