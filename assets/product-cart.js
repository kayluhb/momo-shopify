import { morphSection, sectionRenderer } from '@theme/section-renderer';
import { fetchConfig, onDocumentReady } from '@theme/utilities';
import { CartAddEvent, CartErrorEvent } from '@theme/events';
import { getCartDrawerSectionId, getCartSectionsParam } from '@theme/cart-sections';

/**
 * @param {HTMLFormElement} form
 * @param {HTMLInputElement | HTMLButtonElement} submitControl
 * @param {boolean} isLoading
 */
function setFormLoading(form, submitControl, isLoading) {
  submitControl.disabled = isLoading;
  submitControl.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  form.setAttribute('aria-busy', isLoading ? 'true' : 'false');
}

/**
 * @param {HTMLFormElement} form
 * @param {string} message
 */
function showFormMessage(form, message) {
  let status = form.querySelector('[data-product-form-status]');
  if (!(status instanceof HTMLElement)) {
    status = document.createElement('p');
    status.dataset.productFormStatus = '';
    status.setAttribute('role', 'status');
    status.className = 'product-form__status';
    form.appendChild(status);
  }
  status.textContent = message;
}

/**
 * @param {HTMLFormElement} form
 */
function clearFormMessage(form) {
  const status = form.querySelector('[data-product-form-status]');
  status?.remove();
}

/**
 * @param {Record<string, string | null> | undefined} sections
 */
async function morphCartSections(sections) {
  if (!sections) return;

  const updates = Object.entries(sections)
    .filter((entry) => entry[1])
    .map(([sectionId, html]) => morphSection(sectionId, /** @type {string} */ (html)));

  await Promise.all(updates);
}

/**
 * @param {Record<string, unknown>} data
 */
async function refreshCartDrawerIfNeeded(data) {
  const drawer = document.querySelector('cart-drawer-component');
  if (!drawer?.querySelector('.cart-empty')) return;

  const itemCount = Number(data.item_count);
  const hasItems = itemCount > 0 || (Array.isArray(data.items) && data.items.length > 0);
  if (!hasItems) return;

  const sectionId = getCartDrawerSectionId();
  if (!sectionId) return;

  await sectionRenderer.renderSection(sectionId, { cache: false });
}

/**
 * @param {HTMLFormElement} form
 * @returns {{ items: Array<{ id: number; quantity: number; properties?: Record<string, string>; selling_plan?: number }>; sections?: string; sections_url?: string } | null}
 */
function buildCartAddPayload(form) {
  const formData = new FormData(form);
  const variantIdRaw = formData.get('id') || formData.get('items[0][id]');

  if (!variantIdRaw) {
    return null;
  }

  const variantId = Number(variantIdRaw);
  if (!Number.isFinite(variantId)) {
    return null;
  }

  const quantity = Math.max(1, Number(formData.get('quantity')) || 1);

  /** @type {{ id: number; quantity: number; properties?: Record<string, string>; selling_plan?: number }} */
  const item = { id: variantId, quantity };

  const properties = {};
  for (const [key, value] of formData.entries()) {
    const propertyMatch = /^properties\[(.+)\]$/.exec(key);
    if (propertyMatch && typeof value === 'string') {
      properties[propertyMatch[1]] = value;
    }
  }

  if (Object.keys(properties).length > 0) {
    item.properties = properties;
  }

  const sellingPlan = formData.get('selling_plan');
  if (sellingPlan) {
    const sellingPlanId = Number(sellingPlan);
    if (Number.isFinite(sellingPlanId)) {
      item.selling_plan = sellingPlanId;
    }
  }

  /** @type {{ items: Array<typeof item>; sections?: string; sections_url?: string }} */
  const payload = { items: [item] };

  const sections = getCartSectionsParam();
  if (sections) {
    payload.sections = sections;
    payload.sections_url = window.location.pathname;
  }

  return payload;
}

/**
 * @param {HTMLFormElement} form
 */
async function handleProductFormSubmit(form) {
  const submitControl = form.querySelector('[type="submit"]');
  if (!(submitControl instanceof HTMLInputElement || submitControl instanceof HTMLButtonElement)) {
    return;
  }

  if (!form.checkValidity()) return;

  const payload = buildCartAddPayload(form);
  const variantId = payload?.items[0]?.id?.toString() ?? '';

  const defaultLabel = submitControl.value || submitControl.textContent || '';
  const loadingLabel = Theme.translations.add_to_cart_loading;

  setFormLoading(form, submitControl, true);
  clearFormMessage(form);

  if (submitControl instanceof HTMLInputElement) {
    submitControl.value = loadingLabel;
  } else {
    submitControl.textContent = loadingLabel;
  }

  if (!payload) {
    showFormMessage(form, Theme.translations.add_to_cart_error);
    setFormLoading(form, submitControl, false);
    if (submitControl instanceof HTMLInputElement) {
      submitControl.value = defaultLabel;
    } else {
      submitControl.textContent = defaultLabel;
    }
    return;
  }

  try {
    const fetchCfg = fetchConfig('json', { body: JSON.stringify(payload) });
    const response = await fetch(Theme.routes.cart_add_url, fetchCfg);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || !contentType.includes('json')) {
      const body = await response.text();
      console.error('Cart add failed', response.status, body.slice(0, 300));
      showFormMessage(form, Theme.translations.add_to_cart_error);
      form.dispatchEvent(
        new CartAddEvent({}, form.id || '', {
          didError: true,
          source: 'product-cart',
          variantId,
        })
      );
      return;
    }

    const data = await response.json();

    if (data.status) {
      const message = data.description || data.message || Theme.translations.add_to_cart_error;
      showFormMessage(form, message);
      form.dispatchEvent(
        new CartErrorEvent(form.id || '', data.message, data.description, data.errors)
      );
      form.dispatchEvent(
        new CartAddEvent({}, form.id || '', {
          didError: true,
          source: 'product-cart',
          variantId,
        })
      );
      return;
    }

    await morphCartSections(data.sections);
    await refreshCartDrawerIfNeeded(data);

    showFormMessage(form, Theme.translations.add_to_cart_success);

    document.dispatchEvent(
      new CartAddEvent(data, variantId, {
        source: 'product-cart',
        itemCount: Number(data.item_count),
        variantId,
        sections: data.sections,
      })
    );
  } catch (error) {
    console.error(error);
    showFormMessage(form, Theme.translations.add_to_cart_error);
  } finally {
    setFormLoading(form, submitControl, false);

    if (submitControl instanceof HTMLInputElement) {
      submitControl.value = defaultLabel;
    } else {
      submitControl.textContent = defaultLabel;
    }
  }
}

/**
 * @param {SubmitEvent} event
 */
function onDocumentSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!form.closest('[data-product-form]')) return;

  event.preventDefault();
  handleProductFormSubmit(form);
}

onDocumentReady(() => {
  document.addEventListener('submit', onDocumentSubmit);
});
