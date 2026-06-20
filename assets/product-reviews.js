import { DialogComponent } from '@theme/dialog';
import { debounce } from '@theme/utilities';

/**
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog - The dialog element.
 *
 * @extends {DialogComponent}
 */
class ProductReviewsGalleryComponent extends DialogComponent {
  /** @type {number} */
  #currentGlobalIndex = 0;
  /** @type {number} */
  #mediaCount = 0;
  /** @type {HTMLElement[]} */
  #mediaPanels = [];
  /** @type {Map<number, HTMLTemplateElement>} */
  #reviewTemplates = new Map();
  /** @type {number[]} */
  #reviewIndicesWithMedia = [];
  /** @type {HTMLElement | null} */
  #lastOpener = null;

  connectedCallback() {
    super.connectedCallback();
    this.#cacheDom();
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('keydown', this.#onKeyDown);
  }

  close = async () => {
    this.#pauseAllVideos();
    const opener = this.#lastOpener;
    this.#lastOpener = null;
    await this.closeDialog();
    opener?.focus();
  };

  /** @param {number} globalIndex @param {HTMLElement} [opener] */
  openAt(globalIndex, opener) {
    if (!this.#mediaPanels.length) return;

    if (opener instanceof HTMLElement) {
      this.#lastOpener = opener;
    }

    this.#currentGlobalIndex = this.#clampIndex(globalIndex);
    this.#renderDialogState();
    this.showDialog();

    requestAnimationFrame(() => {
      const closeButton = this.querySelector('.product-reviews__dialog-close');
      if (closeButton instanceof HTMLElement) {
        closeButton.focus();
      }
    });
  }

  #cacheDom() {
    this.#mediaPanels = Array.from(this.querySelectorAll('[data-dialog-media-panel]'));
    this.#mediaCount = this.#mediaPanels.length;

    this.#reviewTemplates = new Map();
    this.querySelectorAll('template[data-review-template]').forEach((template) => {
      if (!(template instanceof HTMLTemplateElement)) return;
      const reviewIndex = Number(template.dataset.reviewIndex);
      if (!Number.isNaN(reviewIndex)) {
        this.#reviewTemplates.set(reviewIndex, template);
      }
    });

    const reviewIndices = new Set();
    this.#mediaPanels.forEach((panel) => {
      const reviewIndex = Number(panel.dataset.reviewIndex);
      if (!Number.isNaN(reviewIndex)) reviewIndices.add(reviewIndex);
    });
    this.#reviewIndicesWithMedia = Array.from(reviewIndices).sort((a, b) => a - b);
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const opener = target.closest('[data-gallery-open]');
    if (opener instanceof HTMLElement && opener.dataset.globalIndex != null) {
      event.preventDefault();
      this.openAt(Number(opener.dataset.globalIndex), opener);
      return;
    }

    if (target.closest('[data-dialog-prev-media]')) {
      event.preventDefault();
      this.#stepMedia(-1);
      return;
    }

    if (target.closest('[data-dialog-next-media]')) {
      event.preventDefault();
      this.#stepMedia(1);
      return;
    }

    if (target.closest('[data-dialog-prev-review]')) {
      event.preventDefault();
      this.#stepReview(-1);
      return;
    }

    if (target.closest('[data-dialog-next-review]')) {
      event.preventDefault();
      this.#stepReview(1);
      return;
    }

