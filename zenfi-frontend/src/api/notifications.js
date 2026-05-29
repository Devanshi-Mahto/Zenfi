import axiosInstance from './axiosInstance';

export const getNotifications = (params = {}) =>
  axiosInstance.get('/notifications/', { params });

export const getUnreadCount = () =>
  axiosInstance.get('/notifications/unread-count/');

export const markNotificationRead = (id) =>
  axiosInstance.post(`/notifications/${id}/read/`);

export const markAllNotificationsRead = () =>
  axiosInstance.post('/notifications/mark-all-read/');

export const deleteNotification = (id) =>
  axiosInstance.delete(`/notifications/${id}/`);

