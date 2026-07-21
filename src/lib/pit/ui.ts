/**
 * The Orchestra Pit — summoned by the secret knock.
 *
 * All DOM is created here at runtime (the house pattern): a lyre glyph
 * (Ψ) fixed bottom-left that persists once the pit has been summoned
 * (localStorage 'wilhelm.pit'), and a dialog panel holding the track
 * shelf (section drones, each locked until its section has been
 * visited), the 7-step sequencer, and an embeds shelf awaiting its
 * programme. The panel is dialog-like but never traps: Escape closes,
 * focus moves in on open and returns where it was on close. Reduced
 * motion opens and closes instantly.
 */

import * as pitAudio from '../audio/pit';
import { SECTIONS } from '../audio/sections';
import { visited } from './visits';

const STORE_KEY = 'wilhelm.pit';

/** Matches --ease-veil in tokens.css. */
const EASE_VEIL = 'cubic-bezier(0.32, 0, 0.24, 1)';

const SEQ_NAMES = ['low', 'tick', 'brush'] as const;

let lyre: HTMLButtonElement | null = null;
let panel: HTMLDivElement | null = null;
let trackShelf: HTMLDivElement | null = null;
let cellsByStep: HTMLButtonElement[][] = [];
let lastFocus: Element | null = null;
let wired = false;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------------------------------------- */
/* State                                                             */
/* ---------------------------------------------------------------- */

