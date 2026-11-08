import React, { useEffect, useState } from "react";
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
  fetchLearningTopics,
  getAiSettings,
  isAiSupported,
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
  const keyIsSavedForProvider = settings?.hasKey && settings?.provider === provider;

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
          placeholder={providerInfo.defaultModel}
        />
        <p className="settingsHint">
          {t.aiModelHint} <code>{providerInfo.defaultModel}</code>
        </p>
      </div>

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

      <div className="aiSettingsActions">
        <button
          type="button"
          className="settingsButton primary"
          onClick={handleSave}
          disabled={isBusy || (!apiKey.trim() && !keyIsSavedForProvider)}
        >
          {t.aiSave}
        </button>
        <button
          type="button"
          className="settingsButton secondary"
          onClick={handleTest}
          disabled={isBusy || (!apiKey.trim() && !keyIsSavedForProvider)}
        >
          {t.aiTest}
        </button>
        {settings?.hasKey && (
          <button type="button" className="settingsButton danger" onClick={handleRemove} disabled={isBusy}>
            {t.aiRemove}
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
