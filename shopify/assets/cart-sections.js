/**
 * Collects section IDs that should refresh on cart changes.
 * @returns {string[]}
 */
export function getCartSectionIds() {
  const ids = new Set();

  const header = document.querySelector('[data-section-id]');
  if (header?.dataset.sectionId) {
    ids.add(header.dataset.sectionId);
  }

  document.querySelectorAll('cart-items-component[data-section-id]').forEach((element) => {
    if (element instanceof HTMLElement && element.dataset.sectionId) {
      ids.add(element.dataset.sectionId);
    }
  });

  return Array.from(ids);
}

/**
 * @returns {string}
 */
export function getCartSectionsParam() {
  return getCartSectionIds().join(',');
}
