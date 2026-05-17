import PhotoSwipeLightbox from '@theme/photoswipe-lightbox';

class ProductGallery extends HTMLElement {
  /** @type {PhotoSwipeLightbox | null} */
  #lightbox = null;

  connectedCallback() {
    this.addEventListener('click', this.#onClick);
    this.#initLightbox();

    const initialMediaId = this.dataset.initialMediaId;
    if (initialMediaId) {
      this.#showMedia(initialMediaId);
      return;
    }

    const activePanel = this.querySelector('[data-media-panel].is-active');
    if (activePanel instanceof HTMLElement && activePanel.dataset.mediaId) {
      this.#updateZoomButton(activePanel.dataset.mediaId);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
    this.#destroyLightbox();
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !this.contains(target)) return;

    if (target.closest('[data-gallery-zoom-button]')) {
      event.preventDefault();
      this.#openZoom();
      return;
    }

    const thumb = target.closest('[data-gallery-thumb]');
    if (!(thumb instanceof HTMLButtonElement)) return;

    const mediaId = thumb.dataset.mediaId;
    if (!mediaId) return;

    this.#showMedia(mediaId);
  };

  #initLightbox() {
    if (this.#lightbox || !this.querySelector('[data-gallery-zoom]')) return;

    this.#lightbox = new PhotoSwipeLightbox({
      gallery: '[data-gallery-zoom]',
      children: 'a.product-gallery__zoom-link',
      pswpModule: () => import('@theme/photoswipe'),
      bgOpacity: 0.75,
      initialZoomLevel: (zoomLevel) => zoomLevel.fit,
      secondaryZoomLevel: (zoomLevel) => zoomLevel.fill,
      maxZoomLevel: 5,
      wheelToZoom: true,
      imageClickAction: 'zoom',
      bgClickAction: 'close',
      tapAction: 'close',
      doubleTapAction: false,
      zoomAnimationDuration: 333,
      showAnimationDuration: 333,
      hideAnimationDuration: 333,
      padding: { top: 24, bottom: 24, left: 16, right: 16 },
    });

    this.#lightbox.init();
  }

  #destroyLightbox() {
    this.#lightbox?.destroy();
    this.#lightbox = null;
  }

  #openZoom() {
    const activePanel = this.querySelector('[data-media-panel].is-active');
    const activeLink = activePanel?.querySelector('a.product-gallery__zoom-link');

    if (activeLink instanceof HTMLAnchorElement) {
      activeLink.click();
      return;
    }

    const links = this.querySelectorAll('a.product-gallery__zoom-link');
    if (!links.length || !this.#lightbox) return;

    this.#lightbox.loadAndOpen(0);
  }

  /** @param {string} mediaId */
  #showMedia(mediaId) {
    this.querySelectorAll('[data-media-panel]').forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;

      const isActive = panel.dataset.mediaId === mediaId;
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;

      if (!isActive) {
        const video = panel.querySelector('video');
        video?.pause();
      }
    });

    this.querySelectorAll('[data-gallery-thumb]').forEach((thumb) => {
      if (!(thumb instanceof HTMLButtonElement)) return;

      const isActive = thumb.dataset.mediaId === mediaId;
      thumb.classList.toggle('is-active', isActive);

      if (isActive) {
        thumb.setAttribute('aria-current', 'true');
      } else {
        thumb.removeAttribute('aria-current');
      }
    });

    this.#updateZoomButton(mediaId);
  }

  /** @param {string} mediaId */
  #updateZoomButton(mediaId) {
    const zoomButton = this.querySelector('[data-gallery-zoom-button]');
    if (!(zoomButton instanceof HTMLButtonElement)) return;

    const activePanel = this.querySelector(`[data-media-panel][data-media-id="${mediaId}"]`);
    const hasZoomableImage = Boolean(activePanel?.querySelector('a.product-gallery__zoom-link'));

    zoomButton.hidden = !hasZoomableImage;
    zoomButton.disabled = !hasZoomableImage;
  }
}

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}
