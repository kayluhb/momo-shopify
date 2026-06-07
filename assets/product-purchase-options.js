/**
 * Syncs pre-order purchase option radios with the selling_plan form field and price display.
 */
class ProductPurchaseOptions {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    this.sectionId = root.dataset.sectionId ?? '';
    this.sellingPlanInput = root.querySelector('[data-selling-plan-input]');
    this.priceEl = document.querySelector('[data-variant-price]');
    this.variantSelect = document.querySelector(
      `#product-variant-${this.sectionId}`,
    );
    this.bindEvents();
    this.syncFromSelection();
  }

  bindEvents() {
    this.root.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name !== `purchase_option_${this.sectionId}`) return;
      this.syncFromSelection();
    });

    this.variantSelect?.addEventListener('change', () => {
      this.syncVariantGroups();
      this.syncFromSelection();
    });
  }

  syncVariantGroups() {
    const variantId = this.getSelectedVariantId();
    if (!variantId) return;

    this.root.querySelectorAll('[data-variant-id]').forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      if (!element.classList.contains('product-purchase-options__group')) return;

      const groupVariantId = element.dataset.variantId;
      element.classList.toggle(
        'product-purchase-options__group--hidden',
        groupVariantId !== variantId,
      );
    });

    const visibleInputs = this.getVisibleInputs();
    const hasChecked = visibleInputs.some((input) => input.checked);

    if (!hasChecked && visibleInputs[0]) {
      visibleInputs[0].checked = true;
    }
  }

  getSelectedVariantId() {
    if (this.variantSelect instanceof HTMLSelectElement) {
      return this.variantSelect.value;
    }

    const hiddenVariant = document.querySelector(
      '.product-buy__form input[name="id"]',
    );
    if (hiddenVariant instanceof HTMLInputElement) {
      return hiddenVariant.value;
    }

    return null;
  }

  /** @returns {HTMLInputElement[]} */
  getVisibleInputs() {
    const variantId = this.getSelectedVariantId();
    return Array.from(
      this.root.querySelectorAll('[data-purchase-option]'),
    ).filter((input) => {
      if (!(input instanceof HTMLInputElement)) return false;
      if (input.dataset.variantId && input.dataset.variantId !== variantId) {
        return false;
      }
      const group = input.closest('.product-purchase-options__group');
      return !group?.classList.contains('product-purchase-options__group--hidden');
    });
  }

  syncFromSelection() {
    const selected = this.getVisibleInputs().find((input) => input.checked);

    if (!this.sellingPlanInput) return;

    if (!selected || selected.dataset.purchaseOption === 'one_time') {
      this.sellingPlanInput.value = '';
      this.updatePrice(selected?.closest('label')?.querySelector('[data-one-time-price]')?.textContent);
      return;
    }

    this.sellingPlanInput.value = selected.dataset.sellingPlanId ?? '';
    this.updatePrice(selected.dataset.displayPrice);
  }

  /** @param {string | null | undefined} priceText */
  updatePrice(priceText) {
    if (!this.priceEl || !priceText) return;
    this.priceEl.textContent = priceText;
  }
}

function initProductPurchaseOptions() {
  document.querySelectorAll('[data-product-purchase-options]').forEach((root) => {
    if (!(root instanceof HTMLElement)) return;
    if (root.dataset.purchaseOptionsInit === 'true') return;
    root.dataset.purchaseOptionsInit = 'true';
    new ProductPurchaseOptions(root);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductPurchaseOptions);
} else {
  initProductPurchaseOptions();
}

document.addEventListener('shopify:section:load', initProductPurchaseOptions);

export {};
