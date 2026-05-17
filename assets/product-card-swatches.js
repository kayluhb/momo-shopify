import { onDocumentReady } from '@theme/utilities';
import { ThemeEvents } from '@theme/events';

/** @type {WeakMap<HTMLElement, { src: string; srcset: string }>} */
const defaultImages = new WeakMap();

/**
 * @param {HTMLElement} card
 */
function getPrimaryImage(card) {
  return card.querySelector('.product-card__image--primary img');
}

/**
 * @param {HTMLElement} card
 */
function rememberDefaultImage(card) {
  const image = getPrimaryImage(card);
  if (!(image instanceof HTMLImageElement) || defaultImages.has(card)) return;

  defaultImages.set(card, {
    src: image.currentSrc || image.src,
    srcset: image.srcset,
  });
}

/**
 * @param {HTMLElement} card
 */
function resetCardImage(card) {
  const image = getPrimaryImage(card);
  const defaults = defaultImages.get(card);
  if (!(image instanceof HTMLImageElement) || !defaults) return;

  image.src = defaults.src;
  image.srcset = defaults.srcset;
}

/**
 * @param {HTMLElement} swatch
 */
function previewSwatchImage(swatch) {
  const imageUrl = swatch.dataset.swatchImage;
  if (!imageUrl) return;

  const card = swatch.closest('[data-product-card]');
  if (!(card instanceof HTMLElement)) return;

  rememberDefaultImage(card);

  const image = getPrimaryImage(card);
  if (!(image instanceof HTMLImageElement)) return;

  image.src = imageUrl;
  image.removeAttribute('srcset');

  card.querySelectorAll('.product-card__swatch.is-selected').forEach((node) => {
    node.classList.remove('is-selected');
    node.removeAttribute('aria-current');
  });

  swatch.classList.add('is-selected');
  swatch.setAttribute('aria-current', 'true');
}

/**
 * @param {Event} event
 */
function handlePointerOver(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const swatch = target.closest('[data-swatch-image]');
  if (!(swatch instanceof HTMLElement)) return;

  previewSwatchImage(swatch);
}

/**
 * @param {Event} event
 */
function handlePointerOut(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest('[data-product-card]');
  if (!(card instanceof HTMLElement)) return;

  const related = event.relatedTarget;
  if (related instanceof Node && card.contains(related)) return;

  resetCardImage(card);
}

/**
 * @param {HTMLElement} root
 */
function initCards(root) {
  root.querySelectorAll('[data-product-card]').forEach(rememberDefaultImage);
}

onDocumentReady(() => {
  initCards(document);

  document.addEventListener('pointerover', handlePointerOver);
  document.addEventListener('pointerout', handlePointerOut);
  document.addEventListener(ThemeEvents.filterUpdate, () => {
    initCards(document);
  });
  document.addEventListener('shopify:section:load', (event) => {
    if (event.target instanceof HTMLElement) {
      initCards(event.target);
    }
  });
});
