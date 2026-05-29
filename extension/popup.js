/**
 * ZenFi extension popup — auth, summary, quick expense, purchase warnings
 */
(function () {
  const ZenFi = globalThis.ZenFi;
  const KEYS = ZenFi.CONSTANTS.STORAGE_KEYS;

  const viewLogin = document.getElementById('view-login');
  const viewMain = document.getElementById('view-main');
  const viewLoading = document.getElementById('view-loading');
  const loginForm = document.getElementById('login-form');
  const expenseForm = document.getElementById('expense-form');
  const toast = document.getElementById('toast');

  function showView(name) {
    viewLogin.classList.add('hidden');
    viewMain.classList.add('hidden');
    viewLoading.classList.add('hidden');
    if (name === 'login') viewLogin.classList.remove('hidden');
    if (name === 'main') viewMain.classList.remove('hidden');
    if (name === 'loading') viewLoading.classList.remove('hidden');
  }

  function showToast(msg, type = 'success') {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('hidden'), 2800);
  }

  function renderSummary(data) {
    const spent = data.monthly_spent || 0;
    const budget = data.monthly_budget || 30000;
    const left = data.budget_remaining ?? Math.max(budget - spent, 0);
    const pct = data.budget_used_pct ?? Math.round((spent / budget) * 100);

    document.getElementById('month-total').textContent = ZenFi.format.currency(spent);
    document.getElementById('budget-left').textContent = ZenFi.format.currency(left);
    document.getElementById('budget-pct').textContent = `${pct}%`;
    const bar = document.getElementById('budget-progress');
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.className = 'progress-fill';
    if (pct >= 90) bar.classList.add('danger');
    else if (pct >= 70) bar.classList.add('warn');

    document.getElementById('user-greeting').textContent = data.username
      ? `Hi, ${data.username}`
      : 'Spending Assistant';
  }

  function renderGoals(goals) {
    const el = document.getElementById('goals-list');
    if (!goals?.length) {
      el.innerHTML = '<div class="empty-state">No goals yet</div>';
      return;
    }
    el.innerHTML = goals.slice(0, 3).map((g) => `
      <div class="goal-item">
        <div class="goal-head">
          <span>${escapeHtml(g.title)}</span>
          <span>${g.progress}%</span>
        </div>
        <div class="goal-bar"><div class="goal-fill" style="width:${g.progress}%"></div></div>
      </div>
    `).join('');
  }

  function renderPurchaseWarning() {
    chrome.storage.local.get([KEYS.LAST_ANALYSIS], (data) => {
      const analysis = data[KEYS.LAST_ANALYSIS];
      const card = document.getElementById('purchase-warning');
      const text = document.getElementById('purchase-warning-text');
      if (!analysis?.insights?.length) {
        card.classList.add('hidden');
        return;
      }
      const line = analysis.ai_summary || analysis.insights[0];
      text.textContent = line;
      card.classList.remove('hidden');
      if (analysis.recommendation === 'avoid') card.classList.add('critical');
      else card.classList.remove('critical');
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function loadMain() {
    showView('loading');
    try {
      const summary = await ZenFi.api.getSummary();
      renderSummary(summary);
      renderGoals(summary.active_goals);
      renderPurchaseWarning();
      showView('main');
    } catch (err) {
      if (err.code === 'AUTH_REQUIRED') {
        showView('login');
      } else {
        showToast(err.message || 'Failed to load', 'error');
        showView('main');
      }
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    try {
      const tokens = await ZenFi.api.login(username, password);
      const me = await fetch(`${ZenFi.CONSTANTS.API_BASE}/me/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      }).then((r) => r.json());

      await ZenFi.storage.saveTokens(tokens.access, tokens.refresh, {
        id: me.id,
        username: me.username,
        email: me.email,
      });
      showToast('Signed in!', 'success');
      await loadMain();
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await ZenFi.storage.clearAuth();
    showView('login');
    showToast('Signed out', 'success');
  });

  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('btn-spinner');
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
      await ZenFi.api.addQuickExpense({
        description: document.getElementById('description').value,
        amount: document.getElementById('amount').value,
        category: document.getElementById('category').value,
      });
      expenseForm.reset();
      showToast('Expense added!', 'success');
      await loadMain();
    } catch (err) {
      showToast(err.message || 'Could not save', 'error');
    } finally {
      btnText.classList.remove('hidden');
      spinner.classList.add('hidden');
    }
  });

  document.getElementById('reminder-toggle').addEventListener('change', (e) => {
    chrome.runtime.sendMessage({
      type: 'ZENFI_SET_REMINDER',
      enabled: e.target.checked,
    });
    ZenFi.storage.set({ [KEYS.REMINDER]: String(e.target.checked) });
  });

  (async function init() {
    document.getElementById('open-app').href = ZenFi.CONSTANTS.WEB_APP_URL;
    document.getElementById('footer-link').href = ZenFi.CONSTANTS.WEB_APP_URL;

    const reminder = await ZenFi.storage.get([KEYS.REMINDER]);
    document.getElementById('reminder-toggle').checked =
      reminder[KEYS.REMINDER] === 'true';

    const authed = await ZenFi.storage.isAuthenticated();
    if (authed) await loadMain();
    else showView('login');
  })();
})();
