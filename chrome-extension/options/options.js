'use strict';

const PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
  '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
  '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
  '熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

let currentProfileId = null;
let profiles = [];
let settings = {};

/** フォームを閉じる／プロフィール切替で未保存が失われないよう検知 */
let formDirty = false;
let suppressDirty = false;

function markDirty() {
  if (suppressDirty) return;
  formDirty = true;
}

function clearDirty() {
  formDirty = false;
}

// ───────────────────────────────────────────
// Initialisation
// ───────────────────────────────────────────
async function init() {
  populateStaticSelects();
  await loadData();
  bindEvents();
}

function populateStaticSelects() {
  // 学科系統（Axol の gakkei_self と同一オプション）
  if (typeof GAKKEI_SELF_OPTIONS !== 'undefined') {
    const gSel = document.getElementById('departmentSystem');
    if (gSel) {
      gSel.innerHTML = GAKKEI_SELF_OPTIONS.map(
        ({ value, label }) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
      ).join('');
    }
  }

  // Prefectures
  document.querySelectorAll('select[id$="Pref"], select[id$="prefecture"], #prefecture, #homePrefecture').forEach((sel) => {
    sel.innerHTML = '<option value="">選択</option>' +
      PREFECTURES.map((p) => `<option value="${p}">${p}</option>`).join('');
  });
  // Year selects
  const currentYear = new Date().getFullYear();
  document.querySelectorAll('.year-select').forEach((sel) => {
    sel.innerHTML = '<option value="">年</option>';
    for (let y = currentYear + 3; y >= 1990; y--) {
      sel.innerHTML += `<option value="${y}">${y}年</option>`;
    }
  });
  // Month selects
  document.querySelectorAll('.month-select').forEach((sel) => {
    sel.innerHTML = '<option value="">月</option>';
    for (let m = 1; m <= 12; m++) {
      sel.innerHTML += `<option value="${m}">${m}月</option>`;
    }
  });
  // DOB year
  const dobYearSel = document.getElementById('dobYear');
  if (dobYearSel) {
    dobYearSel.innerHTML = '<option value="">年</option>';
    for (let y = currentYear - 15; y >= 1960; y--) {
      dobYearSel.innerHTML += `<option value="${y}">${y}年</option>`;
    }
  }
  // DOB month
  const dobMonthSel = document.getElementById('dobMonth');
  if (dobMonthSel) {
    dobMonthSel.innerHTML = '<option value="">月</option>';
    for (let m = 1; m <= 12; m++) {
      dobMonthSel.innerHTML += `<option value="${m}">${m}月</option>`;
    }
  }
  // DOB day
  const dobDaySel = document.getElementById('dobDay');
  if (dobDaySel) {
    dobDaySel.innerHTML = '<option value="">日</option>';
    for (let d = 1; d <= 31; d++) {
      dobDaySel.innerHTML += `<option value="${d}">${d}日</option>`;
    }
  }

  const hsEnrollY = document.getElementById('highSchoolEnrollYear');
  if (hsEnrollY) {
    hsEnrollY.innerHTML = '<option value="">年</option>';
    for (let y = currentYear + 1; y >= 1990; y--) {
      hsEnrollY.innerHTML += `<option value="${y}">${y}年</option>`;
    }
  }
  const hsGradY = document.getElementById('highSchoolGradYear');
  if (hsGradY) {
    hsGradY.innerHTML = '<option value="">年</option>';
    for (let y = currentYear + 3; y >= 1990; y--) {
      hsGradY.innerHTML += `<option value="${y}">${y}年</option>`;
    }
  }
  const hsEnrollM = document.getElementById('highSchoolEnrollMonth');
  if (hsEnrollM) {
    hsEnrollM.innerHTML = '<option value="">月</option>';
    for (let m = 1; m <= 12; m++) {
      hsEnrollM.innerHTML += `<option value="${m}">${m}月</option>`;
    }
  }
  const hsGradM = document.getElementById('highSchoolGradMonth');
  if (hsGradM) {
    hsGradM.innerHTML = '<option value="">月</option>';
    for (let m = 1; m <= 12; m++) {
      hsGradM.innerHTML += `<option value="${m}">${m}月</option>`;
    }
  }
}

