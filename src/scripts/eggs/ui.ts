/**
 * Minimal UI for the egg engine: quiet toasts, the sigil-mark rail, and the
 * completion sigil. All DOM is created here with one injected <style> — the
 * engine owns no markup in any .astro file.
 */

const STYLE_ID = 'iw-egg-style';
const RAIL_ID = 'iw-egg-marks';
const TOAST_ID = 'iw-egg-toast';
const SIGIL_ID = 'iw-egg-sigil';

const CSS = `
#${RAIL_ID} {
  position: fixed;
  right: 1.1rem;
  bottom: 1.1rem;
  z-index: 40;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.55rem;
  pointer-events: none;
  font-family: var(--font-greek, serif);
}
#${RAIL_ID} .iw-mark {
  font-size: 0.95rem;
  line-height: 1;
  color: var(--ink-dim, #9a958c);
  opacity: 0;
  transform: translateY(0.3rem);
  transition: opacity 1.4s ease, transform 1.4s ease;
  text-align: center;
  user-select: none;
}
#${RAIL_ID} .iw-mark.iw-in {
  opacity: 0.55;
  transform: translateY(0);
}
#${TOAST_ID} {
  position: fixed;
  left: 50%;
  bottom: 2.2rem;
  transform: translate(-50%, 0.4rem);
  z-index: 41;
  max-width: 26rem;
  padding: 0.45rem 0.9rem;
  font-family: var(--font-ui, monospace);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--ink, #e8e4dc);
  background: rgba(5, 5, 5, 0.55);
  border: 1px solid rgba(154, 149, 140, 0.35);
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.9s ease, transform 0.9s ease;
  pointer-events: none;
  text-align: center;
}
#${TOAST_ID}.iw-in {
  opacity: 0.92;
  transform: translate(-50%, 0);
}
#${SIGIL_ID} {
  position: fixed;
  left: 50%;
  bottom: 4.2rem;
  transform: translateX(-50%);
  z-index: 41;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 2.4s ease;
}
#${SIGIL_ID}.iw-in { opacity: 1; }
#${SIGIL_ID} .iw-sigil-glyph {
  font-family: var(--font-greek, serif);
  font-size: 1.7rem;
  line-height: 1;
  color: var(--ink, #e8e4dc);
  opacity: 0.7;
  animation: iw-sigil-breathe 5s ease-in-out infinite;
}
#${SIGIL_ID} .iw-sigil-copy {
  font-family: var(--font-ui, monospace);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: var(--ink-dim, #9a958c);
  max-width: 24rem;
  text-align: center;
}
@keyframes iw-sigil-breathe {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.8; }
}
@media (prefers-reduced-motion: reduce) {
  #${SIGIL_ID} .iw-sigil-glyph { animation: none; }
}
`;

export function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function rail(): HTMLElement {
  let el = document.getElementById(RAIL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = RAIL_ID;
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

/** Append a sigil mark to the rail (skips glyphs already present). */
export function addMark(glyph: string, title: string) {
  const host = rail();
  const existing = Array.from(host.children).some(
    (c) => (c as HTMLElement).dataset.glyph === glyph,
  );
  if (existing) return;
  const mark = document.createElement('span');
  mark.className = 'iw-mark';
  mark.dataset.glyph = glyph;
  mark.title = title;
  mark.textContent = glyph;
  host.appendChild(mark);
  requestAnimationFrame(() => requestAnimationFrame(() => mark.classList.add('iw-in')));
}

let toastTimer = 0;

/** Quiet toast, centered low; each call replaces the previous line. */
export function toast(text: string, ms = 3800) {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_ID;
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.remove('iw-in');
  requestAnimationFrame(() => requestAnimationFrame(() => el!.classList.add('iw-in')));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('iw-in'), ms);
}

/** The completion sigil shown once the hunt reaches 'awaiting-seal'. */
export function showCompletionSigil(glyph: string, copy: string) {
  if (document.getElementById(SIGIL_ID)) return;
  const el = document.createElement('div');
  el.id = SIGIL_ID;
  el.setAttribute('role', 'status');
  const g = document.createElement('span');
  g.className = 'iw-sigil-glyph';
  g.textContent = glyph;
  const c = document.createElement('p');
  c.className = 'iw-sigil-copy';
  c.textContent = copy;
  el.appendChild(g);
  el.appendChild(c);
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('iw-in')));
}
