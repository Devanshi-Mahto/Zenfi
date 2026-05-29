/**
 * Axios instance configured for ZenFi Django REST API.
 *
 * Features:
 *  - Attaches Bearer token to every request
 *  - Silent JWT refresh on 401 (queues concurrent requests)
 *  - Forces logout when refresh token is also expired/invalid
 *  - Auth endpoints (login, signup, refresh) are sent without Bearer header
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Public endpoints that must NOT carry a Bearer token (to avoid confusion)
const PUBLIC_PATHS = ['/login/', '/signup/', '/token/refresh/', '/refresh/'];

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ─── Request: attach access token ─────────────────────────────────
axiosInstance.interceptors.request.use((config) => {
  const isPublic = PUBLIC_PATHS.some(p => config.url?.includes(p));
  if (!isPublic) {
    const token = localStorage.getItem('zenfi_access');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response: silent refresh on 401 ──────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (err, token = null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token)
  );
  failedQueue = [];
};

const forceLogout = () => {
  ['zenfi_access', 'zenfi_refresh', 'zenfi_user'].forEach(k =>
    localStorage.removeItem(k)
  );
  // Only redirect if not already on an auth page
  if (!window.location.pathname.startsWith('/login') &&
      !window.location.pathname.startsWith('/register')) {
    window.location.href = '/login';
  }
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401 and only once per request
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Skip refresh for auth endpoints themselves
    const isAuthEndpoint = PUBLIC_PATHS.some(p => original.url?.includes(p));
    if (isAuthEndpoint) return Promise.reject(error);

    const refreshToken = localStorage.getItem('zenfi_refresh');
    if (!refreshToken) {
      forceLogout();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(original);
      }).catch(Promise.reject);
    }

    original._retry  = true;
    isRefreshing     = true;

    try {
      // Django Simple JWT refresh endpoint: POST /api/refresh/
      const res      = await axios.post(`${BASE_URL}/refresh/`, { refresh: refreshToken });
      const newAccess = res.data.access;
      // Also update refresh token if ROTATE_REFRESH_TOKENS=True
      if (res.data.refresh) {
        localStorage.setItem('zenfi_refresh', res.data.refresh);
      }
      localStorage.setItem('zenfi_access', newAccess);
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
      processQueue(null, newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return axiosInstance(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      forceLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
