/**
 * Scraper registry — pick site-specific extractor
 */
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : window;
  const ZenFi = g.ZenFi || {};
  const host = location.hostname;

  ZenFi.scrapers = ZenFi.scrapers || {};

  ZenFi.getScraper = function getScraper() {
    const { amazon, flipkart } = ZenFi.scrapers;
    if (amazon?.matches(host)) return amazon;
    if (flipkart?.matches(host)) return flipkart;
    return null;
  };

  ZenFi.scrapeProduct = function scrapeProduct() {
    const scraper = ZenFi.getScraper();
    if (!scraper || !scraper.isProductPage()) return null;
    const data = scraper.scrape();
    if (!data?.title && !data?.price) return null;
    return ZenFi.sanitize.product(data);
  };

  g.ZenFi = ZenFi;
})();