    const thumb = target.closest('[data-dialog-thumb-index]');
    if (thumb instanceof HTMLElement && thumb.dataset.dialogThumbIndex != null) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#showMediaForReview(this.#currentReviewIndex(), Number(thumb.dataset.dialogThumbIndex));
      return;
    }
  };

  /** @param {number} delta */
  #stepMedia(delta) {
    this.#currentGlobalIndex = this.#clampIndex(this.#currentGlobalIndex + delta);
    this.#renderDialogState();
  }

  /** @param {number} delta */
  #stepReview(delta) {
    const currentReviewIndex = this.#currentReviewIndex();
    const position = this.#reviewIndicesWithMedia.indexOf(currentReviewIndex);
    if (position === -1) return;

    const nextReviewIndex = this.#reviewIndicesWithMedia[position + delta];
    if (nextReviewIndex == null) return;

    const firstPanel = this.#mediaPanels.find(
      (panel) => Number(panel.dataset.reviewIndex) === nextReviewIndex
    );
    if (!firstPanel || firstPanel.dataset.globalIndex == null) return;

    this.#currentGlobalIndex = Number(firstPanel.dataset.globalIndex);
    this.#renderDialogState();
  }

  /** @param {number} reviewIndex @param {number} mediaIndex */
  #showMediaForReview(reviewIndex, mediaIndex) {
    const panel = this.#mediaPanels.find(
      (item) =>
        Number(item.dataset.reviewIndex) === reviewIndex &&
        Number(item.dataset.mediaIndex) === mediaIndex
    );

    if (!panel || panel.dataset.globalIndex == null) return;

    this.#currentGlobalIndex = Number(panel.dataset.globalIndex);
    this.#renderDialogState();
  }

  #renderDialogState() {
    const activePanel = this.#mediaPanels[this.#currentGlobalIndex];
    if (!activePanel) return;

    const reviewIndex = Number(activePanel.dataset.reviewIndex);
    const mediaIndex = Number(activePanel.dataset.mediaIndex);

    this.#mediaPanels.forEach((panel, index) => {
      const isActive = index === this.#currentGlobalIndex;
      panel.hidden = !isActive;

      if (!isActive) {
        const video = panel.querySelector('video');
        if (video instanceof HTMLVideoElement) {
          video.pause();
          video.currentTime = 0;
        }
      }
    });

    this.#populateReviewDetails(reviewIndex, mediaIndex);
    this.#updateNavState(reviewIndex);
    this.#announceMediaChange();
  }

  /** @param {number} reviewIndex @param {number} mediaIndex */
  #populateReviewDetails(reviewIndex, mediaIndex) {
    const template = this.#reviewTemplates.get(reviewIndex);
    if (!template) return;

    const fragment = template.content.cloneNode(true);
    const author = this.querySelector('[data-dialog-author]');
    const stars = this.querySelector('[data-dialog-stars]');
    const title = this.querySelector('[data-dialog-title]');
    const body = this.querySelector('[data-dialog-body]');
    const response = this.querySelector('[data-dialog-response]');
    const responseBody = this.querySelector('[data-dialog-response-body]');
    const thumbs = this.querySelector('[data-dialog-thumbs]');

    const reviewAuthor = fragment.querySelector('[data-review-author]');
    const reviewVerified = fragment.querySelector('[data-review-verified]');
    const reviewTimestamp = fragment.querySelector('[data-review-timestamp]');
    const reviewGid = fragment.querySelector('[data-review-gid]');
    const reviewHelpfulCount = fragment.querySelector('[data-review-helpful-count]');
    const reviewNotHelpfulCount = fragment.querySelector('[data-review-not-helpful-count]');
    const reviewStars = fragment.querySelector('[data-review-stars]');
    const reviewTitle = fragment.querySelector('[data-review-title]');
    const reviewBody = fragment.querySelector('[data-review-body]');
    const reviewResponse = fragment.querySelector('[data-review-response]');
    const thumbNodes = fragment.querySelectorAll('[data-review-media-thumb]');

    const dialogVerified = this.querySelector('[data-dialog-verified]');
    const dialogTimestamp = this.querySelector('[data-dialog-timestamp]');
    const dialogVotes = this.querySelector('[data-dialog-votes]');

    if (author instanceof HTMLElement) {
      author.textContent = reviewAuthor?.textContent?.trim() ?? '';
      author.hidden = author.textContent === '';
    }

    const i18n = getReviewsI18n(this.closest('[data-product-reviews-root]'));

    if (dialogVerified instanceof HTMLElement) {
      const isVerified = reviewVerified?.textContent?.trim() === 'true';
      dialogVerified.hidden = !isVerified;
    }

    if (dialogTimestamp instanceof HTMLTimeElement) {
      const datetime = reviewTimestamp?.getAttribute('datetime');
      if (datetime) {
        dialogTimestamp.dateTime = datetime;
        dialogTimestamp.textContent = formatRelativeTimestamp(datetime);
        dialogTimestamp.hidden = false;
      } else {
        dialogTimestamp.textContent = '';
        dialogTimestamp.hidden = true;
      }
    }

    if (stars instanceof HTMLElement && reviewStars) {
      stars.innerHTML = reviewStars.innerHTML;
      stars.setAttribute('aria-label', reviewStars.getAttribute('aria-label') ?? '');
      stars.hidden = false;
    }

    if (title instanceof HTMLElement) {
      if (reviewTitle?.textContent) {
        title.textContent = reviewTitle.textContent;
        title.hidden = false;
      } else {
        title.textContent = '';
        title.hidden = true;
      }
    }

    if (body instanceof HTMLElement) {
      if (reviewBody?.innerHTML) {
        body.innerHTML = reviewBody.innerHTML;
        body.hidden = false;
      } else {
        body.innerHTML = '';
        body.hidden = true;
      }
    }

    if (response instanceof HTMLElement && responseBody instanceof HTMLElement) {
      if (reviewResponse?.innerHTML) {
        responseBody.innerHTML = reviewResponse.innerHTML;
        response.hidden = false;
      } else {
        responseBody.innerHTML = '';
        response.hidden = true;
      }
    }

    if (thumbs instanceof HTMLElement) {
      thumbs.innerHTML = '';

      if (thumbNodes.length > 1) {
        thumbNodes.forEach((node, thumbIndex) => {
          if (!(node instanceof HTMLElement)) return;

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'product-reviews__dialog-thumb';
          button.dataset.dialogThumbIndex = node.dataset.mediaIndex ?? '0';
          button.setAttribute(
            'aria-label',
            interpolate(i18n.dialogThumb, {
              index: String(thumbIndex + 1),
              count: String(thumbNodes.length),
            }),
          );

          if (Number(node.dataset.mediaIndex) === mediaIndex) {
            button.classList.add('is-active');
            button.setAttribute('aria-current', 'true');
          } else {
            button.removeAttribute('aria-current');
          }

          if (node.dataset.isVideo === 'true') {
            button.classList.add('product-reviews__dialog-thumb--video');
          }

          const image = node.querySelector('img');
          if (image instanceof HTMLImageElement) {
            const clone = image.cloneNode(true);
            if (clone instanceof HTMLImageElement) {
              clone.alt = '';
              button.append(clone);
            }
          }

          thumbs.append(button);
        });
        thumbs.hidden = false;
      } else {
        thumbs.hidden = true;
      }
    }

    if (dialogVotes instanceof HTMLElement && reviewGid?.textContent) {
      const listVotes = document.querySelector(
        `[data-review-votes][data-review-gid="${reviewGid.textContent.trim()}"]`,
      );

      if (listVotes instanceof HTMLElement) {
        dialogVotes.innerHTML = '';
        const clone = listVotes.cloneNode(true);
        if (clone instanceof HTMLElement) {
          dialogVotes.append(clone);
        }
        dialogVotes.hidden = false;
        applyVoteState(dialogVotes.querySelector('[data-review-votes]') ?? dialogVotes);
      } else {
        dialogVotes.innerHTML = buildVoteMarkup({
          reviewGid: reviewGid.textContent.trim(),
          helpfulCount: Number(reviewHelpfulCount?.textContent ?? 0),
          notHelpfulCount: Number(reviewNotHelpfulCount?.textContent ?? 0),
        });
        dialogVotes.hidden = false;
        const voteRoot = dialogVotes.querySelector('[data-review-votes]');
        if (voteRoot instanceof HTMLElement) applyVoteState(voteRoot);
      }
    }
  }

  #announceMediaChange() {
    const status = this.querySelector('[data-dialog-media-status]');
    if (!(status instanceof HTMLElement) || this.#mediaCount <= 0) return;

    const i18n = getReviewsI18n(this.closest('[data-product-reviews-root]'));
    status.textContent = interpolate(i18n.dialogMediaChanged, {
      index: String(this.#currentGlobalIndex + 1),
      count: String(this.#mediaCount),
    });
  }

  /** @param {number} reviewIndex */
  #updateNavState(reviewIndex) {
    const prevMedia = this.querySelector('[data-dialog-prev-media]');
    const nextMedia = this.querySelector('[data-dialog-next-media]');
    const prevReview = this.querySelector('[data-dialog-prev-review]');
    const nextReview = this.querySelector('[data-dialog-next-review]');

    if (prevMedia instanceof HTMLButtonElement) {
      prevMedia.disabled = this.#currentGlobalIndex <= 0;
    }

    if (nextMedia instanceof HTMLButtonElement) {
      nextMedia.disabled = this.#currentGlobalIndex >= this.#mediaCount - 1;
    }

    const reviewPosition = this.#reviewIndicesWithMedia.indexOf(reviewIndex);

    if (prevReview instanceof HTMLButtonElement) {
      prevReview.disabled = reviewPosition <= 0;
    }

    if (nextReview instanceof HTMLButtonElement) {
      nextReview.disabled = reviewPosition >= this.#reviewIndicesWithMedia.length - 1;
    }
  }

  #currentReviewIndex() {
    const activePanel = this.#mediaPanels[this.#currentGlobalIndex];
    return activePanel ? Number(activePanel.dataset.reviewIndex) : 0;
  }

  /** @param {KeyboardEvent} event */
  #onKeyDown = (event) => {
    const { dialog } = this.refs;
    if (!dialog?.open) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.#stepMedia(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.#stepMedia(1);
    }
  };

  #pauseAllVideos() {
    this.querySelectorAll('video').forEach((video) => {
      if (video instanceof HTMLVideoElement) {
        video.pause();
      }
    });
  }

  /** @param {number} index */
  #clampIndex(index) {
    if (this.#mediaCount <= 0) return 0;
    return Math.max(0, Math.min(index, this.#mediaCount - 1));
  }
}

if (!customElements.get('product-reviews-gallery-component')) {
  customElements.define('product-reviews-gallery-component', ProductReviewsGalleryComponent);
}

const VOTE_STORAGE_KEY = 'momo:review-votes';

/** @param {string} template @param {Record<string, string>} values */
function interpolate(template, values) {
  return template.replace(/%(\w+)%/g, (_, key) => values[key] ?? '');
}

/** @param {Element | null} root */
function getReviewsI18n(root) {
  const element = root instanceof HTMLElement ? root : null;

  return {
    dialogThumb: element?.dataset.i18nDialogThumb ?? 'View photo %index% of %count%',
    dialogMediaChanged: element?.dataset.i18nDialogMediaChanged ?? 'Showing photo %index% of %count%',
    filtersResults: element?.dataset.i18nFiltersResults ?? '%count% reviews shown',
    filtersResultsOne: element?.dataset.i18nFiltersResultsOne ?? '1 review shown',
    filtersResultsNone: element?.dataset.i18nFiltersResultsNone ?? 'No reviews match your filters',
    voteHelpful: element?.dataset.i18nVoteHelpful ?? 'Mark as helpful, %count% found this helpful',
    voteNotHelpful: element?.dataset.i18nVoteNotHelpful ?? 'Mark as not helpful, %count% found this not helpful',
  };
}

/** @returns {Record<string, 'up' | 'down'>} */
function readStoredVotes() {
  try {
    const raw = localStorage.getItem(VOTE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, 'up' | 'down'>} votes */
function writeStoredVotes(votes) {
  try {
    localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // Storage unavailable.
  }
}

/** @param {string} datetime */
function formatRelativeTimestamp(datetime) {
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'MINUTE' : 'MINUTES'} AGO`;
  if (hours < 24) return `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'} AGO`;
  if (days < 7) return `${days} ${days === 1 ? 'DAY' : 'DAYS'} AGO`;
  if (weeks < 5) return `${weeks} ${weeks === 1 ? 'WEEK' : 'WEEKS'} AGO`;
  if (months < 12) return `${months} ${months === 1 ? 'MONTH' : 'MONTHS'} AGO`;
  return `${years} ${years === 1 ? 'YEAR' : 'YEARS'} AGO`;
}

function formatRelativeTimestamps(root = document) {
  root.querySelectorAll('[data-relative-time]').forEach((element) => {
    if (!(element instanceof HTMLTimeElement)) return;
    const formatted = formatRelativeTimestamp(element.dateTime);
    if (formatted) element.textContent = formatted;
  });
}

/** @returns {{ shop: string, voteApiUrl: string } | null} */
function getVoteContext() {
  const root = document.querySelector('[data-product-reviews-root]');
  if (!(root instanceof HTMLElement)) return null;

  const shop = root.dataset.shop ?? '';
  const voteApiUrl = root.dataset.voteApiUrl ?? '';
  if (!shop || !voteApiUrl) return null;

  return { shop, voteApiUrl };
}

/** @param {{ reviewGid: string, helpfulCount: number, notHelpfulCount: number }} input */
function buildVoteMarkup(input) {
  return `
    <div
      class="product-review-votes"
      data-review-votes
      data-review-gid="${input.reviewGid}"
      data-helpful-count="${input.helpfulCount}"
      data-not-helpful-count="${input.notHelpfulCount}"
      role="group"
      aria-label="Was this review helpful?"
    >
      <button type="button" class="product-review-votes__button" data-vote="up" aria-pressed="false" aria-label="Mark review as helpful">
        <span class="product-review-votes__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5.25 15.75V8.25" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
            <path d="M5.25 8.25H3.75C3.06 8.25 2.5 8.81 2.5 9.5V14.5C2.5 15.19 3.06 15.75 3.75 15.75H5.25" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5.25 8.25L7.35 3.55C7.72 2.78 8.85 3.04 8.85 3.88V8.25H11.65C12.52 8.25 13.12 9.05 12.82 9.88L11.35 14.35C11.12 15.04 10.47 15.5 9.75 15.5H6.75" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="product-review-votes__count" data-vote-count="up" aria-hidden="true">${input.helpfulCount}</span>
      </button>
      <button type="button" class="product-review-votes__button" data-vote="down" aria-pressed="false" aria-label="Mark review as not helpful">
        <span class="product-review-votes__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5.25 2.25V9.75" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
            <path d="M5.25 9.75H3.75C3.06 9.75 2.5 9.19 2.5 8.5V3.5C2.5 2.81 3.06 2.25 3.75 2.25H5.25" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5.25 9.75L7.35 14.45C7.72 15.22 8.85 14.96 8.85 14.12V9.75H11.65C12.52 9.75 13.12 8.95 12.82 8.12L11.35 3.65C11.12 2.96 10.47 2.5 9.75 2.5H6.75" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="product-review-votes__count" data-vote-count="down" aria-hidden="true">${input.notHelpfulCount}</span>
      </button>
    </div>
  `;
}

/** @param {HTMLElement} container @param {{ shop: string, voteApiUrl: string } | null} context */
function applyVoteState(container) {
  const reviewGid = container.dataset.reviewGid;
  if (!reviewGid) return;

  const storedVotes = readStoredVotes();
  const userVote = storedVotes[reviewGid] ?? null;

  container.querySelectorAll('[data-vote]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const vote = button.dataset.vote;
    button.setAttribute('aria-pressed', String(userVote === vote));
  });

  updateVoteButtonLabels(container);
}

/** @param {HTMLElement} container */
function updateVoteButtonLabels(container) {
  const i18n = getReviewsI18n(container.closest('[data-product-reviews-root]'));
  const helpfulCount = container.dataset.helpfulCount ?? '0';
  const notHelpfulCount = container.dataset.notHelpfulCount ?? '0';

  container.querySelectorAll('[data-vote]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;

    if (button.dataset.vote === 'up') {
      button.setAttribute(
        'aria-label',
        interpolate(i18n.voteHelpful, { count: helpfulCount }),
      );
    } else if (button.dataset.vote === 'down') {
      button.setAttribute(
        'aria-label',
        interpolate(i18n.voteNotHelpful, { count: notHelpfulCount }),
      );
    }
  });
}

