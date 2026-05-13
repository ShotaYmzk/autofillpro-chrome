/**
 * Postal code → address lookup using zipcloud API
 * https://zipcloud.ibsnet.co.jp/api/search
 */

const PostalUtil = {
  /** 半角0–9 と全角０–９ のみ抽出して連結 */
  digitsOnly(str) {
    if (str == null || str === '') return '';
    let out = '';
    for (const ch of String(str)) {
      const code = ch.codePointAt(0);
      if (code >= 0xff10 && code <= 0xff19) {
        out += String.fromCharCode(code - 0xff10 + 0x30);
      } else if (ch >= '0' && ch <= '9') {
        out += ch;
      }
    }
    return out;
  },

  /**
   * 郵便番号を 3桁 + 4桁に正規化。
   * 3370006 / 337-0006 / 全角・ハイフン混在、または 337 と 0006 の分割入力に対応。
   */
  normalizeZipParts(zip1, zip2) {
    const raw1 = zip1 == null ? '' : String(zip1).trim();
    const raw2 = zip2 == null ? '' : String(zip2).trim();
    const d1 = this.digitsOnly(raw1);
    const d2 = this.digitsOnly(raw2);

    let all = '';
    if (d1.length >= 7 && !d2) {
      all = d1.slice(0, 7);
    } else if (!d1 && d2.length >= 7) {
      all = d2.slice(0, 7);
    } else {
      all = (d1 + d2).slice(0, 7);
    }

    if (all.length === 7) {
      return { zip1: all.slice(0, 3), zip2: all.slice(3) };
    }
    if (all.length > 7) {
      all = all.slice(0, 7);
      return { zip1: all.slice(0, 3), zip2: all.slice(3) };
    }
    if (all.length > 3) {
      return { zip1: all.slice(0, 3), zip2: all.slice(3) };
    }
    if (all.length > 0) {
      return { zip1: all, zip2: '' };
    }
    return { zip1: '', zip2: '' };
  },

  async lookup(zip) {
    const code = this.digitsOnly(zip);
    if (code.length !== 7) return null;

    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`);
      const json = await res.json();
      if (json.status === 200 && json.results && json.results.length > 0) {
        const r = json.results[0];
        return {
          prefecture: r.address1,
          city: r.address2,
          address: r.address3,
          prefectureKana: r.kana1,
          cityKana: r.kana2,
          addressKana: r.kana3,
        };
      }
    } catch (_) {
      // network error — fail silently
    }
    return null;
  },
};

if (typeof window !== 'undefined') {
  window.PostalUtil = PostalUtil;
}
