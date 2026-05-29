/**
 * Formatting helpers
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};

  ZenFi.format = {
    currency(amount) {
      const n = Number(amount) || 0;
      return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    },

    scoreLabel(score) {
      if (score >= 70) return { text: 'Good to buy', class: 'zf-score-good' };
      if (score >= 45) return { text: 'Proceed with caution', class: 'zf-score-caution' };
      return { text: 'Not recommended', class: 'zf-score-bad' };
    },

    recommendationEmoji(rec) {
      if (rec === 'approve') return '✅';
      if (rec === 'caution') return '⚠️';
      return '🛑';
    },
  };

  g.ZenFi = ZenFi;
})();