function initProductReviewInteractions(root = document) {
  formatRelativeTimestamps(root);

  root.querySelectorAll('[data-review-votes]').forEach((container) => {
    if (container instanceof HTMLElement) {
      applyVoteState(container);
    }
  });
}

/** @param {string} reviewGid @param {{ helpfulCount: number, notHelpfulCount: number, userVote: 'up' | 'down' | null }} state */
function syncVoteContainers(reviewGid, state) {
  document.querySelectorAll(`[data-review-votes][data-review-gid="${reviewGid}"]`).forEach((container) => {
    if (!(container instanceof HTMLElement)) return;

    container.dataset.helpfulCount = String(state.helpfulCount);
    container.dataset.notHelpfulCount = String(state.notHelpfulCount);

    const upCount = container.querySelector('[data-vote-count="up"]');
    const downCount = container.querySelector('[data-vote-count="down"]');
    if (upCount) upCount.textContent = String(state.helpfulCount);
    if (downCount) downCount.textContent = String(state.notHelpfulCount);

    container.querySelectorAll('[data-vote]').forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.setAttribute('aria-pressed', String(button.dataset.vote === state.userVote));
    });

    updateVoteButtonLabels(container);
  });

  const storedVotes = readStoredVotes();
  if (state.userVote) storedVotes[reviewGid] = state.userVote;
  else delete storedVotes[reviewGid];
  writeStoredVotes(storedVotes);
}

