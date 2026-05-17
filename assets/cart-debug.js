const STORAGE_KEY = 'theme:cart-debug';

/**
 * Cart debugging is off by default. Enable with either:
 * - `localStorage.setItem('theme:cart-debug', '1')` then reload
 * - Add `?cart_debug=1` to the URL
 * @returns {boolean}
 */
export function isCartDebugEnabled() {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      return true;
    }
  } catch {
    // localStorage may be unavailable
  }

  return new URLSearchParams(window.location.search).has('cart_debug');
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
export function cartDebug(scope, message, data) {
  if (!isCartDebugEnabled()) return;

  const prefix = `[cart:${scope}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
export function cartDebugWarn(scope, message, data) {
  if (!isCartDebugEnabled()) return;

  const prefix = `[cart:${scope}]`;
  if (data !== undefined) {
    console.warn(prefix, message, data);
  } else {
    console.warn(prefix, message);
  }
}

/**
 * @param {string} scope
 * @param {string} message
 * @param {unknown} [data]
 */
export function cartDebugError(scope, message, data) {
  if (!isCartDebugEnabled()) return;

  const prefix = `[cart:${scope}]`;
  if (data !== undefined) {
    console.error(prefix, message, data);
  } else {
    console.error(prefix, message);
  }
}

/**
 * @param {string} scope
 * @param {string} label
 * @param {() => void} fn
 */
export function cartDebugGroup(scope, label, fn) {
  if (!isCartDebugEnabled()) {
    fn();
    return;
  }

  console.groupCollapsed(`[cart:${scope}] ${label}`);
  try {
    fn();
  } finally {
    console.groupEnd();
  }
}

/**
 * @returns {{ rows: number; itemCount: number | null; isEmpty: boolean }}
 */
export function getCartDomSnapshot() {
  const rows = document.querySelectorAll('cart-items-component .cart-items__row').length;
  const empty = document.querySelector('cart-items-component .cart-empty');
  const badge = document.querySelector('[data-header-cart-count-value]');
  const itemCount = badge?.textContent ? Number(badge.textContent) : null;

  return {
    rows,
    itemCount: Number.isFinite(itemCount) ? itemCount : null,
    isEmpty: Boolean(empty),
  };
}

if (typeof window !== 'undefined') {
  window.themeCartDebug = {
    enable() {
      localStorage.setItem(STORAGE_KEY, '1');
      console.info('[cart:debug] Enabled — reload the page to trace cart add/remove.');
    },
    disable() {
      localStorage.removeItem(STORAGE_KEY);
      console.info('[cart:debug] Disabled.');
    },
    isEnabled: isCartDebugEnabled,
    snapshot: getCartDomSnapshot,
  };
}
