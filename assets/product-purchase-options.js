/**
 * Syncs pre-order purchase option radios with the selling_plan form field,
 * price display, CTA labels, and disclosure copy.
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
    this.addToCartButton = document.querySelector(
      '.product-buy__add-to-cart',
    );
    this.paymentButton = null;
    this.disclosureEl = document.querySelector('[data-preorder-disclosure]');
    this.defaultAddToCartLabel =
      this.addToCartButton?.textContent?.trim() ?? '';
    this.defaultPaymentLabel = '';
    this.bindEvents();
    this.observePaymentButton();
    this.syncFromSelection();
  }

  observePaymentButton() {
    const paymentRoot = document.querySelector('.product-buy__payment');
    if (!paymentRoot) return;

    const capturePaymentButton = () => {
      const button = paymentRoot.querySelector(
        '.shopify-payment-button__button--unbranded',
      );
      if (!(button instanceof HTMLButtonElement)) return false;

      this.paymentButton = button;
      if (!this.defaultPaymentLabel) {
        this.defaultPaymentLabel = button.textContent?.trim() ?? '';
      }

      this.syncFromSelection();
      return true;
    };

    if (capturePaymentButton()) return;

    const observer = new MutationObserver(() => {
      if (!capturePaymentButton()) return;
      observer.disconnect();
    });

    observer.observe(paymentRoot, { childList: true, subtree: true });
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

  /** @param {string} template @param {Record<string, string>} values */
  fillTemplate(template, values) {
    return Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`[${key}]`, value),
      template,
    );
  }

  /** @param {HTMLInputElement | undefined} selected */
  updateCallToActions(selected) {
    const isPreorder =
      selected instanceof HTMLInputElement &&
      selected.dataset.purchaseOption === 'preorder';
    const depositAmount = selected?.dataset.depositAmount ?? '';
    const balanceAmount = selected?.dataset.balanceAmount ?? '';

    if (this.addToCartButton) {
      this.addToCartButton.textContent = isPreorder
        ? this.fillTemplate(Theme.translations.preorder_add_to_cart, {
            deposit: depositAmount,
          })
        : this.defaultAddToCartLabel;
    }

    if (this.paymentButton) {
      this.paymentButton.textContent = isPreorder
        ? this.fillTemplate(Theme.translations.preorder_checkout, {
            deposit: depositAmount,
          })
        : this.defaultPaymentLabel;
    }

    if (this.disclosureEl) {
      if (isPreorder && depositAmount && balanceAmount) {
        this.disclosureEl.textContent = this.fillTemplate(
          Theme.translations.preorder_disclosure,
          {
            deposit: depositAmount,
            balance: balanceAmount,
          },
        );
        this.disclosureEl.hidden = false;
      } else {
        this.disclosureEl.textContent = '';
        this.disclosureEl.hidden = true;
      }
    }
  }

  syncFromSelection() {
    const selected = this.getVisibleInputs().find((input) => input.checked);

    if (!this.sellingPlanInput) return;

    if (!selected || selected.dataset.purchaseOption === 'one_time') {
      this.sellingPlanInput.value = '';
      this.updatePrice(
        selected?.closest('label')?.querySelector('[data-one-time-price]')
          ?.textContent,
      );
      this.updateCallToActions(selected);
      return;
    }

    this.sellingPlanInput.value = selected.dataset.sellingPlanId ?? '';
    this.updatePrice(selected.dataset.displayPrice);
    this.updateCallToActions(selected);
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
