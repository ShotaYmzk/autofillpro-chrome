'use strict';

/**
 * Field Matcher — scoring-based form field detection
 *
 * For each profile key we define an array of signals (regex patterns).
 * Each element in FIELD_MAP is { key, patterns, type }
 * where key maps to the flattened profile data key.
 *
 * Score = sum of matched pattern weights; highest score wins.
 */

const FieldMatcher = (() => {
  // ──────────────────────────────────────────────
  // Field definitions
  // Each entry: { key, aliases[], type }
  // type: 'text' | 'select' | 'radio' | 'phone-part'
  // ──────────────────────────────────────────────
  const FIELD_DEFS = [
    // ── Basic ──
    {
      key: 'lastName',
      aliases: ['sei','last.?name','family.?name','last_name','lastname',
                '姓','名字','苗字','last','sei','seimei_sei','名前.*姓','氏名.*姓',
                '^kname1$'],
      type: 'text',
    },
    {
      key: 'firstName',
      aliases: ['mei','first.?name','given.?name','first_name','firstname',
                '名','下の名前','first','mei','seimei_mei','名前.*名','氏名.*名',
                '^kname2$'],
      type: 'text',
    },
    {
      key: 'lastKana',
      aliases: ['sei.?kana','last.?kana','last.?furi','furigana.*sei','kana.*sei',
                'sei.*kana','last.*kana','姓.*ふりがな','姓.*フリガナ','フリガナ.*姓',
                'ふりがな.*姓','lastname.*kana','kana_sei','kana_last',
                '^yname1$','セイ'],
      type: 'text',
    },
    {
      key: 'firstKana',
      aliases: ['mei.?kana','first.?kana','first.?furi','furigana.*mei','kana.*mei',
                'mei.*kana','first.*kana','名.*ふりがな','名.*フリガナ','フリガナ.*名',
                'ふりがな.*名','firstname.*kana','kana_mei','kana_first',
                '^yname2$'],
      type: 'text',
    },
    {
      key: 'romajiLast',
      aliases: ['roman.*sei','roma.*sei','romaji.*sei','ローマ字.*姓','ローマ字姓','roman.*last'],
      type: 'text',
    },
    {
      key: 'romajiFirst',
      aliases: ['roman.*mei','roma.*mei','romaji.*mei','ローマ字.*名','ローマ字名','roman.*first'],
      type: 'text',
    },
    {
      key: 'fullName',
      aliases: ['full.?name','name','氏名','お名前','名前','seimei','shimei'],
      type: 'text',
      virtual: true, // composed from lastName + firstName
    },
    {
      key: 'fullKana',
      aliases: ['full.?kana','kana','フリガナ','ふりがな','氏名.*カナ','カナ.*氏名',
                'name.*kana','kana.*name','読み仮名','よみがな'],
      type: 'text',
      virtual: true,
    },
    {
      key: 'gender',
      aliases: ['gender','sex','性別','sei.?betsu'],
      type: 'select',
    },
    {
      key: 'dob',
      aliases: ['birth','dob','生年月日','誕生日','birthday','birth.?date'],
      type: 'text',
    },
    {
      key: 'dobYear',
      aliases: ['birth.*year','dob.*year','生年','誕生年','birth_year','bYear',
                '生まれ.*年','年.*生まれ'],
      type: 'select',
    },
    {
      key: 'dobMonth',
      aliases: ['birth.*month','dob.*month','生月','誕生月','birth_month','bMonth',
                '月.*生まれ','生まれ.*月'],
      type: 'select',
    },
    {
      key: 'dobDay',
      aliases: ['birth.*day','dob.*day','生日','誕生日.*日','birth_day','bDay',
                '日.*生まれ','生まれ.*日'],
      type: 'select',
    },

    // ── Contact ──
    // メイン確認（Axol の email2 など）。normalizeMailAssignments の対象外にすること。
    {
      key: 'emailConfirm',
      aliases: ['^email2$', 'email_confirm', 'mail_confirm', '^mail2$', '^account2$', '^domain2$'],
      type: 'text',
    },
    // メールアドレス2 の確認（Axol kmail2）。サブ宛とは別キーでメール並べ替えの影響を受けない。
    {
      key: 'secondaryEmailConfirm',
      aliases: ['^kmail2$', '^account4$', '^domain4$'],
      type: 'text',
    },
    {
      key: 'emailSub1',
      aliases: ['mail_2','email_2','sub.*mail','mail.*sub','^kmail$',
                'サブ.*メール','予備.*メール','副.*メール','連絡用.*メール','メールアドレス.*2','第2.*メール',
                '^account3$', '^domain3$'],
      type: 'text',
    },
    {
      key: 'emailSub2',
      aliases: ['mail.*3','email.*3','mail_3','email_3','メールアドレス.*3','第3.*メール'],
      type: 'text',
    },
    {
      key: 'email',
      aliases: ['メールアドレス','mail_address','email_address','e-mail','^mail$','email',
                'pcmail','連絡先.*メール','mail.*address',
                '^account1$', '^domain1$'],
      type: 'text',
    },
    {
      key: 'mobile',
      aliases: ['mobile','cell','携帯','cell.?phone','mobile.?phone','携帯電話',
                'smartphone','スマートフォン','携帯番号','tel.*mobile','mobile.*tel'],
      type: 'text',
    },
    {
      key: 'mobile1',
      aliases: ['mobile.*1','cell.*1','tel1.*mobile','携帯.*1$','携帯.*first',
                'mobile_no1','mobiletel1','^kttel1$'],
      type: 'phone-part',
    },
    {
      key: 'mobile2',
      aliases: ['mobile.*2','cell.*2','tel2.*mobile','携帯.*2$','携帯.*second',
                'mobile_no2','mobiletel2','^kttel2$'],
      type: 'phone-part',
    },
    {
      key: 'mobile3',
      aliases: ['mobile.*3','cell.*3','tel3.*mobile','携帯.*3$','携帯.*third',
                'mobile_no3','mobiletel3','^kttel3$'],
      type: 'phone-part',
    },
    {
      key: 'homePhone',
      aliases: ['home.*phone','phone.*home','固定電話','自宅.*電話','tel.*home',
                'home.?tel','自宅電話','tel.*house'],
      type: 'text',
    },
    {
      key: 'homePhone1',
      aliases: ['home.*tel.*1','tel1.*home','自宅.*tel.*1','hometel1','home_tel1','^gtel1$'],
      type: 'phone-part',
    },
    {
      key: 'homePhone2',
      aliases: ['home.*tel.*2','tel2.*home','自宅.*tel.*2','hometel2','home_tel2','^gtel2$'],
      type: 'phone-part',
    },
    {
      key: 'homePhone3',
      aliases: ['home.*tel.*3','tel3.*home','自宅.*tel.*3','hometel3','home_tel3','^gtel3$'],
      type: 'phone-part',
    },
    {
      key: 'zip',
      aliases: ['zip','postal','郵便番号','〒','post.*code','zip.*code','postcode'],
      type: 'text',
    },
    {
      key: 'zip1',
      aliases: ['zip.*1','postal.*1','郵便番号.*1','zip1','postcode1','yuubin1'],
      type: 'phone-part',
    },
    {
      key: 'zip2',
      aliases: ['zip.*2','postal.*2','郵便番号.*2','zip2','postcode2','yuubin2'],
      type: 'phone-part',
    },
    {
      key: 'prefecture',
      aliases: ['pref','prefecture','都道府県','todofuken','address.*pref',
                'pref.*address','現住所.*都','住所.*都'],
      type: 'select',
    },
    {
      key: 'city',
      aliases: ['city','ward','town','市区町村','shiku','shichoson','address.*city',
                '市町村','区','現住所.*市','住所.*市'],
      type: 'text',
    },
    {
      key: 'address',
      aliases: ['address','addr','banchi','丁目','番地','addr.*detail',
                '住所.*番地','address.*detail','番地.*号'],
      type: 'text',
    },
    {
      key: 'building',
      aliases: ['building','apartment','room','apt','mansion','マンション',
                '建物','部屋','号室','建物名','apartement'],
      type: 'text',
    },
    // 帰省先
    {
      key: 'homePrefecture',
      aliases: ['home.*pref','帰省.*都','実家.*都','home.*todofuken'],
      type: 'select',
    },
    {
      key: 'homeCity',
      aliases: ['home.*city','帰省.*市','実家.*市'],
      type: 'text',
    },
    {
      key: 'homeAddress',
      aliases: ['home.*address','home.*addr','帰省.*番地','実家.*番地'],
      type: 'text',
    },
    {
      key: 'homeBuilding',
      aliases: ['home.*building','帰省.*建物','実家.*建物'],
      type: 'text',
    },

    // ── Education ──
    {
      key: 'schoolType',
      aliases: ['school.*type','school.*kind','学校.*区分','学校区分','gakko.*kubun',
                '最終学歴','学歴区分'],
      type: 'select',
    },
    {
      key: 'schoolSetup',
      aliases: ['school.*setup','設置区分','setchi','国立','公立','私立'],
      type: 'select',
    },
    {
      key: 'gradSchoolName',
      aliases: ['graduate.*school.*name','grad.*school.*name','大学院.*名','大学院名',
                'univ.*grad','院.*名前'],
      type: 'text',
    },
    {
      key: 'gradSchoolKana',
      aliases: ['graduate.*school.*kana','grad.*school.*kana','大学院.*ふりがな',
                '大学院名.*ふりがな'],
      type: 'text',
    },
    {
      key: 'univName',
      aliases: ['university.*name','univ.*name','daigaku.*name','大学.*名','大学名',
                'school.*name','college.*name'],
      type: 'text',
    },
    {
      key: 'univKana',
      aliases: ['university.*kana','univ.*kana','大学.*ふりがな','大学名.*ふりがな',
                'daigaku.*kana'],
      type: 'text',
    },
    {
      key: 'univPref',
      aliases: ['university.*pref','univ.*pref','大学.*所在地','大学.*都道府県',
                'daigaku.*pref','school.*pref'],
      type: 'select',
    },
    {
      key: 'faculty',
      aliases: ['faculty','学部','学部名','gakubu','department.*faculty',
                '学部.*名','school.*faculty'],
      type: 'text',
    },
    {
      key: 'dept',
      aliases: ['dept','department','学科','学科名','専攻','major',
                'gakka','学科.*名'],
      type: 'text',
    },
    {
      key: 'seminarLab',
      aliases: ['ゼミ','研究室','ゼミ・研究室','seminar','laboratory','labo','lab'],
      type: 'text',
    },
    {
      key: 'departmentSystem',
      aliases: ['学科系統','gakka.*keitou','department.*system','系統'],
      type: 'text',
    },
    {
      key: 'degree',
      aliases: ['学位','degree','gakui'],
      type: 'select',
    },
    {
      key: 'schoolSearchInitial',
      aliases: ['学校名の頭文字','頭文字','gakkou.*todo','school.*initial','todo.*moji'],
      type: 'text',
    },
    {
      key: 'highSchoolPref',
      aliases: ['卒業高校.*都道府県','高校.*都道府県','高等学校.*pref','high.*school.*pref'],
      type: 'select',
    },
    {
      key: 'highSchoolName',
      aliases: ['卒業高校','高校名','高等学校名','high.*school.*name','koukou'],
      type: 'text',
    },
    {
      key: 'enrollYear',
      aliases: ['enroll.*year','enter.*year','入学.*年','入学年','nyuugaku.*year',
                'admission.*year','入学.*年度'],
      type: 'select',
    },
    {
      key: 'enrollMonth',
      aliases: ['enroll.*month','入学.*月','nyuugaku.*month','admission.*month'],
      type: 'select',
    },
    {
      key: 'gradMonth',
      aliases: ['grad.*month','graduate.*month','卒業.*月','sotsugyou.*month',
                'graduation.*month','卒業予定.*月', '^smonth$'],
      type: 'select',
    },
    {
      key: 'gradYear',
      aliases: ['grad.*year','graduate.*year','卒業.*年','卒業年','sotsugyou.*year',
                'graduation.*year','卒業.*年度','卒業予定.*年','^syear$'],
      type: 'select',
    },
  ];

  // ──────────────────────────────────────────────
  // Scoring helpers
  // ──────────────────────────────────────────────

  /**
   * Extract all text signals from an element:
   * name, id, placeholder, aria-label, associated <label>, data-* attrs
   */
  function getElementSignals(el) {
    const signals = [];
    const push = (v) => { if (v) signals.push(v.toLowerCase()); };

    push(el.name);
    push(el.id);
    push(el.placeholder);
    push(el.getAttribute('aria-label'));
    push(el.getAttribute('data-name'));
    push(el.getAttribute('data-key'));
    push(el.getAttribute('data-field'));
    push(el.getAttribute('autocomplete'));
    push(el.title);
    push(el.className);

    // Associated label text
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) push(label.textContent);
    }
    // Closest label ancestor
    const parentLabel = el.closest('label');
    if (parentLabel) push(parentLabel.textContent);

    // Nearby label/span (parent element text hints)
    const parent = el.parentElement;
    if (parent) {
      // Look for a sibling or cousin label
      const closestLabel = parent.querySelector('label') ||
                           parent.parentElement?.querySelector('label');
      if (closestLabel && !closestLabel.contains(el)) {
        push(closestLabel.textContent);
      }
      // Look for th/td header in a table
      const td = el.closest('td');
      if (td) {
        const th = td.previousElementSibling;
        if (th) push(th.textContent);
      }
      // Axol-style: radio/checkbox row header (th in same row)
      const tr = el.closest('tr');
      if (tr) {
        const rowTh = tr.querySelector('th');
        if (rowTh) push(rowTh.textContent);
      }
      // Fieldset legend
      const fs = el.closest('fieldset');
      if (fs) {
        const leg = fs.querySelector('legend');
        if (leg) push(leg.textContent);
      }
    }

    return signals;
  }

  /**
   * Score a single element against a field definition
   */
  function scoreElement(el, fieldDef) {
    /* Axol: 「メールアドレス２」のラベルにも「メールアドレス」が含まれ、別名が多い key:email に
       強くヒットすると kmail が本体扱いになる。サブメール未設定時は normalize が kmail を破棄し空欄になる。 */
    const nm = String(el?.name || '');
    if (fieldDef.key === 'email' && /^(email2|kmail|kmail2)$/i.test(nm)) return 0;

    const signals = getElementSignals(el);
    let score = 0;

    for (const alias of fieldDef.aliases) {
      const re = new RegExp(alias, 'i');
      for (const sig of signals) {
        if (re.test(sig)) {
          // Exact match scores higher
          score += sig === alias ? 3 : 1;
        }
      }
    }
    return score;
  }

  /**
   * Axol 等で `position: fixed` 祖先により `offsetParent === null` でも入力可能なことがある。
   * `checkVisibility` は content-visibility 等で誤判定しうるため、祖先チェーンのみ見る。
   */
  function isFillableVisible(el) {
    if (!el || !el.isConnected) return false;
    let node = el;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  }

  /**
   * Find all fillable inputs/selects on the page
   */
  function getFillableElements() {
    return Array.from(document.querySelectorAll(
      'input:not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=file]):not([type=hidden]):not([disabled]):not([readonly]), ' +
      'select:not([disabled]):not([readonly]), ' +
      'textarea:not([disabled]):not([readonly])'
    )).filter(isFillableVisible);
  }

  /**
   * Main matching: returns Map<HTMLElement, fieldKey>
   */
  function matchFields(elements) {
    const results = new Map(); // el → { key, score }

    for (const el of elements) {
      let bestKey = null;
      let bestScore = 0;

      for (const def of FIELD_DEFS) {
        if (def.virtual) continue;
        const score = scoreElement(el, def);
        if (score > bestScore) {
          bestScore = score;
          bestKey = def.key;
        }
      }

      if (bestScore >= 1) {
        results.set(el, { key: bestKey, score: bestScore });
      }
    }
    return results;
  }

  function firstKatakanaFromString(str) {
    if (!str) return '';
    const kat = typeof FuriganaUtil !== 'undefined'
      ? FuriganaUtil.toKatakana(String(str).trim())
      : String(str).trim();
    for (const ch of kat) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x30A1 && cp <= 0x30FA) return ch;
      if (cp >= 0x30FD && cp <= 0x30FF) return ch;
    }
    return '';
  }

  function computeSchoolSearchInitial(profile) {
    const e = profile.education || {};
    if ((e.schoolSearchInitial || '').trim()) return String(e.schoolSearchInitial).trim();
    const type = e.schoolType || '';
    let kana = '';
    if (/大学院/.test(type)) kana = e.gradSchoolKana || e.univKana || '';
    else kana = e.univKana || e.gradSchoolKana || '';
    return firstKatakanaFromString(kana);
  }

  /**
   * Axol など「メール」「確認」「メールアドレス2(kmail/kmail2)」が同名ではなく並ぶレイアウト向け。
   * DOM の並べ・キーフィールド混線で kmail にメインアドレスが入る問題を避けるため、name で値を固定する。
   */
  function normalizeMailAssignments(plan, flat) {
    const MAIL_NAMES = ['email', 'email2', 'kmail', 'kmail2'];
    const MAIL_SET = new Set(MAIL_NAMES);
    const mailRows = [];
    let rest = [];
    for (const p of plan) {
      const n = p.el?.name;
      if (MAIL_SET.has(n)) mailRows.push({ ...p });
      else rest.push(p);
    }
    /* name は kmail だが matcher が別キーにした行が rest に残ることがあるため回収 */
    const restOut = [];
    for (const p of rest) {
      const n = p.el?.name;
      if (MAIL_SET.has(n)) mailRows.push({ ...p });
      else restOut.push(p);
    }
    rest = restOut;

    if (!mailRows.length) return plan;

    const byName = {};
    for (const r of mailRows) {
      if (!byName[r.el.name]) byName[r.el.name] = r;
    }

    const main = String(flat.email || '').trim();
    const sub = String(flat.emailSub1 || '').trim();

    if (!main) {
      delete byName.email;
      delete byName.email2;
    } else {
      if (byName.email) {
        byName.email.value = main;
        byName.email.key = 'email';
      }
      if (byName.email2) {
        byName.email2.value = main;
        byName.email2.key = 'emailConfirm';
      }
    }

    if (!sub) {
      delete byName.kmail;
      delete byName.kmail2;
    } else {
      if (byName.kmail) {
        byName.kmail.value = sub;
        byName.kmail.key = 'emailSub1';
      }
      if (byName.kmail2) {
        byName.kmail2.value = sub;
        byName.kmail2.key = 'secondaryEmailConfirm';
      }
    }

    const orderedMail = MAIL_NAMES.map((n) => byName[n]).filter(Boolean);
    return [...rest, ...orderedMail];
  }

  /**
   * accountN / domainN のペアへメールを @ 分割で流し込む（NRI の E-mail + 確認 + サブ等）。
   */
  function normalizeAccountDomainPairs(plan, flat) {
    const pairRows = {};
    for (const row of plan) {
      const m = /^(account|domain)(\d+)$/.exec(row.el?.name || '');
      if (!m) continue;
      const kind = m[1];
      const num = m[2];
      if (!pairRows[num]) pairRows[num] = {};
      pairRows[num][kind] = row;
    }

    const completeNums = Object.keys(pairRows).filter((n) => pairRows[n].account && pairRows[n].domain);
    if (!completeNums.length) return plan;

    const rest = [];
    for (const row of plan) {
      const m = /^(account|domain)(\d+)$/.exec(row.el?.name || '');
      if (m && completeNums.includes(m[2])) continue;
      rest.push(row);
    }

    completeNums.sort((a, b) => Number(a) - Number(b));
    for (const num of completeNums) {
      const pair = pairRows[num];
      const n = Number(num);
      const raw = n <= 2 ? String(flat.email || '').trim() : String(flat.emailSub1 || '').trim();
      const localEnd = raw.indexOf('@');
      const local = localEnd < 0 ? raw : raw.slice(0, localEnd);
      const host = localEnd < 0 ? '' : raw.slice(localEnd + 1);
      pair.account.value = local;
      pair.domain.value = host;
      if (n <= 2) {
        pair.account.key = n === 1 ? 'email' : 'emailConfirm';
        pair.domain.key = n === 1 ? 'email' : 'emailConfirm';
      } else {
        pair.account.key = n === 3 ? 'emailSub1' : 'secondaryEmailConfirm';
        pair.domain.key = n === 3 ? 'emailSub1' : 'secondaryEmailConfirm';
      }
      rest.push(pair.account, pair.domain);
    }

    return rest;
  }

  /**
   * Get flattened profile values
   */
  function flattenProfile(profile) {
    const b = profile.basic || {};
    const c = profile.contact || {};
    const e = profile.education || {};

    const mobile = [c.mobile1, c.mobile2, c.mobile3].filter(Boolean).join('-');
    const homePhone = [c.homePhone1, c.homePhone2, c.homePhone3].filter(Boolean).join('-');
    const zip = [c.zip1, c.zip2].filter(Boolean).join('-');

    const degree =
      (e.degree || '').trim() ||
      (/博士/.test(e.schoolType || '') ? '博士' : '') ||
      (/修士/.test(e.schoolType || '') ? '修士' : '');

    return {
      lastName: b.lastName || '',
      firstName: b.firstName || '',
      lastKana: b.lastKana || '',
      firstKana: b.firstKana || '',
      romajiLast: b.romajiLast || '',
      romajiFirst: b.romajiFirst || '',
      fullName: `${b.lastName || ''} ${b.firstName || ''}`.trim(),
      fullKana: `${b.lastKana || ''} ${b.firstKana || ''}`.trim(),
      gender: b.gender || '',
      dob: b.dobYear ? `${b.dobYear}/${String(b.dobMonth).padStart(2,'0')}/${String(b.dobDay).padStart(2,'0')}` : '',
      dobYear: b.dobYear || '',
      dobMonth: b.dobMonth || '',
      dobDay: b.dobDay || '',

      email: c.email || '',
      emailConfirm: c.email || '',
      emailSub1: c.emailSub1 || '',
      emailSub2: c.emailSub2 || '',
      secondaryEmailConfirm: c.emailSub1 || '',
      mobile, mobile1: c.mobile1 || '', mobile2: c.mobile2 || '', mobile3: c.mobile3 || '',
      homePhone, homePhone1: c.homePhone1 || '', homePhone2: c.homePhone2 || '', homePhone3: c.homePhone3 || '',
      zip, zip1: c.zip1 || '', zip2: c.zip2 || '',
      prefecture: c.prefecture || '',
      city: c.city || '',
      address: c.address || '',
      building: c.building || '',
      homePrefecture: c.homePrefecture || '',
      homeCity: c.homeCity || '',
      homeAddress: c.homeAddress || '',
      homeBuilding: c.homeBuilding || '',

      schoolType: e.schoolType || '',
      schoolSetup: e.schoolSetup || '',
      degree,
      departmentSystem: e.departmentSystem || '',
      seminarLab: e.seminarLab || '',
      schoolSearchInitial: computeSchoolSearchInitial(profile),
      gradSchoolName: e.gradSchoolName || '',
      gradSchoolKana: e.gradSchoolKana || '',
      gradSchoolPref: e.gradSchoolPref || '',
      gradFaculty: e.gradFaculty || '',
      gradDept: e.gradDept || '',
      gradSchoolEnrollYear: e.gradSchoolEnrollYear || '',
      gradSchoolEnrollMonth: e.gradSchoolEnrollMonth || '',
      gradSchoolGradYear: e.gradSchoolGradYear || '',
      gradSchoolGradMonth: e.gradSchoolGradMonth || '',
      univName: e.univName || '',
      univKana: e.univKana || '',
      univPref: e.univPref || '',
      faculty: e.faculty || '',
      dept: e.dept || '',
      enrollYear: e.enrollYear || '',
      enrollMonth: e.enrollMonth || '',
      gradYear: e.gradYear || '',
      gradMonth: e.gradMonth || '',
      highSchoolPref: e.highSchoolPref || '',
      highSchoolName: e.highSchoolName || '',
      highSchoolSearchWord: e.highSchoolSearchWord || '',
      highSchoolEnrollYear: e.highSchoolEnrollYear || '',
      highSchoolEnrollMonth: e.highSchoolEnrollMonth || '',
      highSchoolGradYear: e.highSchoolGradYear || '',
      highSchoolGradMonth: e.highSchoolGradMonth || '',
    };
  }

  /**
   * Build fill plan: array of { el, value, key }
   */
  function buildFillPlan(profile) {
    const elements = getFillableElements();
    const matches = matchFields(elements);
    const flat = flattenProfile(profile);
    const plan = [];

    for (const [el, { key }] of matches) {
      const value = flat[key];
      if (value !== undefined && value !== '') {
        plan.push({ el, key, value: String(value) });
      }
    }
    let out = normalizeMailAssignments(plan, flat);
    out = normalizeAccountDomainPairs(out, flat);
    return out;
  }

  return {
    matchFields,
    getFillableElements,
    isFillableVisible,
    buildFillPlan,
    flattenProfile,
    normalizeMailAssignments,
    FIELD_DEFS,
  };
})();

if (typeof window !== 'undefined') {
  window.FieldMatcher = FieldMatcher;
}
