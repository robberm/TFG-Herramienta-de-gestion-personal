const POLICY_URL = "http://localhost:8080/api/browser-blocking-policy";
const SOCKJS_WEBSOCKET_URL = "ws://localhost:8080/ws/websocket";
const RULE_ID_START = 10_000;
const REFRESH_ALARM = "refresh-focus-policy";
const REFRESH_PERIOD_MINUTES = 0.5;
const BLOCKED_PAGE_URL = chrome.runtime.getURL("blocked.html");
let focusSocket = null;
let activeDomains = null;

function isDomain(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
}

// El service worker MV3 se duerme y pierde la memoria; los dominios se recuperan del storage.
async function getActiveDomains() {
  if (activeDomains === null) {
    const stored = await chrome.storage.local.get("activeDomains");
    activeDomains = Array.isArray(stored.activeDomains) ? stored.activeDomains : [];
  }
  return activeDomains;
}

function isBlockedUrl(url, domains) {
  let hostname;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    hostname = parsed.hostname.toLowerCase();
  } catch (_) {
    return false;
  }
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Segunda capa además de declarativeNetRequest: las navegaciones servidas por un
 * service worker (x.com es una PWA), los cambios de ruta SPA y las pestañas que
 * ya estaban abiertas al activar Focus no siempre pasan por las reglas de red.
 */
async function enforceTab(tabId, url) {
  if (!url || url.startsWith(BLOCKED_PAGE_URL)) return;
  if (!isBlockedUrl(url, await getActiveDomains())) return;
  try {
    await chrome.tabs.update(tabId, { url: BLOCKED_PAGE_URL });
  } catch (_) {
    // La pestaña puede haberse cerrado entre la navegación y la redirección.
  }
}

async function enforceOpenTabs() {
  if (!activeDomains?.length) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => enforceTab(tab.id, tab.url)));
}

function onTopFrameNavigation(details) {
  if (details.frameId === 0) enforceTab(details.tabId, details.url);
}

function makeRules(domains) {
  return domains.map((domain, index) => ({
    id: RULE_ID_START + index,
    priority: 1,
    action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame", "sub_frame"]
    }
  }));
}

async function applyPolicy(policy) {
  const domains = policy?.focusModeEnabled && Array.isArray(policy?.blockedDomains)
    ? [...new Set(policy.blockedDomains.map((value) => String(value).toLowerCase()).filter(isDomain))]
    : [];

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRules.filter((rule) => rule.id >= RULE_ID_START).map((rule) => rule.id),
    addRules: makeRules(domains)
  });
  activeDomains = domains;
  await chrome.storage.local.set({ activeDomains: domains, lastPolicyUpdate: Date.now() });
  await enforceOpenTabs();
  await chrome.action.setBadgeText({ text: domains.length ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#b42318" });
  await chrome.action.setTitle({
    title: domains.length
      ? chrome.i18n.getMessage(
          domains.length === 1 ? "activeTitleOne" : "activeTitleMany",
          String(domains.length),
        )
      : chrome.i18n.getMessage("extensionName"),
  });
}

async function refreshPolicy() {
  try {
    const response = await fetch(POLICY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await applyPolicy(await response.json());
  } catch (error) {
    // Keep the last successful rules if GMO restarts during an active Focus session.
    await chrome.storage.local.set({ lastPolicyError: String(error?.message || error) });
    console.warn("Unable to refresh the GMO Focus policy", error);
  }
}

function sendSockJsFrame(socket, frame) {
  socket.send(JSON.stringify([frame]));
}

function connectFocusSocket() {
  if (focusSocket && (focusSocket.readyState === WebSocket.OPEN || focusSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const socket = new WebSocket(SOCKJS_WEBSOCKET_URL);
  focusSocket = socket;

  socket.onmessage = (event) => {
    if (event.data === "o") {
      sendSockJsFrame(socket, "CONNECT\naccept-version:1.2\nheart-beat:10000,10000\n\n\u0000");
      return;
    }

    if (!event.data.startsWith("a")) return;
    let frames;
    try {
      frames = JSON.parse(event.data.slice(1));
    } catch (_) {
      return;
    }

    for (const frame of frames) {
      if (frame.startsWith("CONNECTED")) {
        sendSockJsFrame(socket, "SUBSCRIBE\nid:focus-policy\ndestination:/topic/focus-state\n\n\u0000");
      }
      if (frame.startsWith("MESSAGE")) {
        refreshPolicy();
      }
    }
  };

  socket.onclose = () => {
    if (focusSocket === socket) focusSocket = null;
    setTimeout(connectFocusSocket, 5000);
  };

  socket.onerror = () => socket.close();
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_PERIOD_MINUTES });
  await refreshPolicy();
  connectFocusSocket();
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_PERIOD_MINUTES });
  await refreshPolicy();
  connectFocusSocket();
});
chrome.webNavigation.onCommitted.addListener(onTopFrameNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(onTopFrameNavigation);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshPolicy();
});
