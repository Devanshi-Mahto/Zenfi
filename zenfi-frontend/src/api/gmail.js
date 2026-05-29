import axiosInstance from './axiosInstance';

export const getGmailStatus = () =>
  axiosInstance.get('/gmail/status/');

export const getGmailConnectUrl = () =>
  axiosInstance.get('/gmail/connect/');

export const disconnectGmail = () =>
  axiosInstance.post('/gmail/disconnect/');

export const reconnectGmail = () =>
  axiosInstance.post('/gmail/reconnect/');

export const updateGmailSettings = (data) =>
  axiosInstance.patch('/gmail/settings/', data);

/** Sync inbox immediately (default). Pass async=true only if Celery worker is running. */
export const triggerGmailSync = (asyncMode = false) =>
  axiosInstance.post('/gmail/sync/', { async: asyncMode });

export const getParsedExpenses = (status = 'pending') =>
  axiosInstance.get('/gmail/parsed/', { params: { status } });

export const approveParsedExpense = (id, data = {}) =>
  axiosInstance.post(`/gmail/parsed/${id}/`, { action: 'approve', ...data });

export const rejectParsedExpense = (id) =>
  axiosInstance.post(`/gmail/parsed/${id}/`, { action: 'reject' });

export const getGmailSyncLogs = () =>
  axiosInstance.get('/gmail/sync-logs/');
