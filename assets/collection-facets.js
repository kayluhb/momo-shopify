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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.refs.facetsForm.removeEventListener('submit', this.#onSubmit);
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
