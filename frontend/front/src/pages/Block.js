import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import "../css/Block.css";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import {
  addBlockedApp as addBlockedAppApi,
  getBlockedApps as getBlockedAppsApi,
  getFocusState,
  getInstalledApps,
  removeBlockedApp as removeBlockedAppApi,
  resetBlockedApps,
  updateFocusSettings,
} from "../api/blockApi";
import { getApiErrorMessage } from "../api/apiClient";
import { useError } from "../components/ErrorContext";
import { useLanguage } from "../context/languageContext";

const SearchIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);
const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
  </svg>
);
const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);
const PlusIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ChevronUpIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CategoryIcons = {
  other: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
};
const MIN_WORK_BREAK_GAP_SECONDS = 5;

const DurationSelector = ({ valueSeconds, onChange, label }) => {
  const totalSeconds = Math.max(1, Number(valueSeconds || 1));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const updateValue = (nextHours, nextMinutes, nextSeconds) => {
    const normalizedHours = Math.max(0, Math.min(5, Number(nextHours || 0)));
    const normalizedMinutes = Math.max(
      0,
      Math.min(59, Number(nextMinutes || 0)),
    );
    const normalizedSeconds = Math.max(
      0,
      Math.min(59, Number(nextSeconds || 0)),
    );
    onChange(
      Math.max(
        1,
        normalizedHours * 3600 + normalizedMinutes * 60 + normalizedSeconds,
      ),
    );
  };

  const increment = (type) => {
    if (type === "h") updateValue(hours + 1, minutes, seconds);
    if (type === "m") updateValue(hours, minutes + 1, seconds);
    if (type === "s") updateValue(hours, minutes, seconds + 1);
  };

  const decrement = (type) => {
    if (type === "h") updateValue(hours - 1, minutes, seconds);
    if (type === "m") updateValue(hours, minutes - 1, seconds);
    if (type === "s") updateValue(hours, minutes, seconds - 1);
  };

  return (
    <div className="duration-picker">
      <span className="duration-picker-label">{label}</span>
      <div className="duration-picker-controls">
        <div className="duration-picker-column">
          <button
            type="button"
            className="picker-arrow"
            onClick={() => increment("h")}
            aria-label={`${label} increase hours`}
          >
            <ChevronUpIcon />
          </button>
          <input
            type="number"
            className="picker-input"
            min={0}
            max={5}
            value={hours.toString().padStart(2, "0")}
            onChange={(e) =>
              updateValue(e.target.value.replace(/^0+/, "") || 0, minutes, seconds)
            }
            onBlur={(e) =>
              updateValue(Number(e.target.value || 0), minutes, seconds)
            }
            aria-label={`${label} hours`}
          />
          <button
            type="button"
            className="picker-arrow"
            onClick={() => decrement("h")}
            aria-label={`${label} decrease hours`}
          >
            <ChevronDownIcon />
          </button>
        </div>
        <span className="picker-separator">:</span>
        <div className="duration-picker-column">
          <button
            type="button"
            className="picker-arrow"
            onClick={() => increment("m")}
            aria-label={`${label} increase minutes`}
          >
            <ChevronUpIcon />
          </button>
          <input
            type="number"
            className="picker-input"
            min={0}
            max={59}
            value={minutes.toString().padStart(2, "0")}
            onChange={(e) =>
              updateValue(hours, e.target.value.replace(/^0+/, "") || 0, seconds)
            }
            onBlur={(e) =>
              updateValue(hours, Number(e.target.value || 0), seconds)
            }
            aria-label={`${label} minutes`}
          />
          <button
            type="button"
            className="picker-arrow"
            onClick={() => decrement("m")}
            aria-label={`${label} decrease minutes`}
          >
            <ChevronDownIcon />
          </button>
        </div>
        <span className="picker-separator">:</span>
        <div className="duration-picker-column">
          <button
            type="button"
            className="picker-arrow"
            onClick={() => increment("s")}
            aria-label={`${label} increase seconds`}
          >
            <ChevronUpIcon />
          </button>
          <input
            type="number"
            className="picker-input"
            min={0}
            max={59}
            value={seconds.toString().padStart(2, "0")}
            onChange={(e) =>
              updateValue(hours, minutes, e.target.value.replace(/^0+/, "") || 0)
            }
            onBlur={(e) =>
              updateValue(hours, minutes, Number(e.target.value || 0))
            }
            aria-label={`${label} seconds`}
          />
          <button
            type="button"
            className="picker-arrow"
            onClick={() => decrement("s")}
            aria-label={`${label} decrease seconds`}
          >
            <ChevronDownIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

function Block() {
  const { t } = useLanguage();
  const { setErrorMessage } = useError();
  const [blockedApps, setBlockedApps] = useState([]);
  const [installedApps, setInstalledApps] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [activeTab, setActiveTab] = useState("add");
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [workDurationSeconds, setWorkDurationSeconds] = useState(20 * 60);
  const [breakDurationSeconds, setBreakDurationSeconds] = useState(20);
  const [focusAction, setFocusAction] = useState("NOTIFICATION");
  const [focusModeLockedByTag, setFocusModeLockedByTag] = useState(false);
  const [timeUntilNextBlock, setTimeUntilNextBlock] = useState(20 * 60);
  const [isBreakPhase, setIsBreakPhase] = useState(false);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const isValidExecutableName = useCallback(
    (value) => /^[a-z0-9_.-]+\.exe$/i.test((value || "").trim()),
    [],
  );

  const normalizeDurations = useCallback((workSeconds, breakSeconds) => {
    let nextWorkSeconds = Math.max(1, Math.round(Number(workSeconds || 1)));
    let nextBreakSeconds = Math.max(1, Math.round(Number(breakSeconds || 1)));

    if (nextWorkSeconds - nextBreakSeconds < MIN_WORK_BREAK_GAP_SECONDS) {
      nextBreakSeconds = Math.max(
        1,
        nextWorkSeconds - MIN_WORK_BREAK_GAP_SECONDS,
      );
      if (nextWorkSeconds - nextBreakSeconds < MIN_WORK_BREAK_GAP_SECONDS) {
        nextWorkSeconds = nextBreakSeconds + MIN_WORK_BREAK_GAP_SECONDS;
      }
    }

    return {
      workDurationSeconds: nextWorkSeconds,
      breakDurationSeconds: nextBreakSeconds,
    };
  }, []);

  const applyFocusState = useCallback((state) => {
    setFocusModeEnabled(!!state.focusModeEnabled);
    setWorkDurationSeconds(
      Math.max(1, Number(state.workDurationSeconds || 1200)),
    );
    setBreakDurationSeconds(
      Math.max(1, Number(state.breakDurationSeconds || 20)),
    );
    setFocusAction(state.focusAction || "NOTIFICATION");
    setFocusModeLockedByTag(!!state.focusModeLockedByTag);
    const phase = state.currentPhase || "OFF";
    setIsBreakPhase(phase === "BREAK");
    const phaseEndsAtEpochMs = state.phaseEndsAtEpochMs || 0;
    const remaining = Math.max(
      0,
      Math.floor(
        (phaseEndsAtEpochMs - (state.serverTimeEpochMs || Date.now())) / 1000,
      ),
    );
    setTimeUntilNextBlock(remaining);
  }, []);

  const normalizedBlockedApps = useMemo(
    () => blockedApps.map((app) => app.toLowerCase()),
    [blockedApps],
  );

  const filteredApplications = installedApps
    .filter((app) => isValidExecutableName(app.executableName))
    .filter((app) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        (app.displayName || "").toLowerCase().includes(query) ||
        (app.executableName || "").toLowerCase().includes(query)
      );
    });

  const manualExecutableCandidate = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !isValidExecutableName(query)) {
      return null;
    }
    if (normalizedBlockedApps.includes(query)) {
      return null;
    }
    const alreadyInInstalled = installedApps.some(
      (app) => (app.executableName || "").toLowerCase() === query,
    );
    if (alreadyInInstalled) {
      return null;
    }
    return query;
  }, [
    installedApps,
    isValidExecutableName,
    normalizedBlockedApps,
    searchQuery,
  ]);

  const fetchInstalledApps = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const apps = await getInstalledApps();
      setInstalledApps(Array.isArray(apps) ? apps : []);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "No se pudo cargar la lista de aplicaciones instaladas",
        ),
      );
    } finally {
      setIsLoadingApps(false);
    }
  }, [setErrorMessage]);

  const fetchBlockedApps = useCallback(async () => {
    try {
      const apps = await getBlockedAppsApi();
      setBlockedApps(Array.isArray(apps) ? apps : []);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "No se pudo cargar la lista de aplicaciones bloqueadas",
        ),
      );
    }
  }, [setErrorMessage]);

  const fetchFocusState = useCallback(
    async (showError = true) => {
      try {
        const state = await getFocusState();
        applyFocusState(state);
      } catch (error) {
        if (showError) {
          setErrorMessage(
            getApiErrorMessage(error, "No se pudo obtener el estado de foco"),
          );
        }
      }
    },
    [applyFocusState, setErrorMessage],
  );

  useEffect(() => {
    fetchBlockedApps();
    fetchInstalledApps();
    fetchFocusState(true);

    const refreshInterval = setInterval(() => fetchFocusState(false), 20000);
    return () => clearInterval(refreshInterval);
  }, [fetchBlockedApps, fetchFocusState, fetchInstalledApps]);

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: () => {},
      onConnect: () => {
        stompClient.subscribe("/topic/focus-state", (message) => {
          try {
            const state = JSON.parse(message.body);
            applyFocusState(state);
          } catch (error) {
            console.error("No se pudo parsear focus-state", error);
          }
        });
      },
    });

    stompClient.activate();

    return () => {
      stompClient.deactivate();
    };
  }, [applyFocusState]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilNextBlock((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveFocusSettings = async (next) => {
    const normalized = normalizeDurations(
      next.workDurationSeconds,
      next.breakDurationSeconds,
    );
    setWorkDurationSeconds(normalized.workDurationSeconds);
    setBreakDurationSeconds(normalized.breakDurationSeconds);

    try {
      await updateFocusSettings({
        focusModeEnabled: next.focusModeEnabled,
        workDurationSeconds: normalized.workDurationSeconds,
        breakDurationSeconds: normalized.breakDurationSeconds,
        focusAction: next.focusAction,
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "No se pudieron guardar los ajustes de foco"),
      );
    }
  };

  const resolveExecutableForBlocking = useCallback(
    (application) => {
      if (typeof application === "string") {
        return application.trim().toLowerCase();
      }

      const resolvedName = (application?.executableName || "")
        .trim()
        .toLowerCase();
      if (isValidExecutableName(resolvedName)) {
        return resolvedName;
      }

      return "";
    },
    [isValidExecutableName],
  );

  const addBlockedApp = async (application) => {
    const executableName = resolveExecutableForBlocking(application);
    if (!executableName) {
      setErrorMessage(
        "No se puede bloquear esta aplicación porque no tiene ejecutable válido",
      );
      return;
    }
    if (normalizedBlockedApps.includes(executableName.toLowerCase())) {
      setErrorMessage("Esta aplicación ya está en la lista de bloqueadas");
      return;
    }
    try {
      await addBlockedAppApi(executableName);
      setSearchQuery("");
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      await fetchBlockedApps();
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "No se pudo agregar la aplicación"),
      );
    }
  };

  const removeBlockedApp = async (appName) => {
    try {
      await removeBlockedAppApi(appName);
      await fetchBlockedApps();
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "No se pudo eliminar la aplicación"),
      );
    }
  };

  const resetAppList = async () => {
    try {
      await resetBlockedApps();
      await fetchBlockedApps();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t.blockResetError));
    }
  };

  const getBlockedAppInfo = (appName) =>
    installedApps.find(
      (app) =>
        (app.executableName || "").toLowerCase() === appName.toLowerCase(),
    ) || {
      executableName: appName,
      displayName: appName.replace(/\.exe$/i, ""),
      iconBase64: null,
    };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentPhaseDuration = isBreakPhase
    ? breakDurationSeconds
    : workDurationSeconds;
  const progressPercentage =
    currentPhaseDuration > 0
      ? ((currentPhaseDuration - timeUntilNextBlock) / currentPhaseDuration) *
        100
      : 0;

  const modeLabel = focusModeEnabled ? t.blockFocusMode : t.blockOff;

  return (
    <div className="block-container">
      <div className="block-main">
        <header className="block-header">
          <h1 className="block-title with-bubble">
            {t.blockTimeTracker}
            <span className="burbuja-content">{t.blockBubbleContent}</span>
          </h1>
        </header>

        <div className="timer-card">
          <div className="timer-progress-ring">
            <svg
              className={`timer-ring ${isBreakPhase ? "timer-ring-resting" : ""}`}
              viewBox="0 0 120 120"
            >
              <circle
                className="timer-ring-bg"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                strokeWidth="8"
              />
              <circle
                className="timer-ring-progress"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - progressPercentage / 100)}`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="timer-display">
              <span className="timer-value">
                {formatTime(timeUntilNextBlock)}
              </span>
              <span className="timer-label">
                {isBreakPhase ? t.blockRestingLower : t.blockNextBreakLower}
              </span>
            </div>
          </div>
          <div className="timer-status">
            {isBreakPhase ? (
              <span className="status-badge status-resting">
                {t.blockResting}
              </span>
            ) : (
              <button
                type="button"
                className={`status-badge status-working ${focusModeLockedByTag ? "locked" : ""}`}
                onClick={() => {
                  if (focusModeLockedByTag) return;
                  const enabled = !focusModeEnabled;
                  setFocusModeEnabled(enabled);
                  saveFocusSettings({
                    focusModeEnabled: enabled,
                    workDurationSeconds,
                    breakDurationSeconds,
                    focusAction,
                  });
                }}
                title={
                  focusModeLockedByTag
                    ? t.blockFocusLockedTitle
                    : t.blockToggleFocusTitle
                }
              >
                {modeLabel}
              </button>
            )}
          </div>
        </div>

        <div className="focus-controls">
          <div className="focus-controls-pickers">
            <DurationSelector
              label={t.blockWork}
              valueSeconds={workDurationSeconds}
              onChange={(nextWorkDurationSeconds) => {
                setWorkDurationSeconds(nextWorkDurationSeconds);
                saveFocusSettings({
                  focusModeEnabled,
                  workDurationSeconds: nextWorkDurationSeconds,
                  breakDurationSeconds,
                  focusAction,
                });
              }}
            />
            <DurationSelector
              label={t.blockBreak}
              valueSeconds={breakDurationSeconds}
              onChange={(nextBreakDurationSeconds) => {
                setBreakDurationSeconds(nextBreakDurationSeconds);
                saveFocusSettings({
                  focusModeEnabled,
                  workDurationSeconds,
                  breakDurationSeconds: nextBreakDurationSeconds,
                  focusAction,
                });
              }}
            />
          </div>
          <div className="focus-action-field">
            <label>{t.blockOnFinish}</label>
            <select
              value={focusAction}
              onChange={(e) => {
                setFocusAction(e.target.value);
                saveFocusSettings({
                  focusModeEnabled,
                  workDurationSeconds,
                  breakDurationSeconds,
                  focusAction: e.target.value,
                });
              }}
            >
              <option value="NOTIFICATION">{t.blockNotification}</option>
              <option value="SCREEN_BLOCK">{t.blockScreen}</option>
            </select>
          </div>
        </div>

        <div className="block-tabs">
          <button
            className={`tab-btn ${activeTab === "add" ? "active" : ""}`}
            onClick={() => setActiveTab("add")}
          >
            <PlusIcon />
            {t.commonAdd}
          </button>
          <button
            className={`tab-btn ${activeTab === "manage" ? "active" : ""}`}
            onClick={() => setActiveTab("manage")}
          >
            <TrashIcon />
            {t.blockManage} ({blockedApps.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "add" && (
            <div className="add-section">
              <div className="search-container" ref={dropdownRef}>
                <div className="search-input-wrapper">
                  <span className="search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedIndex(-1);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder={t.blockSearchApp}
                    className="search-input"
                  />
                  {searchQuery && (
                    <button
                      className="search-clear"
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="search-dropdown">
                    {isLoadingApps ? (
                      <div className="dropdown-loading">
                        <div className="loading-spinner"></div>
                        <span>{t.blockLoadingApps}</span>
                      </div>
                    ) : filteredApplications.length > 0 ||
                      manualExecutableCandidate ? (
                      <ul className="process-list">
                        {filteredApplications.map((application, index) => {
                          const isAlreadyBlocked =
                            normalizedBlockedApps.includes(
                              (application.executableName || "").toLowerCase(),
                            );
                          return (
                            <li
                              key={`${application.displayName}-${application.executableName || index}`}
                              className={`process-item ${index === selectedIndex ? "selected" : ""} ${isAlreadyBlocked ? "already-blocked" : ""}`}
                              onClick={() =>
                                !isAlreadyBlocked && addBlockedApp(application)
                              }
                              onMouseEnter={() => setSelectedIndex(index)}
                            >
                              <div className="process-icon">
                                {application.iconBase64 ? (
                                  <img src={application.iconBase64} alt="" />
                                ) : (
                                  <span className="category-icon">
                                    {CategoryIcons.other}
                                  </span>
                                )}
                              </div>
                              <div className="process-info">
                                <span className="process-name">
                                  {application.displayName}
                                </span>
                                <span className="process-exe">
                                  {resolveExecutableForBlocking(application)}
                                </span>
                              </div>
                              <span className="process-category cat-other">
                                {t.blockInstalled}
                              </span>
                            </li>
                          );
                        })}
                        {manualExecutableCandidate && (
                          <li
                            key={`manual-${manualExecutableCandidate}`}
                            className="process-item"
                            onClick={() =>
                              addBlockedApp(manualExecutableCandidate)
                            }
                          >
                            <div className="process-icon">
                              <span className="category-icon">
                                {CategoryIcons.other}
                              </span>
                            </div>
                            <div className="process-info">
                              <span className="process-name">
                                {t.blockAddManual}
                              </span>
                              <span className="process-exe">
                                {manualExecutableCandidate}
                              </span>
                            </div>
                            <span className="process-category cat-productivity">
                              {t.blockManual}
                            </span>
                          </li>
                        )}
                      </ul>
                    ) : searchQuery ? (
                      <div className="dropdown-empty">
                        <p>{t.blockNoAppsFound}</p>
                      </div>
                    ) : (
                      <div className="dropdown-hint">
                        <p>{t.blockTypeToSearch}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "manage" && (
            <div className="manage-section">
              {blockedApps.length > 0 ? (
                <>
                  <ul className="blocked-apps-list">
                    {blockedApps.map((app) => {
                      const info = getBlockedAppInfo(app);
                      return (
                        <li key={app} className="blocked-app-item">
                          <div className="blocked-app-icon">
                            {info.iconBase64 ? (
                              <img src={info.iconBase64} alt="" />
                            ) : (
                              <span className="category-icon">
                                {CategoryIcons.other}
                              </span>
                            )}
                          </div>
                          <div className="blocked-app-info">
                            <span className="blocked-app-name">
                              {info.displayName}
                            </span>
                            <span className="blocked-app-exe">{app}</span>
                          </div>
                          <button
                            className="remove-app-btn"
                            onClick={() => removeBlockedApp(app)}
                            title={t.blockRemoveFromList}
                          >
                            <TrashIcon />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button className="reset-list-btn" onClick={resetAppList}>
                    <RefreshIcon />
                    {t.blockResetList}
                  </button>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M12 2v20M2 12h20" />
                    </svg>
                  </div>
                  <p>{t.blockNoBlockedApps}</p>
                  <span>{t.blockAddFromTab}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Block;
