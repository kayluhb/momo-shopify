import { fetchConfig, debounce } from '@theme/utilities';
import { morphSection } from '@theme/section-renderer';
import { ThemeEvents, CartUpdateEvent, CartAddEvent } from '@theme/events';
import { getCartSectionsParam } from '@theme/cart-sections';

class CartItemsComponent extends HTMLElement {
  /** @type {string | undefined} */
  #sectionId;

  #debouncedChange = debounce(this.#onQuantityChange.bind(this), 300);

  connectedCallback() {
    this.#sectionId = this.dataset.sectionId;

    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    this.addEventListener('change', this.#debouncedChange);
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    document.removeEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
  }

  get sectionId() {
    if (!this.#sectionId) {
      throw new Error('cart-items-component requires data-section-id');
    }
    return this.#sectionId;
  }

  /**
   * @param {Event} event
   */
  #onClick(event) {
    const removeButton = event.target instanceof Element ? event.target.closest('[data-cart-remove]') : null;
    if (!(removeButton instanceof HTMLButtonElement)) return;

    const line = Number(removeButton.dataset.cartRemove);
    if (!line) return;

    event.preventDefault();
    this.#updateLine(line, 0);
  }

  /**
   * @param {Event} event
   */
  #onQuantityChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-cart-quantity]')) return;
    if (!this.contains(input)) return;

    const line = Number(input.dataset.cartQuantity);
    const quantity = Number(input.value);

    if (!line || Number.isNaN(quantity)) return;

    this.#updateLine(line, quantity);
  }

  /**
   * @param {number} line
   * @param {number} quantity
   */
  async #updateLine(line, quantity) {
    this.setAttribute('aria-busy', 'true');

    const sections = getCartSectionsParam();
    const body = JSON.stringify({
      line,
      quantity,
      sections,
      sections_url: window.location.pathname,
    });

    try {
      const response = await fetch(Theme.routes.cart_change_url, fetchConfig('json', { body }));
      const data = JSON.parse(await response.text());

      if (data.errors) {
        console.error(data.errors);
        return;
      }

      await this.#morphFromResponse(data.sections);

      document.dispatchEvent(
        new CartUpdateEvent(data, this.sectionId, {
          source: 'cart-items',
          sections: data.sections,
          itemCount: data.item_count,
        })
      );
    } catch (error) {
      console.error(error);
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  /**
   * @param {Record<string, string> | undefined} sections
   */
  async #morphFromResponse(sections) {
    if (!sections) return;

    const updates = Object.entries(sections).map(([sectionId, html]) => morphSection(sectionId, html));
    await Promise.all(updates);
  }

  /**
   * @param {CartUpdateEvent | CartAddEvent} event
   */
  #handleCartUpdate = async (event) => {
    if (event.target === this) return;

    const sectionHtml = event.detail?.data?.sections?.[this.sectionId];
    if (sectionHtml) {
      await morphSection(this.sectionId, sectionHtml);
      return;
    }

    if (event.detail?.data?.sections) {
      await this.#morphFromResponse(event.detail.data.sections);
    }
  };
}

if (!customElements.get('cart-items-component')) {
  customElements.define('cart-items-component', CartItemsComponent);
}
