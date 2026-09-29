import React, { useEffect, useDeferredValue, useState } from "react";
import { createNote, deleteNote, fetchNotes, updateNote } from "../api/noteApi";
import { getApiErrorMessage } from "../api/apiClient";
import { useError } from "../components/ErrorContext";
import { useLanguage } from "../context/languageContext";
import "../css/Notes.css";

const COLORS = ["sand", "coral", "sky", "mint", "lilac"];
const EMPTY_NOTE = { id: null, title: "", content: "", color: "sand", pinned: false };

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
  const [saving, setSaving] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

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
    setSelected(note?.id ?? "new");
    setDraft(note ? { ...note } : { ...EMPTY_NOTE });
  };

  const closeEditor = () => {
    setSelected(null);
    setDraft({ ...EMPTY_NOTE });
  };

  const saveDraft = async () => {
    if (!draft.title.trim() && !draft.content.trim()) return;
    setSaving(true);
    try {
      const saved = draft.id
        ? await updateNote(draft.id, draft)
        : await createNote(draft);
      setNotes((current) => {
        const withoutSaved = current.filter((note) => note.id !== saved.id);
        return [saved, ...withoutSaved].sort(
          (a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt),
        );
      });
      setSelected(saved.id);
      setDraft({ ...saved });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const removeDraft = async () => {
    if (!draft.id) {
      closeEditor();
      return;
    }
    try {
      await deleteNote(draft.id);
      setNotes((current) => current.filter((note) => note.id !== draft.id));
      closeEditor();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  };

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
        <div className="noteEditorOverlay" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}>
          <section className={`noteEditor note-${draft.color}`} aria-modal="true" role="dialog">
            <header>
              <button className="noteEditorClose" onClick={closeEditor} aria-label={t.commonCancel}>×</button>
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
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder={t.notesTitlePlaceholder}
            />
            <textarea
              value={draft.content}
              maxLength={50000}
              onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
              placeholder={t.notesBodyPlaceholder}
            />
            <footer>
              <button className="noteDeleteButton" onClick={removeDraft}>{t.commonDelete}</button>
              <span>{draft.content.length.toLocaleString()} {t.notesCharacters}</span>
              <button className="noteSaveButton" disabled={saving || (!draft.title.trim() && !draft.content.trim())} onClick={saveDraft}>
                {saving ? t.commonSaving : t.commonSave}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
};

export default Notes;
