// ─── Full Expenses API ─────────────────────────────────────────────
import axiosInstance from './axiosInstance';

export const getExpenses   = (params = {}) => axiosInstance.get('/expenses/', { params });
export const addExpense    = (data)        => axiosInstance.post('/expenses/', data);
export const deleteExpense = (id)          => axiosInstance.delete(`/expenses/${id}/`);
export const categorize    = (data)        => axiosInstance.post('/categorize/', data);
