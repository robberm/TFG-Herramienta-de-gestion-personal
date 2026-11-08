import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "../../css/DailyQuestionGate.css";
import { useLanguage } from "../../context/languageContext";
import { getApiErrorMessage } from "../../api/apiClient";
import {
  AI_SETTINGS_CHANGED_EVENT,
  answerDailyQuestion,
  fetchDailyQuestion,
  isAiSupported,
} from "../../api/aiApi";

const isElectronEnvironment =
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

// Si la app se queda abierta de un día para otro, la pregunta nueva aparece sin reiniciar.
const DAY_CHANGE_CHECK_MS = 5 * 60 * 1000;
const MAX_ANSWER_LENGTH = 2000;

const todayKey = () => new Date().toDateString();

/**
 * Bloquea la app hasta contestar la pregunta del día. Solo bloquea cuando el backend
 * devuelve PENDING: sin IA configurada o con el proveedor caído la app sigue usable.
 * La barra de título queda fuera del bloqueo para poder minimizar o cerrar la ventana.
 */
const DailyQuestionGate = () => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const [question, setQuestion] = useState(null);
  const [result, setResult] = useState(null);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const checkedRef = useRef({ day: null, token: null });
  const textareaRef = useRef(null);

  const isEligibleRoute = location.pathname !== "/" && !location.pathname.startsWith("/admin");

  const check = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !isAiSupported() || localStorage.getItem("role") === "ADMIN") return;

    const day = todayKey();
    if (checkedRef.current.day === day && checkedRef.current.token === token) return;
    checkedRef.current = { day, token };

    try {
      const status = await fetchDailyQuestion();
      if (status?.state === "PENDING" && status.question) {
        setQuestion(status.question);
        setResult(null);
        setAnswer("");
        setError("");
      }
    } catch (fetchError) {
      // Backend arrancando o sesión caducada: se reintenta en la próxima navegación.
      checkedRef.current = { day: null, token: null };
      console.warn("[DailyQuestionGate] No se pudo consultar la pregunta diaria.", fetchError);
    }
  }, []);

  useEffect(() => {
    if (isEligibleRoute) check();
  }, [isEligibleRoute, location.pathname, language, check]);

  // Al configurar la IA en Ajustes se vuelve a consultar sin esperar a mañana.
  useEffect(() => {
    const recheck = () => {
      checkedRef.current = { day: null, token: null };
      if (isEligibleRoute) check();
    };
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, recheck);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, recheck);
  }, [isEligibleRoute, check]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isEligibleRoute) check();
    }, DAY_CHANGE_CHECK_MS);
    return () => clearInterval(interval);
  }, [isEligibleRoute, check]);

  useEffect(() => {
    if (question && !result) textareaRef.current?.focus();
  }, [question, result]);

  const submit = async (event) => {
    event.preventDefault();
    const text = answer.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      setResult(await answerDailyQuestion(question.id, text));
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = () => {
    setQuestion(null);
    setResult(null);
  };

  if (!question || !isEligibleRoute) return null;

  const formatDate = (isoDate) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString(language === "es" ? "es-ES" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div
      className={`dailyQuestionGate ${isElectronEnvironment ? "withTitleBar" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dailyQuestionTitle"
    >
      <div className="dailyQuestionCard">
        <header className="dailyQuestionHeader">
          <span className="dailyQuestionEyebrow">
            {question.review ? t.dailyQuestionReview : t.dailyQuestionTopic}
            {" · "}
            {question.topic}
          </span>
          <h2 id="dailyQuestionTitle">{t.dailyQuestionTitle}</h2>
          {!result && <p className="dailyQuestionSubtitle">{t.dailyQuestionSubtitle}</p>}
        </header>

        <p className="dailyQuestionText">{question.question}</p>

        {!result ? (
          <form onSubmit={submit} className="dailyQuestionForm">
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit(event);
              }}
              placeholder={t.dailyQuestionPlaceholder}
              maxLength={MAX_ANSWER_LENGTH}
              rows={4}
              disabled={isSubmitting}
            />
            {error && <p className="dailyQuestionError">{error}</p>}
            <button type="submit" className="dailyQuestionButton" disabled={!answer.trim() || isSubmitting}>
              {isSubmitting ? t.dailyQuestionGrading : t.dailyQuestionSubmit}
            </button>
          </form>
        ) : (
          <div className="dailyQuestionResult">
            {result.score !== null && result.score !== undefined ? (
              <div className={`dailyQuestionScore score${result.score}`}>
                <span>{t.dailyQuestionScore}</span>
                <strong>{result.score}/5</strong>
              </div>
            ) : (
              <p className="dailyQuestionNotice">{t.dailyQuestionUngraded}</p>
            )}

            {result.feedback && <p className="dailyQuestionFeedback">{result.feedback}</p>}

            <div className="dailyQuestionReference">
              <span>{t.dailyQuestionReference}</span>
              <p>{result.referenceAnswer}</p>
            </div>

            <p className="dailyQuestionSchedule">
              {result.nextReviewOn
                ? `${t.dailyQuestionNextReview} ${formatDate(result.nextReviewOn)}.`
                : t.dailyQuestionMastered}
            </p>

            <button type="button" className="dailyQuestionButton" onClick={close} autoFocus>
              {t.dailyQuestionContinue}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyQuestionGate;
