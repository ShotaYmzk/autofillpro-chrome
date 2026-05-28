'use strict';

/**
 * sonar ATS 応募者マイページ (*.snar.jp)
 * ASP.NET WebForms（form#form1）の tbx_* / ddl_* 命名に合わせて入力する。
 */
const SnarAdapter = {
  name: 'snar',
  priority: 10,

  matches() {
    return /\.snar\.jp$/i.test(location.hostname);
  },

  _esc(s) {
    if (s == null || s === '') return s;
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(String(s));
    return String(s).replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
  },

  _form() {
    return document.querySelector('form#form1') || document.querySelector('form[name="form1"]');
  },

  _rootSel() {
    const f = this._form();
    if (!f) return '';
    if (f.id) return `#${this._esc(f.id)}`;
    return `form[name="${this._esc(f.name)}"]`;
  },

  _splitPhoneParts(flat, base) {
    const a = String(flat[`${base}1`] || '').trim();
    const b = String(flat[`${base}2`] || '').trim();
    const c = String(flat[`${base}3`] || '').trim();
    if (a || b || c) return [a, b, c];
    const combined = String(flat[base] || '').trim();
    if (!combined) return ['', '', ''];
    const parts = combined.replace(/[^\d]/g, '');
    if (parts.length >= 10) {
      if (parts.length === 11 && /^0[789]0/.test(parts)) {
        return [parts.slice(0, 3), parts.slice(3, 7), parts.slice(7)];
      }
      if (parts.length === 10) {
        return [parts.slice(0, 3), parts.slice(3, 6), parts.slice(6)];
      }
    }
    const dashed = combined.split(/[-−－]/);
    if (dashed.length >= 3) return [dashed[0], dashed[1], dashed[2]];
    return [a, b, c];
  },

  _addTelRow(form, add, prefixes, flat, base, keyBase) {
    const [p1, p2, p3] = this._splitPhoneParts(flat, base);
    const suffixSets = [
      ['1', '2', '3'],
      ['11', '12', '13'],
    ];
    for (const prefix of prefixes) {
      for (const [s1, s2, s3] of suffixSets) {
        const t1 = form.querySelector(`input[name="${prefix}${s1}"]`);
        const t2 = form.querySelector(`input[name="${prefix}${s2}"]`);
        const t3 = form.querySelector(`input[name="${prefix}${s3}"]`);
        if (!t1 && !t2 && !t3) continue;
        if (p1 && t1) add(t1, `${keyBase}1`, p1);
        if (p2 && t2) add(t2, `${keyBase}2`, p2);
        if (p3 && t3) add(t3, `${keyBase}3`, p3);
        return true;
      }
    }
    return false;
  },

  _parseDobParts(flat) {
    let y = String(flat.dobYear || '').trim();
    let m = String(flat.dobMonth || '').trim();
    let d = String(flat.dobDay || '').trim();
    if (y && m && d) return { y, m, d };
    const raw = String(flat.dob || '').trim();
    const m1 = raw.match(/^(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
    if (m1) return { y: m1[1], m: m1[2], d: m1[3] };
    return { y, m, d };
  },

  _fillSnarSelect(el, value, unit) {
    if (!el || el.tagName !== 'SELECT' || value === undefined || value === null) return false;
    const raw = String(value).trim();
    if (!raw) return false;

    const num = parseInt(raw, 10);
    const suffix = unit === 'year' ? '年' : unit === 'month' ? '月' : '日';
    const tries = new Set([raw]);
    if (!isNaN(num)) {
      tries.add(String(num));
      if (unit === 'month' || unit === 'day') {
        tries.add(String(num).padStart(2, '0'));
      }
      tries.add(`${num}${suffix}`);
    }

    for (const t of tries) {
      if (GenericAdapter.fillElement(el, t)) return true;
    }

    if (!isNaN(num)) {
      for (const opt of el.options) {
        const text = String(opt.textContent || opt.text || '').trim();
        const val = String(opt.value || '').trim();
        if (!val) continue;
        if (text === `${num}${suffix}` || text === String(num)) {
          return GenericAdapter.fillElement(el, val);
        }
        if ((unit === 'month' || unit === 'day') && parseInt(text, 10) === num) {
          return GenericAdapter.fillElement(el, val);
        }
      }
    }
    return false;
  },

  async _waitForSelectOptions(sel, minOptions, timeout = 4000) {
    if (!sel) return false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const n = [...sel.options].filter((o) => String(o.value || '').trim() !== '').length;
      if (n >= minOptions) return true;
      await sleep(80);
    }
    return [...sel.options].filter((o) => String(o.value || '').trim() !== '').length >= minOptions;
  },

  /** 生年月日は年変更後に月・日の option が更新される SNAR 向けカスケード */
  async _fillBirthCascade(form, flat, { delay = 50, highlightFilled = true } = {}) {
    const { y, m, d } = this._parseDobParts(flat);
    if (!y || !m || !d) return 0;

    const yearSel = form.querySelector(
      '#ddl_birthY,#ddl_birthy,select[name="ddl_birthY"],select[name="ddl_birthy"]'
    );
    const monthSel = form.querySelector(
      '#ddl_birthM,#ddl_birthm,select[name="ddl_birthM"],select[name="ddl_birthm"]'
    );
    const daySel = form.querySelector(
      '#ddl_birthD,#ddl_birthd,select[name="ddl_birthD"],select[name="ddl_birthd"]'
    );
    if (!yearSel || !monthSel || !daySel) return 0;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let filled = 0;

    if (this._fillSnarSelect(yearSel, y, 'year')) {
      filled++;
      if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
        AutoFillOverlay.highlightElement(yearSel, 'dobYear');
      }
      try {
        yearSel.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
      await sleep(Math.max(350, delay * 5));
      await this._waitForSelectOptions(monthSel, 1);
    } else {
      return filled;
    }

    if (this._fillSnarSelect(monthSel, m, 'month')) {
      filled++;
      if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
        AutoFillOverlay.highlightElement(monthSel, 'dobMonth');
      }
      try {
        monthSel.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
      await sleep(Math.max(250, delay * 4));
      await this._waitForSelectOptions(daySel, 1);
    } else {
      return filled;
    }

    if (this._fillSnarSelect(daySel, d, 'day')) {
      filled++;
      if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
        AutoFillOverlay.highlightElement(daySel, 'dobDay');
      }
    }

    return filled;
  },

  _fillTelRowById(form, add, rowId, flat, base, keyBase) {
    const row = form.querySelector(`#${rowId}`);
    if (!row) return false;
    const inputs = [...row.querySelectorAll('input[type="text"],input[type="tel"]')].filter((el) => {
      if (typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible) {
        return FieldMatcher.isFillableVisible(el);
      }
      return true;
    });
    if (inputs.length < 2) return false;
    const [p1, p2, p3] = this._splitPhoneParts(flat, base);
    const vals = [p1, p2, p3].slice(0, inputs.length);
    let ok = false;
    inputs.forEach((el, i) => {
      if (vals[i]) {
        add(el, `${keyBase}${i + 1}`, vals[i]);
        ok = true;
      }
    });
    return ok;
  },

  getOverrides() {
    const p = this._rootSel();
    if (!p) return {};
    return {
      lastName: `${p} input[name="tbx_sei"],${p} input[name="tbx_name1"],${p} input[name="tbx_lname"]`,
      firstName: `${p} input[name="tbx_mei"],${p} input[name="tbx_name2"],${p} input[name="tbx_fname"]`,
      lastKana: `${p} input[name="tbx_seik"],${p} input[name="tbx_kana1"],${p} input[name="tbx_sei_kana"]`,
      firstKana: `${p} input[name="tbx_meik"],${p} input[name="tbx_kana2"],${p} input[name="tbx_mei_kana"]`,
      gender: `${p} input[type=radio][name="rdo_sex"],${p} select[name="ddl_sex"]`,
      dob: `${p} input[name="tbx_birth"],${p} input.datePicker[name*="birth"]`,
      email: `${p} input[name="tbx_mail"]`,
      emailSub1: `${p} input[name="tbx_smail"]`,
      zip1: `${p} input[name="tbx_yubin1"],${p} input[name="tbx_zip1"],${p} input[name="tbx_zipcd1"]`,
      zip2: `${p} input[name="tbx_yubin2"],${p} input[name="tbx_zip2"],${p} input[name="tbx_zipcd2"]`,
      prefecture: `${p} select[name="ddl_ken"]`,
      city: `${p} input[name="tbx_addr1"]`,
      address: `${p} input[name="tbx_addr2"]`,
      building: `${p} input[name="tbx_addr3"]`,
      homeZip1: `${p} input[name="tbx_kzip1"]`,
      homeZip2: `${p} input[name="tbx_kzip2"]`,
      homePrefecture: `${p} select[name="ddl_kken"]`,
      homeCity: `${p} input[name="tbx_kaddr1"]`,
      homeAddress: `${p} input[name="tbx_kaddr2"]`,
      homeBuilding: `${p} input[name="tbx_kaddr3"]`,
      gradYear: `${p} select[name="ddl_sotsuyY"],${p} select[name="ddl_sotsuyy"]`,
      gradMonth: `${p} select[name="ddl_sotsuyM"],${p} select[name="ddl_sotsuym"]`,
    };
  },

  /** FieldMatcher が tbx_*tel* 3分割欄すべてに結合番号 mobile を当てるのを防ぐ */
  pruneFillPlan(plan) {
    if (!this.matches()) return plan;
    return plan.filter((row) => {
      const n = String(row.el?.name || '');
      const k = row.key;
      if (k === 'mobile' && /^tbx_(k?tel|keitai)\d*$/i.test(n)) return false;
      if (k === 'mobile' && row.el?.closest?.('#input18')) return false;
      if (k === 'homePhone' && /^tbx_tel/i.test(n)) return false;
      if (k === 'emailConfirm' && n === 'tbx_kmail') return false;
      if (k === 'emailSub1' && n === 'tbx_kmail') return false;
      if (/^ddl_birth/i.test(n) && /^dob(Y|Month|Day)$/i.test(k)) return false;
      return true;
    });
  },

  extendFillPlan(profile, existingPlan) {
    if (!this.matches()) return [];
    const form = this._form();
    if (!form) return [];

    const used = new Set(existingPlan.map((row) => row.el));
    const flat = FieldMatcher.flattenProfile(profile);
    const extra = [];
    const add = (el, key, val) => {
      if (!el || used.has(el) || val === undefined || val === null || String(val) === '') return;
      used.add(el);
      extra.push({ el, key, value: String(val) });
    };

    const main = String(flat.email || '').trim();
    if (main) {
      add(form.querySelector('input[name="tbx_mail_R"]'), 'emailConfirm', main);
    }
    const sub = String(flat.emailSub1 || '').trim();
    if (sub) {
      add(form.querySelector('input[name="tbx_smail_R"]'), 'secondaryEmailConfirm', sub);
    }

    this._addTelRow(form, add, ['tbx_ktel', 'tbx_keitai', 'tbx_kei'], flat, 'mobile', 'mobile');
    this._addTelRow(form, add, ['tbx_tel', 'tbx_jtel'], flat, 'homePhone', 'homePhone');
    if (!this._addTelRow(form, add, ['tbx_ktel', 'tbx_keitai', 'tbx_kei'], flat, 'mobile', 'mobile')) {
      this._fillTelRowById(form, add, 'input18', flat, 'mobile', 'mobile');
    }
    if (!this._addTelRow(form, add, ['tbx_tel', 'tbx_jtel'], flat, 'homePhone', 'homePhone')) {
      if (!this._fillTelRowById(form, add, 'input16', flat, 'homePhone', 'homePhone')) {
        this._fillTelRowById(form, add, 'input11', flat, 'homePhone', 'homePhone');
      }
    }

    const dob = this._formatSnarDate(flat);
    if (dob) {
      for (const el of form.querySelectorAll('input.datePicker, input.date')) {
        if (used.has(el)) continue;
        if (
          typeof FieldMatcher !== 'undefined' &&
          FieldMatcher.isFillableVisible &&
          !FieldMatcher.isFillableVisible(el)
        ) {
          continue;
        }
        used.add(el);
        extra.push({ el, key: 'dob', value: dob });
        break;
      }
    }

    return extra;
  },

  _formatSnarDate(flat) {
    const y = String(flat.dobYear || '').trim();
    const m = String(flat.dobMonth || '').trim();
    const d = String(flat.dobDay || '').trim();
    if (!y || !m || !d) return '';
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    return `${y}/${mm}/${dd}`;
  },

  _triggerAutoZip(form) {
    const hdn = form.querySelector('#hdn_AutoZip, input[name="hdn_AutoZip"]');
    if (hdn) hdn.value = '1';
    for (const sel of ['tbx_yubin2', 'tbx_zip2', 'tbx_zipcd2', 'tbx_kzip2']) {
      const zip2 = form.querySelector(`input[name="${sel}"]`);
      if (zip2) {
        try {
          zip2.dispatchEvent(new Event('blur', { bubbles: true }));
        } catch (_) {}
        break;
      }
    }
  },

  fillElement(el, value) {
    if (!el) return false;
    if (el.classList?.contains('tbx_password') && String(el.value || '') === 'パスワード') {
      return false;
    }
    if (el.type === 'password' && /password/i.test(String(el.name || el.id || ''))) {
      return false;
    }
    const nm = String(el.name || '');
    if (el.tagName === 'SELECT') {
      if (/^ddl_birthy$/i.test(nm)) return this._fillSnarSelect(el, value, 'year');
      if (/^ddl_birthm$/i.test(nm)) return this._fillSnarSelect(el, value, 'month');
      if (/^ddl_birthd$/i.test(nm)) return this._fillSnarSelect(el, value, 'day');
      if (/^ddl_sotsuyy$/i.test(nm)) return this._fillSnarSelect(el, value, 'year');
      if (/^ddl_sotsuym$/i.test(nm)) return this._fillSnarSelect(el, value, 'month');
    }
    if (el.classList?.contains('datePicker') || el.classList?.contains('date')) {
      const v = String(value || '').trim();
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) {
        const [y, m, d] = v.split('-');
        value = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
      }
    }
    return GenericAdapter.fillElement(el, value);
  },

  async runAfterPageFill(profile, { delay = 50, highlightFilled = true } = {}) {
    if (!this.matches()) return 0;
    const form = this._form();
    if (!form) return 0;

    const flat = FieldMatcher.flattenProfile(profile);
    let filled = 0;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (
      typeof VacationContact !== 'undefined' &&
      VacationContact.isVacationSameAsCurrent(profile)
    ) {
      const cb =
        form.querySelector('input[name="cbx_kflg"]') ||
        (typeof VacationContact.findSameAsCurrentCheckbox === 'function'
          ? VacationContact.findSameAsCurrentCheckbox(form)
          : null);
      if (cb && !cb.checked && GenericAdapter.fillElement(cb, 'true')) {
        filled++;
        await sleep(Math.max(delay, 80));
      }
    }

    if (form.querySelector('input[name="tbx_yubin1"], input[name="tbx_zip1"], input[name="tbx_kzip1"]')) {
      this._triggerAutoZip(form);
    }

    filled += await this._fillBirthCascade(form, flat, { delay, highlightFilled });

    return filled;
  },
};

if (typeof window !== 'undefined') {
  window.SnarAdapter = SnarAdapter;
}