export function isSummoned(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistSummoned(): void {
  try {
    localStorage.setItem(STORE_KEY, '1');
  } catch {
    /* no persistence — the pit lives only tonight */
  }
}

/* ---------------------------------------------------------------- */
/* Styles                                                            */
/* ---------------------------------------------------------------- */

const STYLE_ID = 'pit-style';

const CSS = `
.pit-lyre {
  position: fixed;
  left: var(--space-2);
  bottom: var(--space-2);
  z-index: 90; /* the mute lyre's mirror, bottom-left */
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink-dim);
  font-family: var(--font-mono);
  font-size: 1.25rem;
  line-height: 1;
  opacity: 0.5;
  transition: opacity var(--pulse-2) var(--ease-veil), color var(--pulse-2) var(--ease-veil);
}
.pit-lyre:hover,
.pit-lyre:focus-visible {
  opacity: 1;
  color: var(--smoke-pallas);
}
.pit-lyre:focus-visible {
  outline: 1px solid var(--ink-dim);
  outline-offset: 3px;
}
.pit-panel {
  position: fixed;
  left: var(--space-2);
  bottom: calc(var(--space-2) + 48px);
  z-index: 95; /* under the threshold (100), over the page */
  width: min(340px, calc(100vw - 2 * var(--space-2)));
  max-height: min(70vh, 560px);
  overflow-y: auto;
  padding: var(--space-2);
  background: rgba(5, 5, 5, 0.94);
  border: 1px solid var(--hairline);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
}
.pit-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-2);
}
.pit-title {
  text-transform: lowercase;
  letter-spacing: var(--tracking-wide);
  color: var(--ink-dim);
}
.pit-close {
  padding: 0 0.3em;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink-dim);
  font: inherit;
  font-size: var(--text-sm);
}
.pit-close:hover,
.pit-close:focus-visible {
  color: var(--ink);
}
.pit-shelf {
  margin-bottom: var(--space-2);
}
.pit-shelf-label {
  display: block;
  margin-bottom: var(--space-1);
  color: var(--ink-dim);
  text-transform: lowercase;
  letter-spacing: var(--tracking-wide);
}
.pit-track {
  display: block;
  width: 100%;
  padding: 0.3em 0.5em;
  background: none;
  border: none;
  border-left: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  color: var(--ink-dim);
  font: inherit;
  letter-spacing: inherit;
  transition: color var(--pulse-2) var(--ease-veil), border-color var(--pulse-2) var(--ease-veil);
}
.pit-track:hover:not(:disabled),
.pit-track:focus-visible {
  color: var(--ink);
}
.pit-track.is-playing {
  color: var(--smoke-pallas);
  border-left-color: var(--smoke-pallas);
}
.pit-track.is-locked {
  color: var(--hairline);
  cursor: default;
}
.pit-seq-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.pit-seq-name {
  width: 3.4em;
  color: var(--ink-dim);
}
.pit-cell {
  width: 22px;
  height: 22px;
  flex: none;
  padding: 0;
  background: none;
  border: 1px solid var(--hairline);
  cursor: pointer;
}
.pit-cell.pit-cell-gap {
  margin-left: 8px; /* the seams of 2+2+3 */
}
.pit-cell.is-on {
  background: var(--ink-dim);
  border-color: var(--ink-dim);
}
.pit-cell.is-now {
  border-color: var(--smoke-pallas);
}
.pit-cell.is-on.is-now {
  background: var(--smoke-pallas);
}
.pit-play {
  margin-top: var(--space-1);
  padding: 0.25em 0.8em;
  background: none;
  border: 1px solid var(--hairline);
  cursor: pointer;
  color: var(--ink-dim);
  font: inherit;
  letter-spacing: inherit;
}
.pit-play:hover,
.pit-play:focus-visible {
  color: var(--ink);
}
.pit-play[aria-pressed='true'] {
  color: var(--smoke-pallas);
  border-color: var(--smoke-pallas);
}
.pit-embeds-note {
  color: var(--ink-dim);
  opacity: 0.6;
  font-style: italic;
}
@media (prefers-reduced-motion: reduce) {
  .pit-lyre,
  .pit-track,
  .pit-cell,
  .pit-play {
    transition: none;
  }
}
`;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/* ---------------------------------------------------------------- */
/* Panel                                                             */
/* ---------------------------------------------------------------- */

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTracks(shelf: HTMLElement): void {
  shelf.textContent = '';
  const seen = visited();
  for (const t of SECTIONS) {
    const btn = make('button', 'pit-track');
    btn.type = 'button';
    if (!seen.has(t.id)) {
      // locked: a dim glyph, unlabeled — the shelf keeps its secrets
      btn.classList.add('is-locked');
      btn.disabled = true;
      btn.textContent = '◦';
      btn.setAttribute('aria-label', 'locked');
    } else {
      btn.textContent = `${t.id} · ${t.mode}`;
      const playing = pitAudio.trackPlaying(t.id);
      btn.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-pressed', String(playing));
      btn.addEventListener('click', () => {
        void pitAudio.toggleTrack(t.id).then((on) => {
          btn.classList.toggle('is-playing', on);
          btn.setAttribute('aria-pressed', String(on));
        });
      });
    }
    shelf.appendChild(btn);
  }
}

function buildSequencer(): HTMLElement {
  const wrap = make('div', 'pit-shelf');
  wrap.appendChild(make('span', 'pit-shelf-label', 'seven'));

  cellsByStep = Array.from({ length: pitAudio.SEQ_STEPS }, () => []);
  for (let v = 0; v < pitAudio.SEQ_VOICES; v++) {
    const row = make('div', 'pit-seq-row');
    const name = SEQ_NAMES[v] ?? `voice ${v + 1}`;
    row.appendChild(make('span', 'pit-seq-name', name));
    for (let s = 0; s < pitAudio.SEQ_STEPS; s++) {
      const cell = make('button', 'pit-cell');
      cell.type = 'button';
      if (s === 2 || s === 4) cell.classList.add('pit-cell-gap');
      cell.setAttribute('aria-pressed', String(pitAudio.cellOn(v, s)));
      cell.setAttribute('aria-label', `${name}, step ${s + 1}`);
      cell.classList.toggle('is-on', pitAudio.cellOn(v, s));
      cell.addEventListener('click', () => {
        const on = !pitAudio.cellOn(v, s);
        pitAudio.setCell(v, s, on);
        cell.classList.toggle('is-on', on);
        cell.setAttribute('aria-pressed', String(on));
      });
      row.appendChild(cell);
      cellsByStep[s]?.push(cell);
    }
    wrap.appendChild(row);
  }

  const play = make('button', 'pit-play', 'play');
  play.type = 'button';
  play.setAttribute('aria-pressed', 'false');
  play.addEventListener('click', () => {
    if (pitAudio.sequencerRunning()) {
      pitAudio.stopSequencer();
      play.textContent = 'play';
      play.setAttribute('aria-pressed', 'false');
    } else {
      void pitAudio.startSequencer().then((ok) => {
        play.textContent = ok ? 'stop' : 'play';
        play.setAttribute('aria-pressed', String(ok));
      });
    }
  });
  wrap.appendChild(play);

  pitAudio.onStep((step) => {
    for (const column of cellsByStep) {
      for (const cell of column) cell.classList.remove('is-now');
    }
    if (step < 0) return;
    for (const cell of cellsByStep[step] ?? []) cell.classList.add('is-now');
  });

  return wrap;
}

function buildPanel(): HTMLDivElement {
  const root = make('div', 'pit-panel');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Orchestra pit');
  root.hidden = true;

  const head = make('div', 'pit-head');
  head.appendChild(make('span', 'pit-title', 'orchestra pit'));
  const close = make('button', 'pit-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the pit');
  close.addEventListener('click', closePit);
  head.appendChild(close);
  root.appendChild(head);

  const tracks = make('div', 'pit-shelf');
  tracks.appendChild(make('span', 'pit-shelf-label', 'drones'));
  trackShelf = make('div');
  renderTracks(trackShelf);
  tracks.appendChild(trackShelf);
  root.appendChild(tracks);

  root.appendChild(buildSequencer());

  // TODO(michael): embed URLs — Spotify/YouTube iframes mount on this
  // shelf; never self-hosted commercial audio.
  const embeds = make('div', 'pit-shelf');
  embeds.appendChild(make('span', 'pit-shelf-label', 'programme'));
  embeds.appendChild(make('p', 'pit-embeds-note', 'nothing on the stand yet.'));
  root.appendChild(embeds);

  document.body.appendChild(root);
  return root;
}

function wireGlobal(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && !panel.hidden) closePit();
  });
  document.addEventListener('pit:visited', () => {
    if (trackShelf) renderTracks(trackShelf);
  });
}

/* ---------------------------------------------------------------- */
/* Open / close / summon                                             */
/* ---------------------------------------------------------------- */

function openPit(): void {
  injectStyles();
  wireGlobal();
  if (!panel) panel = buildPanel();
  else if (trackShelf) renderTracks(trackShelf); // locks may have opened since
  lastFocus = document.activeElement;
  panel.hidden = false;
  lyre?.setAttribute('aria-expanded', 'true');
  if (!prefersReducedMotion()) {
    panel.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 420, easing: EASE_VEIL } // three pulses
    );
  }
  panel.querySelector<HTMLElement>('.pit-close')?.focus();
}

export function closePit(): void {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  lyre?.setAttribute('aria-expanded', 'false');
  if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus();
  else lyre?.focus();
  lastFocus = null;
}

/** The minimized pit: the lyre waits bottom-left on every page. */
export function mountLyre(): void {
  if (lyre) return;
  injectStyles();
  wireGlobal();
  const btn = make('button', 'pit-lyre', 'Ψ');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Orchestra pit');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    if (panel && !panel.hidden) closePit();
    else openPit();
  });
  document.body.appendChild(btn);
  lyre = btn;
}

/** The knock landed: persist, seat the lyre, raise the pit. */
export function summonPit(): void {
  persistSummoned();
  mountLyre();
  openPit();
}
