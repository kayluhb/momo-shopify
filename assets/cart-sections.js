import { cartDebug, cartDebugWarn, getCartDomSnapshot } from '@theme/utilities';
import { morph, MORPH_OPTIONS } from '@theme/morph';
import { morphSection, normalizeSectionId, sectionRenderer } from '@theme/section-renderer';

/**
 * URL used when requesting section HTML alongside cart AJAX operations.
 * @returns {string}
 */
export function getCartSectionsUrl() {
  return window.location.pathname || Theme.routes?.cart_url || '/';
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
 * @returns {Promise<void>}
 */
async function fetchAndRenderSection(sectionId) {
  const normalizedId = normalizeSectionId(sectionId);
  const url = new URL(getCartSectionsUrl(), window.location.origin);

  cartDebug('sections', `fetching section via Section Rendering API`, {
    sectionId: normalizedId,
    url: url.toString(),
  });

  await sectionRenderer.renderSection(normalizedId, { cache: false, url });
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
    cartDebug('sections', `morphed section ${normalizedId}`);
    return true;
  } catch (error) {
    cartDebugWarn('sections', `full section morph failed for ${normalizedId}`, error);
  }

  if (morphCartDrawerInner(html)) {
    cartDebug('sections', `morphed cart drawer inner for ${normalizedId}`);
    return true;
  }

  if (morphCartItemsForSection(normalizedId, html)) {
    cartDebug('sections', `morphed cart-items-component for ${normalizedId}`);
    return true;
  }

  cartDebugWarn('sections', `all morph strategies failed for ${normalizedId}`);
  return false;
}

/**
 * @param {Record<string, string> | undefined} sections
 * @returns {Array<[string, string]>}
 */
function getRenderableSectionEntries(sections) {
  if (!sections) return [];

  return Object.entries(sections).filter((entry) => {
    const html = entry[1];
    if (!html || typeof html !== 'string') {
      cartDebugWarn('sections', `section "${entry[0]}" has no HTML in cart response`);
      return false;
    }
    return true;
  });
}

/**
 * Morphs all sections returned from a cart AJAX response.
 * @param {Record<string, string> | undefined} sections
 * @param {string} [prioritySectionId] - Section to morph first (e.g. the cart items source)
 */
export async function morphCartSectionsFromResponse(sections, prioritySectionId) {
  const before = getCartDomSnapshot();
  const requestedIds = getCartSectionIds();
  const entries = getRenderableSectionEntries(sections);

  cartDebug('sections', 'morphCartSectionsFromResponse', {
    prioritySectionId,
    sectionsUrl: getCartSectionsUrl(),
    requestedSectionIds: requestedIds,
    responseSectionKeys: sections ? Object.keys(sections) : [],
    renderableSectionCount: entries.length,
    domBefore: before,
  });

  if (entries.length === 0) {
    cartDebugWarn('sections', 'no renderable section HTML — falling back to Section Rendering API');

    const fallbackId = prioritySectionId ?? getCartDrawerSectionId();
    if (fallbackId) {
      await fetchAndRenderSection(fallbackId);
    }

    cartDebug('sections', 'dom after fetch fallback', getCartDomSnapshot());
    return;
  }

  let priorityUpdated = false;

  if (prioritySectionId) {
    const normalizedPriority = normalizeSectionId(prioritySectionId);
    const priorityEntry = entries.find(([id]) => normalizeSectionId(id) === normalizedPriority);
    const otherEntries = entries.filter(([id]) => normalizeSectionId(id) !== normalizedPriority);

    if (priorityEntry) {
      priorityUpdated = await morphCartSection(priorityEntry[0], priorityEntry[1]);
    } else {
      cartDebugWarn('sections', `priority section "${normalizedPriority}" missing from response`, {
        responseKeys: entries.map(([id]) => id),
      });
    }

    await Promise.all(
      otherEntries.map(([sectionId, sectionHtml]) => morphCartSection(sectionId, sectionHtml))
    );

    if (!priorityUpdated && prioritySectionId) {
      cartDebugWarn('sections', `priority morph failed — fetching "${normalizedPriority}"`);
      await fetchAndRenderSection(prioritySectionId);
    }
  } else {
    await Promise.all(
      entries.map(([sectionId, sectionHtml]) => morphCartSection(sectionId, sectionHtml))
    );
  }

  const after = getCartDomSnapshot();
  cartDebug('sections', 'dom after morph', { before, after });
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
