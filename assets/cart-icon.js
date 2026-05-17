import { onDocumentReady } from '@theme/utilities';
import { ThemeEvents } from '@theme/events';

/**
 * @param {Event} event
 */
function getCartItemCount(event) {
  const detail = /** @type {{ resource?: { item_count?: number }; data?: { itemCount?: number } }} */ (
    event.detail
  );

  if (typeof detail?.resource?.item_count === 'number') {
    return detail.resource.item_count;
  }

  if (typeof detail?.data?.itemCount === 'number') {
    return detail.data.itemCount;
  }

  return null;
}

/**
 * @param {number} itemCount
 */
function updateCartCountBadge(itemCount) {
  const trigger = document.querySelector('[data-cart-drawer-open]');
  if (!(trigger instanceof HTMLButtonElement)) return;

  const badge = trigger.querySelector('[data-header-cart-count]');
  const value = trigger.querySelector('[data-header-cart-count-value]');
  if (!(badge instanceof HTMLElement) || !(value instanceof HTMLElement)) return;

  if (itemCount > 0) {
    badge.hidden = false;
    value.textContent = String(itemCount);
  } else {
    badge.hidden = true;
    value.textContent = '0';
  }
}

/**
 * @param {Event} event
 */
function openCartDrawer(event) {
  const trigger = event.target instanceof Element ? event.target.closest('[data-cart-drawer-open]') : null;
  if (!trigger) return;

  event.preventDefault();

  const drawer = document.querySelector('cart-drawer-component');
  if (drawer && 'open' in drawer && typeof drawer.open === 'function') {
    drawer.open();
  }
}

/**
 * @param {Event} event
 */
function handleCartUpdate(event) {
  const itemCount = getCartItemCount(event);
  if (itemCount === null) return;
  updateCartCountBadge(itemCount);
}

onDocumentReady(() => {
  document.addEventListener('click', openCartDrawer);
  document.addEventListener(ThemeEvents.cartUpdate, handleCartUpdate);
});
