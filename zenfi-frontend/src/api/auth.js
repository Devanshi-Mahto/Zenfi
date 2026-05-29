// ─── Auth API ──────────────────────────────────────────────────────
// These use axiosInstance but auth endpoints skip the Bearer header
// via the PUBLIC_PATHS check in axiosInstance.js
import axiosInstance from './axiosInstance';

export const login   = (username, password) =>
  axiosInstance.post('/login/', { username, password });

export const signup  = (username, password, email = '') =>
  axiosInstance.post('/signup/', { username, password, email });

export const refresh = (refreshToken) =>
  axiosInstance.post('/refresh/', { refresh: refreshToken });

export const getMe   = () =>
  axiosInstance.get('/me/');

export const updateMe = (data) =>
  axiosInstance.patch('/me/', data);
