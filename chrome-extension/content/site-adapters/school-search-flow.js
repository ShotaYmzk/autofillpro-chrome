'use strict';

/**
 * 複数サイトで共通しがちな「学校検索ウィザード」向け。
 * - 条件指定: form1 + gkbn / gon / dken（school-search 相当）
 * - 学校一覧から選択: form1 + 大学名ラジオ群（change-school 等）
 * - 学部・研究科選択: faculty-select 等（研究科・学部系ラジオ）
 * - 学科・専攻 + 申告文理: dept-select 等
 * ホスト名に依存せず DOM で判定する。
 */
const SchoolSearchFlowAdapter = {
  name: 'school-search-flow',
  priority: 12,

  matches() {
    try {
      return (
        this._isSchoolSearchPage() ||
        this._isSchoolPickPage() ||
        this._isDeptSelectPage() ||
        this._isFacultySelectPage()
      );
    } catch (_) {
      return false;
    }
  },

  _norm(s) {
    return String(s || '').replace(/\s/g, '');
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
    return idx >= 0 ? String(idx + 1) : '';
  },

  _form1() {
    return document.querySelector('form[name="form1"]');
  },

  _isSchoolSearchPage() {
    try {
      const hasForm = this._form1() && document.querySelector('input[type="radio"][name="gkbn"]');
      if (!hasForm) return false;
      const org = document.querySelector('input[name="org_action"][value="school-search"]');
      if (org) return true;
      return /school-search/i.test(location.pathname);
    } catch (_) {
      return false;
    }
  },

  _escIdent(s) {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(s)) : String(s);
  },

  _radioNameCounts(form, extraSkip = new Set()) {
    const skip = new Set(['gkbn', 'gon', 'dken']);
    for (const x of extraSkip) {
      if (x) skip.add(x);
    }
    const counts = Object.create(null);
    if (!form) return counts;
    for (const r of form.querySelectorAll('input[type="radio"]')) {
      const n = r.name;
      if (!n || skip.has(n)) continue;
      counts[n] = (counts[n] || 0) + 1;
    }
    return counts;
  },

  _largestRadioName(counts, minN, maxN) {
    let best = '';
    let bestN = 0;
    for (const n of Object.keys(counts)) {
      const c = counts[n];
      if (c < minN || c > maxN) continue;
      if (c > bestN) {
        bestN = c;
        best = n;
      }
    }
    return bestN >= minN ? best : '';
  },

  /** gkbn / gon / dken 以外で最も件数が多いラジオ名（学校一覧用） */
  _getSchoolListRadioName(form) {
    const counts = this._radioNameCounts(form);
    return this._largestRadioName(counts, 4, 999);
  },

  /** 学部・研究科一覧（件数は少なめでも可） */
  _getFacultySelectRadioName(form) {
    const counts = this._radioNameCounts(form);
    return this._largestRadioName(counts, 2, 40);
  },

  _radioLabelText(radio) {
    if (!radio) return '';
    if (radio.id) {
      const lab = document.querySelector(`label[for="${this._escIdent(radio.id)}"]`);
      if (lab) return (lab.textContent || '').trim();
    }
    const wrap = radio.closest('label');
    if (wrap) return (wrap.textContent || '').replace(/\s+/g, ' ').trim();
    const li = radio.closest('li');
    if (li) return (li.textContent || '').replace(/\s+/g, ' ').trim();
    return '';
  },

  _isSchoolPickPage() {
    const form = this._form1();
    if (!form || this._isSchoolSearchPage()) return false;
    const radioName = this._getSchoolListRadioName(form);
    if (!radioName) return false;
    const radios = [...form.querySelectorAll(`input[type="radio"][name="${this._escIdent(radioName)}"]`)];
    if (radios.length < 4) return false;
    let eduLike = 0;
    for (const r of radios) {
      const t = this._radioLabelText(r);
      if (/大学|学院|学園|学校|高専|短期大学/u.test(t)) eduLike++;
    }
    return eduLike >= 3;
  },

  _bunriRadioName(form) {
    if (!form) return '';
    const skip = new Set(['gkbn', 'gon', 'dken']);
    const byName = Object.create(null);
    for (const r of form.querySelectorAll('input[type="radio"]')) {
      const n = r.name;
      if (!n || skip.has(n)) continue;
      if (!byName[n]) byName[n] = [];
      byName[n].push(r);
    }
    for (const [name, list] of Object.entries(byName)) {
      if (list.length !== 2) continue;
      const texts = list.map((r) => this._norm(this._radioLabelText(r)));
      const s = new Set(texts);
      if (s.has(this._norm('文系')) && s.has(this._norm('理系'))) return name;
    }
    return '';
  },

  _getDeptSelectRadioName(form) {
    if (!form) return '';
    const bun = this._bunriRadioName(form);
    const extra = new Set(bun ? [bun] : []);
    const counts = this._radioNameCounts(form, extra);
    return this._largestRadioName(counts, 4, 99);
  },

  _isDeptSelectPage() {
    const form = this._form1();
    if (!form || this._isSchoolSearchPage() || this._isSchoolPickPage()) return false;
    if (/dept-select|deptselect/i.test(location.pathname)) return true;
    const bun = this._bunriRadioName(form);
    if (!bun) return false;
    const deptN = this._getDeptSelectRadioName(form);
    if (!deptN) return false;
    const radios = [...form.querySelectorAll(`input[type="radio"][name="${this._escIdent(deptN)}"]`)];
    let senko = 0;
    for (const r of radios) {
      if (/専攻|学科/u.test(this._radioLabelText(r))) senko++;
    }
    return senko >= Math.min(3, radios.length);
  },

  _isFacultySelectPage() {
    const form = this._form1();
    if (!form || this._isSchoolSearchPage() || this._isSchoolPickPage()) return false;
    if (/dept-select|deptselect/i.test(location.pathname)) return false;
    const radioName = this._getFacultySelectRadioName(form);
    if (!radioName) return false;
    const radios = [...form.querySelectorAll(`input[type="radio"][name="${this._escIdent(radioName)}"]`)];
    if (radios.length < 2) return false;
    let facLike = 0;
    for (const r of radios) {
      const t = this._radioLabelText(r);
      if (/研究科|学部|学群|学域(?:制度)?|専攻|学科|カリキュラム|その他/u.test(t)) facLike++;
    }
    const pathHit = /faculty-select|facultyselect/i.test(location.pathname);
    if (pathHit) return true;
    return facLike >= Math.max(2, Math.ceil(radios.length * 0.35));
  },

  /** gkbn: 3大学 2修士院 1博士院 4短大 7高専 8専門 9高校 A外国大学日本校 B外国大学 */
  _gkbnValue(profile) {
    const e = profile.education || {};
    const type = String(e.schoolType || '');
    const deg = String(e.degree || '').trim();

    if (/外国大学日本校/.test(type)) return 'A';
    if (/外国大学/.test(type)) return 'B';
    if (/高等学校/.test(type) || /高校/.test(type)) return '9';
    if (/専門学校/.test(type)) return '8';
    if (/高等専門/.test(type)) return '7';
    if (/短期大学|短大/.test(type)) return '4';
    if (/大学院/.test(type)) {
      if (/博士/.test(type) || deg === '博士') return '1';
      return '2';
    }
    // 「大学院」より後で判定（サブストリングでの誤爆を避ける）
    if (type === '大学') return '3';
    return '';
  },

  _schoolPrefectureName(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    const fromEdu = (
      isGrad
        ? (e.gradSchoolPref || e.univPref || '')
        : (e.univPref || e.gradSchoolPref || '')
    ).trim();
    if (fromEdu) return fromEdu;
    return String(profile.contact?.prefecture || '').trim();
  },

  _firstKatakanaForGon(flat) {
    let raw = String(flat.schoolSearchInitial || '').trim();
    if (!raw) return '';
    if (typeof FuriganaUtil !== 'undefined' && FuriganaUtil.toKatakana) {
      raw = FuriganaUtil.toKatakana(raw);
    }
    for (const ch of raw) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x30a1 && cp <= 0x30fa) return ch;
      if (cp >= 0x30fd && cp <= 0x30ff) return ch;
    }
    return '';
  },

  _pickGonRadio(firstKat) {
    if (!firstKat) return null;
    const radios = [...document.querySelectorAll('input[type="radio"][name="gon"]')];
    for (const r of radios) {
      const v = r.value || '';
      if (v.includes(firstKat)) return r;
    }
    return null;
  },

  _radioByGkbnValue(val) {
    if (!val) return null;
    try {
      return document.querySelector(`input[type="radio"][name="gkbn"][value="${this._escIdent(val)}"]`);
    } catch (_) {
      return null;
    }
  },

  _radioByDkenValue(code) {
    if (!code) return null;
    try {
      return document.querySelector(`input[type="radio"][name="dken"][value="${this._escIdent(code)}"]`);
    } catch (_) {
      return null;
    }
  },

  _skipsInitialAndLocation(gkbnVal) {
    return gkbnVal === '8' || gkbnVal === '9' || gkbnVal === 'A' || gkbnVal === 'B';
  },

  _schoolNameCandidates(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    const primary = (
      isGrad ? e.gradSchoolName || e.univName : e.univName || e.gradSchoolName || ''
    ).trim();
    if (!primary) return [];
    const out = [];
    const push = (s) => {
      const t = String(s || '').trim();
      if (t && !out.includes(t)) out.push(t);
    };
    push(primary);
    push(primary.replace(/大学院大学$/u, ''));
    push(primary.replace(/（[^）]*）$/u, '').trim());
    push(primary.replace(/大学院$/u, ''));
    const stripped = primary.replace(/大学院.*$/u, '');
    push(stripped);
    if (!/大学$/u.test(stripped) && stripped.length >= 2) push(`${stripped}大学`);
    return out;
  },

  _pickSchoolListRadio(form, radioName, candidates) {
    const norm = (x) => this._norm(String(x)).toLowerCase();
    const radios = [
      ...form.querySelectorAll(`input[type="radio"][name="${this._escIdent(radioName)}"]`),
    ];
    const opts = radios.map((r) => ({
      el: r,
      text: norm(this._radioLabelText(r)),
    })).filter((o) => o.text);

    const variants = [...new Set(candidates.map(norm).filter(Boolean))];
    if (!variants.length || !opts.length) return null;

    const uniqHits = (pred) => {
      const hits = opts.filter(pred);
      return hits.length === 1 ? hits[0].el : null;
    };

    for (const vn of variants) {
      const hit = uniqHits((o) => o.text === vn);
      if (hit) return hit;
    }
    for (const vn of variants) {
      const hit = uniqHits((o) => o.text.startsWith(vn) || vn.startsWith(o.text));
      if (hit) return hit;
    }
    for (const vn of variants) {
      const hits = opts.filter((o) => o.text.includes(vn) || vn.includes(o.text));
      if (hits.length === 1) return hits[0].el;
    }
    const sorted = [...variants].sort((a, b) => b.length - a.length);
    for (const vn of sorted) {
      const hits = opts.filter((o) => o.text.includes(vn));
      if (hits.length >= 1) {
        hits.sort((a, b) => a.text.length - b.text.length);
        return hits[0].el;
      }
    }
    return null;
  },

  _safeDomClick(el) {
    if (!el) return false;
    try {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.click();
      return true;
    } catch (_) {
      return false;
    }
  },

  _findNextStepLink() {
    const links = [...document.querySelectorAll('a[href*="nextpage"], a.btn_w160b, a[class*="btn_"]')];
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

  _facultyLabelCandidates(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    const primary = (
      isGrad ? e.gradFaculty || e.faculty : e.faculty || e.gradFaculty || ''
    ).trim();
    if (!primary) return [];
    const out = [];
    const push = (s) => {
      const t = String(s || '').trim();
      if (t && !out.includes(t)) out.push(t);
    };
    push(primary);
    push(primary.replace(/（[^）]*）$/u, '').trim());
    push(primary.replace(/\s+/g, ''));
    return out;
  },

  _deptLabelCandidates(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    const primary = (
      isGrad ? e.gradDept || e.dept : e.dept || e.gradDept || ''
    ).trim();
    if (!primary) return [];
    const out = [];
    const push = (s) => {
      const t = String(s || '').trim();
      if (t && !out.includes(t)) out.push(t);
    };
    push(primary);
    push(primary.replace(/（[^）]*）$/u, '').trim());
    push(primary.replace(/\s+/g, ''));
    return out;
  },

  _pickDeclaredStreamRadio(form, profile) {
    const want = String(profile.education?.declaredStream || '').trim();
    if (!want) return null;
    if (!/^(文系|理系)$/.test(want)) return null;
    const name = this._bunriRadioName(form);
    if (!name) return null;
    const radios = [
      ...form.querySelectorAll(`input[type="radio"][name="${this._escIdent(name)}"]`),
    ];
    const nw = this._norm(want);
    for (const r of radios) {
      const lab = this._norm(this._radioLabelText(r));
      if (lab === nw || lab.includes(nw) || nw.includes(lab)) return r;
    }
    return null;
  },

  extendFillPlan(profile, existingPlan) {
    if (!this.matches()) return [];

    const used = new Set(existingPlan.map((p) => p.el));
    const extra = [];

    const add = (el, key, val) => {
      if (!el || val === undefined || val === null || String(val) === '') return;
      if (used.has(el)) return;
      used.add(el);
      extra.push({ el, key, value: String(val) });
    };

    if (this._isSchoolPickPage()) {
      const form = this._form1();
      const radioName = this._getSchoolListRadioName(form);
      const candidates = this._schoolNameCandidates(profile);
      const picked = this._pickSchoolListRadio(form, radioName, candidates);
      if (picked) add(picked, 'schoolListPick', picked.value);
      return extra;
    }

    if (this._isDeptSelectPage()) {
      const form = this._form1();
      const deptRn = this._getDeptSelectRadioName(form);
      if (deptRn) {
        const candidates = this._deptLabelCandidates(profile);
        const picked = this._pickSchoolListRadio(form, deptRn, candidates);
        if (picked) add(picked, 'deptSelectPick', picked.value);
      }
      const bunEl = this._pickDeclaredStreamRadio(form, profile);
      if (bunEl) add(bunEl, 'declaredStream', bunEl.value);
      return extra;
    }

    if (this._isFacultySelectPage()) {
      const form = this._form1();
      const radioName = this._getFacultySelectRadioName(form);
      const candidates = this._facultyLabelCandidates(profile);
      const picked = this._pickSchoolListRadio(form, radioName, candidates);
      if (picked) add(picked, 'facultySelectPick', picked.value);
      return extra;
    }

    if (!this._isSchoolSearchPage()) return [];

    const flat = FieldMatcher.flattenProfile(profile);

    const gkbnVal = this._gkbnValue(profile);
    const gkbnRadio = this._radioByGkbnValue(gkbnVal);
    if (gkbnRadio) add(gkbnRadio, 'schoolType', gkbnRadio.value);

    const dkenCb = document.querySelector('input[type="checkbox"][name="dken_search"]');
    if (dkenCb && this._skipsInitialAndLocation(gkbnVal)) {
      add(dkenCb, 'dken_search', 'false');
    } else {
      if (dkenCb && !dkenCb.checked) add(dkenCb, 'dken_search', 'true');

      const prefName = this._schoolPrefectureName(profile);
      let dkenCode = this._prefectureToCode(prefName);
      if (!dkenCode && /^[0-9]{1,2}$/.test(prefName.trim())) dkenCode = prefName.trim();
      const dkenRadio = this._radioByDkenValue(dkenCode);
      if (dkenRadio) add(dkenRadio, 'univPref', dkenRadio.value);
    }

    if (!this._skipsInitialAndLocation(gkbnVal)) {
      const firstKat = this._firstKatakanaForGon(flat);
      const gonRadio = this._pickGonRadio(firstKat);
      if (gonRadio) add(gonRadio, 'schoolSearchInitial', gonRadio.value);
    }

    return extra;
  },

  fillElement(el, value) {
    if (!this.matches()) return GenericAdapter.fillElement(el, value);
    if (el && el.type === 'radio') {
      const n = el.name || '';
      if (n === 'gkbn' || n === 'gon' || n === 'dken') {
        try {
          el.click();
          return el.checked;
        } catch (_) {
          return GenericAdapter.fillElement(el, value);
        }
      }
      const form = el.form || this._form1();
      if (form && this._isSchoolPickPage() && this._getSchoolListRadioName(form) === n) {
        try {
          el.click();
          return el.checked;
        } catch (_) {
          return GenericAdapter.fillElement(el, value);
        }
      }
      if (form && this._isFacultySelectPage() && this._getFacultySelectRadioName(form) === n) {
        try {
          el.click();
          return el.checked;
        } catch (_) {
          return GenericAdapter.fillElement(el, value);
        }
      }
      if (form && this._isDeptSelectPage()) {
        const br = this._bunriRadioName(form);
        const dr = this._getDeptSelectRadioName(form);
        if ((br && n === br) || (dr && n === dr)) {
          try {
            el.click();
            return el.checked;
          } catch (_) {
            return GenericAdapter.fillElement(el, value);
          }
        }
      }
    }
    return GenericAdapter.fillElement(el, value);
  },

  /**
   * 学校一覧 / 学部・研究科で選択した直後に「次へ」を押す（同一ウィザード用）
   */
  async runAfterPageFill(profile, { delay = 50, plan = [] } = {}) {
    if (!this.matches()) return 0;
    if (this._isDeptSelectPage()) {
      const rows = plan.filter((p) => p.key === 'deptSelectPick' || p.key === 'declaredStream');
      if (!rows.length) return 0;
      if (!rows.every((r) => r.el?.checked)) return 0;
      await new Promise((r) => setTimeout(r, Math.max(delay, 100)));
      const nextA = this._findNextStepLink();
      if (nextA && this._safeDomClick(nextA)) return 1;
      return 0;
    }
    const pickKey = this._isSchoolPickPage()
      ? 'schoolListPick'
      : this._isFacultySelectPage()
        ? 'facultySelectPick'
        : null;
    if (!pickKey) return 0;
    if (!plan.some((p) => p.key === pickKey)) return 0;
    const row = plan.find((p) => p.key === pickKey);
    if (!row?.el?.checked) return 0;
    await new Promise((r) => setTimeout(r, Math.max(delay, 100)));
    const nextA = this._findNextStepLink();
    if (nextA && this._safeDomClick(nextA)) return 1;
    return 0;
  },
};

if (typeof window !== 'undefined') {
  window.SchoolSearchFlowAdapter = SchoolSearchFlowAdapter;
}
