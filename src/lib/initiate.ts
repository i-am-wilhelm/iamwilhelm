/**
 * The initiate state (egg 11) — Phase 4.
 *
 * Completing the chain — the dawn gate opening — permanently changes
 * rendering for that visitor. dawn.ts banks 'wilhelm.initiate' = '1'
 * the moment the gate opens; from then on every page load (and the
 * opening moment itself, via the 'dawn-gate' egg:found event) applies:
 *
 *  1. The whole site speaks Greek: every ascii dither field is swapped
 *     to the greek palette — rare glyphs (♅ ♆ and the dead letters)
 *     surface where the profane see plain ASCII. Sleeping engines are
 *     caught on their bubbling `dither:ready` as they wake.
 *  2. Marginalia brighten — the whispered lines are no longer half
 *     buried — and one extra line surfaces in the footer: an
 *     acknowledgment only initiates receive.
 *  3. A nav item that exists only for them: a small fixed link to
 *     /underworld/ — the door they earned, now named.
 *
 * Everything here is runtime-injected and no-ops cleanly when storage
 * is unavailable or the visitor is not (yet) an initiate.
 */

const INITIATE_KEY = 'wilhelm.initiate';
const STYLE_ID = 'initiate-style';

let applied = false;

function isInitiate(): boolean {
  try {
    return localStorage.getItem(INITIATE_KEY) === '1';
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- */
/* 1 — the shifted dither palette                                     */
/* ---------------------------------------------------------------- */

/** The runtime shape of <glyph-dither> once its swap hook exists. */
interface SwappableDither extends HTMLElement {
  swap?: (opts: { palette?: string }) => boolean;
}

function greekify(el: SwappableDither): void {
  if (el.dataset.palette === 'greek') return; // already speaks it
  if (typeof el.swap !== 'function') return;
  el.swap({ palette: 'greek' }); // false while dormant — dither:ready recovers it
}

function initGreekTongue(): void {
  // engines already awake (or awakening later on lazy IO) both land here
  document.addEventListener('dither:ready', (e) => {
    if (e.target instanceof HTMLElement) greekify(e.target as SwappableDither);
  });
  // and sweep whatever is already on the page
  document
    .querySelectorAll<SwappableDither>('glyph-dither')
    .forEach((el) => greekify(el));
}

/* ---------------------------------------------------------------- */
/* 2 — visible marginalia                                             */
/* ---------------------------------------------------------------- */

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html[data-initiate] .marginalia {
  color: var(--ink, #e8e6e1);
  opacity: 0.85;
}
html[data-initiate] .initiate-door {
  position: fixed;
  top: var(--space-1, 0.75rem);
  right: var(--space-2, 1.5rem);
  z-index: 90;
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs, 0.75rem);
  letter-spacing: 0.06em;
  color: var(--ink-dim, rgba(232, 230, 225, 0.55));
  text-decoration: none;
  opacity: 0.7;
  transition: opacity var(--pulse-3, 420ms) var(--ease-veil, ease);
}
html[data-initiate] .initiate-door:hover,
html[data-initiate] .initiate-door:focus-visible {
  color: var(--ink, #e8e6e1);
  opacity: 1;
}`;
  document.head.appendChild(style);
}

function revealFooterLine(): void {
  const footer = document.querySelector<HTMLElement>('.site-footer');
  if (!footer || footer.querySelector('.initiate-line')) return;
  const line = document.createElement('p');
  line.className = 'marginalia initiate-line';
  line.setAttribute('aria-hidden', 'true');
  line.textContent = 'You walked it.';
  footer.appendChild(line);
}

/* ---------------------------------------------------------------- */
/* 3 — the door, named                                                */
/* ---------------------------------------------------------------- */

function addUnderworldLink(): void {
  if (document.querySelector('.initiate-door')) return;
  const a = document.createElement('a');
  a.className = 'initiate-door';
  a.href = '/underworld/';
  a.textContent = '> underworld';
  document.body.appendChild(a);
}

/* ---------------------------------------------------------------- */

function apply(): void {
  if (applied) return;
  applied = true;

  // the earliest possible signal: CSS keys off this attribute
  document.documentElement.dataset.initiate = '1';

  injectStyles();
  initGreekTongue();
  revealFooterLine();
  addUnderworldLink();
}

export function initInitiate(): void {
  if (isInitiate()) apply();

  // the opening moment itself: dawn.ts banks the key, then marks
  // 'dawn-gate' — the state takes hold with no reload between
  document.addEventListener('egg:found', (e) => {
    const detail = (e as CustomEvent<{ id?: string }>).detail;
    if (detail?.id === 'dawn-gate' && isInitiate()) apply();
  });
}