/** 保存値がコード or ラベルのどちらでも departmentSystem に復元 */
function syncDepartmentSystemFromProfile(stored) {
  const sel = document.getElementById('departmentSystem');
  if (!sel) return;
  const s = stored == null ? '' : String(stored).trim();
  if (!s) {
    sel.value = '';
    return;
  }
  sel.value = s;
  if (sel.value === s) return;
  const opts = typeof GAKKEI_SELF_OPTIONS !== 'undefined' ? GAKKEI_SELF_OPTIONS : [];
  const byVal = opts.find((o) => o.value === s);
  if (byVal) {
    sel.value = byVal.value;
    return;
  }
  const byLabel = opts.find(
    (o) =>
      o.label === s ||
      (s.length >= 2 && (s.includes(o.label) || o.label.includes(s)))
  );
  if (byLabel) sel.value = byLabel.value;
}

async function loadData() {
  const data = await StorageUtil.getProfiles();
  profiles = data.profiles;
  currentProfileId = data.activeProfileId;
  if (!profiles.length) {
    profiles = [{ ...StorageUtil.DEFAULT_PROFILE }];
    currentProfileId = 'default';
  }

  settings = await StorageUtil.getSettings();

  renderProfileList();
  loadProfile(currentProfileId);
  loadSettings();
  clearDirty();
}

// ───────────────────────────────────────────
// Profile list rendering
// ───────────────────────────────────────────
function renderProfileList() {
  const list = document.getElementById('profileList');
  list.innerHTML = profiles.map((p) => `
    <div class="profile-item ${p.id === currentProfileId ? 'active' : ''}" data-id="${p.id}">
      <div class="profile-item__dot"></div>
      <div class="profile-item__name">${escapeHtml(p.name || 'プロフィール')}</div>
    </div>
  `).join('');

  list.querySelectorAll('.profile-item').forEach((el) => {
    el.addEventListener('click', () => switchProfile(el.dataset.id));
  });
}

function switchProfile(id) {
  if (formDirty && id !== currentProfileId) {
    const ok = confirm(
      '保存していない変更があります。ほかのプロフィールに切り替えると破棄されます。切り替えますか？'
    );
    if (!ok) return;
  }
  currentProfileId = id;
  renderProfileList();
  loadProfile(id);
  StorageUtil.setActiveProfile(id);
  clearDirty();
}

// ───────────────────────────────────────────
// Load / save profile into form
// ───────────────────────────────────────────
function loadProfile(id) {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) return;

  suppressDirty = true;
  try {
    const b = profile.basic || {};
    const c = profile.contact || {};
    const e = profile.education || {};

    setValue('profileName', profile.name);
    setValue('lastName', b.lastName);
    setValue('firstName', b.firstName);
    setValue('lastKana', b.lastKana);
    setValue('firstKana', b.firstKana);
    setValue('romajiLast', b.romajiLast);
    setValue('romajiFirst', b.romajiFirst);
    setValue('gender', b.gender);
    setValue('dobYear', b.dobYear);
    setValue('dobMonth', b.dobMonth);
    setValue('dobDay', b.dobDay);

    setValue('email', c.email);
    setValue('emailSub1', c.emailSub1);
    setValue('mobile1', c.mobile1);
    setValue('mobile2', c.mobile2);
    setValue('mobile3', c.mobile3);
    setValue('homePhone1', c.homePhone1);
    setValue('homePhone2', c.homePhone2);
    setValue('homePhone3', c.homePhone3);
    setValue('zip1', c.zip1);
    setValue('zip2', c.zip2);
    setValue('prefecture', c.prefecture);
    setValue('city', c.city);
    setValue('address', c.address);
    setValue('building', c.building);
    setValue('homeZip1', c.homeZip1);
    setValue('homeZip2', c.homeZip2);
    setValue('homePrefecture', c.homePrefecture);
    setValue('homeCity', c.homeCity);
    setValue('homeAddress', c.homeAddress);
    setValue('homeBuilding', c.homeBuilding);

    setChecked('vacationSameAsCurrent', !!c.vacationSameAsCurrent);

    setValue('schoolType', e.schoolType);
    setValue('schoolSetup', e.schoolSetup);
    setValue('degree', e.degree || '');
    setValue('gradSchoolName', e.gradSchoolName);
    setValue('gradSchoolKana', e.gradSchoolKana);
    setValue('gradSchoolPref', e.gradSchoolPref);
    setValue('gradFaculty', e.gradFaculty);
    setValue('gradDept', e.gradDept);
    setValue('gradSchoolEnrollYear', e.gradSchoolEnrollYear);
    setValue('gradSchoolEnrollMonth', e.gradSchoolEnrollMonth);
    setValue('gradSchoolGradYear', e.gradSchoolGradYear);
    setValue('gradSchoolGradMonth', e.gradSchoolGradMonth);
    setValue('univName', e.univName);
    setValue('univKana', e.univKana);
    setValue('univPref', e.univPref);
    setValue('faculty', e.faculty);
    setValue('dept', e.dept);
    setValue('declaredStream', e.declaredStream || '');
    setValue('enrollYear', e.enrollYear);
    setValue('enrollMonth', e.enrollMonth);
    setValue('gradYear', e.gradYear);
    setValue('gradMonth', e.gradMonth);

    syncDepartmentSystemFromProfile(e.departmentSystem);
    setValue('schoolSearchInitial', e.schoolSearchInitial);
    setValue('seminarLab', e.seminarLab);
    setValue('highSchoolPref', e.highSchoolPref);
    setValue('highSchoolSearchWord', e.highSchoolSearchWord || '');
    setValue('highSchoolName', e.highSchoolName);
    setValue('highSchoolEnrollYear', e.highSchoolEnrollYear || '');
    setValue('highSchoolEnrollMonth', e.highSchoolEnrollMonth || '');
    setValue('highSchoolGradYear', e.highSchoolGradYear || '');
    setValue('highSchoolGradMonth', e.highSchoolGradMonth || '');

    document.getElementById('profileNameTitle').textContent = profile.name || 'プロフィール設定';
    document.getElementById('deleteProfileBtn').style.display = profiles.length > 1 ? '' : 'none';
  } finally {
    suppressDirty = false;
  }
}

