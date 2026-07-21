/**
 * Odd-meter motion — the whole site moves in seven.
 *
 * Global animation timing derives from 7/8 groupings: reveals and glyph
 * cascades pulse in 2+2+3 rather than at even intervals. One PULSE is an
 * eighth-note; a bar is seven of them. The CSS side of this system lives
 * in tokens.css (--pulse, --pulse-2, --pulse-3, --bar-7-8).
 */

/** One eighth-note, in ms. Keep in sync with --pulse in tokens.css. */
export const PULSE = 140;

/** The 2+2+3 grouping of a 7/8 bar, in pulses. */
export const SEVEN_EIGHT: readonly number[] = [2, 2, 3];

/** Length of one full bar in ms (7 pulses). */
export const BAR = PULSE * 7;

/**
 * Cumulative onset times (ms) for `count` events placed on the 2+2+3 grid,
 * wrapping into successive bars. First event lands on the downbeat (0ms).
 * e.g. count=5 → [0, 280, 560, 980, 1260]
 */
export function staggerDelays(count: number, pulseMs: number = PULSE): number[] {
  const delays: number[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    delays.push(t);
    t += SEVEN_EIGHT[i % SEVEN_EIGHT.length]! * pulseMs;
  }
  return delays;
}

/**
 * Returns the beat index (0, 1, 2) within the 2+2+3 cycle for step n.
 * Useful for accenting the long beat.
 */
export function beatOf(n: number): number {
  return n % SEVEN_EIGHT.length;
}

/**
 * Wire up reveal-on-scroll: every `.reveal` element gets a --reveal-delay
 * from the 2+2+3 grid (grouped per parent so each cluster restarts its bar)
 * and is lit when it enters the viewport.
 */
export function initReveals(root: ParentNode = document): void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
  if (els.length === 0) return;

  const byParent = new Map<Element | null, HTMLElement[]>();
  for (const el of els) {
    const key = el.parentElement;
    const group = byParent.get(key) ?? [];
    group.push(el);
    byParent.set(key, group);
  }
  for (const group of byParent.values()) {
    const delays = staggerDelays(group.length);
    group.forEach((el, i) => el.style.setProperty('--reveal-delay', `${delays[i]}ms`));
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-lit');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px' }
  );
  els.forEach((el) => io.observe(el));
}
