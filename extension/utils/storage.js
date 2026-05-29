/**
 * chrome.storage.local wrappers (JWT + cache)
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};
  const KEYS = ZenFi.CONSTANTS?.STORAGE_KEYS || {};

  function get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function set(items) {
    return new Promise((resolve) => {
      chrome.storage.local.set(items, resolve);
    });
  }

  function remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  }

  ZenFi.storage = {
    get,
    set,
    remove,

    async getTokens() {
      const data = await get([KEYS.ACCESS, KEYS.REFRESH, KEYS.USER]);
      return {
        access: data[KEYS.ACCESS] || null,
        refresh: data[KEYS.REFRESH] || null,
        user: data[KEYS.USER] || null,
      };
    },

    async saveTokens(access, refresh, user) {
      await set({
        [KEYS.ACCESS]: access,
        [KEYS.REFRESH]: refresh,
        [KEYS.USER]: user,
      });
    },

    async clearAuth() {
      await remove([KEYS.ACCESS, KEYS.REFRESH, KEYS.USER]);
    },

    async isAuthenticated() {
      const { access } = await this.getTokens();
      return Boolean(access);
    },
  };

  g.ZenFi = ZenFi;
})();
