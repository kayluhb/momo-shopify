import { onDocumentReady } from '@theme/utilities';

const MENU_DRAWER_SELECTOR = 'menu-drawer-component';

/**
 * @param {Event} event
 */
function openMenuDrawer(event) {
  const trigger = event.target instanceof Element ? event.target.closest('[data-menu-drawer-open]') : null;
  if (!trigger) return;

  event.preventDefault();

  const drawer = document.querySelector(MENU_DRAWER_SELECTOR);
  if (drawer && 'open' in drawer && typeof drawer.open === 'function') {
    drawer.open();
  }
}

onDocumentReady(() => {
  document.addEventListener('click', openMenuDrawer);
});
