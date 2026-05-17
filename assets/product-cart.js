import { sectionRenderer } from '@theme/section-renderer';
import { CartAddEvent, CartErrorEvent, CartSource } from '@theme/events';
import {
  cartDebug,
  cartDebugError,
  cartDebugWarn,
  fetchCartJson,
  fetchConfig,
  getCartDomSnapshot,
  onDocumentReady,
} from '@theme/utilities';
import {
  CART_DRAWER_SELECTOR,
  getCartDrawerSectionId,
  getCartSectionsParam,
  getCartSectionsUrl,
  morphCartSectionsFromResponse,
} from '@theme/cart-sections';

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
 * @param {unknown} data
 * @returns {boolean}
 */
function isCartAddErrorResponse(data) {
  if (!data || typeof data !== 'object') return true;

  const record = /** @type {Record<string, unknown>} */ (data);

  if (Array.isArray(record.items) && record.items.length > 0) {
    return false;
  }

  if (typeof record.item_count === 'number' && record.item_count > 0) {
    return false;
  }

  const status = record.status;

  if (typeof status === 'number' && status >= 400) {
    return true;
  }

  if (typeof status === 'string') {
    return status !== 'success';
  }

  return Boolean(record.description || record.message);
}

/**
 * @param {unknown} data
 * @returns {number}
 */
function getCartItemCount(data) {
  if (!data || typeof data !== 'object') return 0;

  const record = /** @type {Record<string, unknown>} */ (data);

  if (typeof record.item_count === 'number') {
    return record.item_count;
  }

  if (Array.isArray(record.items)) {
    return record.items.reduce((total, item) => {
      if (!item || typeof item !== 'object') return total;
      const quantity = /** @type {{ quantity?: number }} */ (item).quantity;
      return total + (quantity || 0);
    }, 0);
  }

  return 0;
}

/**
 * @param {Record<string, unknown>} data
 */
async function refreshCartDrawerIfNeeded(data) {
  const drawer = document.querySelector(CART_DRAWER_SELECTOR);
  const hasEmptyState = Boolean(drawer?.querySelector('.cart-empty'));

  cartDebug('add', 'refreshCartDrawerIfNeeded', {
    hasDrawer: Boolean(drawer),
    hasEmptyState,
    itemCount: getCartItemCount(data),
  });

  if (!hasEmptyState) return;

  const itemCount = getCartItemCount(data);
  if (itemCount <= 0) return;

  const sectionId = getCartDrawerSectionId();
  if (!sectionId) {
    cartDebugWarn('add', 'no cart drawer section id found for refresh');
    return;
  }

  try {
    await sectionRenderer.renderSection(sectionId, { cache: false });
    cartDebug('add', 'cart drawer refreshed via Section Rendering API', getCartDomSnapshot());
  } catch (error) {
    cartDebugWarn('add', 'could not refresh cart drawer after cart add', error);
  }
}

/**
 * @param {HTMLFormElement} form
 * @returns {{ items: Array<{ id: number; quantity: number; properties?: Record<string, string>; selling_plan?: number }>; sections?: string; sections_url?: string } | null}
 */
function buildCartAddPayload(form) {
  const formData = new FormData(form);
  const variantIdRaw = formData.get('id') || formData.get('items[0][id]');

  cartDebug('add', 'buildCartAddPayload form fields', Object.fromEntries(formData.entries()));

  if (!variantIdRaw) {
    cartDebugWarn('add', 'no variant id in form');
    return null;
  }

  const variantId = Number(variantIdRaw);
  if (!Number.isFinite(variantId)) {
    cartDebugWarn('add', 'invalid variant id', { variantIdRaw });
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
    payload.sections_url = getCartSectionsUrl();
  } else {
    cartDebugWarn('add', 'no section ids collected for cart add');
  }

  return payload;
}

/**
 * @param {HTMLFormElement} form
 */