function collectProfile() {
  const id = currentProfileId;
  const profile = profiles.find((p) => p.id === id) || { ...StorageUtil.DEFAULT_PROFILE, id };

  profile.name = getValue('profileName') || 'プロフィール';
  profile.basic = {
    lastName: getValue('lastName'),
    firstName: getValue('firstName'),
    lastKana: getValue('lastKana'),
    firstKana: getValue('firstKana'),
    romajiLast: getValue('romajiLast'),
    romajiFirst: getValue('romajiFirst'),
    gender: getValue('gender'),
    dobYear: getValue('dobYear'),
    dobMonth: getValue('dobMonth'),
    dobDay: getValue('dobDay'),
  };
  profile.contact = {
    email: getValue('email').trim(),
    emailSub1: getValue('emailSub1').trim(),
    emailSub2: '',
    mobile1: getValue('mobile1'),
    mobile2: getValue('mobile2'),
    mobile3: getValue('mobile3'),
    homePhone1: getValue('homePhone1'),
    homePhone2: getValue('homePhone2'),
    homePhone3: getValue('homePhone3'),
    ...(() => {
      const zm =
        typeof PostalUtil !== 'undefined' && PostalUtil.normalizeZipParts
          ? PostalUtil.normalizeZipParts(getValue('zip1'), getValue('zip2'))
          : { zip1: getValue('zip1'), zip2: getValue('zip2') };
      const zh =
        typeof PostalUtil !== 'undefined' && PostalUtil.normalizeZipParts
          ? PostalUtil.normalizeZipParts(getValue('homeZip1'), getValue('homeZip2'))
          : { zip1: getValue('homeZip1'), zip2: getValue('homeZip2') };
      return {
        zip1: zm.zip1,
        zip2: zm.zip2,
        homeZip1: zh.zip1,
        homeZip2: zh.zip2,
      };
    })(),
    prefecture: getValue('prefecture'),
    city: getValue('city'),
    address: getValue('address'),
    building: getValue('building'),
    homePrefecture: getValue('homePrefecture'),
    homeCity: getValue('homeCity'),
    homeAddress: getValue('homeAddress'),
    homeBuilding: getValue('homeBuilding'),
    vacationSameAsCurrent: isChecked('vacationSameAsCurrent'),
  };
  profile.education = {
    schoolType: getValue('schoolType'),
    schoolSetup: getValue('schoolSetup'),
    degree: getValue('degree'),
    gradSchoolName: getValue('gradSchoolName'),
    gradSchoolKana: getValue('gradSchoolKana'),
    gradSchoolPref: getValue('gradSchoolPref'),
    gradFaculty: getValue('gradFaculty'),
    gradDept: getValue('gradDept'),
    gradSchoolEnrollYear: getValue('gradSchoolEnrollYear'),
    gradSchoolEnrollMonth: getValue('gradSchoolEnrollMonth'),
    gradSchoolGradYear: getValue('gradSchoolGradYear'),
    gradSchoolGradMonth: getValue('gradSchoolGradMonth'),
    univName: getValue('univName'),
    univKana: getValue('univKana'),
    univPref: getValue('univPref'),
    faculty: getValue('faculty'),
    dept: getValue('dept'),
    declaredStream: getValue('declaredStream'),
    enrollYear: getValue('enrollYear'),
    enrollMonth: getValue('enrollMonth'),
    gradYear: getValue('gradYear'),
    gradMonth: getValue('gradMonth'),

    departmentSystem: getValue('departmentSystem'),
    schoolSearchInitial: getValue('schoolSearchInitial'),
    seminarLab: getValue('seminarLab'),
    highSchoolPref: getValue('highSchoolPref'),
    highSchoolSearchWord: getValue('highSchoolSearchWord'),
    highSchoolName: getValue('highSchoolName'),
    highSchoolEnrollYear: getValue('highSchoolEnrollYear'),
    highSchoolEnrollMonth: getValue('highSchoolEnrollMonth'),
    highSchoolGradYear: getValue('highSchoolGradYear'),
    highSchoolGradMonth: getValue('highSchoolGradMonth'),
  };
  return profile;
}

