'use strict';

importScripts('../utils/allowed-urls.js');

/**
 * Service worker — runs only logic that is gated by `isRecruitmentAllowedUrl`,
 * matching manifest `content_scripts` / `host_permissions`.
 */

// ──────────────────────────────────────────────
// Install / Update
// ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        const url = chrome.runtime.getURL('options/options.html');
        chrome.tabs.create({ url });
      }
    });
  }
});

// ──────────────────────────────────────────────
// Page visit tracking (allowed recruitment URLs only)
// ──────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  if (!isRecruitmentAllowedUrl(tab.url)) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  const data = await chrome.storage.local.get(['visitedPages']);
  const pages = data.visitedPages || [];
  const entry = { url: tab.url, title: tab.title || tab.url, visitedAt: Date.now() };
  const idx = pages.findIndex((p) => p.url === tab.url);
  if (idx >= 0) {
    pages[idx] = entry;
  } else {
    pages.unshift(entry);
  }
  await chrome.storage.local.set({ visitedPages: pages.slice(0, 100) });

  chrome.action.setBadgeText({ tabId, text: '✓' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#22c55e' });
});

// ──────────────────────────────────────────────
// Message handlers
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const safeRespond = (payload) => {
    try {
      sendResponse(payload);
    } catch (_) {}
  };

  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    safeRespond({ ok: true });
    return false;
  }

  if (msg.type === 'GET_CURRENT_TAB') {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.url && !isRecruitmentAllowedUrl(tab.url)) {
          safeRespond({ tab, recruitmentAllowed: false });
          return;
        }
        safeRespond({ tab, recruitmentAllowed: true });
      })
      .catch(() => safeRespond({ tab: undefined, recruitmentAllowed: false }));
    return true;
  }

  if (sender.tab?.url && !isRecruitmentAllowedUrl(sender.tab.url)) {
    safeRespond({ ok: false, reason: 'url-not-allowed' });
    return false;
  }

  return false;
});
