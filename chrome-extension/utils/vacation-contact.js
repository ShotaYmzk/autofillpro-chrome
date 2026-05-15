'use strict';

/**
 * 休暇中連絡先: 「現住所と同じ」設定時はフォームのチェックのみ、別住所時は帰省先（home*）を入力。
 * i-webs / Axol / Entry Sheet / 汎用マッチングのいずれでも autofill.js から適用する。
 */
const VacationContact = (() => {
  const VACATION_INPUT_NAMES =
    /^(kyubin\d|kken|kadrs\d|ktel\d|yubink_h|yubink_l|kenk|jushok\d|telk_h|telk_m|telk_l|vacation_|kyuka|kyusyoku)/i;

  const CURRENT_INPUT_NAMES =
    /^(gyubin\d|gken|gadrs\d|gtel\d|kttel\d|yubing_h|yubing_l|keng|jushog\d)$/i;

  const VACATION_PROFILE_KEYS = new Set([
    'zipVacation1',
    'zipVacation2',
    'prefectureVacation',
    'cityVacation',
    'addressVacation',
    'buildingVacation',
    'vacationAddressLine',
    'telVacation1',
    'telVacation2',
    'telVacation3',
    'telk1',
    'telk2',
    'telk3',
    'vacationSameAsCurrent',
    'jushosame',
  ]);

  const HOME_VACATION_PROFILE_KEYS = new Set([
    'homeZip1',
    'homeZip2',
    'homePrefecture',
    'homeCity',
    'homeAddress',
    'homeBuilding',
  ]);

  const CURRENT_ADDRESS_KEYS = new Set([
    'zip1',
    'zip2',
    'zip',
    'prefecture',
    'city',
    'address',
    'building',
    'homePhone1',
    'homePhone2',
    'homePhone3',
    ...HOME_VACATION_PROFILE_KEYS,
  ]);

  const CHECKBOX_NAMES = [
    'adch',
    'jushosame',
    'addrsame',
    'kjushosame',
    'sameflg',
    'same_flg',
    'address_same',
    'addr_same',
    'jusho_same',
  ];

  const VACATION_SECTION_RE = /休暇中|休暇先|長期休暇|休暇.*連絡|帰省先.*連絡/;
  const CURRENT_SECTION_RE = /現住所|現在の住所|現在の連絡先|在学中.*住所/;

  function isVacationSameAsCurrent(profile) {
    return !!(profile?.contact?.vacationSameAsCurrent);
  }

  function isVacationNamedElement(el) {
    const n = String(el?.name || '');
    if (VACATION_INPUT_NAMES.test(n)) return true;
    const id = String(el?.id || '');
    if (/vacation|kyuka|kyusyoku|休暇/i.test(id)) return true;
    return false;
  }

  function isCurrentNamedElement(el) {
    return CURRENT_INPUT_NAMES.test(String(el?.name || ''));
  }

  /** テーブル行・fieldset・見出しからブロック文脈を推定 */
  function collectSectionTexts(el) {
    const parts = [];
    const push = (t) => {
      const s = String(t || '').replace(/\s+/g, ' ').trim();
      if (s) parts.push(s);
    };
    let node = el;
    for (let depth = 0; depth < 10 && node; depth++) {
      if (node.tagName === 'TR') {
        const th = node.querySelector('th');
        if (th) push(th.textContent);
      }
      if (node.tagName === 'FIELDSET') {
        const leg = node.querySelector('legend');
        if (leg) push(leg.textContent);
      }
      const head = node.querySelector?.(':scope > h2, :scope > h3, :scope > h4, :scope > h5');
      if (head) push(head.textContent);
      node = node.parentElement;
    }
    return parts.join(' ');
  }

  function isVacationContextElement(el) {
    if (!el) return false;
    if (isVacationNamedElement(el)) return true;

    const section = collectSectionTexts(el);
    if (VACATION_SECTION_RE.test(section)) {
      if (!CURRENT_SECTION_RE.test(section)) return true;
      if (/休暇|帰省/.test(section)) return true;
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && VACATION_SECTION_RE.test(label.textContent || '')) return true;
    }
    const parentLabel = el.closest('label');
    if (parentLabel && VACATION_SECTION_RE.test(parentLabel.textContent || '')) return true;

    const td = el.closest('td');
    if (td) {
      const th = td.previousElementSibling;
      if (th && VACATION_SECTION_RE.test(th.textContent || '')) return true;
    }

    return false;
  }

  function isCurrentContextElement(el) {
    if (!el) return false;
    if (isCurrentNamedElement(el)) return true;
    const section = collectSectionTexts(el);
    return CURRENT_SECTION_RE.test(section) && !VACATION_SECTION_RE.test(section);
  }

  function isVacationField(el) {
    return isVacationNamedElement(el) || isVacationContextElement(el);
  }

  function shouldBlockCurrentKeyOnVacationElement(el, fieldKey) {
    if (!CURRENT_ADDRESS_KEYS.has(fieldKey)) return false;
    return isVacationField(el);
  }

  /** 現住所ブロックに休暇用キーが誤マッチするのを防ぐ */
  function shouldBlockVacationKeyOnCurrentElement(el, fieldKey) {
    if (!VACATION_PROFILE_KEYS.has(fieldKey)) return false;
    if (isVacationField(el)) return false;
    return isCurrentNamedElement(el) || isCurrentContextElement(el);
  }

  function enrichFlat(flat, contact) {
    const c = contact || {};
    const line = `${c.homeCity || ''}${c.homeAddress || ''}`.trim();
    return {
      ...flat,
      zipVacation1: flat.homeZip1 || '',
      zipVacation2: flat.homeZip2 || '',
      prefectureVacation: flat.homePrefecture || '',
      cityVacation: flat.homeCity || '',
      addressVacation: flat.homeAddress || '',
      buildingVacation: flat.homeBuilding || '',
      vacationAddressLine: line,
      telVacation1: flat.homePhone1 || '',
      telVacation2: flat.homePhone2 || '',
      telVacation3: flat.homePhone3 || '',
    };
  }

  function filterPlanWhenSame(plan, profile) {
    if (!isVacationSameAsCurrent(profile)) return plan;
    return plan.filter((row) => {
      if (isVacationField(row.el)) return false;
      if (VACATION_PROFILE_KEYS.has(row.key)) return false;
      if (HOME_VACATION_PROFILE_KEYS.has(row.key) && isVacationField(row.el)) return false;
      return true;
    });
  }

  function findSameAsCurrentCheckbox(root) {
    const scope = root || document;
    for (const n of CHECKBOX_NAMES) {
      const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(n) : n;
      const inp = scope.querySelector(`input[type=checkbox][name="${esc}"]`);
      if (inp) return inp;
    }
    for (const inp of scope.querySelectorAll('input[type=checkbox]')) {
      const n = String(inp.name || '');
      if (/same|同じ|doui/i.test(n) && /addr|jusho|renraku|contact|adch/i.test(n)) return inp;
    }
    for (const lab of scope.querySelectorAll('label')) {
      const t = lab.textContent || '';
      if (
        /現住所と同じ|現在の連絡先と同じ|現住所.*同じ|休暇.*現住所.*同じ|連絡先.*現住所.*同じ/.test(
          t
        )
      ) {
        const c = lab.querySelector('input[type=checkbox]');
        if (c) return c;
        const fid = lab.getAttribute('for');
        if (fid) {
          const el = scope.getElementById(fid);
          if (el && el.type === 'checkbox') return el;
        }
      }
    }
    return null;
  }

  function buildCheckboxFillRows(profile, plan) {
    if (!isVacationSameAsCurrent(profile)) return [];
    const used = new Set(plan.map((p) => p.el));
    const cb = findSameAsCurrentCheckbox();
    if (!cb || used.has(cb)) return [];
    return [{ el: cb, key: 'vacationSameAsCurrent', value: 'true' }];
  }

  /** autofill の最終段で呼ぶ（メール正規化の後） */
  function applyVacationPolicy(plan, profile) {
    let out = filterPlanWhenSame(plan, profile);
    for (const row of buildCheckboxFillRows(profile, out)) {
      out = out.filter((p) => p.el !== row.el);
      out.push(row);
    }
    return out;
  }

  return {
    isVacationSameAsCurrent,
    isVacationNamedElement,
    isVacationContextElement,
    isVacationField,
    shouldBlockCurrentKeyOnVacationElement,
    shouldBlockVacationKeyOnCurrentElement,
    enrichFlat,
    filterPlanWhenSame,
    findSameAsCurrentCheckbox,
    buildCheckboxFillRows,
    applyVacationPolicy,
    VACATION_PROFILE_KEYS,
    HOME_VACATION_PROFILE_KEYS,
  };
})();

if (typeof window !== 'undefined') {
  window.VacationContact = VacationContact;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VacationContact };
}
