/**
 * THE ORCHESTRA PIT — overlay drawer UI. Pure DOM creation plus one injected
 * <style>; colors ride the site's CSS vars (--ink, --ink-dim, and
 * --section-accent with an --ink fallback, since the drawer floats outside
 * any .section). All copy is affirmative.
 */

import { STEPS, SEQ_ROW_NAMES, GROUP_STARTS } from './grid';
import { tracks, type PitTrack } from './tracks.config';

export interface PitUIDeps {
  onScoreToggle: (on: boolean) => void;
  onSeqToggle: (playing: boolean) => void;
  onCellToggle: (row: number, step: number, on: boolean) => void;
  onClose: () => void;
  initialPattern: boolean[][];
  initialScoreOn: boolean;
}

export interface PitUI {
  root: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  setScoreOn(on: boolean): void;
  setSeqPlaying(playing: boolean): void;
  markStep(step: number): void;
}

const STYLE_ID = 'iw-pit-style';

const CSS = `
.iw-pit {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 60;
  transform: translateY(102%);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  background: rgba(5, 5, 5, 0.94);
  border-top: 1px solid var(--section-accent, var(--ink-dim, #9a958c));
  color: var(--ink, #e8e4dc);
  font-family: var(--font-ui, ui-monospace, monospace);
  font-size: 0.78rem;
  padding: 1rem 1.4rem 1.4rem;
  max-height: 70vh;
  overflow-y: auto;
}
.iw-pit.iw-pit--open { transform: translateY(0); }
.iw-pit__head {
  display: flex; align-items: baseline; gap: 1rem; margin-bottom: 1rem;
}
.iw-pit__title { letter-spacing: 0.18em; text-transform: uppercase; }
.iw-pit__meter { color: var(--ink-dim, #9a958c); }
.iw-pit__close {
  margin-left: auto;
  background: transparent; border: 1px solid var(--ink-dim, #9a958c);
  color: var(--ink, #e8e4dc); font: inherit; cursor: pointer;
  padding: 0.15rem 0.6rem;
}
.iw-pit__close:hover { border-color: var(--ink, #e8e4dc); }
.iw-pit__row { margin: 0.9rem 0; }
.iw-pit button { touch-action: manipulation; }
.iw-pit__toggle {
  background: transparent; border: 1px solid var(--ink-dim, #9a958c);
  color: var(--ink, #e8e4dc); font: inherit; cursor: pointer;
  padding: 0.3rem 0.9rem; letter-spacing: 0.08em;
}
.iw-pit__toggle[aria-pressed="true"] {
  border-color: var(--section-accent, var(--ink, #e8e4dc));
  color: var(--section-accent, var(--ink, #e8e4dc));
}
.iw-pit__hint { color: var(--ink-dim, #9a958c); margin-top: 0.35rem; }
.iw-pit__seq { display: grid; grid-template-columns: 5.2rem 1fr; gap: 0.3rem 0.6rem; align-items: center; }
.iw-pit__rowlabel { color: var(--ink-dim, #9a958c); text-align: right; }
.iw-pit__cells { display: flex; gap: 0.25rem; }
.iw-pit__cell {
  width: 1.7rem; height: 1.7rem;
  background: transparent; border: 1px solid var(--ink-dim, #9a958c);
  cursor: pointer; padding: 0;
}
/* Visual 2+2+3 grouping: extra air before each group start after the first. */
.iw-pit__cell--group { margin-left: 0.7rem; }
.iw-pit__cell[aria-pressed="true"] {
  background: var(--section-accent, var(--ink, #e8e4dc));
  border-color: var(--section-accent, var(--ink, #e8e4dc));
}
.iw-pit__cell--now { outline: 1px solid var(--ink, #e8e4dc); outline-offset: 1px; }
.iw-pit__counts { display: flex; gap: 0.25rem; color: var(--ink-dim, #9a958c); }
.iw-pit__count { width: 1.7rem; text-align: center; }
.iw-pit__count--group { margin-left: 0.7rem; }
.iw-pit__sect { border-top: 1px dashed var(--ink-dim, #9a958c); padding-top: 0.9rem; margin-top: 1.2rem; }
.iw-pit__sect h3 {
  font-size: 0.78rem; font-weight: 400;
  letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 0.6rem;
}
.iw-pit__tracks { list-style: none; }
.iw-pit__tracks li { margin: 0.4rem 0; }
.iw-pit__track-artist, .iw-pit__track-license { color: var(--ink-dim, #9a958c); }
.iw-pit__tracks audio { display: block; width: 100%; margin-top: 0.3rem; }
@media (prefers-reduced-motion: reduce) {
  .iw-pit { transition: none; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderTrack(track: PitTrack): HTMLLIElement {
  const li = el('li');
  li.append(el('div', 'iw-pit__track-title', track.title));
  li.append(el('div', 'iw-pit__track-artist', track.artist));
  if (track.kind === 'owner-recording' && track.src) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = track.src;
    li.append(audio);
  } else if (track.kind === 'licensed-embed' && track.embedUrl) {
    const frame = document.createElement('iframe');
    frame.src = track.embedUrl;
    frame.loading = 'lazy';
    frame.style.border = '0';
    frame.style.width = '100%';
    frame.style.height = '120px';
    li.append(frame);
  }
  if (track.license) li.append(el('div', 'iw-pit__track-license', track.license));
  return li;
}

export function createPitUI(deps: PitUIDeps): PitUI {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }

  const root = el('aside', 'iw-pit');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Orchestra pit');
  root.setAttribute('aria-hidden', 'true');

  // Header
  const head = el('div', 'iw-pit__head');
  head.append(
    el('span', 'iw-pit__title', 'the orchestra pit'),
    el('span', 'iw-pit__meter', '7/8 · counted 2 · 2 · 3'),
  );
  const closeBtn = el('button', 'iw-pit__close', 'close');
  closeBtn.addEventListener('click', () => deps.onClose());
  head.append(closeBtn);
  root.append(head);

  // (a) Site score toggle
  const scoreRow = el('div', 'iw-pit__row');
  const scoreBtn = el('button', 'iw-pit__toggle', 'site score');
  scoreBtn.setAttribute('aria-pressed', String(deps.initialScoreOn));
  scoreBtn.addEventListener('click', () => {
    const next = scoreBtn.getAttribute('aria-pressed') !== 'true';
    scoreBtn.setAttribute('aria-pressed', String(next));
    deps.onScoreToggle(next);
  });
  scoreRow.append(scoreBtn);
  scoreRow.append(
    el(
      'div',
      'iw-pit__hint',
      'A low drone walks the circle of fifths as you descend. The knock keeps the count: 1 · 3 · 5.',
    ),
  );
  root.append(scoreRow);

  // (b) Sequencer toy
  const seqSect = el('div', 'iw-pit__sect');
  seqSect.append(el('h3', undefined, 'seven steps'));
  const playBtn = el('button', 'iw-pit__toggle', 'play');
  playBtn.setAttribute('aria-pressed', 'false');
  playBtn.addEventListener('click', () => {
    const next = playBtn.getAttribute('aria-pressed') !== 'true';
    setSeqPlaying(next);
    deps.onSeqToggle(next);
  });
  const playRow = el('div', 'iw-pit__row');
  playRow.append(playBtn);
  seqSect.append(playRow);

  const grid = el('div', 'iw-pit__seq');
  const cells: HTMLButtonElement[][] = [];
  SEQ_ROW_NAMES.forEach((name, row) => {
    grid.append(el('div', 'iw-pit__rowlabel', name));
    const cellRow = el('div', 'iw-pit__cells');
    const rowCells: HTMLButtonElement[] = [];
    for (let step = 0; step < STEPS; step++) {
      const cell = el('button', 'iw-pit__cell');
      if (step > 0 && (GROUP_STARTS as readonly number[]).includes(step))
        cell.classList.add('iw-pit__cell--group');
      const startOn = !!deps.initialPattern[row]?.[step];
      cell.setAttribute('aria-pressed', String(startOn));
      cell.setAttribute('aria-label', `${name}, step ${step + 1}`);
      cell.addEventListener('click', () => {
        const next = cell.getAttribute('aria-pressed') !== 'true';
        cell.setAttribute('aria-pressed', String(next));
        deps.onCellToggle(row, step, next);
      });
      cellRow.append(cell);
      rowCells.push(cell);
    }
    grid.append(cellRow);
    cells.push(rowCells);
  });
  // Count row labelling the 2+2+3 grouping: 1 2 | 1 2 | 1 2 3
  grid.append(el('div', 'iw-pit__rowlabel', 'count'));
  const counts = el('div', 'iw-pit__counts');
  const countLabels = ['1', '2', '1', '2', '1', '2', '3'];
  countLabels.forEach((label, step) => {
    const c = el('span', 'iw-pit__count', label);
    if (step > 0 && (GROUP_STARTS as readonly number[]).includes(step))
      c.classList.add('iw-pit__count--group');
    counts.append(c);
  });
  grid.append(counts);
  seqSect.append(grid);
  root.append(seqSect);

  // (c) Owner recordings & licensed embeds
  const trackSect = el('div', 'iw-pit__sect');
  trackSect.append(el('h3', undefined, 'recordings'));
  const list = el('ul', 'iw-pit__tracks');
  if (tracks.length === 0) {
    // TODO(owner): entries added to tracks.config.ts render here.
    list.append(el('li', 'iw-pit__track-artist', 'Recordings arrive here.'));
  } else {
    tracks.forEach((t) => list.append(renderTrack(t)));
  }
  trackSect.append(list);
  root.append(trackSect);

  document.body.append(root);

  let openState = false;
  let lastStepCells: HTMLButtonElement[] | null = null;

  function open() {
    openState = true;
    root.classList.add('iw-pit--open');
    root.setAttribute('aria-hidden', 'false');
  }
  function close() {
    openState = false;
    root.classList.remove('iw-pit--open');
    root.setAttribute('aria-hidden', 'true');
  }
  function setSeqPlaying(playing: boolean) {
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? 'stop' : 'play';
    if (!playing && lastStepCells) {
      lastStepCells.forEach((c) => c.classList.remove('iw-pit__cell--now'));
      lastStepCells = null;
    }
  }

  return {
    root,
    open,
    close,
    isOpen: () => openState,
    setScoreOn(on: boolean) {
      scoreBtn.setAttribute('aria-pressed', String(on));
    },
    setSeqPlaying,
    markStep(step: number) {
      if (lastStepCells)
        lastStepCells.forEach((c) => c.classList.remove('iw-pit__cell--now'));
      lastStepCells = cells.map((row) => row[step]);
      lastStepCells.forEach((c) => c.classList.add('iw-pit__cell--now'));
    },
  };
}
