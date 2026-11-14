/**
 * Public header behaviour: desktop menus (click, hover intent on fine pointers, Escape returns focus, outside click closes),
 * the sliding nav indicator, the directory's lit frame, and the scrolled state. The mobile menu is a `.kz-sheet` handled by
 * src/ui/motion/controllers.ts.
 */
export function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!header || header.dataset.kzInit) return;
  header.dataset.kzInit = '1';
  const nav = header.querySelector<HTMLElement>('[data-nav]');
  const bar = header.querySelector<HTMLElement>('.kz-nav__bar');
  const buttons = Array.from(header.querySelectorAll<HTMLButtonElement>('[data-menu-button]'));
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let openBtn: HTMLButtonElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;

  const panelOf = (b: HTMLButtonElement) => document.getElementById(b.getAttribute('aria-controls') ?? '');

  /* Indicator: rests under the current section, follows hover/focus, and sits under an open menu's button. */
  const items = nav ? Array.from(nav.querySelectorAll<HTMLElement>('.kz-nav__item')) : [];
  const current = () => items.find((i) => i.getAttribute('aria-current')) ?? null;
  const moveBar = (to: HTMLElement | null) => {
    if (!bar || !nav) return;
    if (!to) {
      bar.style.opacity = '0';
      return;
    }
    const n = nav.getBoundingClientRect();
    const r = to.getBoundingClientRect();
    bar.style.opacity = '1';
    bar.style.width = `${r.width - 24}px`;
    bar.style.transform = `translateX(${r.left - n.left + 12}px)`;
  };
  const rest = () => moveBar(openBtn ?? current());
  for (const it of items) {
    it.addEventListener('pointerenter', () => moveBar(it));
    it.addEventListener('focus', () => moveBar(it));
  }
  nav?.addEventListener('pointerleave', rest);
  nav?.addEventListener('focusout', (e) => {
    if (!nav.contains(e.relatedTarget as Node)) rest();
  });

  const close = (focusButton = false) => {
    // A pending hover-intent open must not reopen a menu the visitor just closed (click, Escape, outside click).
    clearTimeout(openTimer);
    if (!openBtn) return;
    const b = openBtn;
    b.setAttribute('aria-expanded', 'false');
    const p = panelOf(b);
    if (p) {
      p.removeAttribute('data-open');
      p.hidden = true;
    }
    openBtn = null;
    header.removeAttribute('data-menu-open');
    if (focusButton) b.focus();
    rest();
  };
  const open = (b: HTMLButtonElement) => {
    if (openBtn === b) return;
    close();
    const p = panelOf(b);
    if (!p) return;
    p.hidden = false;
    requestAnimationFrame(() => p.setAttribute('data-open', ''));
    b.setAttribute('aria-expanded', 'true');
    openBtn = b;
    header.setAttribute('data-menu-open', '');
    if (p.classList.contains('kz-pop')) {
      const r = b.getBoundingClientRect();
      p.style.left = `${Math.max(16, r.left - 8)}px`;
    }
    moveBar(b);
  };

  for (const b of buttons) {
    b.addEventListener('click', () => {
      clearTimeout(openTimer);
      if (openBtn === b) close();
      else open(b);
    });
    const li = b.closest('[data-menu]');
    const panel = panelOf(b);
    const enter = () => {
      if (!finePointer.matches) return;
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      openTimer = setTimeout(() => open(b), openBtn ? 0 : 80);
    };
    const leave = () => {
      if (!finePointer.matches) return;
      clearTimeout(openTimer);
      closeTimer = setTimeout(() => close(), 160);
    };
    li?.addEventListener('pointerenter', enter);
    li?.addEventListener('pointerleave', leave);
    panel?.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    panel?.addEventListener('pointerleave', leave);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openBtn) {
      e.preventDefault();
      close(true);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (openBtn && !header.contains(e.target as Node)) close();
  });
  header.addEventListener('focusout', (e) => {
    if (openBtn && e.relatedTarget && !header.contains(e.relatedTarget as Node)) close();
  });

  /* Directory lit frame: the hovered/focused row lights and its frame cross-fades in. */
  const rows = Array.from(header.querySelectorAll<HTMLElement>('[data-lit-target]'));
  const frames = Array.from(header.querySelectorAll<HTMLElement>('[data-lit]'));
  const light = (row: HTMLElement) => {
    for (const r of rows) r.classList.toggle('kz-lit', r === row);
    const id = row.dataset.litTarget;
    for (const f of frames) f.hidden = f.id !== id;
  };
  for (const r of rows) {
    r.addEventListener('pointerenter', () => light(r));
    r.addEventListener('focus', () => light(r));
  }
  if (rows[0]) light(rows[0]);

  /* Scrolled state: a hairline and the glass background once the page moves. */
  const onScroll = () => header.toggleAttribute('data-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  addEventListener('resize', () => {
    if (!matchMedia('(min-width: 1280px)').matches) close();
    rest();
  });
  requestAnimationFrame(rest);
  document.fonts?.ready.then(rest);

  /* Mobile menu: close on any link tap, and when the page is restored from the back/forward cache with the menu still open. */
  const sheet = document.getElementById('site-menu');
  if (sheet instanceof HTMLDialogElement) {
    sheet.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a[href]')) {
        delete sheet.dataset.open;
        setTimeout(() => sheet.open && sheet.close(), 120);
      }
    });
    addEventListener('pageshow', (e) => {
      if (e.persisted && sheet.open) {
        delete sheet.dataset.open;
        sheet.close();
      }
    });
  }
}
