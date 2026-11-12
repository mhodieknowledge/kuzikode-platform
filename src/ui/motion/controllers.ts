/**
 * Behaviour for the server-rendered primitives in src/ui/primitives (no framework, bundled by Astro, CSP-safe).
 * Everything is progressive: markup works without this file (links, <details>, native scrolling, <dialog> fallbacks).
 * Specs: docs/redesign/MOTION_AND_INTERACTION_SPEC.md.
 */

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
type Root = Document | Element;
const qsa = <T extends Element = HTMLElement>(sel: string, root: Root = document): T[] =>
  Array.from(root.querySelectorAll(sel)) as unknown as T[];

/* ---------------- Sliding thumb / bar for segmented controls and tabs ---------------- */

function placeIndicator(container: HTMLElement, indicator: HTMLElement, active: HTMLElement | null, axisPad = 0) {
  if (!active) {
    indicator.style.width = '0px';
    return;
  }
  const c = container.getBoundingClientRect();
  const a = active.getBoundingClientRect();
  indicator.style.width = `${a.width}px`;
  indicator.style.transform = `translateX(${a.left - c.left + container.scrollLeft - axisPad}px)`;
}

/**
 * [data-kz-seg]: a segmented control. Options are `.kz-seg__opt`, selected = aria-selected / aria-current / aria-pressed "true".
 * Modes (data-kz-seg value):
 *  - "tabs": options are role=tab controlling role=tabpanel (aria-controls); arrow keys move selection.
 *  - "links": options are in-page links (#id); the selection follows scroll (scroll-spy) and click.
 *  - "buttons": options are aria-pressed toggle buttons; emits `kz:change` with the option's data-value.
 */
function initSegmented(seg: HTMLElement) {
  const mode = seg.dataset.kzSeg ?? 'buttons';
  const thumb = seg.querySelector<HTMLElement>('.kz-seg__thumb');
  const opts = qsa<HTMLElement>('.kz-seg__opt', seg);
  const selectedAttr = mode === 'tabs' ? 'aria-selected' : mode === 'links' ? 'aria-current' : 'aria-pressed';
  const current = () => opts.find((o) => o.getAttribute(selectedAttr) === 'true') ?? null;
  const sync = () => thumb && placeIndicator(seg, thumb, current());

  const select = (opt: HTMLElement, focus = false, emit = true) => {
    for (const o of opts) {
      const on = o === opt;
      if (mode === 'links') {
        if (on) o.setAttribute('aria-current', 'true');
        else o.removeAttribute('aria-current');
      } else o.setAttribute(selectedAttr, String(on));
      if (mode === 'tabs') {
        o.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(o.getAttribute('aria-controls') ?? '');
        if (panel) panel.hidden = !on;
      }
    }
    if (focus) opt.focus();
    // Keep the selected option visible inside a scrollable control.
    if (seg.scrollWidth > seg.clientWidth) {
      const left = opt.offsetLeft - (seg.clientWidth - opt.offsetWidth) / 2;
      seg.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
    sync();
    if (emit)
      seg.dispatchEvent(new CustomEvent('kz:change', { detail: { value: opt.dataset.value ?? '' }, bubbles: true }));
  };

  for (const o of opts) {
    o.addEventListener('click', (e) => {
      if (mode === 'links') {
        const id = o.getAttribute('href')?.slice(1);
        const target = id ? document.getElementById(id) : null;
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', `#${id}`);
        }
      }
      select(o);
    });
  }
  if (mode === 'tabs') {
    seg.addEventListener('keydown', (e) => {
      const i = opts.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      const next =
        e.key === 'ArrowRight'
          ? opts[(i + 1) % opts.length]
          : e.key === 'ArrowLeft'
            ? opts[(i - 1 + opts.length) % opts.length]
            : e.key === 'Home'
              ? opts[0]
              : e.key === 'End'
                ? opts[opts.length - 1]
                : null;
      if (next) {
        e.preventDefault();
        select(next, true);
      }
    });
  }
  if (mode === 'links') {
    const targets = opts
      .map((o) => document.getElementById(o.getAttribute('href')?.slice(1) ?? ''))
      .filter((t): t is HTMLElement => !!t);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visible) return;
        const opt = opts.find((o) => o.getAttribute('href') === `#${visible.target.id}`);
        if (opt && opt.getAttribute('aria-current') !== 'true') select(opt, false, false);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const t of targets) io.observe(t);
  }
  new ResizeObserver(sync).observe(seg);
  seg.addEventListener('scroll', sync, { passive: true });
  // Reading: the thumb takes over the selected fill once positioned (no first-frame jump).
  requestAnimationFrame(() => {
    sync();
    seg.dataset.ready = '';
  });
}

