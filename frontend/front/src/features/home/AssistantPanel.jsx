import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../css/AssistantPanel.css";
import { useLanguage } from "../../context/languageContext";
import { getApiErrorMessage } from "../../api/apiClient";
import {
  AI_SETTINGS_CHANGED_EVENT,
  clearChatHistory,
  fetchChatHistory,
  getAiSettings,
  isAiSupported,
  sendChatMessage,
} from "../../api/aiApi";

const MAX_MESSAGE_LENGTH = 4000;

/**
 * Chat con el asistente personal en el Home. Responde sobre los datos del usuario y
 * muestra bajo cada respuesta lo que ha decidido recordar.
 */
const AssistantPanel = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isConfigured, setIsConfigured] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (!isAiSupported()) return undefined;

    const loadSettings = () =>
      getAiSettings().then((settings) => setIsConfigured(Boolean(settings?.configured ?? settings?.hasKey)));
    loadSettings();
    fetchChatHistory()
      .then((history) => setMessages(Array.isArray(history) ? history : []))
      .catch((loadError) => setError(getApiErrorMessage(loadError)));

    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, loadSettings);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, loadSettings);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  if (!isAiSupported() || isConfigured === null) return null;

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    // El mensaje se muestra al momento; si falla se quita y se devuelve al input.
    const pending = { id: `pending-${Date.now()}`, role: "user", content: text };
    setMessages((current) => [...current, pending]);
    setDraft("");
    setError("");
    setIsSending(true);
    try {
      const reply = await sendChatMessage(text);
      setMessages((current) => [
        ...current,
        { ...reply.message, remembered: reply.remembered || [] },
      ]);
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== pending.id));
      setDraft(text);
      const detail = sendError?.details?.provider;
      setError(detail ? `${getApiErrorMessage(sendError)} (${detail})` : getApiErrorMessage(sendError, t.assistantError));
    } finally {
      setIsSending(false);
    }
  };

  const clear = async () => {
    try {
      await clearChatHistory();
      setMessages([]);
    } catch (clearError) {
      setError(getApiErrorMessage(clearError));
    }
  };

  return (
    <section className="assistantPanel">
      <header className="assistantHeader">
        <div>
          <h2>{t.assistantTitle}</h2>
          <span className="assistantSubtitle">{t.assistantSubtitle}</span>
        </div>
        {messages.length > 0 && (
          <button type="button" className="todoClearButton" onClick={clear}>
            {t.assistantClear}
          </button>
        )}
      </header>

      {!isConfigured ? (
        <div className="assistantNotice">
          <p>{t.assistantNotConfigured}</p>
          <button type="button" className="assistantSend" onClick={() => navigate("/settings")}>
            {t.assistantGoToSettings}
          </button>
        </div>
      ) : (
        <>
          <div className="assistantMessages" ref={listRef}>
            {messages.length === 0 && !isSending && <p className="assistantEmpty">{t.assistantEmpty}</p>}
            {messages.map((message) => (
              <div key={message.id} className={`assistantMessage ${message.role}`}>
                <p>{message.content}</p>
                {message.remembered?.length > 0 && (
                  <ul className="assistantRemembered">
                    {message.remembered.map((memory) => (
                      <li key={memory.id}>
                        <i className="fa fa-bookmark" aria-hidden="true"></i> {t.assistantRemembered}:{" "}
                        {memory.content}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {isSending && <div className="assistantMessage assistant thinking">{t.assistantThinking}</div>}
          </div>

          {error && <p className="assistantError">{error}</p>}

          <form className="assistantComposer" onSubmit={send}>
            <input
              type="text"
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t.assistantPlaceholder}
              disabled={isSending}
            />
            <button type="submit" className="assistantSend" disabled={!draft.trim() || isSending}>
              {t.assistantSend}
            </button>
          </form>
        </>
      )}
    </section>
  );
};

export default AssistantPanel;
