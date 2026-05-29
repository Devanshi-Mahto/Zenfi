/**
 * Django REST API client for ZenFi extension
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};
  const API_BASE = ZenFi.CONSTANTS?.API_BASE || 'http://localhost:8000/api';

  async function getAccessToken() {
    const { access } = await ZenFi.storage.getTokens();
    return access;
  }

  async function refreshAccessToken() {
    const data = await ZenFi.storage.get([ZenFi.CONSTANTS.STORAGE_KEYS.REFRESH]);
    const refresh = data[ZenFi.CONSTANTS.STORAGE_KEYS.REFRESH];
    if (!refresh) throw new Error('No refresh token');

    const res = await fetch(`${API_BASE}/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) throw new Error('Refresh failed');

    const json = await res.json();
    const items = { [ZenFi.CONSTANTS.STORAGE_KEYS.ACCESS]: json.access };
    if (json.refresh) items[ZenFi.CONSTANTS.STORAGE_KEYS.REFRESH] = json.refresh;
    await ZenFi.storage.set(items);
    return json.access;
  }

  async function request(path, options = {}, retry = true) {
    const token = await getAccessToken();
    if (!token) {
      const err = new Error('Not authenticated');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && retry) {
      try {
        await refreshAccessToken();
        return request(path, options, false);
      } catch {
        await ZenFi.storage.clearAuth();
        const err = new Error('Session expired');
        err.code = 'AUTH_REQUIRED';
        throw err;
      }
    }

    let body = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { detail: text };
      }
    }

    if (!res.ok) {
      const err = new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  ZenFi.api = {
    login(username, password) {
      return fetch(`${API_BASE}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail || 'Login failed');
        return body;
      });
    },

    async fetchMe() {
      return request('/me/');
    },

    async getSummary() {
      return request('/extension/summary/');
    },

    async analyzePurchase(product) {
      const safe = ZenFi.sanitize.product(product);
      return request('/extension/analyze/', {
        method: 'POST',
        body: JSON.stringify(safe),
      });
    },

    async addQuickExpense(expense) {
      const safe = ZenFi.sanitize.expense(expense);
      return request('/extension/quick-expense/', {
        method: 'POST',
        body: JSON.stringify(safe),
      });
    },

    async getGoals() {
      return request('/goals/');
    },

    async addExpense(expense) {
      const safe = ZenFi.sanitize.expense(expense);
      return request('/expenses/', {
        method: 'POST',
        body: JSON.stringify(safe),
      });
    },
  };

  g.ZenFi = ZenFi;
})();
