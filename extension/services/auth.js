/**
 * Auth helpers — JWT via chrome.storage (used by popup & content)
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};

  ZenFi.auth = {
    async login(username, password) {
      const tokens = await ZenFi.api.login(username, password);
      const me = await fetch(`${ZenFi.CONSTANTS.API_BASE}/me/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      }).then((r) => {
        if (!r.ok) throw new Error('Could not load profile');
        return r.json();
      });
      await ZenFi.storage.saveTokens(tokens.access, tokens.refresh, {
        id: me.id,
        username: me.username,
        email: me.email,
        monthly_budget: me.monthly_budget,
      });
      return me;
    },

    async logout() {
      await ZenFi.storage.clearAuth();
    },

    isAuthenticated() {
      return ZenFi.storage.isAuthenticated();
    },

    async requireAuth() {
      const ok = await ZenFi.storage.isAuthenticated();
      if (!ok) {
        const err = new Error('Authentication required');
        err.code = 'AUTH_REQUIRED';
        throw err;
      }
    },
  };

  g.ZenFi = ZenFi;
})();