// ───────────────────────────────────────────
// Settings
// ───────────────────────────────────────────
function loadSettings() {
  setChecked('highlightFilled', settings.highlightFilled !== false);
  setChecked('previewBeforeFill', !!settings.previewBeforeFill);
  setChecked('autoDetect', settings.autoDetect !== false);
  setChecked('showFloatingButton', settings.showFloatingButton !== false);
  setValue('fillDelay', settings.fillDelay ?? 50);
}

function collectSettings() {
  return {
    highlightFilled: isChecked('highlightFilled'),
    previewBeforeFill: isChecked('previewBeforeFill'),
    autoDetect: isChecked('autoDetect'),
    showFloatingButton: isChecked('showFloatingButton'),
    fillDelay: parseInt(getValue('fillDelay'), 10) || 50,
  };
}

// ───────────────────────────────────────────
// Events
// ───────────────────────────────────────────
function bindEvents() {
  const mainEl = document.querySelector('.main');
  if (mainEl) {
    mainEl.addEventListener('input', markDirty);
    mainEl.addEventListener('change', markDirty);
  }
  window.addEventListener('beforeunload', (e) => {
    if (!formDirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // Tab navigation
  document.querySelectorAll('.nav-item').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      document.querySelectorAll('.nav-item').forEach((l) => l.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
    });
  });

  // Save
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const profile = collectProfile();
    try {
      const clonedProfiles = JSON.parse(JSON.stringify(profiles));
      const idx = clonedProfiles.findIndex((p) => p.id === profile.id);
      const plain = JSON.parse(JSON.stringify(profile));
      if (idx >= 0) clonedProfiles[idx] = plain;
      else clonedProfiles.push(plain);

      settings = collectSettings();

      await StorageUtil.set({
        profiles: clonedProfiles,
        activeProfileId: currentProfileId,
        settings: { ...settings },
      });

      profiles = clonedProfiles;

      const { profiles: reread } = await StorageUtil.getProfiles();
      const saved = reread.find((p) => p.id === plain.id);
      const emailMatch =
        String(saved?.contact?.email ?? '').trim() === String(plain.contact?.email ?? '').trim();
      const subMatch =
        String(saved?.contact?.emailSub1 ?? '').trim() ===
        String(plain.contact?.emailSub1 ?? '').trim();

      if (!saved || !emailMatch || !subMatch) {
        console.error('[AutoFillPro] Save verification failed', {
          expected: plain.contact,
          stored: saved?.contact,
        });
        showToast(
          '保存の確認でメールが一致しませんでした。別の AutoFillPro が有効になっていないか確認してください。',
          'error'
        );
        return;
      }

      clearDirty();
      const pcSave = plain.contact || {};
      setValue('zip1', pcSave.zip1 ?? '');
      setValue('zip2', pcSave.zip2 ?? '');
      setValue('homeZip1', pcSave.homeZip1 ?? '');
      setValue('homeZip2', pcSave.homeZip2 ?? '');
      renderProfileList();
      document.getElementById('profileNameTitle').textContent = plain.name;
      showToast('保存しました', 'success');
    } catch (e) {
      console.error('[AutoFillPro] Save failed', e);
      showToast(`保存に失敗しました: ${e.message || String(e)}`, 'error');
    }
  });

  // Add profile
  document.getElementById('addProfileBtn').addEventListener('click', async () => {
    const newId = 'profile_' + Date.now();
    const newProfile = {
      ...JSON.parse(JSON.stringify(StorageUtil.DEFAULT_PROFILE)),
      id: newId,
      name: `プロフィール${profiles.length + 1}`,
    };
    profiles.push(newProfile);
    await StorageUtil.set({ profiles });
    switchProfile(newId);
    showToast('新しいプロフィールを作成しました', 'success');
  });

  // Delete profile
  document.getElementById('deleteProfileBtn').addEventListener('click', async () => {
    if (!confirm(`「${profiles.find((p) => p.id === currentProfileId)?.name}」を削除しますか？`)) return;
    const remaining = profiles.filter((p) => p.id !== currentProfileId);
    profiles = remaining;
    const newActive = remaining[0]?.id || 'default';
    await StorageUtil.set({ profiles, activeProfileId: newActive });
    currentProfileId = newActive;
    renderProfileList();
    loadProfile(newActive);
    showToast('削除しました');
  });

  // Postal code lookup - current address
  document.getElementById('lookupZipBtn').addEventListener('click', () => lookupZip('zip1', 'zip2', 'prefecture', 'city', 'address'));
  document.getElementById('lookupHomeZipBtn').addEventListener('click', () => lookupZip('homeZip1', 'homeZip2', 'homePrefecture', 'homeCity', 'homeAddress'));

  // Export/Import
  const doExport = async () => {
    const json = await StorageUtil.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `autofillpro-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };
  document.getElementById('exportBtn').addEventListener('click', doExport);
  document.getElementById('exportBtn2')?.addEventListener('click', doExport);

  const doImport = () => document.getElementById('importFile').click();
  document.getElementById('importBtn').addEventListener('click', doImport);
  document.getElementById('importBtn2')?.addEventListener('click', doImport);
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      await StorageUtil.importData(text);
      await loadData();
      showToast('インポートしました', 'success');
    } catch (_) {
      showToast('インポートに失敗しました', 'error');
    }
    e.target.value = '';
  });

  // Clear all
  document.getElementById('clearAllBtn')?.addEventListener('click', async () => {
    if (!confirm('すべてのデータを削除します。この操作は取り消せません。')) return;
    await chrome.storage.local.clear();
    await loadData();
    showToast('データを削除しました');
  });

  // Auto kana generation
  document.getElementById('lastName').addEventListener('input', () => tryAutoKana('lastName', 'lastKana'));
  document.getElementById('firstName').addEventListener('input', () => tryAutoKana('firstName', 'firstKana'));
}

// ───────────────────────────────────────────
// Postal code lookup
// ───────────────────────────────────────────
async function lookupZip(zip1Id, zip2Id, prefId, cityId, addrId) {
  const parts = PostalUtil.normalizeZipParts(getValue(zip1Id), getValue(zip2Id));
  const code = parts.zip1 + parts.zip2;
  if (code.length !== 7) {
    showToast('郵便番号を7桁になるように入力してください（ハイフン付きや分割でも可）', 'error');
    return;
  }
  setValue(zip1Id, parts.zip1);
  setValue(zip2Id, parts.zip2);
  const result = await PostalUtil.lookup(code);
  if (result) {
    setValue(prefId, result.prefecture);
    setValue(cityId, result.city + result.address);
    showToast('住所を取得しました', 'success');
  } else {
    showToast('住所が見つかりませんでした', 'error');
  }
}

// ───────────────────────────────────────────
// Auto kana generation hint
// ───────────────────────────────────────────
function tryAutoKana(srcId, destId) {
  const src = getValue(srcId);
  const dest = getValue(destId);
  if (!dest && FuriganaUtil.isKanaOnly(src)) {
    setValue(destId, FuriganaUtil.toKatakana(src));
  }
}

// ───────────────────────────────────────────
// Toast
// ───────────────────────────────────────────
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.classList.remove('show'); }, 2500);
}

// ───────────────────────────────────────────
// DOM helpers
// ───────────────────────────────────────────
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function setValue(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val ?? '';
}
function isChecked(id) {
  return document.getElementById(id)?.checked ?? false;
}
function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', init);
