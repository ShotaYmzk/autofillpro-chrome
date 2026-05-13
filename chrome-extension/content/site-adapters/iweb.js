'use strict';

/**
 * i-web adapter (i-web.co.jp / career.hunet.co.jp)
 * i-web uses table-based layouts with Japanese <th> cell headers.
 * The generic label-parsing fallback in FieldMatcher handles most cases.
 * We only provide overrides for reliably named fields.
 */
const IWebAdapter = {
  name: 'iweb',
  priority: 10,

  matches() {
    return /i-web\.co\.jp|career\.hunet\.co\.jp/i.test(location.hostname);
  },

  getOverrides() {
    return {
      gender:     'select[name*="sex"],select[name*="gender"],input[type=radio][name*="sex"]',
      schoolType: 'select[name*="school_type"],select[name*="gakko_kubun"]',
    };
  },

  fillElement(el, value) { return GenericAdapter.fillElement(el, value); },
};

if (typeof window !== 'undefined') {
  window.IWebAdapter = IWebAdapter;
}
