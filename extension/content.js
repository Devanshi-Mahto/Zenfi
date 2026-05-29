/**
 * ZenFi content script — product detection + floating purchase assistant
 */
(function () {
  const ZenFi = window.ZenFi;
  if (!ZenFi?.scrapeProduct) return;

  const KEYS = ZenFi.CONSTANTS.STORAGE_KEYS;
  let debounceTimer = null;
  let lastUrl = '';
  let widgetEl = null;
  let isMinimized = false;

  function createWidget() {
    if (document.getElementById('zenfi-assistant-root')) return;

    const root = document.createElement('div');
    root.id = 'zenfi-assistant-root';
    root.innerHTML = `
      <div class="zenfi-widget" id="zenfi-widget">
        <div class="zenfi-header">
          <div class="zenfi-brand">
            <div class="zenfi-logo">Z</div>
            <span>ZenFi Assistant</span>
          </div>
          <div class="zenfi-actions">
            <button class="zenfi-btn-icon" id="zenfi-minimize" title="Minimize">−</button>
            <button class="zenfi-btn-icon" id="zenfi-close" title="Dismiss">×</button>
          </div>
        </div>
        <div class="zenfi-body" id="zenfi-body">
          <div class="zenfi-loading"><span class="zenfi-spinner"></span>Analyzing purchase…</div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    widgetEl = root.querySelector('#zenfi-widget');

    root.querySelector('#zenfi-close').addEventListener('click', () => {
      root.remove();
      widgetEl = null;
    });

    root.querySelector('#zenfi-minimize').addEventListener('click', () => {
      isMinimized = !isMinimized;
      widgetEl.classList.toggle('zenfi-minimized', isMinimized);
    });
  }

  function renderLoading() {
    const body = document.getElementById('zenfi-body');
    if (!body) return;
    body.innerHTML = '<div class="zenfi-loading"><span class="zenfi-spinner"></span>Analyzing purchase…</div>';
  }

  function renderLoginPrompt() {
    const body = document.getElementById('zenfi-body');
    if (!body) return;
    const url = ZenFi.CONSTANTS.WEB_APP_URL;
    body.innerHTML = `
      <div class="zenfi-login-prompt">
        <p>Sign in to ZenFi to get AI purchase insights.</p>
        <p style="margin-top:8px"><a href="${url}/login" target="_blank">Open ZenFi →</a></p>
      </div>
    `;
  }

  function renderAnalysis(product, analysis) {
    const body = document.getElementById('zenfi-body');
    if (!body) return;

    const score = analysis.recommendation_score ?? 50;
    const label = ZenFi.format.scoreLabel(score);
    const emoji = ZenFi.format.recommendationEmoji(analysis.recommendation);

    const insights = (analysis.insights || []).slice(0, 4);
    const aiLine = analysis.ai_summary;

    const insightsHtml = insights
      .map((msg) => `<li>${escapeHtml(msg)}</li>`)
      .join('');

    const imgHtml = product.image
      ? `<img src="${escapeAttr(product.image)}" alt="" />`
      : '';

    body.innerHTML = `
      <div class="zenfi-product">
        ${imgHtml ? `<div>${imgHtml}</div>` : ''}
        <div>
          <div class="zenfi-product-title">${escapeHtml(product.title)}</div>
          <div class="zenfi-product-price">${ZenFi.format.currency(product.price)}</div>
        </div>
      </div>
      <div class="zenfi-score ${label.class}">
        <span>${emoji} ${label.text}</span>
        <span>${score}/100</span>
      </div>
      <ul class="zenfi-insights">
        ${aiLine ? `<li class="zenfi-ai">${escapeHtml(aiLine)}</li>` : ''}
        ${insightsHtml}
      </ul>
    `;
  }

  function renderError(msg) {
    const body = document.getElementById('zenfi-body');
    if (!body) return;
    body.innerHTML = `<div class="zenfi-error">${escapeHtml(msg)}</div>`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  async function runAnalysis() {
    const product = ZenFi.scrapeProduct();
    if (!product || (!product.title && !product.price)) return;

    createWidget();
    renderLoading();

    const authed = await ZenFi.storage.isAuthenticated();
    if (!authed) {
      renderLoginPrompt();
      return;
    }

    try {
      const analysis = await ZenFi.api.analyzePurchase(product);
      renderAnalysis(product, analysis);

      await ZenFi.storage.set({
        [KEYS.LAST_PRODUCT]: product,
        [KEYS.LAST_ANALYSIS]: analysis,
      });

      chrome.runtime.sendMessage({
        type: 'ZENFI_ANALYSIS_DONE',
        product,
        analysis,
      }).catch(() => {});
    } catch (err) {
      if (err.code === 'AUTH_REQUIRED') {
        renderLoginPrompt();
      } else {
        renderError(err.message || 'Could not analyze this purchase.');
      }
    }
  }

  function scheduleAnalysis() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runAnalysis, ZenFi.CONSTANTS.DEBOUNCE_MS);
  }

  function onNavigation() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;

    const scraper = ZenFi.getScraper();
    if (!scraper?.isProductPage()) {
      const root = document.getElementById('zenfi-assistant-root');
      if (root) root.remove();
      widgetEl = null;
      return;
    }
    scheduleAnalysis();
  }

  // SPA / dynamic page updates
  const observer = new MutationObserver(() => {
    const scraper = ZenFi.getScraper();
    if (scraper?.isProductPage()) scheduleAnalysis();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', onNavigation);

  const _push = history.pushState;
  history.pushState = function (...args) {
    _push.apply(this, args);
    onNavigation();
  };

  const _replace = history.replaceState;
  history.replaceState = function (...args) {
    _replace.apply(this, args);
    onNavigation();
  };

  lastUrl = location.href;
  onNavigation();
})();
