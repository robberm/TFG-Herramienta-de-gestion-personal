import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../css/TodoList.css";
import { useError } from "../../components/ErrorContext";
import { useLanguage } from "../../context/languageContext";
import { getApiErrorMessage } from "../../api/apiClient";
import {
  createTodo,
  deleteCompletedTodos,
  deleteTodo,
  fetchTodos,
  updateTodo,
} from "../../api/todoApi";

const MAX_TITLE_LENGTH = 255;

/**
 * Fila de la lista. El título se edita en línea al hacer click (estilo Notion):
 * Enter o perder el foco guarda, Escape cancela.
 */
const TodoRow = ({ todo, onToggle, onRename, onDelete, t }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  useEffect(() => {
    if (!isEditing) setDraft(todo.title);
  }, [todo.title, isEditing]);

  const commit = () => {
    setIsEditing(false);
    const title = draft.trim();
    if (!title) {
      setDraft(todo.title);
      return;
    }
    if (title !== todo.title) onRename(todo, title);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setDraft(todo.title);
      setIsEditing(false);
    }
  };

  return (
    <li className={`todoItem ${todo.done ? "isDone" : ""}`}>
      <button
        type="button"
        className="todoCheckbox"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={todo.done ? t.todoMarkPending : t.todoMarkDone}
        onClick={() => onToggle(todo)}
      >
        {todo.done && <i className="fa fa-check" aria-hidden="true"></i>}
      </button>

      {isEditing ? (
        <input
          className="todoTitleInput"
          value={draft}
          maxLength={MAX_TITLE_LENGTH}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span
          className="todoTitle"
          role="button"
          tabIndex={0}
          title={t.todoEditHint}
          onClick={() => setIsEditing(true)}
          onKeyDown={(event) => event.key === "Enter" && setIsEditing(true)}
        >
          {todo.title}
        </span>
      )}

      <button
        type="button"
        className="todoDeleteButton"
        aria-label={t.todoDelete}
        title={t.todoDelete}
        onClick={() => onDelete(todo)}
      >
        ×
      </button>
    </li>
  );
};

const TodoList = () => {
  const { t } = useLanguage();
  const { setErrorMessage } = useError();
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const newInputRef = useRef(null);

  useEffect(() => {
    const loadTodos = async () => {
      try {
        const response = await fetchTodos();
        setTodos(Array.isArray(response) ? response : []);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, t.todoLoadError));
      } finally {
        setIsLoading(false);
      }
    };

    loadTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setErrorMessage]);

  // Pendientes arriba en su orden de creación; completadas debajo.
  const { pending, completed } = useMemo(() => ({
    pending: todos.filter((todo) => !todo.done),
    completed: todos.filter((todo) => todo.done),
  }), [todos]);

  const replaceTodo = (updated) =>
    setTodos((current) => current.map((todo) => (todo.id === updated.id ? updated : todo)));

  /**
   * Aplica el cambio en local al instante y lo revierte si el backend falla.
   */
  const patchOptimistically = async (todo, changes) => {
    replaceTodo({ ...todo, ...changes });
    try {
      replaceTodo(await updateTodo(todo.id, changes));
    } catch (error) {
      replaceTodo(todo);
      setErrorMessage(getApiErrorMessage(error, t.todoSaveError));
    }
  };

  const handleToggle = (todo) => patchOptimistically(todo, { done: !todo.done });

  const handleRename = (todo, title) => patchOptimistically(todo, { title });

  const handleDelete = async (todo) => {
    setTodos((current) => current.filter((item) => item.id !== todo.id));
    try {
      await deleteTodo(todo.id);
    } catch (error) {
      setTodos((current) => [...current, todo].sort((a, b) => a.position - b.position));
      setErrorMessage(getApiErrorMessage(error, t.todoSaveError));
    }
  };

  const handleClearCompleted = async () => {
    const previous = todos;
    setTodos((current) => current.filter((todo) => !todo.done));
    try {
      await deleteCompletedTodos();
    } catch (error) {
      setTodos(previous);
      setErrorMessage(getApiErrorMessage(error, t.todoSaveError));
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || isCreating) return;

    setIsCreating(true);
    try {
      const created = await createTodo(title);
      setTodos((current) => [...current, created]);
      setNewTitle("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t.todoSaveError));
    } finally {
      setIsCreating(false);
      newInputRef.current?.focus();
    }
  };

  const rowProps = {
    onToggle: handleToggle,
    onRename: handleRename,
    onDelete: handleDelete,
    t,
  };

  return (
    <section className="todoListSection">
      <header className="todoListHeader">
        <div>
          <h2>{t.todoTitle}</h2>
          {todos.length > 0 && (
            <span className="todoListCounter">
              {completed.length}/{todos.length} {t.todoCompletedSuffix}
            </span>
          )}
        </div>
        {completed.length > 0 && (
          <button type="button" className="todoClearButton" onClick={handleClearCompleted}>
            {t.todoClearCompleted}
          </button>
        )}
      </header>

      {todos.length > 0 && (
        <div className="todoProgressTrack" aria-hidden="true">
          <div
            className="todoProgressFill"
            style={{ width: `${(completed.length / todos.length) * 100}%` }}
          ></div>
        </div>
      )}

      {isLoading ? (
        <p className="todoEmptyState">{t.homeLoading}</p>
      ) : (
        <>
          {todos.length === 0 && <p className="todoEmptyState">{t.todoEmpty}</p>}

          <ul className="todoItems">
            {pending.map((todo) => (
              <TodoRow key={todo.id} todo={todo} {...rowProps} />
            ))}
            {completed.map((todo) => (
              <TodoRow key={todo.id} todo={todo} {...rowProps} />
            ))}
          </ul>

          <form className="todoNewItem" onSubmit={handleCreate}>
            <span className="todoNewIcon" aria-hidden="true">+</span>
            <input
              ref={newInputRef}
              className="todoNewInput"
              value={newTitle}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={t.todoAddPlaceholder}
              disabled={isCreating}
              onChange={(event) => setNewTitle(event.target.value)}
            />
          </form>
        </>
      )}
    </section>
  );
};

export default TodoList;
