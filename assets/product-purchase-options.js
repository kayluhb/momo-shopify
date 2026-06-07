/**
 * Syncs pre-order purchase option radios with the selling_plan form field,
 * price display, CTA labels, and disclosure copy.
 */
import { ThemeEvents } from '@theme/events';

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
    this.updateLegendVisibility();
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

    document.querySelector('variant-picker')?.addEventListener(
      ThemeEvents.variantUpdate,
      () => {
        this.variantSelect = document.querySelector(
          `#product-variant-${this.sectionId}`,
        );
        this.syncVariantGroups();
        this.syncFromSelection();
      },
    );
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
    const idField = document.querySelector(
      '.product-buy__form select[name="id"], .product-buy__form input[name="id"]',
    );

    if (
      idField instanceof HTMLSelectElement ||
      idField instanceof HTMLInputElement
    ) {
      return idField.value;
    }

    return null;
  }

  /** @returns {HTMLInputElement | undefined} */
  getSelectedInput() {
    const selected = this.root.querySelector('[data-purchase-option]:checked');
    if (!(selected instanceof HTMLInputElement)) return undefined;

    const variantId = this.getSelectedVariantId();
    if (
      selected.dataset.purchaseOption === 'selling_plan' &&
      selected.dataset.variantId &&
      variantId &&
      selected.dataset.variantId !== variantId
    ) {
      return undefined;
    }

    return selected;
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

  updateLegendVisibility() {
    const legend = this.root.querySelector('.product-purchase-options__legend');
    if (!(legend instanceof HTMLElement)) return;

    legend.classList.toggle('sr-only', this.getVisibleInputs().length <= 1);
  }

  /** @param {string} template @param {Record<string, string>} values */
  fillTemplate(template, values) {
    const text = Object.entries(values).reduce(
      (result, [key, value]) => result.replaceAll(`[${key}]`, value),
      template,
    );

    return text
      .replaceAll('&amp;', '&')
      .replaceAll('&#39;', "'")
      .replaceAll('&quot;', '"');
  }

  /** @param {HTMLInputElement | undefined} selected */
  updateCallToActions(selected) {
    const isSellingPlan =
      selected instanceof HTMLInputElement &&
      selected.dataset.purchaseOption === 'selling_plan';
    const planType = isSellingPlan ? selected.dataset.planType : null;
    const isDeferredPreorder = planType === 'preorder';
    const isSubscription = planType === 'subscription';
    const depositAmount = selected?.dataset.depositAmount ?? '';
    const subscriptionCadence = selected?.dataset.subscriptionCadence ?? '';

    if (this.addToCartButton) {
      this.addToCartButton.textContent = this.defaultAddToCartLabel;
    }

    if (this.paymentButton) {
      if (isDeferredPreorder) {
        this.paymentButton.textContent = this.fillTemplate(
          Theme.translations.preorder_checkout,
          { deposit: depositAmount },
        );
      } else if (isSubscription) {
        this.paymentButton.textContent = this.fillTemplate(
          Theme.translations.subscription_checkout,
          { price: depositAmount, cadence: subscriptionCadence },
        );
      } else {
        this.paymentButton.textContent = this.defaultPaymentLabel;
      }
    }

    this.updateDisclosure(selected);
  }

  /** @param {HTMLInputElement | undefined} selected */
  updateDisclosure(selected) {
    if (!this.disclosureEl) return;

    const planType =
      selected instanceof HTMLInputElement &&
      selected.dataset.purchaseOption === 'selling_plan'
        ? selected.dataset.planType
        : null;

    if (planType !== 'preorder' && planType !== 'subscription') {
      this.disclosureEl.hidden = true;
      return;
    }

    this.disclosureEl.hidden = false;
    this.disclosureEl
      .querySelectorAll('[data-disclosure-content]')
      .forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        element.hidden = element.dataset.disclosureContent !== planType;
      });
  }

  getFullVariantPrice() {
    const variantId = this.getSelectedVariantId();
    const preorderInput = this.root.querySelector(
      `[data-purchase-option="selling_plan"][data-variant-id="${variantId}"]`,
    );

    if (preorderInput instanceof HTMLInputElement && preorderInput.dataset.fullPrice) {
      return preorderInput.dataset.fullPrice;
    }

    const oneTimePrice = this.root
      .querySelector('[data-one-time-price]')
      ?.textContent?.trim();
    if (oneTimePrice) return oneTimePrice;

    return null;
  }

  syncFromSelection() {
    const selected = this.getSelectedInput();

    if (!this.sellingPlanInput) return;

    this.updateLegendVisibility();
    this.updatePrice(this.getFullVariantPrice());

    if (!selected || selected.dataset.purchaseOption === 'one_time') {
      this.sellingPlanInput.value = '';
      this.updateCallToActions(selected);
      return;
    }

    this.sellingPlanInput.value = selected.dataset.sellingPlanId ?? '';
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
