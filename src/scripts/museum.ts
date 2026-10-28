/**
 * Museum choreography for the public pages. Small and dependency-free:
 *
 *   1. Reveal on scroll: [data-reveal] elements settle into place as they
 *      enter, staggered to the same 7/8 (2+2+3 sixteenths at 84 bpm) meter
 *      the poem movements reveal to (src/scripts/scroll.ts).
 *   2. The foyer's zodiac ring turns slowly with scroll, damped so it moves
 *      with weight rather than tracking the wheel 1:1.
 *   3. The nav marks the room in view (aria-current="location") and gains a
 *      hairline once the page has scrolled.
 *
 * Under prefers-reduced-motion nothing animates: no reveals (the CSS shows
 * everything), and the ring holds still.
 */
import { meter } from '../design/tokens';

const BEAT_MS = 60000 / meter.bpm;
const SIXTEENTH_MS = BEAT_MS / 4;

/** Cumulative offset for the nth item in a batch: gaps of 2, 2, 3 sixteenths. */
function meterOffset(index: number): number {
  let t = 0;
  for (let i = 0; i < index; i++) t += meter.septuple[i % meter.septuple.length];
  return t * SIXTEENTH_MS;
}

function initReveals(root: HTMLElement) {
  const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!root.classList.contains('js-reveal') || !('IntersectionObserver' in window)) {
    for (const el of items) el.classList.add('is-revealed');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      const entering = entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target as HTMLElement)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      entering.forEach((el, i) => {
        // Cap the stagger at one bar so a tall batch never lags behind the reader.
        const delay = Math.min(meterOffset(i), meterOffset(7));
        el.style.setProperty('--reveal-delay', `${Math.round(delay)}ms`);
        el.classList.add('is-revealed');
        io.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
  );
  for (const el of items) io.observe(el);
}

function initRing(reduced: boolean) {
  const ring = document.querySelector<SVGElement>('[data-ring]');
  if (!ring || reduced) return;
  let target = 0;
  let current = 0;
  let frame = 0;
  let visible = true;

  const tick = () => {
    current += (target - current) * 0.06;
    ring.style.setProperty('--ring-turn', `${current.toFixed(3)}deg`);
    frame = Math.abs(target - current) > 0.01 && visible ? requestAnimationFrame(tick) : 0;
  };
  const onScroll = () => {
    // A full turn over roughly twelve screens of scrolling.
    target = (window.scrollY / Math.max(window.innerHeight, 1)) * 30;
    if (!frame && visible) frame = requestAnimationFrame(tick);
  };
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) onScroll();
  }).observe(ring);
  addEventListener('scroll', onScroll, { passive: true });
}

function initNav(root: HTMLElement) {
  const onScroll = () => root.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const links = new Map<string, HTMLAnchorElement>();
  document.querySelectorAll<HTMLAnchorElement>('[data-nav-link]').forEach((a) => links.set(a.dataset.navLink!, a));
  if (!links.size) return;
  const rooms = Array.from(links.keys())
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => !!el);

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const link = links.get(e.target.id);
        if (!link) continue;
        if (e.isIntersecting) {
          links.forEach((l) => l.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'location');
        } else if (link.getAttribute('aria-current')) {
          link.removeAttribute('aria-current');
        }
      }
    },
    // A thin band across the middle of the viewport: one room at a time.
    { rootMargin: '-45% 0px -50% 0px' },
  );
  rooms.forEach((r) => io.observe(r));
}

export function initMuseum() {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('museum-ready');
  initReveals(root);
  initRing(reduced);
  initNav(root);
}
