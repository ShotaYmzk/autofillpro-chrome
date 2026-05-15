'use strict';

let profiles = [];
let activeProfileId = null;
let settings = {};
let currentTab = null;

async function init() {
  const verEl = document.querySelector('.footer__version');
  if (verEl) {
    verEl.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  const data = await StorageUtil.getProfiles();
  profiles = data.profiles;
  activeProfileId = data.activeProfileId;
  settings = await StorageUtil.getSettings();

  renderProfiles();
  renderVisited();
  updateStatus();
  bindEvents();
}

// ───────────────────────────────────────────
// Profiles
// ───────────────────────────────────────────
function renderProfiles() {
  const sel = document.getElementById('profileSelect');
  sel.innerHTML = profiles.map((p) =>
    `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${escapeHtml(p.name || 'プロフィール')}</option>`
  ).join('');
}

function getSelectedProfile() {
  const id = document.getElementById('profileSelect').value;
  return profiles.find((p) => p.id === id) || profiles[0];
}

// ───────────────────────────────────────────
// Status
// ───────────────────────────────────────────
function updateStatus() {
  const bar = document.getElementById('statusBar');
  const text = document.getElementById('statusText');

  if (!currentTab?.url || currentTab.url.startsWith('chrome://')) {
    bar.className = 'status-bar status-bar--warn';
    text.textContent = 'このページでは使用できません';
    document.getElementById('fillBtn').disabled = true;
    document.getElementById('previewBtn').disabled = true;
    return;
  }

  if (typeof isRecruitmentAllowedUrl === 'function' && !isRecruitmentAllowedUrl(currentTab.url)) {
    bar.className = 'status-bar status-bar--warn';
    text.textContent = 'この拡張は登録済みの就活サイト上でのみ利用できます';
    document.getElementById('fillBtn').disabled = true;
    document.getElementById('previewBtn').disabled = true;
    return;
  }

  bar.className = 'status-bar status-bar--ready';
  text.textContent = 'フォームを検出しました — 入力できます';
}

// ───────────────────────────────────────────
// Visited pages
// ───────────────────────────────────────────
async function renderVisited() {
  const pages = await StorageUtil.getVisitedPages();
  const list = document.getElementById('visitedList');

  if (!pages.length) {
    list.innerHTML = '<div class="empty-state">閲覧した企業のマイページがここに表示されます</div>';
    return;
  }

  list.innerHTML = pages.slice(0, 10).map((p) => {
    const domain = (() => { try { return new URL(p.url).hostname; } catch { return ''; } })();
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    const date = formatDate(p.visitedAt);
    return `
      <a class="visited-item" href="${escapeHtml(p.url)}" target="_blank" rel="noopener" title="${escapeHtml(p.title || p.url)}">
        <img class="visited-item__favicon" src="${favicon}" alt="" />
        <div class="visited-item__title">${escapeHtml(p.title || domain)}</div>
        <div class="visited-item__date">${date}</div>
      </a>`;
  }).join('');
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '今';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '時間前';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ───────────────────────────────────────────
// Fill / Preview
// ───────────────────────────────────────────
function showFillResult(response) {
  if (!response?.success) {
    showResult('入力できませんでした', true);
    return;
  }
  if (response.previewPending) {
    const n = response.previewCount;
    showResult(
      typeof n === 'number'
        ? `プレビュー（${n} 件）を表示しました。画面上で確定すると入力されます`
        : 'プレビューを表示しました。画面上で確定すると入力されます'
    );
    return;
  }
  showResult(`${response.filled ?? 0} 件のフィールドに入力しました`);
}

async function doFill() {
  const { profiles: latestProfiles } = await StorageUtil.getProfiles();
  settings = await StorageUtil.getSettings();
  const id = document.getElementById('profileSelect').value;
  const profile = latestProfiles.find((p) => p.id === id) || latestProfiles[0];
  if (!profile) return;

  const btn = document.getElementById('fillBtn');
  btn.disabled = true;
  btn.textContent = '入力中...';

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      type: 'AUTOFILL_FILL',
      profile,
      settings,
    });

    showFillResult(response);
  } catch (err) {
    // Content script not injected yet — inject and retry
    try {
      await injectContentScripts();
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'AUTOFILL_FILL',
        profile,
        settings,
      });
      showFillResult(response);
    } catch (_) {
      showResult('このページでは入力できません', true);
    }
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 自動入力する`;
}

async function doPreview() {
  const { profiles: latestProfiles } = await StorageUtil.getProfiles();
  settings = await StorageUtil.getSettings();
  const id = document.getElementById('profileSelect').value;
  const profile = latestProfiles.find((p) => p.id === id) || latestProfiles[0];
  if (!profile) return;

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      type: 'AUTOFILL_PREVIEW',
      profile,
    });
    if (response?.success) {
      showResult(`${response.count} 件のフィールドが入力対象です`);
    }
  } catch (_) {
    try {
      await injectContentScripts();
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'AUTOFILL_PREVIEW',
        profile,
      });
      if (response?.success) {
        showResult(`${response.count} 件のフィールドが入力対象です`);
      }
    } catch (__) {
      showResult('このページでは使用できません', true);
    }
  }
}

async function injectContentScripts() {
  if (typeof isRecruitmentAllowedUrl === 'function' && !isRecruitmentAllowedUrl(currentTab.url)) {
    throw new Error('url-not-allowed');
  }
  // Keep in sync with manifest.json content_scripts js[] order
  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    files: [
      'utils/allowed-urls.js',
      'utils/storage.js',
      'utils/furigana.js',
      'utils/postal.js',
      'utils/vacation-contact.js',
      'content/field-matcher.js',
      'content/overlay.js',
      'content/site-adapters/generic.js',
      'content/site-adapters/axol.js',
      'content/site-adapters/iweb.js',
      'content/site-adapters/school-search-flow.js',
      'content/site-adapters/entry-sheet.js',
      'content/autofill.js',
      'content/float-button.js',
    ],
  });
}

function showResult(msg, isError = false) {
  const banner = document.getElementById('resultBanner');
  const text = document.getElementById('resultText');
  text.textContent = msg;
  banner.style.display = 'flex';
  banner.style.background = isError ? '#fee2e2' : '';
  banner.style.color = isError ? '#991b1b' : '';
  banner.style.borderBottomColor = isError ? '#fca5a5' : '';

  setTimeout(() => { banner.style.display = 'none'; }, 4000);
}

// ───────────────────────────────────────────
// Events
// ───────────────────────────────────────────
function bindEvents() {
  document.getElementById('fillBtn').addEventListener('click', doFill);
  document.getElementById('previewBtn').addEventListener('click', doPreview);

  document.getElementById('profileSelect').addEventListener('change', (e) => {
    activeProfileId = e.target.value;
    StorageUtil.setActiveProfile(activeProfileId);
  });

  document.getElementById('editProfileBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('openOptionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    await StorageUtil.set({ visitedPages: [] });
    renderVisited();
  });

  // Visited item clicks should close popup
  document.getElementById('visitedList').addEventListener('click', (e) => {
    const link = e.target.closest('.visited-item');
    if (link) window.close();
  });
}

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', init);
