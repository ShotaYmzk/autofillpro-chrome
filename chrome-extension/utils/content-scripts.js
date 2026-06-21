'use strict';

/**
 * Content script 注入順序（manifest content_scripts と popup injectContentScripts で共有）
 */
var AFP_CONTENT_SCRIPT_FILES = [
  'utils/allowed-urls.js',
  'utils/storage.js',
  'utils/furigana.js',
  'utils/postal.js',
  'utils/vacation-contact.js',
  'utils/education-dates.js',
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

var root = typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis;
if (root) {
  root.AFP_CONTENT_SCRIPT_FILES = AFP_CONTENT_SCRIPT_FILES;
}
