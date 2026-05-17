import { morphSection } from '@theme/section-renderer';
import { fetchConfig, onDocumentReady } from '@theme/utilities';
import { CartAddEvent, CartErrorEvent } from '@theme/events';
import { getCartSectionsParam } from '@theme/cart-sections';

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
 * @param {Record<string, string> | undefined} sections
 */
async function morphCartSections(sections) {
  if (!sections) return;

  await Promise.all(Object.entries(sections).map(([sectionId, html]) => morphSection(sectionId, html)));
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

  const formData = new FormData(form);
  const sections = getCartSectionsParam();

  if (sections) {
    formData.append('sections', sections);
    formData.append('sections_url', window.location.pathname);
  }

  const defaultLabel = submitControl.value || submitControl.textContent || '';
  const loadingLabel = Theme.translations.add_to_cart_loading;

  setFormLoading(form, submitControl, true);
  clearFormMessage(form);

  if (submitControl instanceof HTMLInputElement) {
    submitControl.value = loadingLabel;
  } else {
    submitControl.textContent = loadingLabel;
  }

  try {
    const fetchCfg = fetchConfig('javascript', { body: formData });
    const response = await fetch(Theme.routes.cart_add_url, fetchCfg);
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
          variantId: formData.get('id')?.toString(),
        })
      );
      return;
    }

    await morphCartSections(data.sections);

    showFormMessage(form, Theme.translations.add_to_cart_success);

    document.dispatchEvent(
      new CartAddEvent(data, formData.get('id')?.toString() || '', {
        source: 'product-cart',
        itemCount: Number(formData.get('quantity')) || 1,
        variantId: formData.get('id')?.toString(),
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
