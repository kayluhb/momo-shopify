import { Component } from '@theme/component';
import { sectionRenderer } from '@theme/section-renderer';
import { FilterUpdateEvent } from '@theme/events';
import { debounce } from '@theme/utilities';

class FacetsFormComponent extends Component {
  requiredRefs = ['facetsForm'];

  #debouncedUpdate = debounce(() => this.updateFilters(), 300);

  connectedCallback() {
    super.connectedCallback();
    this.refs.facetsForm.addEventListener('change', this.#debouncedUpdate);
    this.refs.facetsForm.addEventListener('submit', this.#onSubmit);
    this.refs.facetsForm.addEventListener('toggle', this.#onFilterToggle, true);
    document.addEventListener('pointerdown', this.#onDocumentPointerDown, true);
    document.addEventListener('keydown', this.#onDocumentKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.refs.facetsForm.removeEventListener('submit', this.#onSubmit);
    this.refs.facetsForm.removeEventListener('toggle', this.#onFilterToggle, true);
    document.removeEventListener('pointerdown', this.#onDocumentPointerDown, true);
    document.removeEventListener('keydown', this.#onDocumentKeyDown);
  }

  /** @param {Event} event */
  #onFilterToggle = (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;
    if (!details.classList.contains('collection-filter')) return;
    if (!details.open) return;

    this.#getOpenFilters().forEach((filter) => {
      if (filter !== details) filter.removeAttribute('open');
    });
  };

  /** @param {PointerEvent} event */
  #onDocumentPointerDown = (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;

    this.#getOpenFilters().forEach((filter) => {
      if (!filter.contains(target)) {
        filter.removeAttribute('open');
      }
    });
  };

  /** @param {KeyboardEvent} event */
  #onDocumentKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    this.#closeAllFilters();
  };

  #getOpenFilters() {
    return this.refs.facetsForm.querySelectorAll('.collection-filter[open]');
  }

  #closeAllFilters() {
    this.#getOpenFilters().forEach((filter) => {
      filter.removeAttribute('open');
    });
  }

  /** @param {SubmitEvent} event */
  #onSubmit = (event) => {
    event.preventDefault();
    this.updateFilters();
  };

  get sectionId() {
    const id = this.getAttribute('section-id');
    if (!id) throw new Error('facets-form-component requires section-id');
    return id;
  }

  updateFilters() {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(new FormData(this.refs.facetsForm));

    params.delete('page');

    if (params.get('filter.v.price.gte') === '') params.delete('filter.v.price.gte');
    if (params.get('filter.v.price.lte') === '') params.delete('filter.v.price.lte');

    url.search = params.toString();
    history.pushState({}, '', url.toString());

    this.dispatchEvent(new FilterUpdateEvent(params));
    sectionRenderer.renderSection(this.sectionId, { url, cache: false });
  }
}

if (!customElements.get('facets-form-component')) {
  customElements.define('facets-form-component', FacetsFormComponent);
}
