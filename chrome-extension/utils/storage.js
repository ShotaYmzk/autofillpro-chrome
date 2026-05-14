/**
 * chrome.storage.local wrapper with defaults
 */

const DEFAULT_PROFILE = {
  id: 'default',
  name: 'メイン',
  basic: {
    // 初期値は空。画面のプレースホルダーに汎用例（山田太郎など）を表示
    lastName: '',
    firstName: '',
    lastKana: '',
    firstKana: '',
    romajiLast: '',
    romajiFirst: '',
    gender: '',
    dobYear: '',
    dobMonth: '',
    dobDay: '',
  },
  contact: {
    email: '',
    emailSub1: '',
    emailSub2: '',
    vacationSameAsCurrent: false,
    mobile1: '',
    mobile2: '',
    mobile3: '',
    homePhone1: '',
    homePhone2: '',
    homePhone3: '',
    zip1: '',
    zip2: '',
    prefecture: '',
    city: '',
    address: '',
    building: '',
    // 帰省先
    homePrefecture: '',
    homeCity: '',
    homeAddress: '',
    homeBuilding: '',
    homeZip1: '',
    homeZip2: '',
  },
  education: {
    schoolType: '',     // 大学院(修士)/大学/短大/専門学校
    schoolSetup: '',    // 国立/公立/私立
    degree: '',         // 修士 / 博士（大学院）
    departmentSystem: '', // 学科系統（サイト検索結果や自由入力）
    seminarLab: '',     // ゼミ・研究室
    schoolSearchInitial: '', // 学校名頭文字（空ならカナから自動）
    gradSchoolName: '',
    gradSchoolKana: '',
    univName: '',
    univKana: '',
    univPref: '',
    gradSchoolPref: '',
    faculty: '',
    dept: '',
    /** 申告文理区分（例: NRI dept-select の「文系」「理系」） */
    declaredStream: '',
    highSchoolPref: '',
    highSchoolName: '',
    highSchoolSearchWord: '',
    highSchoolEnrollYear: '',
    highSchoolEnrollMonth: '',
    highSchoolGradYear: '',
    highSchoolGradMonth: '',
    enrollYear: '',
    enrollMonth: '',
    gradYear: '',
    gradMonth: '',
    gradSchoolEnrollYear: '',
    gradSchoolEnrollMonth: '',
    gradSchoolGradYear: '',
    gradSchoolGradMonth: '',
  },
};

const DEFAULT_SETTINGS = {
  highlightFilled: true,
  previewBeforeFill: false,
  autoDetect: true,
  fillDelay: 50,
  showFloatingButton: true,
  /** true のときフローティングボタンは専用アダプタが効くページにのみ表示 */
  floatingButtonDedicatedSitesOnly: true,
};

const StorageUtil = {
  async get(keys) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(keys ?? null, (result) => {
          const err = chrome.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else resolve(result);
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  async set(data) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(data, () => {
          const err = chrome.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  async getProfiles() {
    const data = await this.get(['profiles', 'activeProfileId']);
    return {
      profiles: data.profiles || [{ ...DEFAULT_PROFILE }],
      activeProfileId: data.activeProfileId || 'default',
    };
  },

  async getActiveProfile() {
    const { profiles, activeProfileId } = await this.getProfiles();
    return profiles.find((p) => p.id === activeProfileId) || profiles[0] || { ...DEFAULT_PROFILE };
  },

  async saveProfile(profile) {
    const { profiles } = await this.getProfiles();
    const idx = profiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }
    await this.set({ profiles });
  },

  async deleteProfile(profileId) {
    const { profiles, activeProfileId } = await this.getProfiles();
    const updated = profiles.filter((p) => p.id !== profileId);
    const newActive = activeProfileId === profileId ? (updated[0]?.id || 'default') : activeProfileId;
    await this.set({ profiles: updated, activeProfileId: newActive });
  },

  async setActiveProfile(profileId) {
    await this.set({ activeProfileId: profileId });
  },

  async getSettings() {
    const data = await this.get(['settings']);
    return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  },

  async saveSettings(settings) {
    await this.set({ settings });
  },

  async getVisitedPages() {
    const data = await this.get(['visitedPages']);
    return data.visitedPages || [];
  },

  async addVisitedPage(url, title) {
    const pages = await this.getVisitedPages();
    const existing = pages.findIndex((p) => p.url === url);
    const entry = { url, title, visitedAt: Date.now() };
    if (existing >= 0) {
      pages[existing] = entry;
    } else {
      pages.unshift(entry);
    }
    // keep latest 100
    await this.set({ visitedPages: pages.slice(0, 100) });
  },

  async exportData() {
    const data = await this.get(null);
    return JSON.stringify(data, null, 2);
  },

  async importData(jsonString) {
    const data = JSON.parse(jsonString);
    await this.set(data);
  },

  DEFAULT_PROFILE,
};

// Make available globally (content scripts share scope per page)
if (typeof window !== 'undefined') {
  window.StorageUtil = StorageUtil;
}
