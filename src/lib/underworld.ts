/**
 * The descent — scroll logic for /underworld/ (Phase 3).
 *
 * Everything here is scroll-position driven, so it holds unchanged
 * under prefers-reduced-motion. Three duties:
 *
 * Depth — `underworld:depth` {depth} on document: 0 with the Threshold
 * centered, 1 with the Fields of Mourning centered, clamped beyond.
 * Emitted from the scroll handler (browsers deliver scroll events
 * frame-aligned, so this is rAF-throttled in effect) and only when the
 * value moves. The audio engine pitches its drones down this number.
 *
 * Presence — `underworld:presence` {present:true} the moment the
 * Return's instruction shows; {present:false} on betrayal — the
 * footsteps behind the visitor stop.
 *
 * The Orpheus rule — the descent runs downward the whole way; the
 * Return is a final downward stretch framed as the climb, so "turning
 * back" means scrolling up toward the depths already passed. From the
 * moment the Return begins, backing more than REVERSAL_PX above the
 * deepest point reached, before the exit, is betrayal: the exit's
 * reward never renders this descent (its dither falls to noise), and
 * the verdict is written to sessionStorage so re-scrolling forward
 * cannot undo it. A fresh page load is a fresh descent: the ledger
 * clears and the scroll pins back to the Threshold — the only way to
 * try again is to leave and come down whole.
 *
 * Faithful arrival opens the exit, banks the passphrase token, and
 * plucks the lyre (`audio:pluck`). Events are fire-and-forget; the
 * audio engine listens elsewhere.
 */

export const BETRAYED_KEY = 'wilhelm.underworld.betrayed';
export const PASSPHRASE_KEY = 'wilhelm.passphrase.1';

/** TODO(copy): placeholder — the real word arrives with the copy pass. */
export const PASSPHRASE = 'ΚΛΕΙΣ';

/** How far back (px) above the deepest climb point counts as turning. */
const REVERSAL_PX = 120;

/** The Return begins when its top crosses this fraction of the viewport. */
const BEGIN_LINE = 0.7;

/** The exit is reached when its top crosses this fraction. */
const EXIT_LINE = 0.85;

function station(n: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-station="${n}"]`);
}

function emit(name: string, detail: Record<string, unknown>): void {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export function initUnderworld(): void {
  const threshold = station(1);
  const mourning = station(5);
  const theReturn = station(6);
  const exit = station(7);
  if (!threshold || !mourning || !theReturn || !exit) return;

  // a new descent: clean ledger, and it begins at the Threshold
  try {
    sessionStorage.removeItem(BETRAYED_KEY);
  } catch {
    /* storage unavailable — the rule is judged in memory alone */
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo({ top: 0, behavior: 'instant' });

  let lastDepth = -1;
  let returnBegun = false;
  let betrayed = false;
  let completed = false;
  let deepestY = 0;

  const betray = (): void => {
    betrayed = true;
    try {
      sessionStorage.setItem(BETRAYED_KEY, '1');
    } catch {
      /* no store — the memory of turning is enough */
    }
    exit.classList.add('is-lost');
    // a sleeping exit engine reads data-mode when it wakes → noise churn;
    // an already-woken one is veiled by the is-lost styles instead
    const field = exit.querySelector<HTMLElement>('glyph-dither');
    if (field) field.dataset.mode = 'dissolve';
    emit('underworld:presence', { present: false });
  };

  const complete = (): void => {
    completed = true;
    exit.classList.add('is-open');
    try {
      localStorage.setItem(PASSPHRASE_KEY, PASSPHRASE);
    } catch {
      /* the word survives only as long as they remember it */
    }
    emit('audio:pluck', {});
  };

  const measure = (): void => {
    const vh = window.innerHeight;
    const y = window.scrollY;

    // depth: viewport center between Threshold center and Mourning center
    const r1 = threshold.getBoundingClientRect();
    const r5 = mourning.getBoundingClientRect();
    const a = r1.top + r1.height / 2;
    const b = r5.top + r5.height / 2;
    const depth = b === a ? 0 : Math.max(0, Math.min(1, (vh / 2 - a) / (b - a)));
    if (Math.abs(depth - lastDepth) >= 0.002) {
      lastDepth = depth;
      emit('underworld:depth', { depth });
    }

    if (!returnBegun && theReturn.getBoundingClientRect().top <= vh * BEGIN_LINE) {
      returnBegun = true;
      deepestY = y;
      emit('underworld:presence', { present: true });
    }
    if (!returnBegun || betrayed || completed) return;

    deepestY = Math.max(deepestY, y);
    if (deepestY - y > REVERSAL_PX) {
      betray();
      return;
    }
    if (exit.getBoundingClientRect().top <= vh * EXIT_LINE) complete();
  };

  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  measure();
}
