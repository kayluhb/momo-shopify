import { Component } from '@theme/component';

const STORAGE_KEY = 'momo:recently-viewed';
const MAX_RECENT = 8;

/**
 * @typedef {{ id: number; handle: string }} RecentProduct
 */

/**
 * @returns {RecentProduct[]}
 */
function getRecentProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {number} id
 * @param {string} handle
 */
function trackRecentProduct(id, handle) {
  if (!id || !handle) return;

  let items = getRecentProducts().filter((item) => item.id !== id);
  items.unshift({ id, handle });
  items = items.slice(0, MAX_RECENT);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable or full.
  }
}

class ProductRecommendationsComponent extends Component {
  requiredRefs = ['relatedPanel', 'recentlyViewedPanel', 'relatedTab', 'recentlyViewedTab'];

  /** @type {IntersectionObserver | null} */
  #observer = null;

  connectedCallback() {
    super.connectedCallback();

    const productId = Number(this.dataset.productId);
    const productHandle = this.dataset.productHandle;

    if (productId && productHandle) {
      trackRecentProduct(productId, productHandle);
    }

    this.#syncRecentlyViewedTab();
    this.#updateTabsVisibility();
    this.#observeRelated();
  }

  activateRelatedTab() {
    if (!(this.refs.relatedTab instanceof HTMLButtonElement) || this.refs.relatedTab.hidden) return;
    this.#activateTab(this.refs.relatedTab);
  }

  activateRecentlyViewedTab() {
    if (!(this.refs.recentlyViewedTab instanceof HTMLButtonElement) || this.refs.recentlyViewedTab.hidden) {
      return;
    }
    this.#activateTab(this.refs.recentlyViewedTab);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #syncRecentlyViewedTab() {
    const productId = Number(this.dataset.productId);
    const recentCount = getRecentProducts().filter((item) => item.id !== productId).length;
    const showRecentlyViewed = this.dataset.showRecentlyViewed === 'true';

    if (!showRecentlyViewed || recentCount === 0) {
      this.refs.recentlyViewedTab.hidden = true;
      this.refs.recentlyViewedTab.setAttribute('aria-hidden', 'true');
      this.refs.recentlyViewedTab.disabled = true;
      this.#updateTabsVisibility();
      return;
    }

    this.refs.recentlyViewedTab.hidden = false;
    this.refs.recentlyViewedTab.removeAttribute('aria-hidden');
    this.refs.recentlyViewedTab.disabled = false;
    this.#updateTabsVisibility();
  }

  #updateTabsVisibility() {
    const tabs = [this.refs.relatedTab, this.refs.recentlyViewedTab].filter(
      (tab) => tab instanceof HTMLButtonElement && !tab.hidden
    );
    const tablist = this.querySelector('.product-recommendations__tabs');

    if (!tablist) return;

    tablist.classList.toggle('product-recommendations__tabs--single', tabs.length < 2);
  }

  /** @param {HTMLButtonElement} tab */
  #activateTab(tab) {
    const isRelated = tab === this.refs.relatedTab;

    this.refs.relatedTab.classList.toggle('is-active', isRelated);
    this.refs.relatedTab.setAttribute('aria-selected', String(isRelated));
    this.refs.recentlyViewedTab.classList.toggle('is-active', !isRelated);
    this.refs.recentlyViewedTab.setAttribute('aria-selected', String(!isRelated));

    this.refs.relatedPanel.hidden = !isRelated;
    this.refs.recentlyViewedPanel.hidden = isRelated;

    if (!isRelated && !this.refs.recentlyViewedPanel.dataset.loaded) {
      this.#loadRecentlyViewed();
    }
  }

  #observeRelated() {
    if (this.refs.relatedPanel.dataset.loaded === 'true') {
      this.#hydrateCards(this.refs.relatedPanel);
      return;
    }

    if (this.refs.relatedPanel.querySelector('.collection-page__grid li')) {
      this.refs.relatedPanel.dataset.loaded = 'true';
      this.#hydrateCards(this.refs.relatedPanel);
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        this.#observer?.disconnect();
        this.#loadRelated();
      },
      { rootMargin: '200px' }
    );

    this.#observer.observe(this);
  }

  async #loadRelated() {
    const url = this.dataset.recommendationsUrl;
    if (!url) return;

    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const panel = doc.querySelector('[data-related-panel]');

      if (!(panel instanceof HTMLElement)) {
        this.#hideIfEmpty();
        return;
      }

      const hasProducts = panel.querySelector('.collection-page__grid li');
      if (!hasProducts) {
        this.#hideIfEmpty();
        return;
      }

      this.refs.relatedPanel.innerHTML = panel.innerHTML;
      this.refs.relatedPanel.dataset.loaded = 'true';
      this.#hydrateCards(this.refs.relatedPanel);
    } catch {
      this.#hideIfEmpty();
    }
  }

  async #loadRecentlyViewed() {
    const productId = Number(this.dataset.productId);
    const limit = Number(this.dataset.limit) || 4;
    const recentItems = getRecentProducts()
      .filter((item) => item.id !== productId)
      .slice(0, limit);

    if (recentItems.length === 0) return;

    const query = recentItems.map((item) => `id:${item.id}`).join(' OR ');
    const url = new URL(this.dataset.recentlyViewedUrl || '/search', window.location.origin);
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'product');

    try {
      const response = await fetch(url.toString());
      if (!response.ok) return;

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const grid = doc.querySelector('[data-recently-viewed-grid]');

      if (!(grid instanceof HTMLElement)) return;

      this.refs.recentlyViewedPanel.innerHTML = grid.outerHTML;
      this.refs.recentlyViewedPanel.dataset.loaded = 'true';
      this.#hydrateCards(this.refs.recentlyViewedPanel);
    } catch {
      // Ignore fetch errors.
    }
  }

  /** @param {HTMLElement} root */
  #hydrateCards(root) {
    root.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));
  }

  #hideIfEmpty() {
    const relatedEmpty = !this.refs.relatedPanel.querySelector('.collection-page__grid li');
    const recentHidden = this.refs.recentlyViewedTab.hidden;
    const recentEmpty =
      recentHidden || this.refs.recentlyViewedPanel.dataset.loaded !== 'true'
        ? recentHidden
        : !this.refs.recentlyViewedPanel.querySelector('.collection-page__grid li');

    if (relatedEmpty && recentEmpty) {
      this.closest('.shopify-section')?.setAttribute('hidden', '');
    } else if (relatedEmpty && !recentHidden) {
      this.refs.relatedTab.hidden = true;
      this.refs.relatedPanel.hidden = true;
      this.#updateTabsVisibility();
      this.#activateTab(this.refs.recentlyViewedTab);
    }
  }
}

if (!customElements.get('product-recommendations-component')) {
  customElements.define('product-recommendations-component', ProductRecommendationsComponent);
}
