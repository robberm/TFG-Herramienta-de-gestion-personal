import React, { useCallback, useEffect, useState } from "react";
import "../../css/AiSettings.css";
import CustomSelectDropdown from "../../components/shared/CustomSelectDropdown";
import { useLanguage } from "../../context/languageContext";
import { getApiErrorMessage } from "../../api/apiClient";
import {
  AI_PROVIDERS,
  clearAiMemories,
  clearAiSettings,
  deleteAiMemory,
  fetchAiMemories,
  fetchCliStatus,
  fetchLearningTopics,
  getAiSettings,
  isAiSupported,
  openCliLogin,
  saveAiSettings,
  saveLearningTopics,
  testAiConnection,
} from "../../api/aiApi";

const MAX_TOPIC_LENGTH = 60;

/** Mensaje de error de la API más el detalle del proveedor (p. ej. "model not found"). */
const describeError = (error) => {
  const providerDetail = error?.details?.provider;
  return providerDetail
    ? `${getApiErrorMessage(error)} (${providerDetail})`
    : getApiErrorMessage(error);
};

const StatusMessage = ({ status }) =>
  status ? (
    <p className={`accountMessage ${status.error ? "error" : "success"}`}>{status.text}</p>
  ) : null;

/**
 * Estado del CLI (Claude Code / Codex) en este PC: instalado, sesión iniciada y botón
 * para abrir el login en una terminal. Tras iniciar sesión el usuario pulsa "Comprobar".
 */
