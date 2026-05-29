// ─── Dashboard API ─────────────────────────────────────────────────
import axiosInstance from './axiosInstance';

export const getDashboard = () => axiosInstance.get('/dashboard/');
