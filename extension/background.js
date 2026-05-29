/**
 * ZenFi service worker — notifications, budget checks, message hub
 */
importScripts(
  'utils/constants.js',
  'utils/storage.js',
  'services/api.js'
);

const C = globalThis.ZenFi?.CONSTANTS || {};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(C.ALARM_BUDGET_CHECK, { periodInMinutes: 360 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === C.ALARM_BUDGET_CHECK) {
    await checkBudgetAndNotify();
  }
  if (alarm.name === C.ALARM_REMINDER) {
    chrome.notifications.create('zenfi-reminder', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'ZenFi',
      message: 'Remember to log your expenses today!',
    });
  }
});

async function checkBudgetAndNotify() {
  try {
    const authed = await ZenFi.storage.isAuthenticated();
    if (!authed) return;

    const summary = await ZenFi.api.getSummary();
    const pct = summary.budget_used_pct || 0;

    if (pct >= 90) {
      chrome.notifications.create('zenfi-budget-critical', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'ZenFi — Budget Alert',
        message: `You've used ${pct}% of your monthly budget. Slow down on spending!`,
      });
    } else if (pct >= 75) {
      chrome.notifications.create('zenfi-budget-warning', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'ZenFi — Budget Warning',
        message: `${pct}% of monthly budget used. ₹${Math.round(summary.budget_remaining).toLocaleString('en-IN')} left.`,
      });
    }
  } catch (e) {
    console.debug('[ZenFi] budget check skipped', e);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ZENFI_GET_SUMMARY') {
    ZenFi.api.getSummary()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message, code: err.code }));
    return true;
  }

  if (msg.type === 'ZENFI_ANALYZE') {
    ZenFi.api.analyzePurchase(msg.product)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message, code: err.code }));
    return true;
  }

  if (msg.type === 'ZENFI_QUICK_EXPENSE') {
    ZenFi.api.addQuickExpense(msg.expense)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === 'ZENFI_SET_REMINDER') {
    if (msg.enabled) {
      chrome.alarms.create(C.ALARM_REMINDER, { periodInMinutes: 60 * 20 });
    } else {
      chrome.alarms.clear(C.ALARM_REMINDER);
    }
    sendResponse({ ok: true });
    return true;
  }
});
