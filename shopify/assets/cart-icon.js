import { onDocumentReady } from '@theme/utilities';

function openCartDrawer(event) {
  const trigger = event.target instanceof Element ? event.target.closest('[data-cart-drawer-open]') : null;
  if (!trigger) return;

  event.preventDefault();

  const drawer = document.querySelector('cart-drawer-component');
  if (drawer && 'open' in drawer && typeof drawer.open === 'function') {
    drawer.open();
  }
}

onDocumentReady(() => {
  document.addEventListener('click', openCartDrawer);
});
