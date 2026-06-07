import { Component } from '@theme/component';
import { sectionRenderer, morphSection } from '@theme/section-renderer';
import { VariantSelectedEvent, VariantUpdateEvent } from '@theme/events';

class VariantPickerComponent extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this.#onVariantChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('change', this.#onVariantChange);
  }

  get sectionId() {
    const id = this.dataset.sectionId;
    if (!id) throw new Error('variant-picker requires data-section-id');
    return id;
  }

  get productUrl() {
    const url = this.dataset.productUrl;
    if (!url) throw new Error('variant-picker requires data-product-url');
    return url;
  }

  /** @returns {Array<{ id: number, option1?: string | null, option2?: string | null, option3?: string | null, available?: boolean }>} */
  #getVariantData() {
    const dataEl = this.querySelector('[data-product-variant-data]');
    if (!(dataEl instanceof HTMLScriptElement)) return [];

    try {
      const parsed = JSON.parse(dataEl.textContent ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** @returns {(HTMLSelectElement | HTMLInputElement)[]} */
  #getOptionControls() {
    /** @type {Set<string>} */
    const positions = new Set();

    this.querySelectorAll('[data-product-option]').forEach((element) => {
      if (
        element instanceof HTMLSelectElement ||
        (element instanceof HTMLInputElement && element.type === 'radio')
      ) {
        const position = element.getAttribute('data-product-option');
        if (position) positions.add(position);
      }
    });

    return Array.from(positions)
      .sort((a, b) => Number(a) - Number(b))
      .map((position) => {
        const select = this.querySelector(
          `select[data-product-option="${position}"]`,
        );
        if (select instanceof HTMLSelectElement) return select;

        const checked = this.querySelector(
          `input[type="radio"][data-product-option="${position}"]:checked`,
        );
        if (checked instanceof HTMLInputElement) return checked;

        const fallback = this.querySelector(
          `input[type="radio"][data-product-option="${position}"]`,
        );
        return fallback instanceof HTMLInputElement ? fallback : null;
      })
      .filter(
        (element) =>
          element instanceof HTMLSelectElement ||
          element instanceof HTMLInputElement,
      );
  }

  /** @returns {string | null} */
  #resolveVariantFromOptions() {
    const optionControls = this.#getOptionControls();

    if (optionControls.length === 0) return null;

    const selectedOptions = optionControls.map((control) => control.value);
    const match = this.#getVariantData().find((variant) => {
      if (selectedOptions[0] && variant.option1 !== selectedOptions[0]) {
        return false;
      }
      if (selectedOptions[1] && variant.option2 !== selectedOptions[1]) {
        return false;
      }
      if (selectedOptions[2] && variant.option3 !== selectedOptions[2]) {
        return false;
      }

      return true;
    });

    return match?.id != null ? String(match.id) : null;
  }

  /** @param {string} variantId */
  async #updateVariant(variantId) {
    this.dispatchEvent(
      new VariantSelectedEvent({
        id: variantId,
      }),
    );

    const url = new URL(this.productUrl, window.location.origin);
    url.searchParams.set('variant', variantId);

    const sectionHtml = await sectionRenderer.getSectionHTML(
      this.sectionId,
      false,
      url,
    );
    await morphSection(this.sectionId, sectionHtml);

    const browserUrl = new URL(window.location.href);
    browserUrl.searchParams.set('variant', variantId);
    history.replaceState({}, '', browserUrl.toString());

    this.dispatchEvent(
      new VariantUpdateEvent({ id: variantId }, this.sectionId, {
        productId: this.dataset.productId,
      }),
    );
  }

  /** @param {Event} event */
  #onVariantChange = async (event) => {
    const target = event.target;

    if (
      (target instanceof HTMLSelectElement ||
        (target instanceof HTMLInputElement && target.type === 'radio')) &&
      target.hasAttribute('data-product-option')
    ) {
      const variantId = this.#resolveVariantFromOptions();
      if (!variantId) return;

      const idSelect = this.querySelector('select[name="id"]');
      if (idSelect instanceof HTMLSelectElement) {
        idSelect.value = variantId;
      }

      await this.#updateVariant(variantId);
      return;
    }

    let variantId = null;
    if (target instanceof HTMLSelectElement && target.name === 'id') {
      variantId = target.options[target.selectedIndex]?.value ?? null;
    } else if (target instanceof HTMLInputElement && target.name === 'id') {
      variantId = target.value;
    } else {
      return;
    }

    if (!variantId) return;

    await this.#updateVariant(variantId);
  };
}

if (!customElements.get('variant-picker')) {
  customElements.define('variant-picker', VariantPickerComponent);
}