let voteDelegationBound = false;
let galleryOpenDelegationBound = false;

/** @param {HTMLElement} root */
function initProductReviewsFilters(root) {
  if (root.dataset.reviewsFilterInit === 'true') return;

  const list = root.querySelector('[data-product-reviews-list]');
  const emptyMessage = root.querySelector('[data-filter-empty]');
  if (!(list instanceof HTMLElement)) return;

  const items = Array.from(list.querySelectorAll('.product-reviews__item')).filter(
    (item) => item instanceof HTMLElement,
  );
  if (!items.length) return;

  root.dataset.reviewsFilterInit = 'true';

  const sortSelect = root.querySelector('[data-review-sort]');
  const ratingSelect = root.querySelector('[data-review-rating-filter]');
  const mediaCheckbox = root.querySelector('[data-review-media-filter]');
  const searchInput = root.querySelector('[data-review-search]');
  const distributionFilters = root.querySelectorAll('[data-rating-filter]');
  const resultsStatus = root.querySelector('[data-review-results-status]');
  const i18n = getReviewsI18n(root);

  /** @type {{ sort: string, rating: string, mediaOnly: boolean, search: string }} */
  const state = {
    sort: 'latest',
    rating: '',
    mediaOnly: false,
    search: '',
  };
  let shouldAnnounceResults = false;

  /** @param {HTMLElement} item */
  function itemMatches(item) {
    if (state.rating && item.dataset.reviewRating !== state.rating) return false;
    if (state.mediaOnly && item.dataset.reviewHasMedia !== 'true') return false;
    if (state.search && !(item.dataset.reviewSearch ?? '').includes(state.search)) return false;
    return true;
  }

  /** @param {HTMLElement} a @param {HTMLElement} b */
  function compareLatest(a, b) {
    return Number(b.dataset.reviewSubmittedAt ?? 0) - Number(a.dataset.reviewSubmittedAt ?? 0);
  }

  /** @param {HTMLElement[]} visibleItems */
  function sortItems(visibleItems) {
    const sorters = {
      latest: compareLatest,
      oldest: (a, b) => -compareLatest(a, b),
      highest: (a, b) =>
        Number(b.dataset.reviewRating ?? 0) - Number(a.dataset.reviewRating ?? 0) || compareLatest(a, b),
      lowest: (a, b) =>
        Number(a.dataset.reviewRating ?? 0) - Number(b.dataset.reviewRating ?? 0) || compareLatest(a, b),
    };

    visibleItems.sort(sorters[state.sort] ?? sorters.latest);
  }

  function syncDistributionButtons() {
    distributionFilters.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = state.rating !== '' && button.dataset.ratingFilter === state.rating;
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function applyFilters() {
    const visible = [];

    items.forEach((item) => {
      const show = itemMatches(item);
      item.hidden = !show;
      if (show) visible.push(item);
    });

    sortItems(visible);
    visible.forEach((item) => list.appendChild(item));

    if (emptyMessage instanceof HTMLElement) {
      emptyMessage.hidden = visible.length > 0;
    }

    if (resultsStatus instanceof HTMLElement && shouldAnnounceResults) {
      if (visible.length === 0) {
        resultsStatus.textContent = i18n.filtersResultsNone;
      } else if (visible.length === 1) {
        resultsStatus.textContent = i18n.filtersResultsOne;
      } else {
        resultsStatus.textContent = interpolate(i18n.filtersResults, {
          count: String(visible.length),
        });
      }
    }

    syncDistributionButtons();

    if (ratingSelect instanceof HTMLSelectElement) {
      ratingSelect.value = state.rating;
    }
  }

  if (sortSelect instanceof HTMLSelectElement) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      shouldAnnounceResults = true;
      applyFilters();
    });
  }

  if (ratingSelect instanceof HTMLSelectElement) {
    ratingSelect.addEventListener('change', () => {
      state.rating = ratingSelect.value;
      shouldAnnounceResults = true;
      applyFilters();
    });
  }

  if (mediaCheckbox instanceof HTMLInputElement) {
    mediaCheckbox.addEventListener('change', () => {
      state.mediaOnly = mediaCheckbox.checked;
      shouldAnnounceResults = true;
      applyFilters();
    });
  }

  if (searchInput instanceof HTMLInputElement) {
    const applySearch = debounce(() => {
      state.search = searchInput.value.trim().toLowerCase();
      shouldAnnounceResults = true;
      applyFilters();
    }, 200);

    searchInput.addEventListener('input', applySearch);
  }

  distributionFilters.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;

    button.addEventListener('click', () => {
      if (button.disabled) return;

      const rating = button.dataset.ratingFilter ?? '';
      state.rating = state.rating === rating ? '' : rating;
      shouldAnnounceResults = true;
      applyFilters();
    });
  });

  applyFilters();
}

