'use strict';

/**
 * Allowed recruitment site URL match patterns (runtime guard; same semantics you use in code review).
 * Keep aligned with manifest.json `content_scripts[].matches` and `host_permissions`.
 *
 * Note: Chrome host wildcards allow only a leading `*` (e.g. `*.i-webs.jp`); patterns like
 * `*.*.i-webs.jp` are invalid in the manifest. `*://*.i-webs.jp/*` covers nested hosts such as
 * `mypage.3010.i-webs.jp`. Runtime guard uses `*://mypage.*.i-webs.jp/*` for `isRecruitmentAllowedUrl`.
 */
var RECRUITMENT_ALLOWED_MATCH_PATTERNS = [
  '*://axol.jp/zw/s/*/mypage/*',
  '*://axol.jp/zw/s/*/entry/*',
  /* entry_2124220008/input など entry_<id> 形式（/entry/ ではない） */
  '*://axol.jp/zw/s/*/*/*',
  /* job.axol.jp（三菱商事等 bx テナント） */
  '*://job.axol.jp/bx/s/*/mypage/*',
  '*://job.axol.jp/bx/s/*/entry/*',
  '*://job.axol.jp/bx/s/*/*/*',
  '*://www.e2r.jp/ja/*/career_edu/*',
  '*://www.e2r.jp/eARTH/*',
  '*://job.mynavi.jp/28/pc/*',
  '*://mypage.*.i-webs.jp/*',
  /* 旧 i-web 系（fujifilm.i-web.jpn.com 等） */
  '*://*.i-web.jpn.com/*',
  /* sonar ATS テナント（nttdata / docomo-recruit / lycorp 等）を一括で許可 */
  '*://*.snar.jp/*',
  '*://suntory.saiyo.jp/2028/*',
  /* 三菱UFJ銀行 マイページ（ES 系 form1） */
  '*://www.mypage.bk.mufg.jp/*',
];

/**
 * Match a URL against a Chrome extension match pattern (MV3 semantics).
 * @param {string} urlString
 * @param {string} pattern  e.g. scheme wildcards with host and path
 * @returns {boolean}
 */
function matchesChromeMatchPattern(urlString, pattern) {
  if (!urlString || !pattern) return false;

  var delim = '://';
  var i = pattern.indexOf(delim);
  if (i === -1) return false;

  var schemePat = pattern.slice(0, i);
  var rest = pattern.slice(i + delim.length);
  var slash = rest.indexOf('/');
  if (slash === -1) return false;

  var hostPat = rest.slice(0, slash);
  var pathPat = rest.slice(slash);

  var u;
  try {
    u = new URL(urlString);
  } catch (e) {
    return false;
  }

  // Scheme
  if (schemePat !== '*') {
    if (u.protocol.replace(/:$/, '') !== schemePat) return false;
  } else if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return false;
  }

  // Host: only patterns used here are exact labels or mypage.*.i-webs.jp
  if (!hostMatchesPattern(hostPat, u.hostname)) return false;

  return pathMatchesPattern(pathPat, u.pathname);
}

function hostMatchesPattern(hostPat, hostname) {
  if (hostPat === '*') return true;

  if (hostPat.indexOf('*') === -1) {
    return hostname === hostPat;
  }

  var patLabels = hostPat.split('.');
  var hostLabels = hostname.split('.');
  if (patLabels.length !== hostLabels.length) return false;

  for (var i = 0; i < patLabels.length; i++) {
    if (patLabels[i] === '*') {
      if (!hostLabels[i] || hostLabels[i].indexOf('*') !== -1) return false;
      continue;
    }
    if (patLabels[i] !== hostLabels[i]) return false;
  }
  return true;
}

/**
 * Path matching aligned with extension match patterns:
 * - Internal `*` still matches a single path segment.
 * - A trailing `/*` (with no other `*` in the prefix) matches that prefix and any deeper path
 *   (e.g. `/28/pc/*` matches `/28/pc/corpinfo/...`).
 * - Path pattern `/*` matches any pathname on the host.
 */
function pathMatchesPattern(pathPat, pathname) {
  if (pathPat === '/*') {
    return pathname.startsWith('/');
  }

  if (pathPat.length >= 2 && pathPat.slice(-2) === '/*') {
    var prefix = pathPat.slice(0, -2);
    if (prefix.indexOf('*') === -1) {
      if (pathname === prefix) return true;
      return prefix === '' ? pathname.startsWith('/') : pathname.startsWith(prefix + '/');
    }
  }

  var ps = pathPat.split('/');
  var us = pathname.split('/');

  if (ps.length !== us.length) return false;

  for (var k = 0; k < ps.length; k++) {
    if (ps[k] === '*') continue;
    if (ps[k] !== us[k]) return false;
  }
  return true;
}

/**
 * @param {string|undefined} url
 * @returns {boolean}
 */
function isRecruitmentAllowedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return false;

  return RECRUITMENT_ALLOWED_MATCH_PATTERNS.some(function (p) {
    return matchesChromeMatchPattern(url, p);
  });
}

/**
 * 一般的な Web ページ（http/https）か。
 * @param {string|undefined} url
 * @returns {boolean}
 */
function isHttpPageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return false;
  if (/^https?:\/\//i.test(url)) return true;
  try {
    var u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * ユーザー操作によるオンデマンド注入が可能か。
 * @param {string|undefined} url
 * @param {{ injectionMode?: string }|undefined} settings
 * @returns {boolean}
 */
function canInjectOnDemand(url, settings) {
  if (!isHttpPageUrl(url)) return false;
  var mode = (settings && settings.injectionMode) || 'on_demand';
  if (mode === 'allowlist_only') {
    return isRecruitmentAllowedUrl(url);
  }
  return true;
}

/* global self, window */
var root = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis;
if (root) {
  root.RECRUITMENT_ALLOWED_MATCH_PATTERNS = RECRUITMENT_ALLOWED_MATCH_PATTERNS;
  root.matchesChromeMatchPattern = matchesChromeMatchPattern;
  root.isRecruitmentAllowedUrl = isRecruitmentAllowedUrl;
  root.isHttpPageUrl = isHttpPageUrl;
  root.canInjectOnDemand = canInjectOnDemand;
}
