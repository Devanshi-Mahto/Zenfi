/**
 * Flipkart product page scraper
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

  ZenFi.scrapers.flipkart = {
    matches(hostname) {
      return /flipkart\.com/i.test(hostname);
    },

    isProductPage() {
      return (
        /\/p\//.test(location.pathname) ||
        document.querySelector('h1[class], .VU-ZEz') !== null ||
        document.querySelector('h1 span') !== null
      );
    },

    scrape() {
      const titleEl =
        document.querySelector('h1 span') ||
        document.querySelector('.VU-ZEz') ||
        document.querySelector('h1');

      const priceEl =
        document.querySelector('._30jeq3') ||
        document.querySelector('._16Jk6d') ||
        document.querySelector('[class*="price"]');

      const imageEl =
        document.querySelector('._396cs4 img') ||
        document.querySelector('img[src*="rukminim"]');

      let category = '';
      const crumbs = document.querySelectorAll('._2whKao a, .FH_CMR a');
      if (crumbs.length > 1) {
        category = text(crumbs[1]).toLowerCase();
      }

      return {
        title: text(titleEl),
        price: parsePriceFromText(text(priceEl)),
        category,
        url: location.href.split('?')[0],
        image: imageEl ? imageEl.src : '',
        site: 'flipkart',
      };
    },
  };

  g.ZenFi = ZenFi;
})();
