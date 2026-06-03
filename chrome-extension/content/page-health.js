'use strict';

/**
 * 入力後に「次へ」等が画面外にないか検知し、トーストとスクロールで案内する。
 */
const PageHealth = (() => {
  const TOAST_ID = 'afp-page-health-toast';

  function showToast(msg, durationMs = 4200) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '88px',
        right: '24px',
        zIndex: '2147483645',
        padding: '10px 14px',
        background: '#0f172a',
        color: '#fff',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        maxWidth: '300px',
        lineHeight: '1.45',
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN",Meiryo,sans-serif',
        boxShadow: '0 4px 14px rgba(0,0,0,.25)',
      });
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._hide);
    el._hide = setTimeout(() => {
      el.style.display = 'none';
    }, durationMs);
  }

  async function checkAfterFill(settings) {
    if (typeof NavControls === 'undefined') return { ok: true };

    const nav = NavControls.findPrimaryNav();
    if (!nav) {
      showToast('「次へ」などのボタンが見つかりません。ページをスクロールするか、手動で確認してください。');
      return { ok: false, reason: 'nav-missing' };
    }

    const inView = NavControls.isInViewport(nav);
    const label = NavControls.navLabel(nav);
    const scrollOn = settings?.scrollToNavAfterFill === true;

    if (!inView) {
      if (scrollOn) {
        try {
          nav.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {
          try {
            nav.scrollIntoView(false);
          } catch (__) {}
        }
        showToast(`「${label}」はページ下部にあります。下にスクロールしてください。`);
      }
      return { ok: true, scrolled: scrollOn, belowFold: true };
    }

    return { ok: true, belowFold: false };
  }

  return { checkAfterFill, showToast };
})();

if (typeof window !== 'undefined') {
  window.PageHealth = PageHealth;
}
