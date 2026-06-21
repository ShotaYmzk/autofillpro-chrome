'use strict';

const ONBOARDING_STEPS = [
  {
    title: 'マイページを自動入力',
    desc: 'axol.jp・i-webs.jpなど対応サイトを開くと、登録した情報を自動でフォームに入力します。',
    features: [
      { label: '対応サイトで自動起動', sub: '対応マイページを開くと自動で起動します' },
      { label: 'ワンクリックで入力', sub: 'ボタン1つで全フォームに入力できます' },
      { label: '複数プラットフォーム対応', sub: 'axol・i-web・snarなど主要サイトに対応' },
    ],
  },
  {
    title: '情報を一度登録するだけ',
    desc: '氏名・住所・学歴などを一度入力すれば、すべての企業マイページで使い回せます。',
    features: [
      { label: '基本情報', sub: '氏名・フリガナ・生年月日・性別' },
      { label: '連絡先・住所', sub: 'メール・電話・郵便番号・住所' },
      { label: '学歴', sub: '大学名・学部・学科・卒業年度' },
    ],
  },
  {
    title: '主要就活サイトに対応',
    desc: 'NTTドコモ・LYCorp・日立など人気企業が使うプラットフォームをカバーしています。',
    features: [
      { label: 'axol.jp', sub: 'リクルート系企業など多数' },
      { label: 'i-webs.jp', sub: '大手メーカー・金融など' },
      { label: 'snar.jp / e2r.jp', sub: '順次対応中' },
    ],
  },
  {
    title: 'すぐ使えるようにピン留め',
    desc: 'Chromeのツールバーにピン留めしておくと、マイページを開いたときすぐアクセスできます。',
    features: [
      { label: '右上の拡張機能アイコンを開く', sub: 'Chromeツールバー右上のパズルアイコン' },
      { label: 'AutoFillProをピン留め', sub: 'ピンアイコンをクリックしてON' },
      { label: 'すぐアクセス', sub: 'アイコンから設定・自動入力をすぐ開けます' },
    ],
  },
];

let currentStep = 0;
let overlayEl = null;

function buildStepHTML(index) {
  const step = ONBOARDING_STEPS[index];
  const total = ONBOARDING_STEPS.length;
  const isLast = index === total - 1;

  const progressBars = ONBOARDING_STEPS.map((_, i) =>
    `<div class="ob-progress-bar${i <= index ? ' active' : ''}"></div>`
  ).join('');

  const featureItems = step.features.map((f) => `
    <li>
      <span class="ob-feature-label">${f.label}</span>
      <span class="ob-feature-sub">${f.sub}</span>
    </li>
  `).join('');

  const nextLabel = isLast ? '情報登録を始める' : '次へ';

  return `
    <div class="ob-header">
      <div class="ob-step-meta">メニュー ${index + 1}/${total}</div>
      <div class="ob-progress">${progressBars}</div>
    </div>
    <div class="ob-body">
      <div class="ob-step-title">${step.title}</div>
      <div class="ob-step-desc">${step.desc}</div>
      <ul class="ob-feature-list">${featureItems}</ul>
    </div>
    <div class="ob-footer">
      <div class="ob-footer-left">
        <button type="button" class="ob-skip-link" id="ob-skip">あとで見る</button>
      </div>
      <div class="ob-footer-right">
        <button type="button" class="btn btn--secondary btn--sm" id="ob-prev" ${index === 0 ? 'disabled' : ''}>戻る</button>
        <button type="button" class="btn btn--primary btn--sm" id="ob-next">${nextLabel}</button>
      </div>
    </div>
  `;
}

function attachListeners() {
  overlayEl.querySelector('#ob-skip').addEventListener('click', dismissOnboarding);
  overlayEl.querySelector('#ob-prev').addEventListener('click', () => {
    if (currentStep > 0) renderStep(currentStep - 1);
  });
  overlayEl.querySelector('#ob-next').addEventListener('click', async () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      renderStep(currentStep + 1);
    } else {
      await markCompleted();
      removeOverlay();
      document.getElementById('lastName')?.focus();
    }
  });
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) dismissOnboarding();
  });
}

function renderStep(index) {
  currentStep = index;
  overlayEl.querySelector('.onboarding-card').innerHTML = buildStepHTML(index);
  attachListeners();
}

async function markCompleted() {
  await chrome.storage.local.set({ onboardingCompleted: true });
}

function removeOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

function dismissOnboarding() {
  removeOverlay();
}

function injectCSS() {
  if (document.getElementById('ob-styles')) return;
  const link = document.createElement('link');
  link.id = 'ob-styles';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('onboarding/onboarding.css');
  document.head.appendChild(link);
}

function showOnboarding(forceShow = false) {
  if (overlayEl) removeOverlay();

  if (!forceShow) {
    chrome.storage.local.get(['onboardingCompleted'], (data) => {
      if (!data.onboardingCompleted) _render();
    });
    return;
  }

  _render();
}

function _render() {
  injectCSS();
  currentStep = 0;

  overlayEl = document.createElement('div');
  overlayEl.className = 'onboarding-overlay';
  overlayEl.innerHTML = `<div class="onboarding-card"></div>`;
  document.body.appendChild(overlayEl);

  renderStep(0);
}

function initOnboarding() {
  const tutorialBtn = document.getElementById('showTutorialBtn');
  if (tutorialBtn) {
    tutorialBtn.addEventListener('click', () => showOnboarding(true));
  }
  showOnboarding(false);
}

document.addEventListener('DOMContentLoaded', initOnboarding);