const CliStatusPanel = ({ provider, t }) => {
  const [status, setStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");
  const [loginOpened, setLoginOpened] = useState(false);

  const check = useCallback(async () => {
    setIsChecking(true);
    setError("");
    try {
      setStatus(await fetchCliStatus(provider.id));
    } catch (checkError) {
      setStatus(null);
      setError(getApiErrorMessage(checkError));
    } finally {
      setIsChecking(false);
    }
  }, [provider.id]);

  useEffect(() => {
    check();
  }, [check]);

  const handleLogin = async () => {
    setError("");
    try {
      await openCliLogin(provider.id);
      setLoginOpened(true);
    } catch (loginError) {
      setError(loginError?.message || String(loginError));
    }
  };

  let stateClass = "pending";
  let stateText = t.aiCliChecking;
  if (!isChecking && status) {
    if (!status.installed) {
      stateClass = "error";
      stateText = t.aiCliNotInstalled;
    } else if (!status.loggedIn) {
      stateClass = "warning";
      stateText = t.aiCliLoggedOut;
    } else {
      stateClass = "ok";
      stateText = t.aiCliReady;
    }
  } else if (!isChecking && error) {
    stateClass = "error";
    stateText = t.aiCliCheckFailed;
  }

  return (
    <div className="aiCliPanel" aria-live="polite">
      <p className={`aiCliState ${stateClass}`}>
        <span className="aiCliDot" aria-hidden="true" />
        {stateText}
      </p>

      {status && !status.installed && (
        <p className="settingsHint">
          {t.aiCliInstallHint} <code>{provider.installCommand}</code>
        </p>
      )}
      {status?.installed && !status.loggedIn && (
        <p className="settingsHint">
          {t.aiCliLoginHint} <code>{status.loginCommand}</code>
        </p>
      )}
      {loginOpened && !status?.loggedIn && <p className="settingsHint">{t.aiCliLoginOpened}</p>}
      {status?.loggedIn && status.detail && <p className="settingsHint">{status.detail}</p>}
      {error && <p className="accountMessage error">{error}</p>}

      <div className="aiSettingsActions">
        {status?.installed && !status.loggedIn && (
          <button type="button" className="settingsButton primary" onClick={handleLogin}>
            {t.aiCliLogin}
          </button>
        )}
        <button type="button" className="settingsButton secondary" onClick={check} disabled={isChecking}>
          {t.aiCliRecheck}
        </button>
      </div>
      <p className="settingsHint">{t.aiCliUsageNote}</p>
    </div>
  );
};

/**
 * Ajustes del asistente: proveedor y clave (solo en este PC), temas de la pregunta
 * diaria y la memoria del asistente (en la cuenta).
 */
const AiSettingsCard = () => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [provider, setProvider] = useState(AI_PROVIDERS[0].id);
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [providerStatus, setProviderStatus] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const [topics, setTopics] = useState([]);
  const [topicDraft, setTopicDraft] = useState("");
  const [topicsStatus, setTopicsStatus] = useState(null);

  const [memories, setMemories] = useState([]);
  const [memoriesStatus, setMemoriesStatus] = useState(null);

  useEffect(() => {
    if (!isAiSupported()) return;

    getAiSettings().then((stored) => {
      setSettings(stored);
      if (stored?.provider) setProvider(stored.provider);
      setModel(stored?.model || "");
    });
    fetchLearningTopics()
      .then((stored) => setTopics(Array.isArray(stored) ? stored : []))
      .catch((error) => setTopicsStatus({ error: true, text: getApiErrorMessage(error) }));
    fetchAiMemories()
      .then((stored) => setMemories(Array.isArray(stored) ? stored : []))
      .catch((error) => setMemoriesStatus({ error: true, text: getApiErrorMessage(error) }));
  }, []);

  if (!isAiSupported()) {
    return (
      <section className="settingsCard">
        <div className="settingsCardHeader">
          <h2>{t.aiSection}</h2>
          <p>{t.aiDesktopOnly}</p>
        </div>
      </section>
    );
  }

  const providerInfo = AI_PROVIDERS.find((item) => item.id === provider) || AI_PROVIDERS[0];
  const isCli = Boolean(providerInfo.cli);
  const keyIsSavedForProvider = settings?.hasKey && settings?.provider === provider;
  // Los proveedores de CLI no llevan clave: basta con elegirlos y guardar.
  const canSave = isCli || Boolean(apiKey.trim()) || keyIsSavedForProvider;

  const runProviderAction = async (action) => {
    setIsBusy(true);
    setProviderStatus(null);
    try {
      await action();
    } catch (error) {
      setProviderStatus({ error: true, text: describeError(error) });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = () =>
    runProviderAction(async () => {
      const saved = await saveAiSettings({ provider, model, apiKey });
      setSettings(saved);
      setApiKey("");
      setProviderStatus({ error: false, text: t.aiSaved });
    });

  const handleTest = () =>
    runProviderAction(async () => {
      // Se prueba lo que hay guardado: si hay cambios sin guardar, se guardan antes.
      if (apiKey.trim() || provider !== settings?.provider || model !== (settings?.model || "")) {
        setSettings(await saveAiSettings({ provider, model, apiKey }));
        setApiKey("");
      }
      if (isCli) setProviderStatus({ error: false, text: t.aiCliTesting });
      await testAiConnection();
      setProviderStatus({ error: false, text: t.aiTestOk });
    });

  const handleRemove = () =>
    runProviderAction(async () => {
      setSettings(await clearAiSettings());
      setModel("");
      setApiKey("");
    });

  const addTopic = () => {
    const topic = topicDraft.trim().replace(/\s+/g, " ");
    if (!topic) return;
    if (!topics.some((existing) => existing.toLowerCase() === topic.toLowerCase())) {
      setTopics([...topics, topic]);
    }
    setTopicDraft("");
  };

  const handleSaveTopics = async () => {
    setTopicsStatus(null);
    try {
      setTopics(await saveLearningTopics(topics));
      setTopicsStatus({ error: false, text: t.aiTopicsSaved });
    } catch (error) {
      setTopicsStatus({ error: true, text: getApiErrorMessage(error) });
    }
  };

  const handleDeleteMemory = async (id) => {
    try {
      await deleteAiMemory(id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
    } catch (error) {
      setMemoriesStatus({ error: true, text: getApiErrorMessage(error) });
    }
  };

  const handleClearMemories = async () => {
    try {
      await clearAiMemories();
      setMemories([]);
    } catch (error) {
      setMemoriesStatus({ error: true, text: getApiErrorMessage(error) });
    }
  };

  return (
    <section className="settingsCard aiSettingsCard">
      <div className="settingsCardHeader">
        <h2>{t.aiSection}</h2>
        <p>{t.aiSectionHint}</p>
      </div>

      <div className="settingsRow">
        <div>
          <span className="settingsLabel">{t.aiProvider}</span>
        </div>
        <div className="settingsSelectWrap">
          <CustomSelectDropdown
            value={provider}
            onChange={setProvider}
            options={AI_PROVIDERS.map((item) => ({ value: item.id, label: item.label }))}
          />
        </div>
      </div>

      <div className="settingsFieldGroup">
        <label className="settingsFieldLabel" htmlFor="aiModel">
          {t.aiModel}
        </label>
        <input
          id="aiModel"
          type="text"
          className="settingsInput"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={providerInfo.defaultModel || t.aiCliDefaultModel}
        />
        <p className="settingsHint">
          {isCli ? (
            t.aiCliModelHint
          ) : (
            <>
              {t.aiModelHint} <code>{providerInfo.defaultModel}</code>
            </>
          )}
        </p>
      </div>

      {isCli && <CliStatusPanel key={provider} provider={providerInfo} t={t} />}

      {!isCli && (
      <div className="settingsFieldGroup">
        <label className="settingsFieldLabel" htmlFor="aiApiKey">
          {t.aiApiKey}
        </label>
        <input
          id="aiApiKey"
          type="password"
          autoComplete="off"
          className="settingsInput"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyIsSavedForProvider ? "••••••••••••" : ""}
        />
        {keyIsSavedForProvider && <p className="settingsHint">{t.aiApiKeySaved}</p>}
        {settings && !settings.encryptionAvailable && (
          <p className="settingsHint">{t.aiEncryptionUnavailable}</p>
        )}
      </div>
      )}

      <div className="aiSettingsActions">
        <button
          type="button"
          className="settingsButton primary"
          onClick={handleSave}
          disabled={isBusy || !canSave}
        >
          {t.aiSave}
        </button>
        <button
          type="button"
          className="settingsButton secondary"
          onClick={handleTest}
          disabled={isBusy || !canSave}
        >
          {t.aiTest}
        </button>
        {(settings?.configured ?? settings?.hasKey) && (
          <button type="button" className="settingsButton danger" onClick={handleRemove} disabled={isBusy}>
            {settings?.hasKey ? t.aiRemove : t.aiDisconnect}
          </button>
        )}
      </div>
      <StatusMessage status={providerStatus} />

      <div className="aiSettingsSubsection">
        <h3>{t.aiTopics}</h3>
        <p className="settingsHint">{t.aiTopicsHint}</p>
        <div className="aiTopicChips">
          {topics.map((topic) => (
            <span key={topic} className="aiTopicChip">
              {topic}
              <button
                type="button"
                aria-label={`${t.aiMemoryDelete}: ${topic}`}
                onClick={() => setTopics(topics.filter((item) => item !== topic))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          className="settingsInput"
          value={topicDraft}
          maxLength={MAX_TOPIC_LENGTH}
          onChange={(event) => setTopicDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTopic();
            }
          }}
          placeholder={t.aiTopicAdd}
        />
        <button
          type="button"
          className="settingsButton primary"
          onClick={handleSaveTopics}
          disabled={topics.length === 0}
        >
          {t.aiTopicsSave}
        </button>
        <StatusMessage status={topicsStatus} />
      </div>

      <div className="aiSettingsSubsection">
        <h3>{t.aiMemories}</h3>
        {memories.length === 0 ? (
          <p className="settingsHint">{t.aiMemoriesEmpty}</p>
        ) : (
          <ul className="aiMemoryList">
            {memories.map((memory) => (
              <li key={memory.id}>
                <span>{memory.content}</span>
                <button type="button" onClick={() => handleDeleteMemory(memory.id)}>
                  {t.aiMemoryDelete}
                </button>
              </li>
            ))}
          </ul>
        )}
        {memories.length > 0 && (
          <button type="button" className="settingsButton danger" onClick={handleClearMemories}>
            {t.aiMemoriesClear}
          </button>
        )}
        <StatusMessage status={memoriesStatus} />
      </div>
    </section>
  );
};

export default AiSettingsCard;
