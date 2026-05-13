'use strict';

/**
 * Service Worker
 * - Tracks visited pages (job-hunting mypage sites)
 * - Handles extension icon badge
 * - Opens options page on first install
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
// Page visit tracking
// Job-hunting site detection heuristics
// ──────────────────────────────────────────────

const JOB_SITE_PATTERNS = [
  /axol\.jp/,
  /i-web\.co\.jp/,
  /career\.hunet\.co\.jp/,
  /job\.rikunabi\.com/,
  /job\.mynavi\.jp/,
  /offerbox\.jp/,
  /en\.wantedly\.com/,
  /shukatsu\./,
  /mypage\./,
  /entry\./,
  /recruit\./,
  /career\./,
  /jinji\./,
  /saiyou\./,
  /senkou\./,
];

function isJobSite(url) {
  try {
    const u = new URL(url);
    return JOB_SITE_PATTERNS.some((re) => re.test(u.hostname + u.pathname));
  } catch {
    return false;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  if (isJobSite(tab.url)) {
    // Save to visited pages
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

    // Show badge
    chrome.action.setBadgeText({ tabId, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#22c55e' });
  } else {
    // Clear badge on non-job sites
    chrome.action.setBadgeText({ tabId, text: '' });
  }
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
      .then(([tab]) => safeRespond({ tab }))
      .catch(() => safeRespond({ tab: undefined }));
    return true;
  }

  return false;
});
