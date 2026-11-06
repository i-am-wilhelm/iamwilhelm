/**
 * THE UNSEEN ONE: the seed gates. Six pomegranate arils, the only red on
 * the page. Gates 1 to 5 are a click; gate 6 is press-and-hold (HOLD_MS)
 * with a ring that fills as the press goes on. Release early and it
 * resets with "Hold it. All the way." Pointer events throughout, so one
 * code path serves mouse, pen and touch; the long-press context menu and
 * the iOS callout are suppressed on the seed.
 */

import { HOLD_MS } from './cues';

const SEED_SVG =
  '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
  '<defs><radialGradient id="unseen-aril" cx="38%" cy="32%" r="70%">' +
  '<stop offset="0" stop-color="#ee5a6c"/><stop offset=".45" stop-color="#c0243a"/>' +
  '<stop offset="1" stop-color="#4a0a12"/></radialGradient></defs>' +
  '<circle class="ring" cx="50" cy="50" r="46"/>' +
  '<path class="aril" fill="url(#unseen-aril)" d="M50 10 C 72 18, 86 42, 76 66 C 68 84, 52 92, 42 88 C 24 80, 14 56, 24 34 C 30 20, 40 12, 50 10 Z"/>' +
  '<ellipse class="shine" cx="40" cy="32" rx="9" ry="14" fill="rgba(255,255,255,.28)" transform="rotate(-25 40 32)"/>' +
  '</svg>';

const TAKEN_LABEL = [
  '',
  'First seed, taken.',
  'Second seed, taken.',
  'Third seed, taken.',
  'Fourth seed, taken.',
  'Fifth seed, taken.',
  'Sixth seed. Now.',
];

export interface GateHandlers {
  /** Seeds 1 to 5 clicked, or 6 held to completion. */
  onTake(n: number): void;
  /** Sixth seed: press began. */
  onHoldStart(): void;
  /** Sixth seed: released or cancelled before the ring filled. */
  onHoldCancel(): void;
}

export interface Gate {
  n: number;
  root: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  /** Mark taken without firing handlers (the straight read). */
  markTaken(): void;
  show(): void;
  readonly taken: boolean;
}

export function buildGates(roots: HTMLElement[], handlers: GateHandlers): Gate[] {
  return roots.map((root) => buildGate(root, handlers));
}

function buildGate(root: HTMLElement, handlers: GateHandlers): Gate {
  const n = Number(root.dataset.seed);
  const text = root.getAttribute('aria-label') || `Take seed ${n}`;
  root.removeAttribute('aria-label');
  root.classList.add('gate');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'seed';
  button.setAttribute('aria-label', text);
  button.innerHTML = SEED_SVG;

  const label = document.createElement('div');
  label.className = 'lbl';
  label.textContent = n === 6 ? 'Take the sixth. Hold it.' : text;

  root.replaceChildren(button, label);

  let taken = false;
  const markTaken = () => {
    if (taken) return;
    taken = true;
    root.classList.add('done');
    button.classList.add('taken');
    button.disabled = true;
    label.textContent = TAKEN_LABEL[n];
  };
  const take = () => {
    if (taken) return;
    markTaken();
    handlers.onTake(n);
  };

  if (n < 6) {
    button.addEventListener('click', take);
  } else {
    bindHold(button, label, handlers, take);
  }

  return {
    n,
    root,
    button,
    label,
    markTaken,
    show() {
      root.hidden = false;
    },
    get taken() {
      return taken;
    },
  };
}

function bindHold(
  button: HTMLButtonElement,
  label: HTMLElement,
  handlers: GateHandlers,
  complete: () => void,
) {
  const ring = button.querySelector<SVGElement>('.ring');
  let holding = false;
  let start = 0;
  let raf = 0;
  let pointerId: number | null = null;

  const paint = (t: number) => {
    if (ring) {
      ring.style.opacity = String(0.25 + t * 0.75);
      ring.style.transform = `scale(${0.72 + t * 0.28})`;
    }
    button.style.transform = `scale(${1 + t * 0.12})`;
  };
  const reset = () => {
    if (ring) {
      ring.style.opacity = '0';
      ring.style.transform = 'scale(.72)';
    }
    button.style.transform = '';
  };

  const tick = () => {
    if (!holding) return;
    const t = Math.min(1, (performance.now() - start) / HOLD_MS);
    paint(t);
    if (t >= 1) {
      holding = false;
      pointerId = null;
      complete();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const down = () => {
    if (holding || button.disabled) return;
    holding = true;
    start = performance.now();
    button.classList.add('hold');
    label.textContent = 'Hold it.';
    handlers.onHoldStart();
    raf = requestAnimationFrame(tick);
  };
  const release = () => {
    cancelAnimationFrame(raf);
    if (!holding) return;
    holding = false;
    pointerId = null;
    button.classList.remove('hold');
    reset();
    label.textContent = 'Hold it. All the way.';
    handlers.onHoldCancel();
  };

  button.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    pointerId = e.pointerId;
    // Keep receiving the pointer even if the finger drifts off the seed.
    try {
      button.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
    down();
  });
  const onUp = (e: PointerEvent) => {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    release();
  };
  button.addEventListener('pointerup', onUp);
  button.addEventListener('pointercancel', onUp);
  button.addEventListener('lostpointercapture', onUp);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      down();
    }
  });
  button.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  button.addEventListener('blur', release);
}
