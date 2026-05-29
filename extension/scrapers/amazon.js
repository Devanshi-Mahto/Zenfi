/**
 * Amazon India / .com product page scraper
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};

  function text(el) {
    return el ? el.textContent.trim() : '';
  }

  function parsePriceFromText(t) {
    if (!t) return 0;
    const m = t.replace(/,/g, '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }

  ZenFi.scrapers = ZenFi.scrapers || {};

  ZenFi.scrapers.amazon = {
    matches(hostname) {
      return /amazon\.(in|com)/i.test(hostname);
    },

    isProductPage() {
      return (
        /\/dp\//.test(location.pathname) ||
        /\/gp\/product\//.test(location.pathname) ||
        document.getElementById('productTitle') !== null
      );
    },

    scrape() {
      const titleEl =
        document.getElementById('productTitle') ||
        document.querySelector('#title span') ||
        document.querySelector('h1#title');

      const priceEl =
        document.querySelector('.priceToPay span.a-price-whole') ||
        document.querySelector('#corePrice_feature_div .a-price .a-offscreen') ||
        document.querySelector('#priceblock_ourprice') ||
        document.querySelector('#priceblock_dealprice') ||
        document.querySelector('.a-price .a-offscreen');

      const imageEl =
        document.getElementById('landingImage') ||
        document.querySelector('#imgTagWrapperId img') ||
        document.querySelector('#main-image');

      let category = '';
      const breadcrumb = document.querySelector('#wayfinding-breadcrumbs_feature_div a, .a-breadcrumb a');
      if (breadcrumb) category = breadcrumb.textContent.trim().toLowerCase();

      const priceText = priceEl
        ? priceEl.getAttribute('content') || text(priceEl)
        : '';

      return {
        title: text(titleEl),
        price: parsePriceFromText(priceText),
        category,
        url: location.href.split('?')[0],
        image: imageEl ? (imageEl.src || imageEl.getAttribute('data-src') || '') : '',
        site: 'amazon',
      };
    },
  };

  g.ZenFi = ZenFi;
})();
