'use strict';

/**
 * 就活フォームでよくある「次へ」「確認」「送信」などのナビゲーション要素を検出する。
 */
const NavControls = {
  _preferTextRe: /次へ|確認|送信|登録|完了|進む/,

  findNextStepLink() {
    const sel =
      'a[href*="nextpage"], a.btn_w160b, a[class*="btn_"], .btn_w160 a, .btn_w160b a, p.btn_w160 a, p[class*="btn"] a';
    const links = [...document.querySelectorAll(sel)];
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      const t = (a.textContent || '').trim();
      if (/次へ/.test(t) && /nextpage/i.test(href)) return a;
    }
    for (const a of links) {
      if (/次へ/.test((a.textContent || '').trim())) return a;
    }
    return null;
  },

  findPrimaryNav() {
    const next = this.findNextStepLink();
    if (next) return next;

    const nodes = [
      ...document.querySelectorAll(
        'input[type="submit"], input[type="image"], button[type="submit"], button:not([type="button"])'
      ),
    ];
    for (const el of nodes) {
      const t = `${el.value || ''} ${el.alt || ''} ${el.title || ''} ${el.textContent || ''}`.trim();
      if (this._preferTextRe.test(t)) return el;
    }
    for (const a of document.querySelectorAll('a[href]')) {
      const t = (a.textContent || '').trim();
      if (this._preferTextRe.test(t)) return a;
    }
    return null;
  },

  isInViewport(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    const r = el.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > 0 && r.top < h;
  },

  navLabel(el) {
    if (!el) return '次へ';
    const t = (el.textContent || el.value || '').trim();
    return t || '次へ';
  },
};

var root = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis;
if (root) {
  root.NavControls = NavControls;
}
