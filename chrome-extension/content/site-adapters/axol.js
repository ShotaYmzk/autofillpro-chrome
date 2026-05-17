'use strict';

/**
 * Axol (axol.jp) — aligns with FormBuilder field names used on mast/top forms.
 * Reference: kanji_sei/na, keng (prefecture codes), kubun/kokushi/degree radios,
 * email + email2, kmail + kmail2, jushosame, school_from_Y/m, etc.
 */
const AxolAdapter = {
  name: 'axol',
  priority: 10,

  matches() {
    return /axol\.jp/i.test(location.hostname);
  },

  _norm(s) {
    return String(s || '').replace(/\s/g, '');
  },

  /** 現住所・休暇先・高校で共通の都道府県コード（1–47, 99=国外）— select は option 文言でもマッチするが保険でコードも算出 */
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
    if (/国外/.test(p)) return '99';
    const idx = names.indexOf(p);
    return idx >= 0 ? String(idx + 1) : '';
  },

  /**
   * `.form__item__title` テキストで親ブロックを取得（simple.css レイアウト）
   */
  _findItemByTitle(re) {
    for (const el of document.querySelectorAll('.form__item__title')) {
      const t = this._norm(el.textContent || '');
      if (re.test(t)) {
        const item =
          el.closest('.form__item') ||
          el.closest('[role="group"]') ||
          el.closest('.form__item__multi');
        return item || el.parentElement;
      }
    }
    return null;
  },

  _pickRadioInRoot(root, predicate) {
    if (!root) return null;
    const radios = root.querySelectorAll('input[type=radio]');
    const ordered = [...radios].sort((a, b) => {
      const la = this._norm(a.closest('label')?.textContent || '');
      const lb = this._norm(b.closest('label')?.textContent || '');
      return lb.length - la.length;
    });
    for (const r of ordered) {
      const lab = r.closest('label');
      const txt = this._norm(lab ? lab.textContent : '');
      if (predicate(txt, r)) return r;
    }
    return null;
  },

  /**
   * kubun のラベル向け。「大学」が「大学院」「短期大学」に誤マッチしないようにする。
   * 「専門学校」が「高等専門学校」に誤マッチしないようにする。
   */
  _schoolKindLabelSubstringMatches(labelNorm, wantNorm) {
    if (!labelNorm.includes(wantNorm)) return false;
    if (wantNorm === '大学') {
      if (/大学院/.test(labelNorm)) return false;
      if (/短期大学/.test(labelNorm)) return false;
    }
    if (wantNorm === '専門学校' && /高等専門/.test(labelNorm)) return false;
    return true;
  },

  _isFillableVisible(el) {
    if (typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible) {
      return FieldMatcher.isFillableVisible(el);
    }
    if (!el || !el.isConnected) return false;
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  },

  _radioLabelText(radio) {
    if (!radio) return '';
    if (radio.id) {
      try {
        const lab = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
        if (lab) return (lab.textContent || '').replace(/\s+/g, ' ').trim();
      } catch (_) {}
    }
    const wrap = radio.closest('label');
    if (wrap) return (wrap.textContent || '').replace(/\s+/g, ' ').trim();
    let sib = radio.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'LABEL') {
        const t = (sib.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) return t;
      }
      sib = sib.nextElementSibling;
    }
    const li = radio.closest('li');
    if (li) {
      const labOnly = li.querySelector('label');
      if (labOnly) return (labOnly.textContent || '').replace(/\s+/g, ' ').trim();
    }
    return '';
  },

  _visibleRadiosByName(inputName) {
    const esc =
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(inputName)) : inputName;
    return [...document.querySelectorAll(`input[type="radio"][name="${esc}"]`)].filter((r) =>
      this._isFillableVisible(r)
    );
  },

  /** kubun / degree など name が一意な Axol のラジオ（可視のみ） */
  _pickRadioByNameAndLabel(inputName, desiredLabel, opts = {}) {
    const schoolKind = !!opts.schoolKind;
    const exactOnly = !!opts.exactOnly;
    const want = this._norm(desiredLabel);
    if (!want) return null;
    const radios = this._visibleRadiosByName(inputName);
    radios.sort((a, b) => {
      const ta = this._norm(this._radioLabelText(a));
      const tb = this._norm(this._radioLabelText(b));
      return tb.length - ta.length;
    });
    for (const r of radios) {
      const txt = this._norm(this._radioLabelText(r));
      if (txt === want) return r;
    }
    if (exactOnly) return null;
    for (const r of radios) {
      const txt = this._norm(this._radioLabelText(r));
      if (schoolKind) {
        if (this._schoolKindLabelSubstringMatches(txt, want)) return r;
      } else if (txt.includes(want)) {
        return r;
      }
    }
    return null;
  },

  /** 設置区分 kokushi — ラベル完全一致のみ。value 1–4 でフォールバック */
  _pickKokushiRadio(setupLabel) {
    const want = String(setupLabel || '').trim();
    if (!want) return null;
    const byLabel = this._pickRadioByNameAndLabel('kokushi', want, { exactOnly: true });
    if (byLabel) return byLabel;
    const valueMap = { 国立: '1', 公立: '2', 私立: '3', 日本国外: '4' };
    const code = valueMap[want];
    if (!code) return null;
    return (
      this._visibleRadiosByName('kokushi').find((r) => String(r.value) === code) || null
    );
  },

  _schoolKindLabel(type) {
    const t = String(type || '').trim();
    if (!t) return '';
    if (/大学院/.test(t)) return '大学院';
    if (/短期大学|短大/.test(t)) return '短期大学';
    if (/高等専門/.test(t)) return '高等専門学校';
    if (/専門学校/.test(t)) return '専門学校';
    // 「大学院」「短期大学」より後で判定。「国立大学」などを誤って大学にしない。
    if (t === '大学' || /^大学[（(]/.test(t)) return '大学';
    return '';
  },

  /** 同一 name が複製されている DOM があるため、自動入力対象として可視フィールドのみ採る */
  _firstVisibleInputByName(name) {
    const nm = String(name || '');
    if (!nm) return null;
    const esc =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(nm) : nm;
    try {
      const list = document.querySelectorAll(`input[name="${esc}"]`);
      const vis =
        typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
          ? FieldMatcher.isFillableVisible
          : (el) => {
              if (!el || !el.isConnected) return false;
              let node = el;
              while (node && node.nodeType === Node.ELEMENT_NODE) {
                const style = window.getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                node = node.parentElement;
              }
              return true;
            };
      for (const el of list) {
        if (vis(el)) return el;
      }
    } catch (_) {}
    return document.querySelector(`input[name="${esc}"]`);
  },

  /** 「現在の連絡先と同じ」— axol の休暇ブロック */
  _findJushosameCheckbox() {
    const inp = document.querySelector('input[type=checkbox][name="jushosame"]');
    if (inp) return inp;
    for (const lab of document.querySelectorAll('label')) {
      const t = lab.textContent || '';
      if (/現在の連絡先と同じ/.test(t)) {
        const c = lab.querySelector('input[type=checkbox]');
        if (c) return c;
        const fid = lab.getAttribute('for');
        if (fid) {
          const el = document.getElementById(fid);
          if (el && el.type === 'checkbox') return el;
        }
      }
    }
    return null;
  },

  /**
   * name属性どおりのセレクタ（mast フォーム優先）。複数フォーム時は visibility で判定済みの要素が plan に載る。
   */
  getOverrides() {
    return {
      lastName: 'input[name="kanji_sei"]',
      firstName: 'input[name="kanji_na"]',
      lastKana: 'input[name="kana_sei"]',
      firstKana: 'input[name="kana_na"]',
      romajiLast: 'input[name="roma_sei"]',
      romajiFirst: 'input[name="roma_na"]',

      dobYear: 'select[name="birth_Y"]',
      dobMonth: 'select[name="birth_m"]',
      dobDay: 'select[name="birth_d"]',

      zip1: 'input[name="yubing_h"]',
      zip2: 'input[name="yubing_l"]',
      prefecture: 'select[name="keng"]',
      city: 'input[name="jushog1"]',
      address: 'input[name="jushog2"]',
      building: 'input[name="jushog3"]',

      homePhone1: 'input[name="telg_h"]',
      homePhone2: 'input[name="telg_m"]',
      homePhone3: 'input[name="telg_l"]',
      mobile1: 'input[name="keitai_h"]',
      mobile2: 'input[name="keitai_m"]',
      mobile3: 'input[name="keitai_l"]',

      email: 'input[name="email"]',

      // 休暇中（別住所モード）
      zipVacation1: 'input[name="yubink_h"]',
      zipVacation2: 'input[name="yubink_l"]',
      prefectureVacation: 'select[name="kenk"]',
      cityVacation: 'input[name="jushok1"]',
      addressVacation: 'input[name="jushok2"]',
      buildingVacation: 'input[name="jushok3"]',

      schoolSearchInitial: 'input[name="initial"]',
      // 検索後は select が優先される。hidden の mirror input のみの環境では従来どおり。
      univName: 'input[name="dname"]',
      faculty:
        'select[name="bcd"], select#bcd, select[name="bcdcd"], select#bcdcd, input[name="bname"]',
      dept: 'select[name="paxcd"], select#paxcd, input[name="kname"]',
      seminarLab: 'input[name="zemi"]',
      departmentSystem: 'select[name="gakkei_self"]',

      enrollYear: 'select[name="school_from_Y"]',
      enrollMonth: 'select[name="school_from_m"]',
      gradYear: 'select[name="school_to_Y"]',
      gradMonth: 'select[name="school_to_m"]',

      highSchoolPref: 'select[name="koko_ken"]',
      highSchoolName: 'input[name="koko_name"]',
      highSchoolEnrollYear: 'select[name="koko_from_Y"]',
      highSchoolEnrollMonth: 'select[name="koko_from_m"]',
      highSchoolGradYear: 'select[name="koko_to_Y"]',
      highSchoolGradMonth: 'select[name="koko_to_m"]',
    };
  },

  /**
   * flatten のキーと異なる Axol 専用キーをマージしたフラットオブジェクト
   */
  axolFlat(profile) {
    const flat = FieldMatcher.flattenProfile(profile);
    const c = profile.contact || {};
    const e = profile.education || {};

    const prefCode = this._prefectureToCode(flat.prefecture) || flat.prefecture;
    const prefHsCode =
      this._prefectureToCode(flat.highSchoolPref) || flat.highSchoolPref;

    const schoolLabel = this._schoolKindLabel(e.schoolType || '');
    const isGradSchool = /大学院/.test(e.schoolType || '');

    const enrollY = isGradSchool
      ? (e.gradSchoolEnrollYear || e.enrollYear || '')
      : (e.enrollYear || '');
    const enrollM = isGradSchool
      ? (e.gradSchoolEnrollMonth || e.enrollMonth || '')
      : (e.enrollMonth || '');
    const gradY = isGradSchool
      ? (e.gradSchoolGradYear || e.gradYear || '')
      : (e.gradYear || '');
    const gradM = isGradSchool
      ? (e.gradSchoolGradMonth || e.gradMonth || '')
      : (e.gradMonth || '');

    let merged = { ...flat, prefecture: prefCode || flat.prefecture };
    if (
      !profile.contact?.vacationSameAsCurrent &&
      typeof VacationContact !== 'undefined'
    ) {
      const enriched = VacationContact.enrichFlat(merged, profile.contact);
      const prefVacCode =
        this._prefectureToCode(enriched.prefectureVacation) ||
        enriched.prefectureVacation;
      merged = {
        ...enriched,
        prefectureVacation: prefVacCode || enriched.prefectureVacation,
      };
    }

    return {
      ...merged,

      enrollYear: enrollY,
      enrollMonth: enrollM,
      gradYear: gradY,
      gradMonth: gradM,

      highSchoolPref: prefHsCode || flat.highSchoolPref,

      axolSchoolLabel: schoolLabel,
      axolSetupLabel: (e.schoolSetup || '').trim(),
      axolDegreeLabel: (flat.degree || '').trim(),
    };
  },

  /**
   * overrides で axolFlat を使うため、autofill 側から参照できるようにする
   */
  mapFlat(profile) {
    return this.axolFlat(profile);
  },

  extendFillPlan(profile, existingPlan) {
    if (!this.matches()) return [];

    const used = new Set(existingPlan.map((p) => p.el));
    const flat = this.axolFlat(profile);
    const extra = [];

    const add = (el, key, val) => {
      if (!el || val === undefined || val === null || String(val) === '') return;
      if (used.has(el)) return;
      used.add(el);
      extra.push({ el, key, value: String(val) });
    };

    // メイン確認用・サブメール2（同一値）
    const email2 = this._firstVisibleInputByName('email2');
    if (flat.email && email2) add(email2, 'emailConfirm', flat.email);

    const kmail = this._firstVisibleInputByName('kmail');
    const kmail2 = this._firstVisibleInputByName('kmail2');
    /* メイン＝email/email2、サブ①＝kmail/kmail2（normalizeMailAssignments が name で確定） */
    if (flat.emailSub1 && kmail) add(kmail, 'emailSub1', flat.emailSub1);
    if (flat.emailSub1 && kmail2) add(kmail2, 'secondaryEmailConfirm', flat.emailSub1);

    // 性別（name=sex の value は 1/2/3）
    const genderMap = [
      [/男性|^1$/, '1'],
      [/女性|^2$/, '2'],
      [/その他|無回答|回答しない|^3$/, '3'],
    ];
    let sexVal = '';
    const g = String(flat.gender || '').trim();
    for (const [re, code] of genderMap) {
      if (re.test(this._norm(g)) || re.test(g)) {
        sexVal = code;
        break;
      }
    }
    if (!sexVal && /^[123]$/.test(g)) sexVal = g;
    if (sexVal) {
      const radio = document.querySelector(`input[name="sex"][value="${sexVal}"]`);
      if (radio) add(radio, 'gender', radio.value);
    }

    // 学校区分・設置区分（他ラジオと混ざらないよう name で絞る）
    const skLabel = flat.axolSchoolLabel;
    if (skLabel) {
      const radio = this._pickRadioByNameAndLabel('kubun', skLabel, { schoolKind: true });
      if (radio) add(radio, 'schoolType', radio.value);
    }

    const setup = flat.axolSetupLabel;
    if (setup) {
      const radio = this._pickKokushiRadio(setup);
      if (radio) add(radio, 'schoolSetup', radio.value);
    }

    // 学位（大学院）
    if (/大学院/.test(profile.education?.schoolType || '') && flat.axolDegreeLabel) {
      const deg = flat.axolDegreeLabel;
      let radio = this._pickRadioByNameAndLabel('degree', deg, { exactOnly: true });
      if (!radio && deg === '修士') {
        radio = this._visibleRadiosByName('degree').find((r) => String(r.value) === '1') || null;
      }
      if (!radio && deg === '博士') {
        radio = this._visibleRadiosByName('degree').find((r) => String(r.value) === '2') || null;
      }
      if (radio) add(radio, 'degree', radio.value);
    }

    if (!profile.contact?.vacationSameAsCurrent) {
      const telkH = document.querySelector('input[name="telk_h"]');
      const telkM = document.querySelector('input[name="telk_m"]');
      const telkL = document.querySelector('input[name="telk_l"]');
      if (telkH && flat.telVacation1) {
        add(telkH, 'telVacation1', flat.telVacation1);
        add(telkM, 'telVacation2', flat.telVacation2);
        add(telkL, 'telVacation3', flat.telVacation3);
      }
    }

    // 高校検索ワード（Axol name=koko_word）。明示があれば優先。
    const kokoWord = document.querySelector('input[name="koko_word"]');
    if (kokoWord) {
      const explicit = (profile.education?.highSchoolSearchWord || '').trim();
      const piece =
        explicit ||
        (flat.highSchoolName ? String(flat.highSchoolName).slice(0, 12) : '');
      if (piece) add(kokoWord, 'koko_word', piece);
    }

    return extra;
  },

  /** Phase A で除外し Phase B cascade でのみ入力するフラットキー */
  schoolCascadeExcludedKeys() {
    return ['univName', 'faculty', 'dept', 'departmentSystem'];
  },

  collectCascadeExcludedKeys(profile) {
    const keys = new Set();
    if (
      this.shouldRunSchoolCascade(profile) ||
      this.shouldRunFacultyDeptCascade(profile)
    ) {
      this.schoolCascadeExcludedKeys().forEach((k) => keys.add(k));
    }
    if (this.shouldRunHighSchoolCascade(profile)) {
      this.highSchoolCascadeExcludedKeys().forEach((k) => keys.add(k));
    }
    return [...keys];
  },

  highSchoolCascadeExcludedKeys() {
    return ['highSchoolName'];
  },

  shouldRunHighSchoolCascade(profile) {
    if (!this.matches() || !profile) return false;
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const btn =
      document.querySelector('input[type="button"][value="高校検索"]') ||
      document.querySelector('input[type="submit"][value="高校検索"]');
    if (!btn || !vis(btn)) return false;
    const e = profile.education || {};
    const piece = (e.highSchoolSearchWord || e.highSchoolName || '').trim();
    return !!piece;
  },

  /**
   * 学校区分・設置区分・学位・頭文字がロックされているとき、「条件変更」で編集モードにする。
   * #jsAxolSchool_dcd_search_edit（value=条件変更）が表示されている場合のみ MAIN でクリック。
   */
  unlockSchoolSearchConditionsIfNeeded() {
    if (!this.matches()) return false;
    const btn =
      document.querySelector('#jsAxolSchool_dcd_search_edit') ||
      document.querySelector('input[type="button"][value="条件変更"]');
    if (!btn) return false;
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible(btn)
        : (() => {
            const st = window.getComputedStyle(btn);
            return st.display !== 'none' && st.visibility !== 'hidden';
          })();
    if (!vis) return false;
    this._injectPageClickConditionEdit();
    return true;
  },

  shouldRunSchoolCascade(profile) {
    if (!this.matches() || !profile) return false;
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const initial = document.querySelector('input[name="initial"]');
    if (!initial || !vis(initial)) return false;
    const btn = this._findSchoolSearchButton();
    if (!btn || !vis(btn)) return false;
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    const target = (
      isGrad ? e.gradSchoolName || e.univName : e.univName || e.gradSchoolName || ''
    ).trim();
    return !!target;
  },

  _facultySelectSelector() {
    return 'select[name="bcd"], select#bcd, select[name="bcdcd"], select#bcdcd';
  },

  _findFacultySelect(form) {
    if (!form) return null;
    return form.querySelector(this._facultySelectSelector());
  },

  _schoolSelectHasValidChoice(sel) {
    if (!sel || sel.tagName !== 'SELECT') return false;
    const val = String(sel.value || '').trim();
    if (!val) return false;
    const opt = sel.options[sel.selectedIndex];
    const t = String(opt?.text || '').trim();
    if (!t || /選択|ください|検索してください/u.test(t)) return false;
    return true;
  },

  shouldRunFacultyDeptCascade(profile) {
    if (!this.matches() || !profile) return false;
    const { faculty, dept } = this._facultyDeptTargets(profile);
    if (!faculty && !dept) return false;
    const form = this._getAxolForm();
    if (!form) return false;
    const schoolSel = this._findSchoolSelect(form);
    return !!(schoolSel && this._schoolSelectHasValidChoice(schoolSel));
  },

  _facultyDeptLabelCandidates(profile, kind) {
    const { faculty, dept } = this._facultyDeptTargets(profile);
    const raw = (kind === 'faculty' ? faculty : dept) || '';
    const out = [];
    const push = (s) => {
      const t = String(s || '').trim();
      if (t && !out.includes(t)) out.push(t);
    };
    push(raw);
    push(raw.replace(/[\s　]+/g, ''));
    push(raw.replace(/（[^）]*）|\([^)]*\)/g, '').trim());
    const suffixes =
      kind === 'faculty'
        ? ['学部', '研究科', '学群', '学域', 'カリキュラム']
        : ['学科', '専攻'];
    for (const suf of suffixes) {
      if (raw.endsWith(suf)) push(raw.slice(0, -suf.length));
    }
    return out;
  },

  _usableSelectOptions(sel) {
    if (!sel) return [];
    return [...sel.options].filter((o) => {
      if (o.value === '' && !String(o.text).trim()) return false;
      if (!String(o.text).trim()) return false;
      const t = String(o.text);
      if (/選択|ください|検索してください/u.test(t)) return false;
      if (/不明$/u.test(t) || /研究科不明|学部不明|学科不明/u.test(t)) return false;
      return !!String(o.value || '').trim() || t.length >= 2;
    });
  },

  _pickOptionFromLabelCandidates(sel, candidates) {
    if (!sel || !candidates?.length) return null;
    const opts = this._usableSelectOptions(sel);
    if (!opts.length) return null;
    const norm = (x) => this._norm(String(x)).toLowerCase();
    const variants = [...new Set(candidates.map((c) => norm(c)).filter(Boolean))].sort(
      (a, b) => b.length - a.length
    );

    const uniqHits = (pred) => {
      const hits = opts.filter(pred);
      return hits.length === 1 ? hits[0] : null;
    };

    for (const vn of variants) {
      const hit = uniqHits((o) => norm(o.text) === vn || norm(o.value) === vn);
      if (hit) return hit;
    }
    for (const vn of variants) {
      const hit = uniqHits(
        (o) => norm(o.text).startsWith(vn) || vn.startsWith(norm(o.text))
      );
      if (hit) return hit;
    }
    for (const vn of variants) {
      let hits = opts.filter(
        (o) => norm(o.text).includes(vn) || vn.includes(norm(o.text))
      );
      if (!hits.length) continue;
      if (hits.length === 1) return hits[0];
      hits.sort((a, b) => norm(a.text).length - norm(b.text).length);
      return hits[0];
    }
    return this._pickOptionContainingVariants(opts, variants, '');
  },

  /**
   * 大学選択済みのあと、学部（bcd/bcdcd）→ 学科（paxcd）のみ入力
   */
  async runFacultyDeptCascade(
    profile,
    { form, schoolSel, delay = 50, highlightFilled = true } = {}
  ) {
    const filledKeys = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
      const f = form || this._getAxolForm();
      if (!f) return { filled: 0, keys: filledKeys };

      const school = schoolSel || this._findSchoolSelect(f);
      if (!school || !this._schoolSelectHasValidChoice(school)) {
        return { filled: 0, keys: filledKeys };
      }

      const { faculty, dept } = this._facultyDeptTargets(profile);
      if (!faculty && !dept) return { filled: 0, keys: filledKeys };

      await sleep(Math.max(150, delay * 2));

      let facSel = null;
      if (faculty) {
        facSel = await this._waitForFacultySelect(f, school, 9000);
        if (facSel) {
          const fo = this._pickOptionFromLabelCandidates(
            facSel,
            this._facultyDeptLabelCandidates(profile, 'faculty')
          );
          if (
            fo &&
            this._applySelectValue(facSel, fo.value, 'faculty', highlightFilled)
          ) {
            filledKeys.push('faculty');
          }
          await sleep(Math.max(200, delay * 3));
        }
      }

      if (dept) {
        const deptSel = await this._waitForDeptSelect(f, school, facSel, 9000);
        if (deptSel) {
          const dto = this._pickOptionFromLabelCandidates(
            deptSel,
            this._facultyDeptLabelCandidates(profile, 'dept')
          );
          if (dto && this._applySelectValue(deptSel, dto.value, 'dept', highlightFilled)) {
            filledKeys.push('dept');
          }
          await sleep(Math.max(120, delay * 2));
        }
      }

      return { filled: filledKeys.length, keys: filledKeys };
    } catch (_) {
      return { filled: filledKeys.length, keys: filledKeys };
    }
  },

  async runSchoolSearchCascade(profile, { delay = 50, highlightFilled = true } = {}) {
    const filledKeys = [];
    const flat = this.axolFlat(profile);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
      const form = this._getAxolForm();
      if (!form) return { filled: 0 };

      await sleep(Math.max(30, delay));

      if (this.unlockSchoolSearchConditionsIfNeeded()) {
        await sleep(Math.max(160, delay * 2));
      }

      const snap = this._schoolListSnapshot(form);
      this._injectPageClickSchoolSearch();
      await sleep(Math.max(80, delay));

      const schoolSel = await this._waitForUpdatedSchoolSelect(form, snap, 12000);
      if (!schoolSel) return { filled: filledKeys.length };

      const prefHintUniv = String(profile.education?.univPref || '').trim();
      const schoolOpt = this._pickSchoolOption(
        schoolSel,
        this._schoolNameCandidates(profile),
        prefHintUniv
      );
      if (!schoolOpt) return { filled: filledKeys.length };

      if (!this._applySelectValue(schoolSel, schoolOpt.value, 'univName', highlightFilled)) {
        return { filled: filledKeys.length };
      }
      filledKeys.push('univName');

      const fd = await this.runFacultyDeptCascade(profile, {
        form,
        schoolSel,
        delay,
        highlightFilled,
      });
      if (fd.keys) filledKeys.push(...fd.keys);

      this._injectPageClickAutoGakkei();

      await sleep(Math.max(150, delay * 2));

      if (flat.departmentSystem) {
        const g = form.querySelector('select[name="gakkei_self"]');
        if (
          g &&
          typeof FieldMatcher !== 'undefined' &&
          FieldMatcher.isFillableVisible(g)
        ) {
          const ok = GenericAdapter.fillElement(g, flat.departmentSystem);
          if (ok) {
            filledKeys.push('departmentSystem');
            this._maybeHighlight(g, 'departmentSystem', highlightFilled);
          }
        }
      }

      return { filled: filledKeys.length };
    } catch (_) {
      return { filled: filledKeys.length };
    }
  },

  async runHighSchoolSearchCascade(profile, { delay = 50, highlightFilled = true } = {}) {
    const filledKeys = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
      const form =
        document.querySelector('form[name="form1"]') || document.querySelector('form');
      if (!form) return { filled: 0 };

      await sleep(Math.max(40, delay));

      const snap = this._highSchoolListSnapshot(form);
      this._injectPageClickHighSchoolSearch();
      await sleep(Math.max(100, delay));

      const hsSel = await this._waitForUpdatedHighSchoolSelect(form, snap, 12000);
      if (!hsSel) return { filled: filledKeys.length };

      const prefHint = String(profile.education?.highSchoolPref || '').trim();
      const schoolOpt = this._pickSchoolOption(
        hsSel,
        this._highSchoolNameCandidates(profile),
        prefHint
      );
      if (!schoolOpt) return { filled: filledKeys.length };

      if (
        !this._applySelectValue(hsSel, schoolOpt.value, 'highSchoolName', highlightFilled)
      ) {
        return { filled: filledKeys.length };
      }
      filledKeys.push('highSchoolName');

      return { filled: filledKeys.length };
    } catch (_) {
      return { filled: filledKeys.length };
    }
  },

  _getAxolForm() {
    const initial = document.querySelector('input[name="initial"]');
    if (initial && initial.closest('form')) return initial.closest('form');
    return document.querySelector('form[name="form1"]') || document.querySelector('form');
  },

  _findSchoolSearchButton() {
    const form = this._getAxolForm();
    const sel =
      'input[type="button"][value="学校検索"],input[type="submit"][value="学校検索"],button[value="学校検索"]';
    return (form && form.querySelector(sel)) || document.querySelector(sel);
  },

  /**
   * CSP がページへのインライン script 注入を禁止している環境があるため、
   * 同一 DOM ノードに対してコンテンツスクリプトから click / change を送る。
   */
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

  _injectPageClickConditionEdit() {
    const btn =
      document.querySelector('#jsAxolSchool_dcd_search_edit') ||
      document.querySelector('input[type="button"][value="条件変更"]');
    this._safeDomClick(btn);
  },

  _injectPageClickHighSchoolSearch() {
    const form = document.querySelector('form[name="form1"]') || document.querySelector('form');
    const btn =
      (form && form.querySelector('input[type="button"][value="高校検索"]')) ||
      document.querySelector('input[type="button"][value="高校検索"]');
    this._safeDomClick(btn);
  },

  _injectPageClickSchoolSearch() {
    const form = document.querySelector('form[name="form1"]') || document.querySelector('form');
    const btn =
      (form && form.querySelector('input[type="button"][value="学校検索"]')) ||
      document.querySelector('input[type="button"][value="学校検索"]');
    this._safeDomClick(btn);
  },

  _injectPageSelectValueByName(name, value) {
    const nm = String(name || '');
    if (!nm) return;
    const esc = GenericAdapter._cssEscapeIdent(nm);
    const form = document.querySelector('form[name="form1"]') || document.querySelector('form');
    const sel =
      (form && form.querySelector(`select[name="${esc}"]`)) ||
      document.querySelector(`select[name="${esc}"]`);
    if (!sel) return;
    GenericAdapter.fillElement(sel, String(value ?? ''));
  },

  _injectPageClickAutoGakkei() {
    const form = document.querySelector('form[name="form1"]') || document.querySelector('form');
    const buttons = form ? form.querySelectorAll('input[type="button"],button') : [];
    for (const btn of buttons) {
      const v = (btn.value || btn.textContent || '').trim();
      if (v.includes('学科から自動選択')) {
        this._safeDomClick(btn);
        return;
      }
    }
  },

  _maybeHighlight(el, key, highlightFilled) {
    if (
      highlightFilled !== false &&
      typeof AutoFillOverlay !== 'undefined' &&
      AutoFillOverlay.highlightElement
    ) {
      AutoFillOverlay.highlightElement(el, key);
    }
  },

  _applySelectValue(selectEl, optionValue, key, highlightFilled) {
    const want = String(optionValue);
    const nm = selectEl.name || '';
    GenericAdapter.fillElement(selectEl, want);
    let match = selectEl.value === want;
    if (!match && nm) {
      this._injectPageSelectValueByName(nm, want);
      const form = selectEl.closest('form') || document;
      const fresh = form.querySelector(`select[name="${nm}"]`);
      if (fresh) match = fresh.value === want;
    }
    if (match) this._maybeHighlight(selectEl, key, highlightFilled);
    return match;
  },

  _facultyDeptTargets(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    const faculty = (
      isGrad ? e.gradFaculty || e.faculty : e.faculty || e.gradFaculty || ''
    ).trim();
    const dept = (isGrad ? e.gradDept || e.dept : e.dept || e.gradDept || '').trim();
    return { faculty, dept };
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

  _highSchoolNameCandidates(profile) {
    const e = profile.education || {};
    const explicit = (e.highSchoolSearchWord || '').trim();
    const name = (e.highSchoolName || '').trim();
    const out = [];
    const push = (s) => {
      const t = String(s || '').trim();
      if (t && !out.includes(t)) out.push(t);
    };
    if (explicit) push(explicit);
    if (name) {
      push(name);
      push(name.replace(/^[\u4e00-\u9faf]{2,8}(県|府|道)[\s　]*/u, '').trim());
      push(name.replace(/私立|国立|公立|[\s　]/gu, ''));
    }
    return out;
  },

  _isExcludedAxolMetaSelect(sel) {
    const n = sel.name || '';
    const fixed = new Set([
      'birth_Y',
      'birth_m',
      'birth_d',
      'school_from_Y',
      'school_from_m',
      'school_to_Y',
      'school_to_m',
      'koko_ken',
      'koko_from_Y',
      'koko_from_m',
      'koko_to_Y',
      'koko_to_m',
      'gakkei_self',
      'keng',
      'kenk',
    ]);
    if (fixed.has(n)) return true;
    if (/^birth_/u.test(n) || /^school_from_/u.test(n) || /^school_to_/u.test(n) || /^koko_/u.test(n))
      return true;
    return false;
  },

  _findSchoolSelect(form) {
    if (!form) return null;
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const prefer = ['select[name="dcdcd"]', 'select#dcdcd', 'select[name="school_cd"]'];
    for (const sel of prefer) {
      const el = form.querySelector(sel);
      if (el && vis(el)) return el;
    }
    let best = null;
    let bestScore = -1;
    for (const el of form.querySelectorAll('select')) {
      if (!vis(el) || this._isExcludedAxolMetaSelect(el)) continue;
      let uniLike = 0;
      let nonempty = 0;
      for (const o of el.options) {
        if (!o.value || !String(o.text).trim()) continue;
        nonempty++;
        if (/大学|短期大学|高等専門|専門学校/u.test(o.text)) uniLike++;
      }
      const score = uniLike * 10 + nonempty;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  },

  _findHighSchoolSelect(form) {
    if (!form) return null;
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const uniSel = this._findSchoolSelect(form);
    const prefer = ['select[name="kokocd"]', 'select[name="koko_cd"]', 'select#kokocd'];
    for (const sel of prefer) {
      const el = form.querySelector(sel);
      if (el && vis(el) && el !== uniSel) return el;
    }
    let best = null;
    let bestScore = -1;
    for (const el of form.querySelectorAll('select')) {
      if (!vis(el) || el === uniSel || this._isExcludedAxolMetaSelect(el)) continue;
      let hsLike = 0;
      let nonempty = 0;
      for (const o of el.options) {
        if (!o.value || !String(o.text).trim()) continue;
        nonempty++;
        const t = o.text || '';
        if (/高等学校/u.test(t) || /高校$/u.test(t)) hsLike++;
      }
      const score = hsLike * 12 + nonempty;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return bestScore >= 6 ? best : null;
  },

  _schoolListSnapshot(form) {
    const sel = this._findSchoolSelect(form);
    if (!sel) return { signature: '', optionCount: 0 };
    const sig = [...sel.options].map((o) => `${o.text}:${o.value}`).join('|');
    return { signature: sig, optionCount: sel.options.length };
  },

  _highSchoolListSnapshot(form) {
    const sel = this._findHighSchoolSelect(form);
    if (!sel) return { signature: '', optionCount: 0 };
    const sig = [...sel.options].map((o) => `${o.text}:${o.value}`).join('|');
    return { signature: sig, optionCount: sel.options.length };
  },

  _looksLikeHighSchoolOptionList(sel) {
    let hsLike = 0;
    let nonempty = 0;
    for (const o of sel.options) {
      if (!o.value || !String(o.text).trim()) continue;
      nonempty++;
      if (/高等学校/u.test(o.text) || /高校$/u.test(o.text)) hsLike++;
    }
    return hsLike >= 2 || nonempty >= 6;
  },

  async _waitForUpdatedHighSchoolSelect(form, prevSnap, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const sel = this._findHighSchoolSelect(form);
      if (sel && this._looksLikeHighSchoolOptionList(sel)) {
        const sig = [...sel.options].map((o) => `${o.text}:${o.value}`).join('|');
        if (
          sig !== prevSnap.signature ||
          sel.options.length > Math.max(prevSnap.optionCount, 0)
        ) {
          return sel;
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    const fallback = this._findHighSchoolSelect(form);
    if (fallback && this._looksLikeHighSchoolOptionList(fallback)) return fallback;
    return null;
  },

  _looksLikeSchoolOptionList(sel) {
    let uniLike = 0;
    let nonempty = 0;
    for (const o of sel.options) {
      if (!o.value || !String(o.text).trim()) continue;
      nonempty++;
      if (/大学|短期大学|高等専門|専門学校/u.test(o.text)) uniLike++;
    }
    return uniLike >= 2 || nonempty >= 8;
  },

  async _waitForUpdatedSchoolSelect(form, prevSnap, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const sel = this._findSchoolSelect(form);
      if (sel && this._looksLikeSchoolOptionList(sel)) {
        const sig = [...sel.options].map((o) => `${o.text}:${o.value}`).join('|');
        if (
          sig !== prevSnap.signature ||
          sel.options.length > Math.max(prevSnap.optionCount, 0)
        ) {
          return sel;
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const fallback = this._findSchoolSelect(form);
    if (fallback && this._looksLikeSchoolOptionList(fallback)) return fallback;
    return null;
  },

  _axolSchoolCascadeSelects(form, ...avoid) {
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const skip = new Set(avoid.filter(Boolean));
    return [...form.querySelectorAll('select')]
      .filter((sel) => !skip.has(sel) && vis(sel) && !this._isExcludedAxolMetaSelect(sel))
      .sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
      );
  },

  _facultySelectIsReady(s, vis, schoolSel) {
    if (!s || !vis(s) || s === schoolSel) return false;
    return this._usableSelectOptions(s).length >= 1;
  },

  _deptSelectIsReady(s, vis) {
    if (!s || !vis(s) || s.disabled) return false;
    return this._usableSelectOptions(s).length >= 1;
  },

  async _waitForFacultySelect(form, schoolSel, timeout) {
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let s = this._findFacultySelect(form);
      if (this._facultySelectIsReady(s, vis, schoolSel)) return s;
      const ordered = this._axolSchoolCascadeSelects(form, schoolSel);
      const cand = ordered.find((el) => this._facultySelectIsReady(el, vis, schoolSel));
      if (cand) return cand;
      await new Promise((r) => setTimeout(r, 100));
    }
    const fallback = this._findFacultySelect(form);
    if (fallback && vis(fallback)) return fallback;
    return this._axolSchoolCascadeSelects(form, schoolSel)[0] || null;
  },

  async _waitForDeptSelect(form, schoolSel, facSel, timeout) {
    const vis =
      typeof FieldMatcher !== 'undefined' && FieldMatcher.isFillableVisible
        ? FieldMatcher.isFillableVisible
        : (el) => {
            if (!el) return false;
            const st = window.getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
          };
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let s = form.querySelector('select[name="paxcd"], select#paxcd');
      if (this._deptSelectIsReady(s, vis)) return s;
      const ordered = this._axolSchoolCascadeSelects(form, schoolSel, facSel);
      const cand = ordered.find((el) => this._deptSelectIsReady(el, vis));
      if (cand) return cand;
      await new Promise((r) => setTimeout(r, 120));
    }
    const fallback = form.querySelector('select[name="paxcd"], select#paxcd');
    if (fallback && vis(fallback) && !fallback.disabled) return fallback;
    return null;
  },

  _pickSchoolOption(sel, candidates, prefHint) {
    const norm = (x) => this._norm(String(x)).toLowerCase();
    const opts = [...sel.options].filter(
      (o) => o.value && o.text.trim() && !/選択|ください/u.test(o.text)
    );
    if (!opts.length) return null;
    const variants = [...new Set(candidates.map(norm).filter(Boolean))];
    const prefNorm = prefHint ? norm(prefHint).replace(/県|府|道$/u, '') : '';

    const uniqHits = (pred) => {
      const hits = opts.filter(pred);
      return hits.length === 1 ? hits[0] : null;
    };

    for (const vn of variants) {
      const hit = uniqHits((o) => norm(o.text) === vn || norm(o.value) === vn);
      if (hit) return hit;
    }
    for (const vn of variants) {
      const hit = uniqHits(
        (o) => norm(o.text).startsWith(vn) || vn.startsWith(norm(o.text))
      );
      if (hit) return hit;
    }
    for (const vn of variants) {
      const hits = opts.filter(
        (o) => norm(o.text).includes(vn) || vn.includes(norm(o.text))
      );
      if (hits.length === 1) return hits[0];
    }

    const loose = this._pickOptionContainingVariants(opts, variants, prefNorm);
    return loose || null;
  },

  _pickOptionContainingVariants(opts, variantNorms, prefNormLoose) {
    const norm = (x) => this._norm(String(x)).toLowerCase();
    const sortedVariants = [...variantNorms].sort((a, b) => b.length - a.length);
    for (const vn of sortedVariants) {
      if (!vn) continue;
      let hits = opts.filter((o) => norm(o.text).includes(vn));
      if (!hits.length) continue;
      if (prefNormLoose && prefNormLoose.length >= 1) {
        const narrowed = hits.filter((o) => {
          const t = norm(o.text);
          return (
            t.includes(prefNormLoose) ||
            t.includes(prefNormLoose + '県') ||
            t.includes(prefNormLoose + '府') ||
            t.includes(prefNormLoose + '道')
          );
        });
        if (narrowed.length) hits = narrowed;
      }
      if (hits.length === 1) return hits[0];
      hits.sort((a, b) => norm(a.text).length - norm(b.text).length);
      return hits[0];
    }
    return null;
  },

  _pickOptionPreferSubstring(sel, desiredText, prefHint) {
    const want = String(desiredText || '').trim();
    if (!want || !sel) return null;
    const norm = (x) => this._norm(String(x)).toLowerCase();
    const vn = norm(want);
    const prefNorm = prefHint ? norm(prefHint).replace(/県|府|道$/u, '') : '';
    const opts = [...sel.options].filter(
      (o) =>
        o.value !== '' &&
        String(o.text).trim() &&
        !/選択してください|ください/u.test(o.text)
    );
    const uniqHits = (pred) => {
      const hits = opts.filter(pred);
      return hits.length === 1 ? hits[0] : null;
    };
    let hit = uniqHits((o) => norm(o.text) === vn || norm(o.value) === vn);
    if (hit) return hit;
    hit = uniqHits(
      (o) => norm(o.text).startsWith(vn) || vn.startsWith(norm(o.text))
    );
    if (hit) return hit;
    const hits = opts.filter(
      (o) => norm(o.text).includes(vn) || vn.includes(norm(o.text))
    );
    if (hits.length === 1) return hits[0];
    return this._pickOptionContainingVariants(opts, [vn], prefNorm);
  },

  /**
   * Axol のメール欄はもともとページ MAIN の jQuery で注入していたが、
   * axol.jp の CSP がインライン script を禁止するため実行されず空欄になる。
   * 同一 DOM ノードに対してネイティブ value + イベントを送ればページ側リスナにも届く。
   */
  _setNativeInputValue(el, value) {
    const v = String(value ?? '');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, v);
    else el.value = v;
  },

  _axolGentleEvents() {
    return ['focus', 'input', 'change', 'blur'];
  },

  _axolGentleTextFill(el, value) {
    if (!el) return false;
    this._setNativeInputValue(el, value);
    GenericAdapter._dispatchEvents(el, this._axolGentleEvents());
    return true;
  },

  _fillAxolMailInput(el, value) {
    if (!el) return false;
    const name = el.name;
    const str = String(value ?? '');
    const ev = this._axolGentleEvents();

    if (name === 'kmail2' && str) {
      const kmPeer = this._firstVisibleInputByName('kmail');
      if (kmPeer) {
        this._setNativeInputValue(kmPeer, str);
        GenericAdapter._dispatchEvents(kmPeer, ev);
      }
    }

    this._setNativeInputValue(el, str);
    GenericAdapter._dispatchEvents(el, ev);

    if (name === 'email2' || name === 'kmail2') {
      const peerName = name === 'email2' ? 'email' : 'kmail';
      const peer = this._firstVisibleInputByName(peerName);
      if (peer) GenericAdapter._dispatchEvents(peer, ['input', 'change', 'blur']);
      GenericAdapter._dispatchEvents(el, ['input', 'change']);
    }

    return true;
  },

  _isAxolMailInput(el) {
    if (!el || (el.tagName || '').toLowerCase() !== 'input') return false;
    const t = (el.type || '').toLowerCase();
    if (t !== 'text' && t !== 'email') return false;
    return /^(email|email2|kmail|kmail2)$/.test(el.name || '');
  },

  /**
   * 大学院選択後に学位ブロックが表示されてから修士/博士を入れる（同期ループで漏れた場合のフォールバック）
   */
  async fillDegreeIfNeeded(profile, { delay = 50, highlightFilled = true } = {}) {
    if (!this.matches() || !/大学院/.test(profile?.education?.schoolType || '')) return 0;
    const flat = this.axolFlat(profile);
    const deg = flat.axolDegreeLabel;
    if (!deg) return 0;

    await new Promise((r) => setTimeout(r, Math.max(delay * 2, 200)));

    let radio = this._pickRadioByNameAndLabel('degree', deg, { exactOnly: true });
    if (!radio && deg === '修士') {
      radio = this._visibleRadiosByName('degree').find((r) => String(r.value) === '1') || null;
    }
    if (!radio && deg === '博士') {
      radio = this._visibleRadiosByName('degree').find((r) => String(r.value) === '2') || null;
    }
    if (!radio || radio.checked) return radio?.checked ? 0 : 0;

    const ok = this.fillElement(radio, radio.value);
    if (
      ok &&
      highlightFilled !== false &&
      typeof AutoFillOverlay !== 'undefined' &&
      AutoFillOverlay.highlightElement
    ) {
      AutoFillOverlay.highlightElement(radio, 'degree');
    }
    return ok ? 1 : 0;
  },

  fillElement(el, value) {
    if (!el) return false;
    if (this._isAxolMailInput(el)) return this._fillAxolMailInput(el, value);
    /* extendFillPlan で既に特定したラジオはそのまま選択（ラベル再マッチ失敗を防ぐ） */
    if (el.type === 'radio' && el.name) {
      return GenericAdapter._setRadioCheckedWithJqTransform(el, el.name);
    }
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'select') return GenericAdapter.fillElement(el, value);
    if (tag === 'input' || tag === 'textarea') {
      const t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox') return GenericAdapter.fillElement(el, value);
      if (t !== 'radio' && t !== 'file' && t !== 'hidden') {
        return this._axolGentleTextFill(el, value);
      }
    }
    return GenericAdapter.fillElement(el, value);
  },
};

if (typeof window !== 'undefined') {
  window.AxolAdapter = AxolAdapter;
}
