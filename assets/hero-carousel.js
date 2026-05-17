(function () {
  const roots = document.querySelectorAll('[data-hero-fullscreen]');
  if (!roots.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  roots.forEach((root) => {
    if (root.dataset.enableCarousel !== '1') return;

    const slides = root.querySelectorAll('[data-hero-slide]');
    const panels = root.querySelectorAll('[data-hero-slide-inner]');
    const dots = root.querySelectorAll('[data-hero-dot]');
    const prevBtn = root.querySelector('[data-hero-dir="prev"]');
    const nextBtn = root.querySelector('[data-hero-dir="next"]');
    const pauseBtn = root.querySelector('[data-hero-pause]');
    const liveRegion = root.querySelector('[id^="hero-live-"]');
    const total = slides.length;
    if (total < 2) return;

    let index = 0;
    let timer = null;
    let userPaused = false;
    const autoplayEnabled = root.dataset.autoplay === '1' && !reduceMotion;
    const interval = parseInt(root.dataset.interval, 10) || 5000;
    const i18nSlide = root.dataset.i18nSlide || '';
    const i18nSlideNamed = root.dataset.i18nSlideNamed || '';
    const i18nPause = root.dataset.i18nPause || 'Pause slideshow';
    const i18nPlay = root.dataset.i18nPlay || 'Play slideshow';

    function formatMessage(template, current, title) {
      let msg = template
        .replace(/__CURRENT__/g, String(current))
        .replace(/__TOTAL__/g, String(total));
      if (title) {
        msg = msg.replace(/__TITLE__/g, title);
      }
      return msg;
    }

    function announce() {
      if (!liveRegion) return;
      const panel = panels[index];
      const title = panel ? panel.getAttribute('data-slide-title') : '';
      const current = index + 1;
      if (title && i18nSlideNamed) {
        liveRegion.textContent = formatMessage(i18nSlideNamed, current, title);
      } else if (i18nSlide) {
        liveRegion.textContent = formatMessage(i18nSlide, current);
      }
    }

    function updatePauseUi() {
      if (!pauseBtn) return;
      const paused = userPaused || !autoplayEnabled;
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', paused ? i18nPlay : i18nPause);
      pauseBtn.classList.toggle('is-paused', paused);
    }

    function goTo(targetIndex, options = {}) {
      index = (targetIndex + total) % total;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      panels.forEach((panel, panelIndex) => {
        const active = panelIndex === index;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) {
          panel.removeAttribute('tabindex');
        } else {
          panel.setAttribute('tabindex', '-1');
        }
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
        dot.setAttribute('tabindex', active ? '0' : '-1');
      });
      if (options.announce !== false) {
        announce();
      }
    }

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startTimer() {
      stopTimer();
      if (!autoplayEnabled || userPaused) return;
      timer = setInterval(() => {
        goTo(index + 1);
      }, interval);
    }

    function togglePause() {
      userPaused = !userPaused;
      updatePauseUi();
      if (userPaused) {
        stopTimer();
      } else {
        startTimer();
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        goTo(index - 1);
        startTimer();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        goTo(index + 1);
        startTimer();
      });
    }

    if (pauseBtn) {
      if (!autoplayEnabled) {
        pauseBtn.setAttribute('aria-disabled', 'true');
        pauseBtn.disabled = true;
      }
      pauseBtn.addEventListener('click', togglePause);
      updatePauseUi();
    }

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const dotIndex = parseInt(dot.getAttribute('data-hero-dot'), 10);
        if (!Number.isNaN(dotIndex)) {
          goTo(dotIndex);
          startTimer();
        }
      });

      dot.addEventListener('keydown', (event) => {
        const dotIndex = parseInt(dot.getAttribute('data-hero-dot'), 10);
        if (Number.isNaN(dotIndex)) return;
        let targetIndex = dotIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          targetIndex = (dotIndex + 1) % total;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          targetIndex = (dotIndex - 1 + total) % total;
        } else if (event.key === 'Home') {
          event.preventDefault();
          targetIndex = 0;
        } else if (event.key === 'End') {
          event.preventDefault();
          targetIndex = total - 1;
        } else {
          return;
        }
        goTo(targetIndex);
        dots[targetIndex].focus();
        startTimer();
      });
    });

    root.addEventListener('keydown', (event) => {
      if (!root.contains(document.activeElement)) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
        startTimer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
        startTimer();
      } else if (event.key === 'Home') {
        event.preventDefault();
        goTo(0);
        startTimer();
      } else if (event.key === 'End') {
        event.preventDefault();
        goTo(total - 1);
        startTimer();
      }
    });

    root.addEventListener('mouseenter', stopTimer);
    root.addEventListener('mouseleave', startTimer);
    root.addEventListener('focusin', stopTimer);
    root.addEventListener('focusout', (event) => {
      if (!root.contains(event.relatedTarget)) startTimer();
    });

    goTo(0, { announce: false });
    startTimer();
  });
})();