/** [data-kz-tabs]: underline tabs (`.kz-tab` with role=tab + `.kz-tabs__bar`). */
function initTabs(tabs: HTMLElement) {
  const bar = tabs.querySelector<HTMLElement>('.kz-tabs__bar');
  const items = qsa<HTMLElement>('.kz-tab', tabs);
  const sync = () =>
    bar && placeIndicator(tabs, bar, items.find((t) => t.getAttribute('aria-selected') === 'true') ?? null);
  const select = (tab: HTMLElement, focus = false) => {
    for (const t of items) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
    sync();
  };
  for (const t of items) t.addEventListener('click', () => select(t));
  tabs.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    select(items[(i + d + items.length) % items.length]!, true);
  });
  new ResizeObserver(sync).observe(tabs);
  requestAnimationFrame(() => {
    sync();
    tabs.dataset.ready = '';
  });
}

/* ---------------- Rail ---------------- */

/** [data-kz-rail]: scroll-snap track with prev/next buttons, dots, dimmed off-centre items, keyboard arrows. */
function initRail(rail: HTMLElement) {
  const track = rail.querySelector<HTMLElement>('.kz-rail__track');
  if (!track) return;
  const items = Array.from(track.children) as HTMLElement[];
  if (items.length < 2) return;
  const prev = rail.querySelector<HTMLButtonElement>('[data-kz-rail-prev]');
  const next = rail.querySelector<HTMLButtonElement>('[data-kz-rail-next]');
  const dotsBox = rail.querySelector<HTMLElement>('.kz-rail__dots');
  const label = rail.getAttribute('aria-label') ?? 'Items';
  const dots: HTMLButtonElement[] = [];
  if (dotsBox) {
    items.forEach((item, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kz-rail__dot';
      b.setAttribute('aria-label', `${label}: item ${i + 1} of ${items.length}`);
      b.addEventListener('click', () => go(i));
      dotsBox.appendChild(b);
      dots.push(b);
      item.setAttribute('aria-roledescription', 'slide');
    });
  }
  let index = 0;
  const go = (i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    const target = items[clamped]!;
    track.scrollTo({
      left: target.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).scrollPaddingLeft || '0'),
      behavior: reducedMotion() ? 'auto' : 'smooth',
    });
  };
  const ratios = new Map<Element, number>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) ratios.set(en.target, en.intersectionRatio);
      let best = 0;
      let bestRatio = -1;
      items.forEach((it, i) => {
        const r = ratios.get(it) ?? 0;
        if (r > 0.98 && bestRatio < 0.98) {
          best = i;
          bestRatio = r;
        } else if (r > bestRatio && bestRatio < 0.98) {
          best = i;
          bestRatio = r;
        }
        if (r < 0.6) it.dataset.dim = '';
        else delete it.dataset.dim;
      });
      index = best;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = atEnd;
      rail.dispatchEvent(new CustomEvent('kz:rail', { detail: { index }, bubbles: true }));
    },
    { root: track, threshold: [0, 0.3, 0.6, 0.98, 1] },
  );
  for (const it of items) io.observe(it);
  prev?.addEventListener('click', () => go(index - 1));
  next?.addEventListener('click', () => go(index + 1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });
  rail.addEventListener('kz:rail-go', (e) => go((e as CustomEvent<{ index: number }>).detail.index));
  // Hide the controls when everything fits (wide screens with few items).
  const fit = () => {
    const fits = track.scrollWidth <= track.clientWidth + 2;
    rail.toggleAttribute('data-fits', fits);
    if (fits) {
      rail.removeAttribute('data-ready');
      for (const it of items) delete it.dataset.dim;
    } else rail.dataset.ready = '';
  };
  new ResizeObserver(fit).observe(track);
  fit();
}

/* ---------------- Sheets (<dialog class="kz-sheet">) ---------------- */