async function handleProductFormSubmit(form) {
  const submitControl = form.querySelector('[type="submit"]');
  if (!(submitControl instanceof HTMLInputElement || submitControl instanceof HTMLButtonElement)) {
    cartDebugWarn('add', 'submit control not found');
    return;
  }

  if (!form.checkValidity()) {
    cartDebugWarn('add', 'form validation failed');
    return;
  }

  const payload = buildCartAddPayload(form);
  const variantId = payload?.items[0]?.id?.toString() ?? '';

  const defaultLabel = submitControl.value || submitControl.textContent || '';
  const loadingLabel = Theme.translations.add_to_cart_loading;

  cartDebug('add', 'submit started', {
    variantId,
    payload,
    domBefore: getCartDomSnapshot(),
  });

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

    cartDebug('add', 'cart add request', {
      url: Theme.routes.cart_add_url,
      body: payload,
    });

    const result = await fetchCartJson(Theme.routes.cart_add_url, fetchCfg, {
      scope: 'add',
      logLabel: 'cart add',
    });

    if (!result.ok) {
      showFormMessage(form, Theme.translations.add_to_cart_error);
      form.dispatchEvent(
        new CartAddEvent({}, form.id || '', {
          didError: true,
          source: CartSource.productCart,
          variantId,
        })
      );
      return;
    }

    const data = result.data;

    cartDebug('add', 'cart add parsed', {
      item_count: data.item_count,
      status: data.status,
      isErrorResponse: isCartAddErrorResponse(data),
    });

    if (isCartAddErrorResponse(data)) {
      const record = /** @type {Record<string, unknown>} */ (data);
      const message =
        (typeof record.description === 'string' && record.description) ||
        (typeof record.message === 'string' && record.message) ||
        Theme.translations.add_to_cart_error;
      cartDebugError('add', 'cart add treated as error response', { message, record });
      showFormMessage(form, message);
      form.dispatchEvent(
        new CartErrorEvent(
          form.id || '',
          typeof record.message === 'string' ? record.message : '',
          typeof record.description === 'string' ? record.description : '',
          record.errors
        )
      );
      form.dispatchEvent(
        new CartAddEvent({}, form.id || '', {
          didError: true,
          source: CartSource.productCart,
          variantId,
        })
      );
      return;
    }

    const itemCount = getCartItemCount(data);

    try {
      await morphCartSectionsFromResponse(
        data && typeof data === 'object' && 'sections' in data
          ? /** @type {Record<string, string>} */ (data).sections
          : undefined,
        getCartDrawerSectionId() ?? undefined
      );
      await refreshCartDrawerIfNeeded(data);
    } catch (refreshError) {
      cartDebugWarn('add', 'item added but cart UI refresh failed', refreshError);
    }

    showFormMessage(form, Theme.translations.add_to_cart_success);

    const cartResource =
      data && typeof data === 'object'
        ? { .../** @type {Record<string, unknown>} */ (data), item_count: itemCount }
        : { item_count: itemCount };

    document.dispatchEvent(
      new CartAddEvent(cartResource, variantId, {
        source: CartSource.productCart,
        itemCount,
        variantId,
        sections:
          data && typeof data === 'object' && 'sections' in data
            ? /** @type {Record<string, string>} */ (data).sections
            : undefined,
      })
    );

    cartDebug('add', 'cart add complete', getCartDomSnapshot());
  } catch (error) {
    cartDebugError('add', 'cart add threw', error);
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

  cartDebug('add', 'product form submit intercepted');

  event.preventDefault();
  handleProductFormSubmit(form);
}

onDocumentReady(() => {
  cartDebug('add', 'product-cart listener registered', {
    cartAddUrl: Theme.routes.cart_add_url,
    sectionIds: getCartSectionsParam(),
    debugHint: 'Enable with localStorage.setItem("theme:cart-debug", "1") or ?cart_debug=1',
  });

  document.addEventListener('submit', onDocumentSubmit);
});
