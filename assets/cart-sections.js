import { morph, MORPH_OPTIONS } from '@theme/morph';
import { morphSection, normalizeSectionId } from '@theme/section-renderer';

/**
 * URL used when requesting section HTML alongside cart AJAX operations.
 * @returns {string}
 */
export function getCartSectionsUrl() {
  return Theme.routes?.cart_url || window.location.pathname;
}

/**
 * @param {string} html
 * @returns {Element | null}
 */
function getSectionElementFromHtml(html) {
  const fragment = new DOMParser().parseFromString(html, 'text/html');
  const section = fragment.querySelector('.shopify-section');

  if (section instanceof Element) {
    return section;
  }

  const sectionNodes = fragment.querySelectorAll('[id^="shopify-section-"]');
  return sectionNodes[0] instanceof Element ? sectionNodes[0] : null;
}

/**
 * @param {string} html
 * @returns {boolean}
 */
function morphCartDrawerInner(html) {
  const sectionEl = getSectionElementFromHtml(html);
  const newInner = sectionEl?.querySelector('[data-hydration-key="cart-drawer-inner"]');
  const existingInner = document.querySelector(
    'cart-drawer-component [data-hydration-key="cart-drawer-inner"]'
  );

  if (!(newInner instanceof HTMLElement) || !(existingInner instanceof HTMLElement)) {
    return false;
  }

  morph(existingInner, newInner, MORPH_OPTIONS);
  return true;
}

/**
 * @param {string} sectionId
 * @param {string} html
 * @returns {boolean}
 */
function morphCartItemsForSection(sectionId, html) {
  const normalizedId = normalizeSectionId(sectionId);
  const sectionEl = getSectionElementFromHtml(html);
  const newCartItems = sectionEl?.querySelector('cart-items-component');

  if (!(newCartItems instanceof HTMLElement)) {
    return false;
  }

  const existingComponents = document.querySelectorAll(
    `cart-items-component[data-section-id="${normalizedId}"]`
  );

  if (existingComponents.length === 0) {
    return false;
  }

  for (const existing of existingComponents) {
    if (existing instanceof HTMLElement) {
      morph(existing, newCartItems, MORPH_OPTIONS);
    }
  }

  return true;
}

/**
 * @param {string} sectionId
 * @param {string} html
 * @returns {Promise<boolean>}
 */
async function morphCartSection(sectionId, html) {
  const normalizedId = normalizeSectionId(sectionId);

  try {
    await morphSection(normalizedId, html);
    return true;
  } catch (error) {
    console.warn(`Could not morph section ${normalizedId} after cart update`, error);
  }

  if (morphCartDrawerInner(html)) {
    return true;
  }

  return morphCartItemsForSection(normalizedId, html);
}

/**
 * Morphs all sections returned from a cart AJAX response.
 * @param {Record<string, string> | undefined} sections
 * @param {string} [prioritySectionId] - Section to morph first (e.g. the cart items source)
 */
export async function morphCartSectionsFromResponse(sections, prioritySectionId) {
  if (!sections) return;

  const entries = Object.entries(sections).filter((entry) => entry[1]);

  if (prioritySectionId) {
    const normalizedPriority = normalizeSectionId(prioritySectionId);
    const priorityEntry = entries.find(([id]) => normalizeSectionId(id) === normalizedPriority);
    const otherEntries = entries.filter(([id]) => normalizeSectionId(id) !== normalizedPriority);

    if (priorityEntry) {
      await morphCartSection(priorityEntry[0], /** @type {string} */ (priorityEntry[1]));
    }

    await Promise.all(
      otherEntries.map(([sectionId, sectionHtml]) =>
        morphCartSection(sectionId, /** @type {string} */ (sectionHtml))
      )
    );
    return;
  }

  await Promise.all(
    entries.map(([sectionId, sectionHtml]) =>
      morphCartSection(sectionId, /** @type {string} */ (sectionHtml))
    )
  );
}

/**
 * @returns {string | null}
 */
export function getCartDrawerSectionId() {
  const drawerSection = document.querySelector('cart-drawer-component')?.closest('.shopify-section');
  if (drawerSection?.id) {
    return normalizeSectionId(drawerSection.id);
  }

  const cartItems = document.querySelector(
    'cart-drawer-component cart-items-component[data-section-id]'
  );
  if (cartItems instanceof HTMLElement && cartItems.dataset.sectionId) {
    return cartItems.dataset.sectionId;
  }

  return null;
}

/**
 * Collects section IDs that should refresh on cart changes.
 * @returns {string[]}
 */
export function getCartSectionIds() {
  const ids = new Set();

  const header = document.querySelector('[data-site-header][data-section-id]');
  if (header instanceof HTMLElement && header.dataset.sectionId) {
    ids.add(header.dataset.sectionId);
  }

  document.querySelectorAll('cart-items-component[data-section-id]').forEach((element) => {
    if (element instanceof HTMLElement && element.dataset.sectionId) {
      ids.add(element.dataset.sectionId);
    }
  });

  const drawerSectionId = getCartDrawerSectionId();
  if (drawerSectionId) {
    ids.add(drawerSectionId);
  }

  return Array.from(ids);
}

/**
 * @returns {string}
 */
export function getCartSectionsParam() {
  return getCartSectionIds().join(',');
}
