'use strict';

/**
 * AutoFill Engine
 * Orchestrates field matching → fill / preview flow
 */

const AutoFill = (() => {
  // Ordered by priority (highest first); generic is always last fallback
  const ADAPTERS = [];

  function initAdapters() {
    if (typeof AxolAdapter !== 'undefined') ADAPTERS.push(AxolAdapter);
    if (typeof IWebAdapter !== 'undefined') ADAPTERS.push(IWebAdapter);
    if (typeof EntrySheetAdapter !== 'undefined') ADAPTERS.push(EntrySheetAdapter);
    if (typeof GenericAdapter !== 'undefined') ADAPTERS.push(GenericAdapter);
    ADAPTERS.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  function getAdapter() {
    return ADAPTERS.find((a) => a.matches()) || GenericAdapter;
  }

  /**
   * Core fill function — fills all matched fields, returns result summary
   */
  async function fillPage(profile, { preview = false, delay = 50, highlightFilled = true } = {}) {
    const adapter = getAdapter();
    let plan = FieldMatcher.buildFillPlan(profile);

    const cascadeExcluded = new Set();
    if (typeof adapter.collectCascadeExcludedKeys === 'function') {
      for (const k of adapter.collectCascadeExcludedKeys(profile)) cascadeExcluded.add(k);
    } else if (
      adapter.shouldRunSchoolCascade?.(profile) &&
      typeof adapter.schoolCascadeExcludedKeys === 'function'
    ) {
      for (const k of adapter.schoolCascadeExcludedKeys()) cascadeExcluded.add(k);
    }

    const overrides = adapter.getOverrides ? adapter.getOverrides() : {};
    const overridePlan = buildOverridePlan(overrides, profile, adapter, cascadeExcluded);

    const overrideEls = new Set(overridePlan.map((p) => p.el));
    plan = [...overridePlan, ...plan.filter((p) => !overrideEls.has(p.el))];

    const extra = adapter.extendFillPlan ? adapter.extendFillPlan(profile, plan) : [];
    /* 同一要素への誤マッチ行が残ると Axol の kmail がサブ宛で上書きされないため、adapter の追加で置換する */
    for (const row of extra) {
      plan = plan.filter((p) => p.el !== row.el);
      plan.push(row);
    }

    if (cascadeExcluded.size) {
      plan = plan.filter((row) => !cascadeExcluded.has(row.key));
    }

    const flat = FieldMatcher.flattenProfile(profile);
    plan = FieldMatcher.normalizeMailAssignments(plan, flat);

    if (adapter.name === 'axol') {
      plan = prioritizeAxolMailFields(plan);
    }

    if (typeof VacationContact !== 'undefined' && VacationContact.applyVacationPolicy) {
      plan = VacationContact.applyVacationPolicy(plan, profile);
    }

    if (preview) {
      return { plan, filled: 0 };
    }

    if (
      adapter.name === 'axol' &&
      typeof adapter.unlockSchoolSearchConditionsIfNeeded === 'function'
    ) {
      if (adapter.unlockSchoolSearchConditionsIfNeeded()) {
        await sleep(Math.max(delay * 2, 160));
      }
    }

    let filled = 0;
    for (const { el, value, key } of plan) {
      let stepDelay = delay;
      if (adapter.name === 'axol' && el?.name === 'email2') stepDelay += 120;
      if (adapter.name === 'axol' && el?.name === 'kmail2') stepDelay += 120;
      if (stepDelay > 0) await sleep(stepDelay);
      const ok = adapter.fillElement(el, value);
      if (ok) {
        filled++;
        if (
          highlightFilled !== false &&
          typeof AutoFillOverlay !== 'undefined' &&
          AutoFillOverlay.highlightElement
        ) {
          AutoFillOverlay.highlightElement(el, key);
        }
      }
    }

    if (
      typeof adapter.runSchoolSearchCascade === 'function' &&
      adapter.shouldRunSchoolCascade?.(profile)
    ) {
      const { filled: cascadeFilled } = await adapter.runSchoolSearchCascade(profile, {
        delay,
        highlightFilled,
      });
      filled += cascadeFilled || 0;
    }

    if (
      typeof adapter.runHighSchoolSearchCascade === 'function' &&
      adapter.shouldRunHighSchoolCascade?.(profile)
    ) {
      const { filled: hsFilled } = await adapter.runHighSchoolSearchCascade(profile, {
        delay,
        highlightFilled,
      });
      filled += hsFilled || 0;
    }

    if (typeof adapter.runAfterPageFill === 'function') {
      const extraFilled = await adapter.runAfterPageFill(profile, { delay, highlightFilled, plan });
      filled += typeof extraFilled === 'number' ? extraFilled : 0;
    }

    return { plan, filled };
  }

  function buildOverridePlan(overrides, profile, adapter, excludeKeys = new Set()) {
    let flat =
      adapter && typeof adapter.mapFlat === 'function'
        ? adapter.mapFlat(profile)
        : FieldMatcher.flattenProfile(profile);
    if (
      typeof VacationContact !== 'undefined' &&
      !VacationContact.isVacationSameAsCurrent(profile)
    ) {
      flat = VacationContact.enrichFlat(flat, profile.contact);
    }
    const vacationKeys =
      typeof VacationContact !== 'undefined' ? VacationContact.VACATION_PROFILE_KEYS : null;
    const plan = [];

    const isElVisible =
      typeof FieldMatcher.isFillableVisible === 'function'
        ? FieldMatcher.isFillableVisible
        : isVisibleCompat;

    for (const [key, selector] of Object.entries(overrides)) {
      if (excludeKeys.has(key)) continue;
      if (
        vacationKeys &&
        vacationKeys.has(key) &&
        typeof VacationContact !== 'undefined' &&
        VacationContact.isVacationSameAsCurrent(profile)
      ) {
        continue;
      }
      const value = flat[key];
      if (!value) continue;

      const selectors = selector.split(',').map((s) => s.trim());
      for (const sel of selectors) {
        try {
          const candidates = document.querySelectorAll(sel);
          let picked = null;
          for (const el of candidates) {
            if (isElVisible(el)) {
              picked = el;
              break;
            }
          }
          if (picked) {
            plan.push({ el: picked, key, value: String(value) });
            break;
          }
        } catch (_) {}
      }
    }
    return plan;
  }

  /** @deprecated 後方互換 — FieldMatcher.isFillableVisible を優先 */
  function isVisibleCompat(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Axol: email → email2 → kmail → kmail2 の順で入れないと比較バリデが壊れやすい */
  function prioritizeAxolMailFields(plan) {
    const order = { email: 0, email2: 1, kmail: 2, kmail2: 3 };
    const isMail = (row) => row?.el?.name != null && order[row.el.name] !== undefined;
    const mails = plan.filter(isMail).sort((a, b) => order[a.el.name] - order[b.el.name]);
    if (!mails.length) return plan;
    const out = [];
    let merged = false;
    for (const row of plan) {
      if (isMail(row)) {
        if (!merged) {
          out.push(...mails);
          merged = true;
        }
        continue;
      }
      out.push(row);
    }
    return out;
  }

  // ──────────────────────────────────────────────
  // Message listener — receives commands from popup
  // ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const safeRespond = (payload) => {
      try {
        sendResponse(payload);
      } catch (_) {
        /* 送信側が既に切断（ポップアップ閉じた等） */
      }
    };

    if (
      typeof isRecruitmentAllowedUrl === 'function' &&
      !isRecruitmentAllowedUrl(location.href)
    ) {
      if (msg.type === 'AUTOFILL_FILL' || msg.type === 'AUTOFILL_PREVIEW') {
        safeRespond({ success: false, error: 'url-not-allowed' });
        return true;
      }
      return false;
    }

    if (msg.type === 'AUTOFILL_FILL') {
      const { profile, settings } = msg;
      if (settings?.previewBeforeFill) {
        fillPage(profile, { preview: true })
          .then(({ plan }) => {
            if (typeof AutoFillOverlay !== 'undefined') {
              /* プレビュー確定まで sendResponse を遅らせるとチャネルが閉じてエラーになるため先に応答 */
              safeRespond({
                success: true,
                previewPending: true,
                previewCount: plan.length,
              });
              AutoFillOverlay.showPreview(plan, () => {
                fillPage(profile, {
                  preview: false,
                  delay: settings.fillDelay ?? 50,
                  highlightFilled: settings.highlightFilled !== false,
                }).catch(() => {});
              });
            } else {
              fillPage(profile, {
                preview: false,
                delay: settings.fillDelay ?? 50,
                highlightFilled: settings.highlightFilled !== false,
              })
                .then(({ filled }) => safeRespond({ success: true, filled }))
                .catch((err) => safeRespond({ success: false, error: err.message }));
            }
          })
          .catch((err) => safeRespond({ success: false, error: err.message }));
      } else {
        fillPage(profile, {
          preview: false,
          delay: settings?.fillDelay ?? 50,
          highlightFilled: settings?.highlightFilled !== false,
        })
          .then(({ filled }) => safeRespond({ success: true, filled }))
          .catch((err) => safeRespond({ success: false, error: err.message }));
      }
      return true;
    }

    if (msg.type === 'AUTOFILL_PREVIEW') {
      const { profile } = msg;
      fillPage(profile, { preview: true })
        .then(({ plan }) => {
          if (typeof AutoFillOverlay !== 'undefined') {
            AutoFillOverlay.showPreview(plan, () => {
              chrome.runtime.sendMessage({ type: 'PREVIEW_CONFIRMED' });
            });
          }
          safeRespond({ success: true, count: plan.length });
        })
        .catch((err) => safeRespond({ success: false, error: err.message }));
      return true;
    }

    if (msg.type === 'AUTOFILL_CLEAR_HIGHLIGHT') {
      if (typeof AutoFillOverlay !== 'undefined') AutoFillOverlay.clearHighlights();
      safeRespond({ success: true });
      return false;
    }

    if (msg.type === 'PING') {
      safeRespond({ ready: true });
      return false;
    }

    return false;
  });

  async function runFillFromUI() {
    const profile = await StorageUtil.getActiveProfile();
    const settings = await StorageUtil.getSettings();
    const delay = settings.fillDelay ?? 50;
    const highlightFilled = settings.highlightFilled !== false;

    if (settings.previewBeforeFill) {
      const { plan } = await fillPage(profile, { preview: true, delay: 0, highlightFilled });
      if (typeof AutoFillOverlay !== 'undefined') {
        return new Promise((resolve) => {
          AutoFillOverlay.showPreview(plan, async () => {
            const r = await fillPage(profile, { preview: false, delay, highlightFilled });
            resolve(r);
          });
        });
      }
      return fillPage(profile, { preview: false, delay, highlightFilled });
    }

    return fillPage(profile, { preview: false, delay, highlightFilled });
  }

  // ──────────────────────────────────────────────
  // MutationObserver for SPA / dynamic forms
  // ──────────────────────────────────────────────
  let observerActive = false;
  function startObserver() {
    if (observerActive) return;
    observerActive = true;
    const observer = new MutationObserver(() => {
      // Re-initialise adapters when DOM changes significantly
      // (e.g. a new form section loads)
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────
  function init() {
    initAdapters();
    startObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { fillPage, runFillFromUI, getAdapter };
})();

if (typeof window !== 'undefined') {
  window.AutoFill = AutoFill;
}
