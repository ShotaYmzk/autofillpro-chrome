'use strict';

/**
 * エントリーシート系（複数社で似たレイアウトのことが多い）
 * - formConfirm など + 現住所 gyubin1/gyubin2/gken/gadrs* + 携帯 kttel* + 休暇 kyubin1/kyubin2/kken/kadrs*
 * 学校検索ウィザード（gkbン等）とは分離して判定する。
 */
const EntrySheetAdapter = {
  name: 'entry-sheet',
  priority: 11,

  _esc(s) {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(s)) : String(s);
  },

  _esRootSelector(form) {
    if (!form) return '';
    if (form.id) return `#${this._esc(form.id)}`;
    if (form.name) return `form[name="${this._esc(form.name)}"]`;
    return '';
  },

  _isMufgEsHost() {
    return /(?:^|\.)mypage\.bk\.mufg\.jp$/i.test(location.hostname);
  },

  _looksLikeEsForm(form) {
    if (!form) return false;
    if (form.querySelector('input[type="radio"][name="gkbn"]')) return false;
    return !!(
      form.querySelector('select[name="gken"]') &&
      form.querySelector('input[name="gyubin1"]') &&
      form.querySelector('input[name="gadrs1"]')
    );
  },

  _looksLikeMufgBasicForm(form) {
    if (!form || !this._isMufgEsHost()) return false;
    return !!(
      form.querySelector('input[name="kname1"]') &&
      form.querySelector('select[name="gken"]') &&
      form.querySelector('input[name="gyubin1"]')
    );
  },

  _esForm() {
    if (this._isMufgEsHost()) {
      const mufgForm = document.querySelector('form[name="form1"]');
      if (mufgForm && (this._looksLikeEsForm(mufgForm) || this._looksLikeMufgBasicForm(mufgForm))) {
        return mufgForm;
      }
    }
    const idForm = document.querySelector('form#formConfirm');
    if (idForm && this._looksLikeEsForm(idForm)) return idForm;
    const named = document.querySelector('form[name="formConfirm"]');
    if (named && this._looksLikeEsForm(named)) return named;
    for (const f of document.querySelectorAll('form')) {
      if (this._looksLikeEsForm(f)) return f;
    }
    return null;
  },

  matches() {
    try {
      return !!this._esForm();
    } catch (_) {
      return false;
    }
  },

  _prefectureToCode(prefName) {
    const names = [
      '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
      '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
      '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
      '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
      '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
      '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
      '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
    ];
    const p = String(prefName || '').trim();
    if (!p) return '';
    if (/国外|海外/.test(p)) return '99';
    const idx = names.indexOf(p);
    if (idx >= 0) return String(idx + 1);
    const m = /^0*(\d{1,2})$/.exec(p);
    if (m) return String(Number(m[1], 10));
    return '';
  },

  _prefectureToSelectValue(pref) {
    const raw = String(pref || '').trim();
    if (!raw) return '';
    const code = this._prefectureToCode(raw);
    if (code && /^\d+$/.test(code)) return code.padStart(2, '0');
    return raw;
  },

  mapFlat(profile) {
    const flat = FieldMatcher.flattenProfile(profile);
    const pref = this._prefectureToSelectValue(flat.prefecture);
    let out = { ...flat, prefecture: pref || flat.prefecture };
    if (profile.contact?.vacationSameAsCurrent) return out;
    if (typeof VacationContact === 'undefined') return out;
    const enriched = VacationContact.enrichFlat(out, profile.contact);
    const hp = this._prefectureToSelectValue(enriched.prefectureVacation);
    return {
      ...enriched,
      prefectureVacation: hp || enriched.prefectureVacation,
    };
  },

  getOverrides() {
    const form = this._esForm();
    const p = this._esRootSelector(form);
    if (!p) return {};
    return {
      lastName: `${p} input[name="kname1"]`,
      firstName: `${p} input[name="kname2"]`,
      lastKana: `${p} input[name="yname1"]`,
      firstKana: `${p} input[name="yname2"]`,
      dobYear: `${p} select#ybirth,${p} select[name="ybirth"]`,
      dobMonth: `${p} select#mbirth,${p} select[name="mbirth"]`,
      dobDay: `${p} select#dbirth,${p} select[name="dbirth"]`,
      zip1: `${p} input[name="gyubin1"]`,
      zip2: `${p} input[name="gyubin2"]`,
      prefecture: `${p} select[name="gken"]`,
      building: `${p} input[name="gadrs2"]`,
      mobile1: `${p} input[name="kttel1"]`,
      mobile2: `${p} input[name="kttel2"]`,
      mobile3: `${p} input[name="kttel3"]`,
      zipVacation1: `${p} input[name="kyubin1"]`,
      zipVacation2: `${p} input[name="kyubin2"]`,
      prefectureVacation: `${p} select[name="kken"]`,
      buildingVacation: `${p} input[name="kadrs2"]`,
      gradYear: `${p} select[name="syear"]`,
      gradMonth: `${p} select[name="smonth"]`,
      graduationStatus: `${p} select[name="shikbn"]`,
    };
  },

  _splitEmail(email) {
    const raw = String(email || '').trim();
    const at = raw.indexOf('@');
    if (at <= 0) return { local: '', domain: '' };
    return { local: raw.slice(0, at), domain: raw.slice(at + 1) };
  },

  _addTelRow(form, add, prefix, a, b, c, keyBase) {
    const t1 = form.querySelector(`input[name="${prefix}1"]`);
    const t2 = form.querySelector(`input[name="${prefix}2"]`);
    const t3 = form.querySelector(`input[name="${prefix}3"]`);
    if (a != null && a !== '' && t1) add(t1, `${keyBase}1`, a);
    if (b != null && b !== '' && t2) add(t2, `${keyBase}2`, b);
    if (c != null && c !== '' && t3) add(t3, `${keyBase}3`, c);
  },

  /**
   * 文系=1 / 理系=2（NRI 等の hidden brkbn でよく見る対応。サイトによって逆の場合は要調整）
   */
  _bunriCode(declaredStream) {
    const s = String(declaredStream || '').trim();
    if (s === '理系') return '2';
    if (s === '文系') return '1';
    return '';
  },

  extendFillPlan(profile, existingPlan) {
    if (!this.matches()) return [];
    const form = this._esForm();
    if (!form) return [];

    const used = new Set(existingPlan.map((row) => row.el));
    const extra = [];
    const add = (el, key, val) => {
      if (!el || val === undefined || val === null || String(val) === '') return;
      if (used.has(el)) return;
      used.add(el);
      extra.push({ el, key, value: String(val) });
    };

    const flat = this.mapFlat(profile);
    const c = profile.contact || {};

    const lineMain = `${flat.city || ''}${flat.address || ''}`.trim();
    const g1 = form.querySelector('input[name="gadrs1"]');
    if (g1 && lineMain) add(g1, 'address', lineMain);

    const mainMail = this._splitEmail(flat.email);
    if (mainMail.local) {
      add(form.querySelector('input[name="account1"]'), 'email', mainMail.local);
      add(form.querySelector('input[name="domain1"]'), 'email', mainMail.domain);
      add(form.querySelector('input[name="account2"]'), 'emailConfirm', mainMail.local);
      add(form.querySelector('input[name="domain2"]'), 'emailConfirm', mainMail.domain);
    }
    const subMail = this._splitEmail(flat.emailSub1);
    if (subMail.local) {
      add(form.querySelector('input[name="account3"]'), 'emailSub1', subMail.local);
      add(form.querySelector('input[name="domain3"]'), 'emailSub1', subMail.domain);
      add(form.querySelector('input[name="account4"]'), 'secondaryEmailConfirm', subMail.local);
      add(form.querySelector('input[name="domain4"]'), 'secondaryEmailConfirm', subMail.domain);
    }

    this._addTelRow(form, add, 'gtel', flat.homePhone1, flat.homePhone2, flat.homePhone3, 'homePhone');

    if (!c.vacationSameAsCurrent) {
      this._addTelRow(
        form,
        add,
        'ktel',
        flat.telVacation1,
        flat.telVacation2,
        flat.telVacation3,
        'telVacation'
      );
      const kad = form.querySelector('input[name="kadrs1"]');
      const vacLine = String(flat.vacationAddressLine || '').trim();
      if (kad && vacLine) add(kad, 'vacationAddressLine', vacLine);
    }

    const bikoaEl = form.querySelector('input[name="bikoa"]');
    const sem = String(flat.seminarLab || '').trim();
    if (bikoaEl && sem) add(bikoaEl, 'seminarLab', sem);
    const bikobEl = form.querySelector('input[name="bikob"]');
    const club = String(flat.clubCircle || '').trim();
    if (bikobEl && club) add(bikobEl, 'clubCircle', club);

    const bCode = this._bunriCode(flat.declaredStream);
    if (bCode) {
      for (const nm of ['brkbn', 's_brkbn']) {
        const hi = form.querySelector(`input[type="hidden"][name="${nm}"]`);
        if (hi) add(hi, 'declaredStream', bCode);
      }
    }

    return extra;
  },

  fillElement(el, value) {
    return GenericAdapter.fillElement(el, value);
  },
};

if (typeof window !== 'undefined') {
  window.EntrySheetAdapter = EntrySheetAdapter;
}
