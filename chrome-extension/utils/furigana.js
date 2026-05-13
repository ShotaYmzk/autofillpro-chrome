/**
 * Furigana helper utilities
 * Provides katakana ↔ hiragana conversion and basic kana normalization
 */

const FuriganaUtil = {
  /**
   * Convert hiragana to katakana
   */
  toKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60)
    );
  },

  /**
   * Convert katakana to hiragana
   */
  toHiragana(str) {
    return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  },

  /**
   * Check if string contains only kana (hiragana or katakana)
   */
  isKanaOnly(str) {
    return /^[\u3040-\u30FF\s　]+$/.test(str);
  },

  /**
   * Normalize kana string: trim full-width spaces, convert to katakana
   */
  normalizeKana(str) {
    return this.toKatakana(str.trim().replace(/　/g, ' '));
  },

  /**
   * Convert full-width alphanumeric to half-width
   */
  toHalfWidth(str) {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    );
  },

  /**
   * Convert half-width katakana to full-width katakana
   */
  halfKanaToFull(str) {
    const map = {
      'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
      'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
      'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
      'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
      'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
      'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
      'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
      'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
      'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
      'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
      'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
      'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜',
    };
    return str.replace(/[ｦ-ﾟ]/g, (ch) => map[ch] || ch);
  },
};

if (typeof window !== 'undefined') {
  window.FuriganaUtil = FuriganaUtil;
}
