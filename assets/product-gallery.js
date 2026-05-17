class ProductGallery extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick);

    const initialMediaId = this.dataset.initialMediaId;
    if (initialMediaId) {
      this.#showMedia(initialMediaId);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const thumb = event.target instanceof Element ? event.target.closest('[data-gallery-thumb]') : null;
    if (!(thumb instanceof HTMLButtonElement) || !this.contains(thumb)) return;

    const mediaId = thumb.dataset.mediaId;
    if (!mediaId) return;

    this.#showMedia(mediaId);
  };

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
  }
}

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}
