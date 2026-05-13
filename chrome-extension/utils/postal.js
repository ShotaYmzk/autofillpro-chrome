/**
 * Postal code → address lookup using zipcloud API
 * https://zipcloud.ibsnet.co.jp/api/search
 */

const PostalUtil = {
  async lookup(zip) {
    const code = zip.replace(/[^0-9]/g, '');
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
