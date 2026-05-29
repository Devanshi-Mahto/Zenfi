// ─── Full Goals API ────────────────────────────────────────────────
import axiosInstance from './axiosInstance';

export const getGoals    = ()         => axiosInstance.get('/goals/');
export const createGoal  = (data)     => axiosInstance.post('/goals/', data);
export const updateGoal  = (id, data) => axiosInstance.put(`/goals/${id}/`, data);
export const patchGoal   = (id, data) => axiosInstance.patch(`/goals/${id}/`, data);
export const deleteGoal  = (id)       => axiosInstance.delete(`/goals/${id}/`);
export const predictGoal = (id)       => axiosInstance.get(`/goals/${id}/predict/`);