function bindGalleryOpenDelegation() {
  if (galleryOpenDelegationBound) return;
  galleryOpenDelegationBound = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const opener = target.closest('[data-gallery-open]');
    if (!(opener instanceof HTMLElement) || opener.dataset.globalIndex == null) return;

    if (opener.closest('product-reviews-gallery-component')) return;

    const reviewsRoot = opener.closest('[data-product-reviews-root]');
    if (!reviewsRoot) return;

    const gallery = reviewsRoot.querySelector('product-reviews-gallery-component');
    if (!gallery || typeof gallery.openAt !== 'function') return;

    event.preventDefault();
    if ('openAt' in gallery && typeof gallery.openAt === 'function') {
      gallery.openAt(Number(opener.dataset.globalIndex), opener);
    }
  });
}

function bindVoteDelegation() {
  if (voteDelegationBound) return;
  voteDelegationBound = true;

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('[data-vote]');
    if (!(button instanceof HTMLButtonElement)) return;

    const container = button.closest('[data-review-votes]');
    if (!(container instanceof HTMLElement)) return;

    const context = getVoteContext();
    if (!context) return;

    const reviewGid = container.dataset.reviewGid;
    const voteDirection = button.dataset.vote;
    if (!reviewGid || (voteDirection !== 'up' && voteDirection !== 'down')) return;

    event.preventDefault();

    const storedVotes = readStoredVotes();
    const currentVote = storedVotes[reviewGid] ?? null;
    const nextVote = currentVote === voteDirection ? null : voteDirection;

    container.querySelectorAll('[data-vote]').forEach((voteButton) => {
      if (voteButton instanceof HTMLButtonElement) voteButton.disabled = true;
    });

    try {
      const voteUrl = new URL(context.voteApiUrl);
      voteUrl.searchParams.set('shop', context.shop);

      const response = await fetch(voteUrl.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: context.shop,
          reviewGid,
          vote: nextVote,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) return;

      syncVoteContainers(reviewGid, {
        helpfulCount: result.helpfulCount,
        notHelpfulCount: result.notHelpfulCount,
        userVote: result.userVote,
      });
    } finally {
      container.querySelectorAll('[data-vote]').forEach((voteButton) => {
        if (voteButton instanceof HTMLButtonElement) voteButton.disabled = false;
      });
    }
  });
}

initProductReviewInteractions();
bindVoteDelegation();
bindGalleryOpenDelegation();
document.querySelectorAll('[data-product-reviews-root]').forEach(initProductReviewsFilters);
document.addEventListener('shopify:section:load', (event) => {
  if (event.target instanceof HTMLElement) {
    initProductReviewInteractions(event.target);
    event.target.querySelectorAll('[data-product-reviews-root]').forEach(initProductReviewsFilters);
    if (event.target.matches('[data-product-reviews-root]')) {
      initProductReviewsFilters(event.target);
    }
  }
});
