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
  ensureContentScriptsForFloatButton();
}

/** 未登録サイトでも、ポップアップを開いた時点でスクリプトを載せて浮動ボタンを出す */
async function ensureContentScriptsForFloatButton() {
  if (!currentTab?.id) return;
  if (typeof canInjectOnDemand === 'function' && !canInjectOnDemand(currentTab.url, settings)) {
    return;
  }
  if (settings.autoInjectOnPopupOpen === false) return;

  try {
    const ping = await chrome.tabs.sendMessage(currentTab.id, { type: 'PING' });
    if (ping?.ready) return;
  } catch (_) {}

  try {
    await injectContentScripts();
    try {
      await chrome.tabs.sendMessage(currentTab.id, { type: 'AFP_SYNC_FLOAT' });
    } catch (_) {}
  } catch (_) {
    /* activeTab 未取得・注入拒否時は Fill クリック時に再試行 */
  }
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
  const fillBtn = document.getElementById('fillBtn');
  const previewBtn = document.getElementById('previewBtn');

  if (
    !currentTab?.url ||
    (typeof isHttpPageUrl === 'function' && !isHttpPageUrl(currentTab.url))
  ) {
    bar.className = 'status-bar status-bar--warn';
    text.textContent = 'このページでは使用できません';
    fillBtn.disabled = true;
    previewBtn.disabled = true;
    return;
  }

  const canInject =
    typeof canInjectOnDemand === 'function' && canInjectOnDemand(currentTab.url, settings);
  if (!canInject) {
    bar.className = 'status-bar status-bar--warn';
    text.textContent = '設定により、このページでは注入できません';
    fillBtn.disabled = true;
    previewBtn.disabled = true;
    return;
  }

  const onAllowlist =
    typeof isRecruitmentAllowedUrl === 'function' && isRecruitmentAllowedUrl(currentTab.url);

  bar.className = 'status-bar status-bar--ready';
  if (onAllowlist) {
    text.textContent = 'フォームを検出しました — 入力できます';
  } else {
    text.textContent = 'このページで自動入力を試せます（未登録サイト・動作保証なし）';
  }
  fillBtn.disabled = false;
  previewBtn.disabled = false;
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
function isOnAllowlist() {
  return (
    typeof isRecruitmentAllowedUrl === 'function' &&
    currentTab?.url &&
    isRecruitmentAllowedUrl(currentTab.url)
  );
}

function buildAutofillMessage(profile) {
  return {
    type: 'AUTOFILL_FILL',
    profile,
    settings,
    relaxedMatching: !isOnAllowlist(),
  };
}

function buildPreviewMessage(profile) {
  return {
    type: 'AUTOFILL_PREVIEW',
    profile,
    settings,
    relaxedMatching: !isOnAllowlist(),
  };
}

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
  const n = response.filled ?? 0;
  if (n === 0) {
    showResult(
      '0 件でした。プロフィールの氏名・メール等を確認するか、詳細設定で項目を埋めてください',
      true
    );
    return;
  }
  const mode =
    !isOnAllowlist() && response.adapterName === 'generic'
      ? '（汎用マッチ）'
      : '';
  showResult(`${n} 件のフィールドに入力しました${mode}`);
}

async function tryInjectWithPermission() {
  try {
    await injectContentScripts();
    return true;
  } catch (_) {
    try {
      const granted = await chrome.permissions.request({
        origins: ['https://*/*', 'http://*/*'],
      });
      if (granted) {
        await injectContentScripts();
        return true;
      }
    } catch (__) {}
    return false;
  }
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

  const msg = buildAutofillMessage(profile);

  try {
    let response = await chrome.tabs.sendMessage(currentTab.id, msg);
    showFillResult(response);
  } catch (err) {
    const ok = await tryInjectWithPermission();
    if (!ok) {
      showResult(
        'スクリプトを載せられませんでした。拡張アイコンをもう一度押すか、設定の「広域サイト権限」を試してください',
        true
      );
    } else {
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, msg);
        showFillResult(response);
      } catch (__) {
        showResult('このページでは入力できません', true);
      }
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

  const msg = buildPreviewMessage(profile);

  try {
    const response = await chrome.tabs.sendMessage(currentTab.id, msg);
    if (response?.success) {
      showResult(`${response.count} 件のフィールドが入力対象です`);
    }
  } catch (_) {
    const ok = await tryInjectWithPermission();
    if (!ok) {
      showResult('このページでは使用できません', true);
      return;
    }
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, msg);
      if (response?.success) {
        showResult(`${response.count} 件のフィールドが入力対象です`);
      }
    } catch (__) {
      showResult('このページでは使用できません', true);
    }
  }
}

async function injectContentScripts() {
  settings = await StorageUtil.getSettings();
  if (typeof canInjectOnDemand === 'function' && !canInjectOnDemand(currentTab.url, settings)) {
    throw new Error('url-not-allowed');
  }
  const files =
    typeof AFP_CONTENT_SCRIPT_FILES !== 'undefined'
      ? AFP_CONTENT_SCRIPT_FILES
      : [
          'utils/allowed-urls.js',
          'utils/storage.js',
          'utils/furigana.js',
          'utils/postal.js',
          'utils/vacation-contact.js',
          'utils/nav-controls.js',
          'content/field-matcher.js',
          'content/overlay.js',
          'content/page-health.js',
          'content/site-adapters/generic.js',
          'content/site-adapters/axol.js',
          'content/site-adapters/e2r-earth.js',
          'content/site-adapters/iweb.js',
          'content/site-adapters/snar.js',
          'content/site-adapters/school-search-flow.js',
          'content/site-adapters/entry-sheet.js',
          'content/autofill.js',
          'content/float-button.js',
        ];
  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    files,
  });
  try {
    await chrome.tabs.sendMessage(currentTab.id, { type: 'AFP_SYNC_FLOAT' });
  } catch (_) {}
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
