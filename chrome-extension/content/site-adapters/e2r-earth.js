'use strict';

/**
 * e2R eARTH 系（NTTドコモソリューションズ プレエントリー等）
 * form[name="mainform"] + I1_D1 等の項目 ID で判定。
 * 学校名（I22〜I24）は readonly だが直接入力＋chk 同期で対応。
 *
 * フォーム種別:
 * - firstregist: I1488（性別）, I59（文理）, I1226/I44（卒業）, I1489（部活・サークル）等
 * - career: I68, I48, I13540/I13541 等（従来の career_edu 系）
 */
const E2rEarthAdapter = {
  name: 'e2r-earth',
  priority: 13,

  _esc(s) {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(s)) : String(s);
  },

  _form() {
    const f = document.querySelector('form[name="mainform"]');
    if (f && f.querySelector('input[name="I1_D1"]')) return f;
    return null;
  },

  /** @returns {'firstregist'|'career'} */
  _variant() {
    const form = this._form();
    if (!form) return 'career';
    if (form.querySelector('input[name="I1488"]') || form.querySelector('input[name="I59"]')) {
      return 'firstregist';
    }
    return 'career';
  },

  _i52IsResearchText(form) {
    if (!form) return false;
    const el = form.querySelector('input[name="I52"]');
    return !!el && String(el.type || 'text').toLowerCase() !== 'radio';
  },

  _i52IsDisabilityRadio(form) {
    if (!form) return false;
    return !!form.querySelector('input[type="radio"][name="I52"]');
  },

  /** メールアドレス2（サブ）。企業・シートにより I2977 / I1225 / I10 等に分かれる */
  _resolveEmailSubNames(form) {
    if (!form) return { sub: null, confirm: null };
    for (const sub of ['I2977', 'I1225', 'I10']) {
      const inp = form.querySelector(`input[name="${sub}"]`);
      if (!inp || String(inp.type || 'text').toLowerCase() === 'hidden') continue;
      const confirm = `${sub}_chk`;
      if (form.querySelector(`input[name="${confirm}"]`)) return { sub, confirm };
    }
    return { sub: null, confirm: null };
  },

  _schema() {
    const form = this._form();
    const v = this._variant();
    const emailSubNames = this._resolveEmailSubNames(form);
    if (v === 'firstregist') {
      return {
        variant: 'firstregist',
        gender: 'I1488',
        bunri: 'I59',
        schoolType: 'I1229',
        gradStatus: 'I1226',
        gradExpected: 'I44',
        gradOtherYear: 'I1227_D1',
        gradOtherMonth: 'I1227_D2',
        gradOtherValue: '8',
        gradChangeFn: 'changeI1226',
        seminar: 'I45',
        majorTheme: 'I46',
        researchTheme: null,
        clubCategory: 'I1489',
        studyAbroad: 'I1228',
        disability: this._i52IsDisabilityRadio(form) ? 'I52' : null,
        emailSub: emailSubNames.sub,
        emailSubConfirm: emailSubNames.confirm,
        vacationSame: 'I54',
      };
    }
    const career = {
      variant: 'career',
      gender: 'I68',
      bunri: 'I48',
      schoolType: 'I47',
      gradStatus: 'I13540',
      gradExpected: 'I13541',
      gradOtherYear: 'I50_D1',
      gradOtherMonth: 'I50_D2',
      gradOtherValue: '6',
      gradChangeFn: 'changeI13540',
      seminar: form?.querySelector('input[name="I51"]') ? 'I51' : null,
      majorTheme: form?.querySelector('input[name="I46"]') ? 'I46' : null,
      researchTheme: this._i52IsResearchText(form) ? 'I52' : null,
      clubCategory: form?.querySelector('select[name="I1489"]') ? 'I1489' : null,
      clubText: form?.querySelector('input[name="I55"]') ? 'I55' : null,
      studyAbroad: form?.querySelector('select[name="I1228"]')
        ? 'I1228'
        : form?.querySelector('select[name="I13542"]')
          ? 'I13542'
          : null,
      disability: this._i52IsDisabilityRadio(form) ? 'I52' : null,
      emailSub: emailSubNames.sub,
      emailSubConfirm: emailSubNames.confirm,
      vacationSame: form?.querySelector('input[name="I54"]') ? 'I54' : null,
    };
    if (!career.seminar && form?.querySelector('input[name="I45"]')) {
      career.seminar = 'I45';
    }
    return career;
  },

  matches() {
    try {
      if (!/e2r\.jp$/i.test(location.hostname)) return false;
      return !!this._form();
    } catch (_) {
      return false;
    }
  },

  _rootSel() {
    const form = this._form();
    if (!form) return '';
    if (form.id) return `#${this._esc(form.id)}`;
    return `form[name="${this._esc(form.name)}"]`;
  },

  _schoolTypeCode(schoolType, variant) {
    const s = String(schoolType || '').trim();
    if (variant === 'firstregist') {
      if (/博士/.test(s)) return '2';
      if (/修士|大学院/.test(s)) return '1';
      if (s === '大学' || /四年制/.test(s)) return '3';
      if (/短期/.test(s)) return '4';
      if (/高等専門.*専攻/.test(s)) return '6';
      if (/高等専門/.test(s)) return '5';
      if (/専門/.test(s)) return '7';
      if (/海外|外国/.test(s)) return '9';
      return '3';
    }
    if (/博士/.test(s)) return '3';
    if (/修士|大学院/.test(s)) return '2';
    if (s === '大学') return '1';
    if (/短期/.test(s)) return '4';
    if (/高等専門/.test(s)) return '5';
    if (/専門/.test(s)) return '6';
    return '7';
  },

  _genderCode(gender) {
    const g = String(gender || '').trim();
    if (/^[123]$/.test(g)) return g;
    if (/男/.test(g)) return '1';
    if (/女/.test(g)) return '2';
    if (g) return '3';
    return '';
  },

  /**
   * @param {'firstregist'|'career'} variant
   * firstregist: 1=理系 2=文系 3=その他 / career: 1=文系 2=理系
   */
  _bunriCode(declaredStream, variant) {
    const s = String(declaredStream || '').trim();
    if (variant === 'firstregist') {
      if (s === '理系' || (/理/.test(s) && !/文/.test(s))) return '1';
      if (s === '文系' || (/文/.test(s) && !/理/.test(s))) return '2';
      if (s === 'その他' || s === '3') return '3';
      if (s === '1' || s === '2') return s;
      return '';
    }
    if (s === '理系' || (/理/.test(s) && !/文/.test(s))) return '2';
    if (s === '文系' || (/文/.test(s) && !/理/.test(s))) return '1';
    if (/^[12]$/.test(s)) return s;
    return '';
  },

  /** 申告文理未設定時: 学科系統コード・学部学科名から推定 */
  _inferBunriFromEducation(e, variant) {
    const science = variant === 'firstregist' ? '1' : '2';
    const humanities = variant === 'firstregist' ? '2' : '1';

    const ds = String(e?.departmentSystem || '').trim();
    if (ds === '296') return humanities;
    if (ds === '297') return science;
    const dsNum = parseInt(ds, 10);
    if (!isNaN(dsNum)) {
      if (dsNum >= 221 && dsNum <= 289) return science;
      if (dsNum >= 201 && dsNum <= 215) return humanities;
    }

    const isGrad = /大学院/.test(e?.schoolType || '');
    const text = [
      isGrad ? e?.gradFaculty : '',
      isGrad ? e?.gradDept : '',
      e?.faculty,
      e?.dept,
    ]
      .filter(Boolean)
      .join(' ');

    if (
      /理工|工学|情報|理学|農|医|歯|薬|電気|機械|建築|土木|化学|物理|数学|地学|材料|生命|システム|コンピュータ|情報科学/.test(
        text
      )
    ) {
      return science;
    }
    if (
      /文学|法学|経済|経営|商|人文|社会|教育|外国語|国際|語学|歴史|哲学|心理|政治|観光|福祉|芸術|音楽|美術/.test(
        text
      )
    ) {
      return humanities;
    }
    return '';
  },

  _resolveE2rBunri(profile, flat, variant) {
    return (
      this._bunriCode(flat.declaredStream, variant) ||
      this._inferBunriFromEducation(profile.education || {}, variant)
    );
  },

  _graduationStatusCode(graduationStatus) {
    const s = String(graduationStatus || '').trim();
    if (/既卒/.test(s)) return '2';
    return '1';
  },

  _graduationDatesFromProfile(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    return {
      year: isGrad ? e.gradSchoolGradYear || e.gradYear : e.gradYear,
      month: isGrad ? e.gradSchoolGradMonth || e.gradMonth : e.gradMonth,
    };
  },

  _gradYm(gradYear, gradMonth) {
    const y = parseInt(String(gradYear || '').trim(), 10);
    const mRaw = parseInt(String(gradMonth || '').trim(), 10);
    if (!y || isNaN(y)) return null;
    const month = !isNaN(mRaw) && mRaw >= 1 && mRaw <= 12 ? mRaw : 3;
    return { year: y, month, gradYm: y * 12 + month, cohort: (month <= 3 ? y : y + 1) - 2000 };
  },

  /** option 表示文言から期間・卒年を抽出 */
  _parseGradOption(text) {
    const t = String(text || '').replace(/\s+/g, '');
    if (!t) return null;

    const cohortMatch = t.match(/[（(](\d{2})卒/);
    const cohort = cohortMatch ? parseInt(cohortMatch[1], 10) : null;

    if (/その他/.test(t)) {
      return { type: 'other', cohort };
    }

    const rangeMatch = t.match(/(\d{4})年4月[～〜\-－~](\d{4})年3月/);
    if (rangeMatch) {
      let y1 = parseInt(rangeMatch[1], 10);
      let y2 = parseInt(rangeMatch[2], 10);
      if (y2 <= y1) y2 = y1 + 1;
      return {
        type: 'range',
        startYm: y1 * 12 + 4,
        endYm: y2 * 12 + 3,
        cohort,
      };
    }

    const afterMatch = t.match(/(\d{4})年4月以降/);
    if (afterMatch) {
      const y = parseInt(afterMatch[1], 10);
      return {
        type: 'after',
        startYm: y * 12 + 4,
        endYm: Number.POSITIVE_INFINITY,
        cohort,
      };
    }

    return cohort != null ? { type: 'cohortOnly', cohort } : null;
  },

  /**
   * 卒業区分変更後の select から卒業予定年月 value を決定
   */
  _resolveGradExpectedValue(select, gradYear, gradMonth, otherValue) {
    const norm = this._gradYm(gradYear, gradMonth);
    if (!norm) return { value: '', useOther: false, year: '', month: '' };

    const { gradYm, cohort, year, month } = norm;
    const monthStr = String(month);
    const yearStr = String(year);
    const other = String(otherValue || '8').trim();

    if (!select) {
      return { value: other, useOther: true, year: yearStr, month: monthStr };
    }

    const intervals = [];
    const afters = [];
    const cohortOnly = [];
    let otherOpt = other;

    for (const opt of select.options) {
      const val = String(opt.value || '').trim();
      if (!val) continue;
      const parsed = this._parseGradOption(opt.textContent || opt.text || '');
      if (!parsed) continue;
      const entry = { value: val, ...parsed };
      if (parsed.type === 'range') intervals.push(entry);
      else if (parsed.type === 'after') afters.push(entry);
      else if (parsed.type === 'other') otherOpt = val;
      else if (parsed.type === 'cohortOnly') cohortOnly.push(entry);
    }

    for (const e of intervals) {
      if (gradYm >= e.startYm && gradYm <= e.endYm) {
        return { value: e.value, useOther: false, year: '', month: '' };
      }
    }

    for (const e of afters) {
      if (gradYm >= e.startYm) {
        return { value: e.value, useOther: false, year: '', month: '' };
      }
    }

    for (const e of cohortOnly) {
      if (e.cohort === cohort) {
        return { value: e.value, useOther: false, year: '', month: '' };
      }
    }

    for (const opt of select.options) {
      const val = String(opt.value || '').trim();
      if (!val) continue;
      const parsed = this._parseGradOption(opt.textContent || opt.text || '');
      if (parsed?.cohort === cohort) {
        return { value: val, useOther: false, year: '', month: '' };
      }
    }

    return { value: otherOpt, useOther: true, year: yearStr, month: monthStr };
  },

  _clubCircleCategoryCode(category, clubName) {
    const c = String(category || '').trim();
    if (/^[1-5]$/.test(c)) return c;
    if (/部活.*体育|体育会系.*部活|部活動.*体育/.test(c)) return '1';
    if (/部活.*文化|文化系.*部活|部活動.*文化/.test(c)) return '2';
    if (/サークル.*体育|同好会.*体育|体育会系.*サークル/.test(c)) return '3';
    if (/サークル|同好会|文化系.*サークル/.test(c)) return '4';
    if (/所属なし|なし|無し|ない/.test(c)) return '5';

    const name = String(clubName || '').trim();
    if (!name || /^(なし|無し|ない|所属なし)$/i.test(name)) return '5';
    return '4';
  },

  _studyAbroadCode(studyAbroad) {
    const s = String(studyAbroad || '').trim();
    if (/^[1-5]$/.test(s)) return s;
    if (/留学中.*海外|日本から海外に留学中/.test(s)) return '1';
    if (/留学中.*日本|海外から日本に留学中/.test(s)) return '2';
    if (/過去.*海外|日本から海外への留学/.test(s)) return '3';
    if (/過去.*日本|海外から日本への留学/.test(s)) return '4';
    return '5';
  },

  _disabilityCode(disabilitySupport) {
    const s = String(disabilitySupport || '').trim();
    if (s === '2' || /必要|手帳/.test(s)) return '2';
    return '1';
  },

  _schoolNames(profile) {
    const e = profile.education || {};
    const isGrad = /大学院/.test(e.schoolType || '');
    if (isGrad) {
      return {
        school: e.gradSchoolName || e.univName || '',
        faculty: e.gradFaculty || e.faculty || '',
        dept: e.gradDept || e.dept || '',
      };
    }
    return {
      school: e.univName || '',
      faculty: e.faculty || '',
      dept: e.dept || '',
    };
  },

  mapFlat(profile) {
    const flat = FieldMatcher.flattenProfile(profile);
    const e = profile.education || {};
    const variant = this._variant();
    const names = this._schoolNames(profile);
    const seminar = String(flat.seminarLab || '').trim() || 'なし';
    const major =
      String(flat.majorTheme || '').trim() ||
      String(flat.dept || '').trim() ||
      'なし';
    const research =
      String(flat.researchTheme || '').trim() ||
      String(flat.majorTheme || '').trim() ||
      'なし';

    return {
      ...flat,
      e2rSchoolType: this._schoolTypeCode(e.schoolType, variant),
      e2rGender: this._genderCode(flat.gender),
      e2rBunri: this._resolveE2rBunri(profile, flat, variant),
      e2rGradStatus: this._graduationStatusCode(e.graduationStatus),
      e2rSchool: names.school,
      e2rFaculty: names.faculty,
      e2rDept: names.dept,
      e2rSeminar: seminar,
      e2rMajorTheme: major,
      e2rResearchTheme: research,
      e2rStudyAbroad: this._studyAbroadCode(e.studyAbroad),
      e2rClubCategory: this._clubCircleCategoryCode(e.clubCircleCategory, flat.clubCircle),
      e2rDisability: this._disabilityCode(e.disabilitySupport),
    };
  },

  /** FieldMatcher の誤マッチ行を除去（ラジオ・連動 select は extendFillPlan / runAfter で処理） */
  pruneFillPlan(plan) {
    if (!this.matches()) return plan;
    const schema = this._schema();
    const skip = new Set([
      'I13597',
      schema.gender,
      schema.bunri,
      schema.gradStatus,
      schema.gradExpected,
      schema.gradOtherYear,
      schema.gradOtherMonth,
      schema.disability,
      schema.clubCategory,
    ].filter(Boolean));

    return plan.filter((row) => {
      const n = String(row.el?.name || '');
      if (skip.has(n)) return false;
      if (schema.variant === 'career' && (n === 'I68' || n === 'I48')) return false;
      return true;
    });
  },

  getOverrides() {
    const p = this._rootSel();
    if (!p) return {};
    const schema = this._schema();
    const overrides = {
      lastName: `${p} input[name="I1_D1"]`,
      firstName: `${p} input[name="I1_D2"]`,
      lastKana: `${p} input[name="I2_D1"]`,
      firstKana: `${p} input[name="I2_D2"]`,
      dobYear: `${p} input[name="I4_D1"]`,
      dobMonth: `${p} input[name="I4_D2"]`,
      dobDay: `${p} input[name="I4_D3"]`,
      email: `${p} input[name="I9"]`,
      emailConfirm: `${p} input[name="I9_chk"]`,
      zip1: `${p} input[name="I12_D1"]`,
      zip2: `${p} input[name="I12_D2"]`,
      prefecture: `${p} select[name="I13"]`,
      city: `${p} input[name="I14"]`,
      address: `${p} input[name="I15"]`,
      building: `${p} input[name="I16"]`,
      mobile1: `${p} input[name="I5_D1"]`,
      mobile2: `${p} input[name="I5_D2"]`,
      mobile3: `${p} input[name="I5_D3"]`,
      homePhone1: `${p} input[name="I8_D1"]`,
      homePhone2: `${p} input[name="I8_D2"]`,
      homePhone3: `${p} input[name="I8_D3"]`,
      zipVacation1: `${p} input[name="I17_D1"]`,
      zipVacation2: `${p} input[name="I17_D2"]`,
      prefectureVacation: `${p} select[name="I18"]`,
      cityVacation: `${p} input[name="I19"]`,
      vacationAddressLine: `${p} input[name="I20"]`,
      buildingVacation: `${p} input[name="I21"]`,
      telVacation1: `${p} input[name="I7_D1"]`,
      telVacation2: `${p} input[name="I7_D2"]`,
      telVacation3: `${p} input[name="I7_D3"]`,
    };

    if (schema.emailSub) {
      overrides.emailSub1 = `${p} input[name="${schema.emailSub}"]`;
      overrides.secondaryEmailConfirm = `${p} input[name="${schema.emailSubConfirm}"]`;
    }
    if (schema.seminar) {
      overrides.seminarLab = `${p} input[name="${schema.seminar}"]`;
    }
    if (schema.majorTheme) {
      overrides.majorTheme = `${p} input[name="${schema.majorTheme}"]`;
    }
    if (schema.researchTheme) {
      overrides.researchTheme = `${p} input[name="${schema.researchTheme}"]`;
    }

    return overrides;
  },

  _clearGradOtherFields(form, schema) {
    if (!form || !schema) return;
    const yInp = form.querySelector(`input[name="${schema.gradOtherYear}"]`);
    const mSel = form.querySelector(`select[name="${schema.gradOtherMonth}"]`);
    if (yInp) GenericAdapter.fillElement(yInp, '');
    if (mSel) GenericAdapter.fillElement(mSel, '');
  },

  _fillGradOtherFields(form, schema, year, month) {
    if (!form || !schema) return false;
    let ok = false;
    const yInp = form.querySelector(`input[name="${schema.gradOtherYear}"]`);
    const mSel = form.querySelector(`select[name="${schema.gradOtherMonth}"]`);
    if (yInp && year) ok = GenericAdapter.fillElement(yInp, String(year)) || ok;
    if (mSel && month) ok = GenericAdapter.fillElement(mSel, String(month)) || ok;
    return ok;
  },

  _fillReadonlyPair(form, name, value) {
    if (!value) return false;
    const inp = form.querySelector(`input[name="${name}"]`);
    if (!inp) return false;
    try {
      inp.removeAttribute('readonly');
    } catch (_) {}
    const ok = GenericAdapter.fillElement(inp, value);
    const chk = form.querySelector(`input[name="${name}_chk"]`);
    if (chk) GenericAdapter.fillElement(chk, value);
    return ok;
  },

  extendFillPlan(profile, existingPlan) {
    if (!this.matches()) return [];
    const form = this._form();
    if (!form) return [];

    const schema = this._schema();
    const used = new Set(existingPlan.map((row) => row.el));
    const extra = [];
    const add = (el, key, val) => {
      if (!el || val === undefined || val === null || String(val) === '') return;
      if (used.has(el)) return;
      used.add(el);
      extra.push({ el, key, value: String(val) });
    };

    const flat = this.mapFlat(profile);

    const addRadio = (name, code, key) => {
      if (!name || !code) return;
      const el = form.querySelector(
        `input[type="radio"][name="${name}"][value="${code}"]`
      );
      if (el) extra.push({ el, key, value: String(code) });
    };

    addRadio(schema.gender, flat.e2rGender, 'gender');
    addRadio(schema.bunri, flat.e2rBunri, 'declaredStream');
    if (schema.disability) addRadio(schema.disability, flat.e2rDisability, 'disabilitySupport');

    const st = form.querySelector(`select[name="${schema.schoolType}"]`);
    if (st && flat.e2rSchoolType) add(st, 'schoolType', flat.e2rSchoolType);

    for (const [name, val, key] of [
      ['I22', flat.e2rSchool, 'univName'],
      ['I23', flat.e2rFaculty, 'faculty'],
      ['I24', flat.e2rDept, 'dept'],
    ]) {
      const inp = form.querySelector(`input[name="${name}"]`);
      if (inp && val && !used.has(inp)) {
        extra.push({ el: inp, key, value: String(val) });
        used.add(inp);
      }
    }

    const sem = form.querySelector(`input[name="${schema.seminar}"]`);
    if (sem) add(sem, 'seminarLab', flat.e2rSeminar);

    if (schema.majorTheme) {
      const mt = form.querySelector(`input[name="${schema.majorTheme}"]`);
      if (mt) add(mt, 'majorTheme', flat.e2rMajorTheme);
    }

    if (schema.researchTheme) {
      const rt = form.querySelector(`input[name="${schema.researchTheme}"]`);
      if (rt) add(rt, 'researchTheme', flat.e2rResearchTheme);
    }

    if (schema.clubCategory && flat.e2rClubCategory) {
      const clubSel = form.querySelector(`select[name="${schema.clubCategory}"]`);
      if (clubSel) add(clubSel, 'clubCircleCategory', flat.e2rClubCategory);
    } else if (schema.clubText && flat.clubCircle) {
      const clubInp = form.querySelector(`input[name="${schema.clubText}"]`);
      if (clubInp) add(clubInp, 'clubCircle', flat.clubCircle);
    }

    if (schema.studyAbroad) {
      const abroad = form.querySelector(`select[name="${schema.studyAbroad}"]`);
      if (abroad && flat.e2rStudyAbroad) add(abroad, 'studyAbroad', flat.e2rStudyAbroad);
    }

    return extra;
  },

  _fillE2rRadio(form, name, code) {
    if (!form || !name || !code) return false;
    const esc =
      typeof CSS !== 'undefined' && CSS.escape
        ? CSS.escape(String(name))
        : String(name);
    const target = form.querySelector(
      `input[type="radio"][name="${esc}"][value="${code}"]`
    );
    if (!target) return false;

    for (const r of form.querySelectorAll(`input[type="radio"][name="${esc}"]`)) {
      r.checked = false;
    }
    try {
      target.click();
    } catch (_) {}
    if (!target.checked) target.checked = true;
    try {
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    return !!target.checked;
  },

  _fillNamedRadio(form, name, value, toCode) {
    if (!form || !name) return false;
    const code = toCode(value) || String(value || '').trim();
    if (!code) return false;
    return this._fillE2rRadio(form, name, code);
  },

  fillElement(el, value) {
    const form = this._form();
    const n = String(el?.name || '');
    const schema = this._schema();

    if (form && /^I2[234]$/.test(n)) {
      return this._fillReadonlyPair(form, n, value);
    }
    if (schema.gender && n === schema.gender) {
      return this._fillNamedRadio(form, schema.gender, value, (v) => this._genderCode(v));
    }
    if (schema.bunri && n === schema.bunri) {
      const variant = schema.variant;
      return this._fillNamedRadio(form, schema.bunri, value, (v) =>
        this._bunriCode(v, variant)
      );
    }
    if (
      schema.disability &&
      n === schema.disability &&
      form?.querySelector(`input[type="radio"][name="${schema.disability}"]`)
    ) {
      return this._fillNamedRadio(form, schema.disability, value, (v) =>
        this._disabilityCode(v)
      );
    }
    if (n === schema.gradOtherYear || n === schema.gradOtherMonth) {
      return false;
    }
    return GenericAdapter.fillElement(el, value);
  },

  async _runGradCascade(form, schema, profile, flat, { delay, highlightFilled }) {
    let filled = 0;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const dates = this._graduationDatesFromProfile(profile);

    const gradStatus = form.querySelector(`select[name="${schema.gradStatus}"]`);
    const statusCode = flat.e2rGradStatus || this._graduationStatusCode('');
    if (gradStatus && statusCode) {
      if (GenericAdapter.fillElement(gradStatus, statusCode)) {
        filled++;
        const fn = schema.gradChangeFn;
        if (typeof window[fn] === 'function') {
          try {
            window[fn]();
          } catch (_) {}
        } else {
          gradStatus.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await sleep(Math.max(delay, 80));
      }
    }

    const gradExp = form.querySelector(`select[name="${schema.gradExpected}"]`);
    const resolved = this._resolveGradExpectedValue(
      gradExp,
      dates.year,
      dates.month,
      schema.gradOtherValue
    );
    if (gradExp && resolved.value) {
      if (GenericAdapter.fillElement(gradExp, resolved.value)) {
        filled++;
        if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
          AutoFillOverlay.highlightElement(gradExp, 'gradYear');
        }
      }
      if (resolved.useOther) {
        if (this._fillGradOtherFields(form, schema, resolved.year, resolved.month)) {
          filled++;
        }
      } else {
        this._clearGradOtherFields(form, schema);
      }
    } else {
      this._clearGradOtherFields(form, schema);
    }

    return filled;
  },

  async runAfterPageFill(profile, { delay = 50, highlightFilled = true } = {}) {
    if (!this.matches()) return 0;
    const form = this._form();
    if (!form) return 0;

    const schema = this._schema();
    let filled = 0;
    const flat = this.mapFlat(profile);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (
      flat.e2rGender &&
      schema.gender &&
      this._fillNamedRadio(form, schema.gender, flat.e2rGender, (v) => v)
    ) {
      filled++;
      if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
        const gEl = form.querySelector(
          `input[type="radio"][name="${schema.gender}"][value="${flat.e2rGender}"]`
        );
        if (gEl) AutoFillOverlay.highlightElement(gEl, 'gender');
      }
    }

    filled += await this._runGradCascade(form, schema, profile, flat, {
      delay,
      highlightFilled,
    });

    for (const pair of [
      ['I22', flat.e2rSchool],
      ['I23', flat.e2rFaculty],
      ['I24', flat.e2rDept],
    ]) {
      if (pair[1] && this._fillReadonlyPair(form, pair[0], pair[1])) filled++;
    }

    const bunriCode = flat.e2rBunri;
    if (bunriCode && schema.bunri && this._fillE2rRadio(form, schema.bunri, bunriCode)) {
      filled++;
      if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
        const bEl = form.querySelector(
          `input[type="radio"][name="${schema.bunri}"][value="${bunriCode}"]`
        );
        if (bEl) AutoFillOverlay.highlightElement(bEl, 'declaredStream');
      }
    }

    if (schema.disability && flat.e2rDisability) {
      if (this._fillE2rRadio(form, schema.disability, flat.e2rDisability)) filled++;
    }

    if (schema.clubCategory && flat.e2rClubCategory) {
      const clubSel = form.querySelector(`select[name="${schema.clubCategory}"]`);
      if (clubSel && GenericAdapter.fillElement(clubSel, flat.e2rClubCategory)) {
        filled++;
        if (highlightFilled && typeof AutoFillOverlay !== 'undefined') {
          AutoFillOverlay.highlightElement(clubSel, 'clubCircleCategory');
        }
      }
    }

    if (schema.studyAbroad && flat.e2rStudyAbroad) {
      const abroad = form.querySelector(`select[name="${schema.studyAbroad}"]`);
      if (abroad && GenericAdapter.fillElement(abroad, flat.e2rStudyAbroad)) filled++;
    }

    const stSel = form.querySelector(`select[name="${schema.schoolType}"]`);
    if (stSel && flat.e2rSchoolType && GenericAdapter.fillElement(stSel, flat.e2rSchoolType)) {
      filled++;
    }

    if (
      typeof VacationContact !== 'undefined' &&
      VacationContact.isVacationSameAsCurrent(profile)
    ) {
      let vacationDone = false;
      try {
        if (typeof copyAddress === 'function') {
          copyAddress();
          vacationDone = true;
          filled++;
        }
      } catch (_) {}
      if (!vacationDone && typeof VacationContact.findSameAsCurrentCheckbox === 'function') {
        const cb = VacationContact.findSameAsCurrentCheckbox(form);
        if (cb && !cb.checked && GenericAdapter.fillElement(cb, 'true')) {
          filled++;
        }
      }
    }

    await sleep(delay);
    return filled;
  },
};

if (typeof window !== 'undefined') {
  window.E2rEarthAdapter = E2rEarthAdapter;
}
