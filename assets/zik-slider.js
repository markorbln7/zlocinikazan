/**
 * <zik-slider> — the carousel used by the Zločin i Kazan sections.
 *
 * Replaces the Swiper 8 CDN dependency the WordPress theme used, matching its
 * behaviour: infinite loop, bullet pagination, prev/next arrows, touch drag.
 * Being a custom element, it re-initialises itself on shopify:section:load,
 * so it works inside the theme editor without extra wiring.
 *
 * Attributes:
 *   loop            — enable seamless looping (clone-based)
 *   autoplay="5000" — ms between slides; omit or 0 to disable
 */
class ZikSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-zik-track]');
    if (!this.track) return;

    this.loop = this.hasAttribute('loop');
    this.autoplayDelay = parseInt(this.getAttribute('autoplay') || '0', 10);
    this.index = 0;
    this.animating = false;

    this.realSlides = Array.from(this.track.children);
    this.count = this.realSlides.length;
    if (this.count === 0) return;

    // A single slide needs no controls at all.
    if (this.count < 2) {
      this.loop = false;
      this.autoplayDelay = 0;
      this.querySelectorAll('[data-zik-prev], [data-zik-next], [data-zik-bullets]').forEach((el) => {
        el.hidden = true;
      });
      return;
    }

    if (this.loop) this.#addClones();
    this.#buildBullets();
    this.#bindControls();
    this.#bindDrag();

    this.#goTo(0, false);
    this.#startAutoplay();
  }

  disconnectedCallback() {
    this.#stopAutoplay();
    if (this.observer) this.observer.disconnect();
  }

  /* Clone the first and last slide so the loop never shows a gap. */
  #addClones() {
    const first = this.realSlides[0].cloneNode(true);
    const last = this.realSlides[this.count - 1].cloneNode(true);
    first.setAttribute('aria-hidden', 'true');
    last.setAttribute('aria-hidden', 'true');
    first.dataset.zikClone = 'first';
    last.dataset.zikClone = 'last';
    this.track.appendChild(first);
    this.track.insertBefore(last, this.realSlides[0]);
  }

  #buildBullets() {
    this.bulletsEl = this.querySelector('[data-zik-bullets]');
    if (!this.bulletsEl) return;

    this.bulletsEl.innerHTML = '';
    this.bullets = this.realSlides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'zik-slider__bullet';
      b.setAttribute('aria-label', `${i + 1}`);
      b.addEventListener('click', () => {
        this.#stopAutoplay();
        this.#goTo(i);
        this.#startAutoplay();
      });
      this.bulletsEl.appendChild(b);
      return b;
    });
  }

  #bindControls() {
    const prev = this.querySelector('[data-zik-prev]');
    const next = this.querySelector('[data-zik-next]');

    if (prev) {
      prev.addEventListener('click', () => {
        this.#stopAutoplay();
        this.#step(-1);
        this.#startAutoplay();
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        this.#stopAutoplay();
        this.#step(1);
        this.#startAutoplay();
      });
    }

    this.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.#step(-1);
      if (e.key === 'ArrowRight') this.#step(1);
    });

    this.track.addEventListener('transitionend', () => {
      this.animating = false;
      if (!this.loop) return;

      // Landed on a clone — jump to the real slide with no transition.
      if (this.index < 0) this.#goTo(this.count - 1, false);
      else if (this.index > this.count - 1) this.#goTo(0, false);
    });

    // Pause autoplay when the slider is off screen.
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.#startAutoplay();
          else this.#stopAutoplay();
        });
      });
      this.observer.observe(this);
    }
  }

  #bindDrag() {
    let startX = 0;
    let delta = 0;
    let dragging = false;

    const onDown = (e) => {
      if (this.animating) return;
      dragging = true;
      delta = 0;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      this.dataset.dragging = 'true';
      this.#stopAutoplay();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      delta = x - startX;
      const offset = this.#offsetFor(this.index);
      this.track.style.transform = `translate3d(calc(${offset}% + ${delta}px), 0, 0)`;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      delete this.dataset.dragging;

      const threshold = this.offsetWidth * 0.15;
      if (delta > threshold) this.#step(-1);
      else if (delta < -threshold) this.#step(1);
      else this.#goTo(this.index);

      this.#startAutoplay();
    };

    this.addEventListener('touchstart', onDown, { passive: true });
    this.addEventListener('touchmove', onMove, { passive: true });
    this.addEventListener('touchend', onUp);
    this.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    this.addEventListener('dragstart', (e) => e.preventDefault());
  }

  #offsetFor(index) {
    return this.loop ? (index + 1) * -100 : index * -100;
  }

  #step(direction) {
    let target = this.index + direction;

    if (!this.loop) {
      target = Math.max(0, Math.min(this.count - 1, target));
    }
    this.#goTo(target);
  }

  #goTo(index, animate = true) {
    this.index = index;

    this.track.style.transition = animate ? '' : 'none';
    this.track.style.transform = `translate3d(${this.#offsetFor(index)}%, 0, 0)`;

    if (!animate) {
      // Force a reflow so the next transform does animate.
      void this.track.offsetHeight;
      this.track.style.transition = '';
    } else {
      this.animating = true;
    }

    this.#syncUi();
  }

  #syncUi() {
    // Map clone positions back onto a real slide for the UI.
    let active = this.index;
    if (active < 0) active = this.count - 1;
    if (active > this.count - 1) active = 0;

    if (this.bullets) {
      this.bullets.forEach((b, i) => {
        b.setAttribute('aria-current', i === active ? 'true' : 'false');
      });
    }

    if (!this.loop) {
      const prev = this.querySelector('[data-zik-prev]');
      const next = this.querySelector('[data-zik-next]');
      if (prev) prev.disabled = active === 0;
      if (next) next.disabled = active === this.count - 1;
    }
  }

  #startAutoplay() {
    if (!this.autoplayDelay) return;
    this.#stopAutoplay();
    this.timer = setInterval(() => this.#step(1), this.autoplayDelay);
  }

  #stopAutoplay() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

if (!customElements.get('zik-slider')) {
  customElements.define('zik-slider', ZikSlider);
}
