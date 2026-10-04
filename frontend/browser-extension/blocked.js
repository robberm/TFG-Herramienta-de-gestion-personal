document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = chrome.i18n.getMessage("blockedTitle");
document.getElementById("title").textContent = chrome.i18n.getMessage("blockedTitle");
document.getElementById("message").textContent = chrome.i18n.getMessage("blockedMessage");
