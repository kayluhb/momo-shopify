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

  /** @param {Event} event */
  #onVariantChange = async (event) => {
    const target = event.target;

    let variantId = null;
    if (target instanceof HTMLSelectElement && target.name === 'id') {
      variantId = target.options[target.selectedIndex]?.value ?? null;
    } else if (target instanceof HTMLInputElement && target.name === 'id') {
      variantId = target.value;
    } else {
      return;
    }

    if (!variantId) return;

    this.dispatchEvent(
      new VariantSelectedEvent({
        id: variantId,
      })
    );

    const url = new URL(this.productUrl, window.location.origin);
    url.searchParams.set('variant', variantId);

    const sectionHtml = await sectionRenderer.getSectionHTML(this.sectionId, false, url);
    await morphSection(this.sectionId, sectionHtml);

    const browserUrl = new URL(window.location.href);
    browserUrl.searchParams.set('variant', variantId);
    history.replaceState({}, '', browserUrl.toString());

    this.dispatchEvent(
      new VariantUpdateEvent({ id: variantId }, this.sectionId, {
        productId: this.dataset.productId,
      })
    );
  };
}

if (!customElements.get('variant-picker')) {
  customElements.define('variant-picker', VariantPickerComponent);
}
