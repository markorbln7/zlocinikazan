/**
 * <zik-header> — mobile drawer toggle + sticky-on-scroll behaviour,
 * ported from the WordPress theme's main.js.
 */
class ZikHeader extends HTMLElement {
  connectedCallback() {
    this.toggle = this.querySelector('[data-zik-menu-toggle]');
    this.menu = this.querySelector('[data-zik-menu]');
    this.hamburger = this.querySelector('[data-zik-hamburger]');
    this.sticky = this.hasAttribute('sticky');

    if (this.toggle && this.menu) {
      this.onToggle = () => this.#toggleMenu();
      this.toggle.addEventListener('click', this.onToggle);
    }

    // Close the drawer when a link inside it is followed.
    this.menu?.addEventListener('click', (e) => {
      if (e.target.closest('a') && this.menu.classList.contains('is-open')) {
        this.#toggleMenu(false);
      }
    });

    this.onKeydown = (e) => {
      if (e.key === 'Escape' && this.menu?.classList.contains('is-open')) {
        this.#toggleMenu(false);
      }
    };
    document.addEventListener('keydown', this.onKeydown);

    if (this.sticky) {
      this.onScroll = () => {
        this.classList.toggle('is-stuck', window.scrollY >= 100);
      };
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.onScroll();
    }
  }

  disconnectedCallback() {
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
    if (this.onKeydown) document.removeEventListener('keydown', this.onKeydown);
    document.body.classList.remove('zik-no-scroll');
  }

  #toggleMenu(force) {
    const open = force === undefined ? !this.menu.classList.contains('is-open') : force;

    this.menu.classList.toggle('is-open', open);
    this.hamburger?.classList.toggle('is-active', open);
    document.body.classList.toggle('zik-no-scroll', open);
    this.toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

if (!customElements.get('zik-header')) {
  customElements.define('zik-header', ZikHeader);
}

/**
 * <zik-cart-count> — keeps the header cart count in sync with Horizon's
 * AJAX cart. Horizon dispatches `cart:update` on document; when the update
 * comes from a product form, detail.data.itemCount is the quantity that was
 * just added rather than the new total, so it is added to the current count
 * (this mirrors Horizon's own cart-icon.js).
 */
class ZikCartCount extends HTMLElement {
  connectedCallback() {
    this.onCartUpdate = (event) => {
      const itemCount = event.detail?.data?.itemCount ?? 0;
      const fromProductForm = event.detail?.data?.source === 'product-form-component';
      const current = parseInt(this.textContent.trim(), 10) || 0;

      this.textContent = fromProductForm ? String(current + itemCount) : String(itemCount);
    };

    document.addEventListener('cart:update', this.onCartUpdate);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:update', this.onCartUpdate);
  }
}

if (!customElements.get('zik-cart-count')) {
  customElements.define('zik-cart-count', ZikCartCount);
}
