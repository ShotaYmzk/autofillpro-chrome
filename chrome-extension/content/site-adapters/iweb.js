'use strict';

/**
 * i-web adapter (i-web.co.jp / career.hunet.co.jp / *.i-webs.jp マイページ)
 * i-webs 系は jqTransform で select を隠すことが多い — FieldMatcher の可視判定と
 * GenericAdapter のラベル同期で対応。gyubin/gken/gadrs 等は EntrySheetAdapter が
 * 優先度 11 で同じフォームを扱う。
 */
const IWebAdapter = {
  name: 'iweb',
  priority: 10,

  matches() {
    const h = location.hostname;
    return (
      /i-web\.co\.jp|career\.hunet\.co\.jp/i.test(h) ||
      /\.i-webs\.jp$/i.test(h)
    );
  },

  getOverrides() {
    return {
      gender:
        'select[name*="sex"],select[name*="gender"],input[type=radio][name*="sex"],input[type=radio][name="sexcd"]',
      schoolType: 'select[name*="school_type"],select[name*="gakko_kubun"]',
      dobYear: 'select#ybirth,select[name="ybirth"]',
      dobMonth: 'select#mbirth,select[name="mbirth"]',
      dobDay: 'select#dbirth,select[name="dbirth"]',
    };
  },

  fillElement(el, value) { return GenericAdapter.fillElement(el, value); },
};

if (typeof window !== 'undefined') {
  window.IWebAdapter = IWebAdapter;
}
