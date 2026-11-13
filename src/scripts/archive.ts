/**
 * The Archive (Room II on the homepage): boxes shelved by series, and a
 * reading table where the chosen box opens.
 *
 * Without this script every box is a plain link to its piece and the table
 * shows the first box. With it:
 *
 *   wide (980px and up)  the table sits beside the shelves. Hovering or
 *                        focusing a box takes it down onto the table; a
 *                        click with the mouse follows the link, a tap or
 *                        pen press opens the box first.
 *   narrow               the table is a bottom sheet (<dialog>); a tap
 *                        opens the box in it, and the sheet's "Enter the
 *                        work" follows the link.
 *
 * On the table a reel of stills from the piece (public/reel/<id>/<n>.jpg,
 * `data-frames` of them) cross-fades every few seconds while the card is on
 * screen. Reduced motion stops the reel, the arrival and the ghost.
 */
const REEL_MS = 2600;
const HOVER_MS = 140;

const reelSrc = (id: string, frame: number) => `/reel/${id}/${frame}.jpg`;

function initArchive(): void {
  const root = document.querySelector<HTMLElement>('[data-arc]');
  if (!root || root.dataset.arcReady) return;
  root.dataset.arcReady = '1';

  const boxes = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-arc-box]'));
  const table = root.querySelector<HTMLElement>('[data-arc-table]');
  const card = root.querySelector<HTMLElement>('[data-arc-card]');
  const clear = root.querySelector<HTMLElement>('[data-arc-clear]');
  const sheet = root.querySelector<HTMLDialogElement>('dialog[data-arc-sheet]');
  const sheetIn = root.querySelector<HTMLElement>('[data-arc-sheet-in]');
  if (!table || !card || !clear || !sheet || !sheetIn) return;
  const away = card.querySelector<HTMLButtonElement>('[data-arc-away]');
  const frame = card.querySelector<HTMLElement>('.arc-card__frame');
  const imgs = Array.from(card.querySelectorAll<HTMLImageElement>('.arc-reel__img'));
  const ticks = Array.from(card.querySelectorAll<HTMLElement>('[data-arc-ticks] li'));
  const frames = Number(root.dataset.frames) || 1;
  if (!away || !frame || imgs.length < 2) return;
  if (!boxes.length || typeof sheet.showModal !== 'function') return;

  /* The sheet is modal, so it lives on <body>, clear of any transformed ancestor. */
  document.body.appendChild(sheet);
  away.hidden = false;

  const wide = matchMedia('(min-width: 980px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const first = boxes.find((b) => b.dataset.id === root.dataset.first) ?? boxes[0];

  let open: HTMLAnchorElement | null = null;
  let pointer = 'mouse';
  let hoverTimer = 0;
  let returningFocus = false;
  let reelTimer = 0;
  let frameAt = 0;
  /** Which of the two stacked images is showing. */
  let front = 0;
  let onScreen = true;

  const markTick = (n: number) => ticks.forEach((t, i) => t.classList.toggle('is-on', i === n));

  function stopReel(): void {
    clearInterval(reelTimer);
    reelTimer = 0;
  }

  function runReel(): void {
    stopReel();
    if (still.matches || frames < 2 || !open || !onScreen || document.hidden) return;
    reelTimer = window.setInterval(() => {
      const id = open?.dataset.id;
      if (!id) return;
      const next = (frameAt + 1) % frames;
      const back = imgs[1 - front];
      const src = reelSrc(id, next + 1);
      const swap = () => {
        if (open?.dataset.id !== id) return;
        imgs[front].classList.remove('is-on');
        back.classList.add('is-on');
        front = 1 - front;
        frameAt = next;
        markTick(next);
      };
      back.onload = swap;
      back.onerror = () => stopReel();
      if (back.getAttribute('src') === src && back.complete) swap();
      else back.src = src;
    }, REEL_MS);
  }

  /** Cut to the first frame of a piece, then start its reel. */
  function loadReel(id: string): void {
    stopReel();
    const reel = imgs[0].parentElement!;
    reel.classList.add('is-cut');
    imgs.forEach((img) => {
      img.onload = img.onerror = null;
      img.classList.remove('is-on');
    });
    front = 0;
    frameAt = 0;
    markTick(0);
    const src = reelSrc(id, 1);
    const show = () => {
      if (open?.dataset.id !== id) return;
      void reel.offsetWidth;
      reel.classList.remove('is-cut');
      imgs[0].classList.add('is-on');
      runReel();
    };
    if (imgs[0].getAttribute('src') === src && imgs[0].complete) return show();
    imgs[0].onload = show;
    imgs[0].src = src;
  }

  const warmed = new Set<string>();
  function warm(id: string | undefined): void {
    if (!id || warmed.has(id)) return;
    warmed.add(id);
    new Image().src = reelSrc(id, 1);
  }

  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    if (onScreen) runReel();
    else stopReel();
  }).observe(card);
  document.addEventListener('visibilitychange', runReel);

  const setText = (key: string, value: string) => {
    const el = card.querySelector(`[data-arc-${key}]`);
    if (el) el.textContent = value;
  };

  function fill(box: HTMLAnchorElement): void {
    const d = box.dataset;
    setText('label', d.label ?? '');
    setText('year', d.year ?? '');
    setText('title', d.title ?? '');
    setText('line', d.line ?? '');
    setText('verb', d.verb ?? '');
    card!.style.setProperty('--accent', d.accent ?? '');
    card!.style.setProperty('--plate', d.plate ?? '');
    card!.querySelectorAll<HTMLAnchorElement>('[data-arc-enter]').forEach((a) => (a.href = box.href));
    loadReel(d.id!);
  }

  function arrive(): void {
    card!.classList.remove('is-arriving');
    if (still.matches) return;
    void card!.offsetWidth;
    card!.classList.add('is-arriving');
  }

  /** A plate-coloured ghost that flies between the shelf and the table. */
  function ghost(from: DOMRect, to: DOMRect, color: string, returning: boolean): void {
    if (still.matches || !from.width || !to.width || typeof document.body.animate !== 'function') return;
    const el = document.createElement('div');
    el.className = 'arc-ghost';
    el.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;background:${color}`;
    document.body.appendChild(el);
    /* In the top layer, so it flies above the open sheet. */
    if (typeof el.showPopover === 'function') {
      el.setAttribute('popover', 'manual');
      el.showPopover();
    }
    const end = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
    el.animate(
      returning
        ? [
            { transform: 'none', opacity: 0 },
            { opacity: 0.35, offset: 0.35 },
            { transform: end, opacity: 0.95 },
          ]
        : [
            { transform: 'none', opacity: 0.95 },
            { opacity: 0.35, offset: 0.5 },
            { transform: end, opacity: 0 },
          ],
      { duration: 520, easing: 'cubic-bezier(0.16, 0.84, 0.24, 1)', fill: 'forwards' },
    ).onfinish = () => el.remove();
  }

  const plateOf = (box: HTMLAnchorElement) => box.dataset.plate || '#2b2230';

  /** Where the card's frame is, or will be once the sheet has risen. */
  function frameRect(): DOMRect {
    const r = frame!.getBoundingClientRect();
    if (!sheet!.open) return r;
    const s = sheet!.getBoundingClientRect();
    return new DOMRect(r.left, innerHeight - sheet!.offsetHeight + (r.top - s.top), r.width, r.height);
  }

  function showSheet(): void {
    sheet!.classList.remove('is-leaving');
    document.documentElement.classList.add('arc-locked');
    sheet!.showModal();
    sheet!.scrollTop = 0;
  }

  function hideSheet(then?: () => void): void {
    if (!sheet!.open) return then?.();
    const done = () => {
      sheet!.classList.remove('is-leaving');
      sheet!.close();
      document.documentElement.classList.remove('arc-locked');
      then?.();
    };
    if (still.matches) return done();
    sheet!.classList.add('is-leaving');
    window.setTimeout(done, 250);
  }

  function take(box: HTMLAnchorElement, animate = true): void {
    if (open === box) {
      if (!wide.matches && !sheet!.open) showSheet();
      return;
    }
    open?.classList.remove('is-out');
    open = box;
    box.classList.add('is-out');
    card!.hidden = false;
    clear!.hidden = true;
    fill(box);
    if (!wide.matches && !sheet!.open) showSheet();
    if (animate) {
      arrive();
      requestAnimationFrame(() => ghost(box.getBoundingClientRect(), frameRect(), plateOf(box), false));
    }
  }

  function putBack(refocus = false): void {
    const box = open;
    if (!box) return;
    stopReel();
    ghost(frame!.getBoundingClientRect(), box.getBoundingClientRect(), plateOf(box), true);
    box.classList.remove('is-out');
    open = null;
    const focusBox = () => {
      if (!refocus) return;
      returningFocus = true;
      box.focus({ preventScroll: true });
      returningFocus = false;
    };
    if (wide.matches) {
      card!.hidden = true;
      clear!.hidden = false;
      focusBox();
    } else {
      hideSheet(focusBox);
    }
  }

  sheet.addEventListener('cancel', (e) => {
    e.preventDefault();
    putBack(true);
  });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) putBack(true);
  });
  away.addEventListener('click', () => putBack(true));
  root.addEventListener('pointerdown', (e) => (pointer = e.pointerType), true);

  for (const box of boxes) {
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !wide.matches || open === box) return;
      clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => take(box), HOVER_MS);
    };
    box.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && wide.matches) warm(box.dataset.id);
      hover(e);
    });
    box.addEventListener('pointermove', hover);
    box.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
    box.addEventListener('focus', () => {
      if (!returningFocus && wide.matches && box.matches(':focus-visible')) take(box);
    });
    box.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (wide.matches) {
        /* A mouse click follows the link; touch and pen open the box first. */
        if (pointer !== 'mouse' && open !== box) {
          e.preventDefault();
          take(box);
        }
      } else {
        e.preventDefault();
        take(box);
      }
    });
  }

  function layout(): void {
    if (wide.matches) {
      if (sheet!.open) {
        sheet!.close();
        document.documentElement.classList.remove('arc-locked');
      }
      table!.prepend(card!);
      if (!open) take(first, false);
    } else {
      open?.classList.remove('is-out');
      open = null;
      stopReel();
      card!.hidden = false;
      clear!.hidden = true;
      sheetIn!.appendChild(card!);
    }
  }
  wide.addEventListener('change', layout);
  layout();
}

initArchive();
