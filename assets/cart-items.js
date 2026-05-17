import { fetchConfig, debounce } from '@theme/utilities';
import { cartDebug, cartDebugError, getCartDomSnapshot } from '@theme/cart-debug';
import { ThemeEvents, CartUpdateEvent, CartAddEvent } from '@theme/events';
import {
  getCartSectionsParam,
  getCartSectionsUrl,
  morphCartSectionsFromResponse,
} from '@theme/cart-sections';

class CartItemsComponent extends HTMLElement {
  /** @type {string | undefined} */
  #sectionId;

  #debouncedChange = debounce(this.#onQuantityChange.bind(this), 300);

  connectedCallback() {
    this.#sectionId = this.dataset.sectionId;

    cartDebug('items', 'cart-items-component connected', {
      sectionId: this.#sectionId,
      dom: getCartDomSnapshot(),
    });

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

    cartDebug('items', 'remove clicked', {
      line,
      sectionId: this.sectionId,
      domBefore: getCartDomSnapshot(),
    });

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

    cartDebug('items', 'quantity change', { line, quantity, sectionId: this.sectionId });

    this.#updateLine(line, quantity);
  }

  /**
   * @param {number} line
   * @param {number} quantity
   */
  async #updateLine(line, quantity) {
    this.setAttribute('aria-busy', 'true');

    const sections = getCartSectionsParam();
    const requestBody = {
      line,
      quantity,
      sections,
      sections_url: getCartSectionsUrl(),
    };

    cartDebug('items', 'cart change request', {
      url: Theme.routes.cart_change_url,
      body: requestBody,
    });

    try {
      const response = await fetch(
        Theme.routes.cart_change_url,
        fetchConfig('json', { body: JSON.stringify(requestBody) })
      );
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();

      cartDebug('items', 'cart change response', {
        ok: response.ok,
        status: response.status,
        contentType,
        bodyPreview: responseText.slice(0, 500),
      });

      if (!response.ok || !contentType.includes('json')) {
        cartDebugError('items', 'cart change failed — non-JSON or error status', {
          status: response.status,
          contentType,
          body: responseText.slice(0, 500),
        });
        return;
      }

      const data = JSON.parse(responseText);

      if (data.errors) {
        cartDebugError('items', 'cart change returned errors', data.errors);
        return;
      }

      cartDebug('items', 'cart change parsed', {
        item_count: data.item_count,
        sectionKeys: data.sections ? Object.keys(data.sections) : [],
      });

      await morphCartSectionsFromResponse(data.sections, this.sectionId);

      document.dispatchEvent(
        new CartUpdateEvent(data, this.sectionId, {
          source: 'cart-items',
          sections: data.sections,
          itemCount: data.item_count,
        })
      );

      cartDebug('items', 'cart change complete', getCartDomSnapshot());
    } catch (error) {
      cartDebugError('items', 'cart change threw', error);
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  /**
   * @param {CartUpdateEvent | CartAddEvent} event
   */
  #handleCartUpdate = async (event) => {
    if (event.target === this) return;

    cartDebug('items', 'cart:update event received', {
      source: event.detail?.data?.source,
      sectionId: this.sectionId,
      sectionKeys: event.detail?.data?.sections ? Object.keys(event.detail.data.sections) : [],
    });

    if (event.detail?.data?.sections) {
      await morphCartSectionsFromResponse(event.detail.data.sections, this.sectionId);
    }
  };
}

if (!customElements.get('cart-items-component')) {
  customElements.define('cart-items-component', CartItemsComponent);
}

cartDebug('items', 'cart-items module loaded', {
  cartChangeUrl: Theme.routes.cart_change_url,
  sectionIds: getCartSectionsParam(),
  debugHint: 'Enable with localStorage.setItem("theme:cart-debug", "1") or ?cart_debug=1',
});
