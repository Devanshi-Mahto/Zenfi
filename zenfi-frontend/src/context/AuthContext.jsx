/**
 * AuthContext – Real JWT authentication via Django REST Framework + Simple JWT.
 *
 * Login/Signup ONLY succeed with valid database credentials.
 * No demo/mock fallbacks.
 *
 * Token storage:
 *   zenfi_access   – JWT access token  (1-day lifetime)
 *   zenfi_refresh  – JWT refresh token (30-day lifetime)
 *   zenfi_user     – { id, username, email } from /api/me/
 *
 * Auto-login: if a valid access token exists in localStorage on mount,
 *             the user is considered authenticated immediately.
 * Token refresh: axiosInstance handles 401s transparently.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';

export const AuthContext = createContext(null);

// ─── Helpers ──────────────────────────────────────────────────────
const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('zenfi_user')); }
  catch { return null; }
};

const persistTokens = (access, refresh, userData) => {
  localStorage.setItem('zenfi_access',  access);
  localStorage.setItem('zenfi_refresh', refresh);
  localStorage.setItem('zenfi_user',    JSON.stringify(userData));
};

const clearStorage = () => {
  ['zenfi_access', 'zenfi_refresh', 'zenfi_user'].forEach(k =>
    localStorage.removeItem(k)
  );
};

// ─── Provider ─────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(getStoredUser);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // On mount: if we have a stored access token, fetch /api/me/ to
  // validate it's still good and refresh the user object.
  useEffect(() => {
    const token = localStorage.getItem('zenfi_access');
    if (!token || !getStoredUser()) return;   // not logged in

    let cancelled = false;
    axiosInstance.get('/me/')
      .then(res => {
        if (!cancelled) {
          const u = {
            id: res.data.id,
            username: res.data.username,
            email: res.data.email,
            monthly_budget: res.data.monthly_budget,
          };
          localStorage.setItem('zenfi_user', JSON.stringify(u));
          setUser(u);
        }
      })
      .catch(() => {
        // Token invalid/expired and refresh also failed → force logout
        if (!cancelled) {
          clearStorage();
          setUser(null);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Login ──────────────────────────────────────────────────────
  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      // TokenObtainPairView: POST /api/login/ → { access, refresh }
      const res = await axiosInstance.post('/login/', { username, password });
      const { access, refresh } = res.data;

      // Persist tokens first so /me/ request is authenticated
      localStorage.setItem('zenfi_access',  access);
      localStorage.setItem('zenfi_refresh', refresh);

      // Fetch real user profile
      const meRes = await axiosInstance.get('/me/');
      const userData = {
        id: meRes.data.id,
        username: meRes.data.username,
        email: meRes.data.email,
        monthly_budget: meRes.data.monthly_budget,
      };
      persistTokens(access, refresh, userData);
      setUser(userData);
      return true;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.username?.[0] ||
        (err.response?.status === 401
          ? 'Invalid username or password. Please try again.'
          : err.response?.status === 400
          ? 'Please fill in all required fields.'
          : 'Could not connect to server. Please check your connection.');
      setError(msg);
      clearStorage();
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Signup ─────────────────────────────────────────────────────
  const signup = useCallback(async (username, password, email = '') => {
    setLoading(true);
    setError(null);
    try {
      // POST /api/signup/ → 201 Created
      await axiosInstance.post('/signup/', { username, password, email });
      // Immediately log the user in
      return await login(username, password);
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg;
      if (detail) {
        // detail may be an object like { username: ['Username already taken.'] }
        if (typeof detail === 'string') {
          msg = detail;
        } else if (typeof detail === 'object') {
          const firstField = Object.values(detail)[0];
          msg = Array.isArray(firstField) ? firstField[0] : JSON.stringify(detail);
        }
      }
      msg = msg
        || err.response?.data?.error
        || err.response?.data?.username?.[0]
        || err.response?.data?.email?.[0]
        || 'Signup failed. Username may already be taken.';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [login]);

  // ── Logout ─────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearStorage();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      signup,
      logout,
      clearError,
      isAuthenticated: !!user && !!localStorage.getItem('zenfi_access'),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
