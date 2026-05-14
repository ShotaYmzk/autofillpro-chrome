'use strict';

/**
 * Floating 「自動入力」 button on supported pages (Axol-style UX).
 */
(function initFloatingAutofillButton() {
  const ROOT_ID = 'afp-float-autofill-root';

  function allowedPage() {
    return /^https?:/i.test(location.protocol);
  }

  /** Axol / i-Web / Entry Sheet など専用アダプタが選ばれるページのみ true（Generic は常時マッチするため除外） */
  function pageHasDedicatedAdapter() {
    try {
      if (typeof AutoFill === 'undefined' || typeof AutoFill.getAdapter !== 'function') return false;
      const adapter = AutoFill.getAdapter();
      return !!(adapter && adapter.name !== 'generic');
    } catch (_) {
      return false;
    }
  }

  function mountButton() {
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-afp-ui', 'float-fill');

    const shadow = root.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 18px;
        border-radius: 999px;
        border: none;
        cursor: pointer;
        font-weight: 700;
        font-size: 14px;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        box-shadow: 0 8px 28px rgba(34, 197, 94, 0.45);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      button:hover { transform: scale(1.03); box-shadow: 0 10px 32px rgba(34, 197, 94, 0.55); }
      button:active { transform: scale(0.98); }
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<span aria-hidden="true">⚡</span><span>自動入力</span>';

    btn.addEventListener('click', async () => {
      try {
        const r = await AutoFill.runFillFromUI();
        const n = r?.filled;
        if (typeof n === 'number' && n === 0) {
          showToast('0 件でした（プロフィール未登録か、ページと表示判定を確認）');
        } else {
          showToast(typeof n === 'number' ? `${n} 件入力しました` : '入力しました');
        }
      } catch (_) {
        showToast('入力できませんでした');
      }
    });

    shadow.appendChild(style);
    shadow.appendChild(btn);

    Object.assign(root.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483646',
    });

    document.documentElement.appendChild(root);
  }

  function showToast(msg) {
    let el = document.getElementById('afp-float-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'afp-float-toast';
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '88px',
        right: '24px',
        zIndex: '2147483646',
        padding: '8px 14px',
        background: '#0f172a',
        color: '#fff',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        maxWidth: '260px',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN",Meiryo,sans-serif',
        boxShadow: '0 4px 14px rgba(0,0,0,.2)',
      });
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._hide);
    el._hide = setTimeout(() => {
      el.style.display = 'none';
    }, 2800);
  }

  async function sync() {
    if (!allowedPage()) return;

    let show = true;
    let dedicatedOnly = true;
    try {
      const s = await StorageUtil.getSettings();
      show = s.showFloatingButton !== false;
      dedicatedOnly = s.floatingButtonDedicatedSitesOnly !== false;
    } catch (_) {}

    const existing = document.getElementById(ROOT_ID);
    if (!show) {
      existing?.remove();
      return;
    }

    if (dedicatedOnly && !pageHasDedicatedAdapter()) {
      existing?.remove();
      return;
    }

    if (!existing && typeof AutoFill !== 'undefined' && typeof AutoFill.runFillFromUI === 'function') {
      mountButton();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) sync();
    });
  } catch (_) {}
})();
