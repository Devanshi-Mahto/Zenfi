/**
 * ZenFi extension — shared constants
 */
const ZenFiGlobal = typeof globalThis !== 'undefined' ? globalThis : window;
ZenFiGlobal.ZenFi = ZenFiGlobal.ZenFi || {};

ZenFiGlobal.ZenFi.CONSTANTS = {
  API_BASE: 'http://localhost:8000/api',
  WEB_APP_URL: 'http://localhost:5173',
  STORAGE_KEYS: {
    ACCESS: 'zenfi_access',
    REFRESH: 'zenfi_refresh',
    USER: 'zenfi_user',
    REMINDER: 'zenfi_ext_reminder',
    LAST_PRODUCT: 'zenfi_last_product',
    LAST_ANALYSIS: 'zenfi_last_analysis',
  },
  SHOPPING_HOSTS: {
    amazon: /amazon\.(in|com)/i,
    flipkart: /flipkart\.com/i,
  },
  DEBOUNCE_MS: 1200,
  ALARM_BUDGET_CHECK: 'zenfi-budget-check',
  ALARM_REMINDER: 'zenfi-reminder',
};
