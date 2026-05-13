'use strict';

/**
 * AutoFillOverlay
 * - Highlights filled form fields (green glow)
 * - Shows a preview modal before filling
 */
const AutoFillOverlay = (() => {
  const HIGHLIGHT_CLASS = 'afp-highlight';
  const PREVIEW_ID = 'afp-preview-modal';
  const STYLE_ID = 'afp-overlay-styles';

  const FIELD_LABELS = {
    lastName: '姓',       firstName: '名',
    lastKana: 'セイ',     firstKana: 'メイ',
    fullName: '氏名',     fullKana: 'フリガナ',
    gender: '性別',       dob: '生年月日',
    dobYear: '年',        dobMonth: '月',       dobDay: '日',
    email: 'メール（メイン）',
    emailConfirm: 'メール（確認）',
    secondaryEmailConfirm: 'メールアドレス2（確認）',
    emailSub1: 'サブメール①（メールアドレス2）',
    romajiLast: 'ローマ字（姓）',
    romajiFirst: 'ローマ字（名）',
    mobile: '携帯',       mobile1: '携帯①',    mobile2: '携帯②',   mobile3: '携帯③',
    homePhone: '自宅電話', homePhone1: '自宅①', homePhone2: '自宅②', homePhone3: '自宅③',
    telk1: '休暇先電話①', telk2: '休暇先電話②', telk3: '休暇先電話③',
    zip: '郵便番号',      zip1: '郵便①',       zip2: '郵便②',
    prefecture: '都道府県', city: '市区町村',   address: '番地',     building: '建物名',
    homePrefecture: '帰省先都道府県', homeCity: '帰省先市区町村',
    homeAddress: '帰省先番地',        homeBuilding: '帰省先建物',
    schoolType: '学校区分',
    schoolSetup: '設置区分',
    degree: '学位',
    departmentSystem: '学科系統',
    seminarLab: 'ゼミ・研究室',
    schoolSearchInitial: '学校名頭文字',
    gradSchoolName: '大学院名', gradSchoolKana: '大学院名ふりがな',
    univName: '大学名',    univKana: '大学名ふりがな',
    univPref: '大学所在地', gradSchoolPref: '大学院所在地',
    faculty: '学部',       dept: '学科',
    enrollYear: '入学年',  enrollMonth: '入学月',
    gradYear: '卒業年',    gradMonth: '卒業月',
    gradFaculty: '研究科', gradDept: '専攻',
    gradSchoolEnrollYear: '大学院入学年', gradSchoolEnrollMonth: '大学院入学月',
    gradSchoolGradYear: '大学院卒業年',  gradSchoolGradMonth: '大学院卒業月',
    highSchoolPref: '卒業高校（県）',
    highSchoolSearchWord: '高校検索ワード',
    highSchoolName: '卒業高校名',
    highSchoolEnrollYear: '高校入学・年',
    highSchoolEnrollMonth: '高校入学・月',
    highSchoolGradYear: '高校卒業・年',
    highSchoolGradMonth: '高校卒業・月',
    koko_word: '高校名検索ワード',
    vacationSame: '休暇中連絡先＝現住所',
    jushosame: '現在の連絡先と同じ',
  };

  // ──────────────────────────────────────────────
  // Style injection
  // ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 2px solid #22c55e !important;
        outline-offset: 1px !important;
        background-color: #f0fdf4 !important;
        transition: outline .3s, background-color .3s;
      }

      #${PREVIEW_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(2px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Kaku Gothic ProN', sans-serif;
        font-size: 14px;
        color: #0f172a;
      }

      #${PREVIEW_ID} .afp-modal {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,.25);
        width: 480px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 64px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #${PREVIEW_ID} .afp-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
      }

      #${PREVIEW_ID} .afp-modal__title {
        font-size: 15px;
        font-weight: 700;
      }

      #${PREVIEW_ID} .afp-modal__close {
        background: none;
        border: none;
        cursor: pointer;
        color: #94a3b8;
        font-size: 20px;
        line-height: 1;
        padding: 2px 6px;
        border-radius: 4px;
      }
      #${PREVIEW_ID} .afp-modal__close:hover { background: #f1f5f9; color: #0f172a; }

      #${PREVIEW_ID} .afp-modal__count {
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
        padding: 8px 20px;
        background: #f8f9fc;
        border-bottom: 1px solid #e2e8f0;
      }

      #${PREVIEW_ID} .afp-modal__body {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }

      #${PREVIEW_ID} .afp-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 20px;
        border-bottom: 1px solid #f1f5f9;
      }
      #${PREVIEW_ID} .afp-row:last-child { border-bottom: none; }

      #${PREVIEW_ID} .afp-row__label {
        width: 110px;
        flex-shrink: 0;
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-align: right;
      }

      #${PREVIEW_ID} .afp-row__arrow {
        color: #c7d2fe;
        font-size: 13px;
        flex-shrink: 0;
      }

      #${PREVIEW_ID} .afp-row__value {
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        color: #1e293b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${PREVIEW_ID} .afp-modal__footer {
        display: flex;
        gap: 8px;
        padding: 14px 20px;
        border-top: 1px solid #e2e8f0;
        background: #f8f9fc;
      }

      #${PREVIEW_ID} .afp-btn {
        flex: 1;
        height: 38px;
        border-radius: 7px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all .15s;
      }

      #${PREVIEW_ID} .afp-btn--primary {
        background: #6C63FF;
        color: #fff;
        border-color: #6C63FF;
      }
      #${PREVIEW_ID} .afp-btn--primary:hover { background: #4F46E5; }

      #${PREVIEW_ID} .afp-btn--cancel {
        background: #fff;
        color: #64748b;
        border-color: #e2e8f0;
      }
      #${PREVIEW_ID} .afp-btn--cancel:hover { background: #f1f5f9; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ──────────────────────────────────────────────
  // Highlight
  // ──────────────────────────────────────────────
  function highlightElement(el, _key) {
    injectStyles();
    el.classList.add(HIGHLIGHT_CLASS);
    // Remove after 5s
    setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), 5000);
  }

  function clearHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
      el.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  // ──────────────────────────────────────────────
  // Preview modal
  // ──────────────────────────────────────────────
  function showPreview(plan, onConfirm) {
    injectStyles();
    removePreview();

    const overlay = document.createElement('div');
    overlay.id = PREVIEW_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '入力プレビュー');

    const rows = plan.map(({ key, value }) => `
      <div class="afp-row">
        <div class="afp-row__label">${FIELD_LABELS[key] || key}</div>
        <div class="afp-row__arrow">→</div>
        <div class="afp-row__value" title="${esc(value)}">${esc(value)}</div>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="afp-modal">
        <div class="afp-modal__header">
          <div class="afp-modal__title">入力プレビュー</div>
          <button class="afp-modal__close" id="afp-close-btn" aria-label="閉じる">×</button>
        </div>
        <div class="afp-modal__count">${plan.length} 件のフィールドが入力対象です</div>
        <div class="afp-modal__body">${rows || '<div style="padding:20px;text-align:center;color:#94a3b8">入力対象のフィールドが見つかりませんでした</div>'}</div>
        <div class="afp-modal__footer">
          <button class="afp-btn afp-btn--cancel" id="afp-cancel-btn">キャンセル</button>
          <button class="afp-btn afp-btn--primary" id="afp-confirm-btn">この内容で入力する</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => removePreview();
    overlay.querySelector('#afp-close-btn').addEventListener('click', close);
    overlay.querySelector('#afp-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#afp-confirm-btn').addEventListener('click', () => {
      removePreview();
      onConfirm?.();
    });

    // Focus trap
    overlay.querySelector('#afp-confirm-btn').focus();
  }

  function removePreview() {
    document.getElementById(PREVIEW_ID)?.remove();
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { highlightElement, clearHighlights, showPreview, removePreview };
})();

if (typeof window !== 'undefined') {
  window.AutoFillOverlay = AutoFillOverlay;
}