function openSheet(dialog: HTMLDialogElement, opener?: HTMLElement | null) {
  if (dialog.open) return;
  dialog.showModal();
  requestAnimationFrame(() => (dialog.dataset.open = ''));
  if (opener) {
    opener.setAttribute('aria-expanded', 'true');
    dialog.addEventListener('close', () => opener.setAttribute('aria-expanded', 'false'), { once: true });
  }
}

export function closeSheet(dialog: HTMLDialogElement) {
  if (!dialog.open) return;
  delete dialog.dataset.open;
  const done = () => dialog.close();
  if (reducedMotion()) done();
  else setTimeout(done, 220);
}

function initSheet(dialog: HTMLDialogElement) {
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeSheet(dialog);
  });
  dialog.addEventListener('click', (e) => {
    // Click on the backdrop (the dialog itself, outside the panel) closes.
    if (e.target === dialog) closeSheet(dialog);
    const closer = (e.target as HTMLElement).closest('[data-kz-sheet-close]');
    if (closer) closeSheet(dialog);
  });
  // Swipe to dismiss: down for bottom sheets, up for top sheets (64 px or a fast flick).
  const panel = dialog.querySelector<HTMLElement>('.kz-sheet__panel');
  const dir = dialog.classList.contains('kz-sheet--top')
    ? -1
    : dialog.classList.contains('kz-sheet--bottom') || dialog.classList.contains('kz-sheet--center')
      ? 1
      : 0;
  if (panel && dir) {
    let y0 = 0;
    let t0 = 0;
    let dy = 0;
    let tracking = false;
    panel.addEventListener(
      'touchstart',
      (e) => {
        const body = (e.target as HTMLElement).closest('.kz-sheet__body');
        if (body && body.scrollTop > 0 && dir === 1) return;
        tracking = true;
        y0 = e.touches[0]!.clientY;
        t0 = performance.now();
        dy = 0;
      },
      { passive: true },
    );
    panel.addEventListener(
      'touchmove',
      (e) => {
        if (!tracking) return;
        dy = (e.touches[0]!.clientY - y0) * dir;
        if (dy > 0) {
          panel.style.transition = 'none';
          panel.style.transform = `translateY(${dy * dir}px)`;
        }
      },
      { passive: true },
    );
    panel.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      panel.style.transition = '';
      panel.style.transform = '';
      const velocity = dy / Math.max(1, performance.now() - t0);
      if (dy > 64 || velocity > 0.5) closeSheet(dialog);
    });
  }
}

function initSheetOpeners() {
  document.addEventListener('click', (e) => {
    const opener = (e.target as HTMLElement).closest<HTMLElement>('[data-kz-sheet-open]');
    if (!opener) return;
    const dialog = document.getElementById(opener.dataset.kzSheetOpen ?? '');
    if (dialog instanceof HTMLDialogElement) {
      e.preventDefault();
      openSheet(dialog, opener);
    }
  });
}

/* ---------------- Reveal ---------------- */

/** [data-reveal] (one element) or [data-reveal-group] (children stagger, max 4 × 50 ms). Content is visible without JS. */
function initReveal() {
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
  );
  const vh = innerHeight;
  const mark = (el: HTMLElement, delay = 0) => {
    // Never hide what is already on screen at load.
    if (el.getBoundingClientRect().top < vh * 0.9) return;
    el.classList.add('kz-reveal');
    if (delay) el.style.setProperty('--kz-delay', `${delay}ms`);
    io.observe(el);
  };
  for (const el of qsa<HTMLElement>('[data-reveal]')) mark(el);
  for (const g of qsa<HTMLElement>('[data-reveal-group]')) {
    Array.from(g.children).forEach((c, i) => mark(c as HTMLElement, Math.min(i, 3) * 50));
  }
}

/* ---------------- Boot ---------------- */

export function initUi(root: Root = document) {
  const once = <T extends HTMLElement>(sel: string, init: (el: T) => void) => {
    for (const el of qsa<T>(sel, root)) {
      if (el.dataset.kzInit) continue;
      el.dataset.kzInit = '1';
      init(el);
    }
  };
  once<HTMLElement>('[data-kz-seg]', initSegmented);
  once<HTMLElement>('[data-kz-tabs]', initTabs);
  once<HTMLElement>('[data-kz-rail]', initRail);
  once<HTMLDialogElement>('dialog.kz-sheet', initSheet);
}

let booted = false;
export function boot() {
  if (booted) return;
  booted = true;
  initUi();
  initSheetOpeners();
  initReveal();
}
