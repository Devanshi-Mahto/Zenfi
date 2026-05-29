// ─── AI API ────────────────────────────────────────────────────────
import axiosInstance from './axiosInstance';

export const sendAiMessage    = (question, session_id = 'default') =>
  axiosInstance.post('/chat/', { question, session_id });

export const getChatHistory   = (session_id = 'default') =>
  axiosInstance.get('/chat/history/', { params: { session_id } });

export const clearChatHistory = (session_id = 'default') =>
  axiosInstance.delete('/chat/history/', { params: { session_id } });

export const getInsights      = (params = {}) =>
  axiosInstance.get('/insights/', { params });

export const refreshInsights  = () =>
  axiosInstance.post('/insights/refresh/');

export const markInsightRead  = (id) =>
  axiosInstance.post(`/insights/${id}/read/`);
