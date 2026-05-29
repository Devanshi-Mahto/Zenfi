/**
 * Sanitize scraped product / user input before API calls
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};

  function stripHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.textContent.trim();
  }

  function parsePrice(raw) {
    if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.max(0, raw);
    const s = String(raw || '').replace(/[^\d.]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  ZenFi.sanitize = {
    product(data) {
      return {
        title: stripHtml(data.title).slice(0, 300) || 'Unknown product',
        price: parsePrice(data.price),
        category: stripHtml(data.category).slice(0, 80).toLowerCase(),
        url: String(data.url || location.href).slice(0, 500),
        image: String(data.image || '').slice(0, 500),
        site: stripHtml(data.site).slice(0, 32),
      };
    },

    expense(data) {
      return {
        description: stripHtml(data.description).slice(0, 500),
        amount: parsePrice(data.amount),
        category: stripHtml(data.category || 'shopping').slice(0, 50) || 'shopping',
        is_essential: Boolean(data.is_essential),
      };
    },
  };

  g.ZenFi = ZenFi;
})();
