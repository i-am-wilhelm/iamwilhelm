/**
 * The museum's small secrets. None are announced; each answers something a
 * visitor might try on their own. All are harmless to miss, and all of
 * them hold still under prefers-reduced-motion.
 *
 *   crown    The foyer ring carries the real chart at hairline weight.
 *            Pressing Saturn's crown on the Midheaven draws the Sun–Moon
 *            beam for a bar and lets Venus beat to her own time.
 *   light    The brass picture light in Room III is a switch. Pressed, it
 *            keeps a lighthouse character, Fl W 7s: one sweep across the
 *            glass every seven seconds. Pressed again, it is a lamp.
 *   knock    Tap the glass in 7/8 (2 + 2 + 3) and the light knocks back.
 *   key      The meander keylines run toward their medallion while the
 *            pointer rests on them.
 *   janus    Hold the monogram in the nav for one bar and the museum turns
 *            to night; the colophon then shows a door to the atelier, the
 *            site's other face. Hold again for day. Night keeps for the
 *            session.
 *   balance  The Libra mark in the colophon weighs: press it and the
 *            hairlines tip like a beam and settle level.
 */
import { meter } from '../design/tokens';

const BEAT = 60000 / meter.bpm; // 714 ms
const EIGHTH = BEAT / 2;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NIGHT_KEY = 'iw:night';

function initCrown() {
  const ring = document.querySelector<HTMLElement>('.ring');
  const crown = ring?.querySelector<SVGGElement>('[data-egg="crown"]');
  if (!ring || !crown) return;
  let timer = 0;
  const press = () => {
    if (reduced) return;
    ring.classList.remove('is-crowned');
    void ring.offsetWidth; // restart the animations
    ring.classList.add('is-crowned');
    clearTimeout(timer);
    timer = window.setTimeout(() => ring.classList.remove('is-crowned'), BEAT * 7.5);
  };
  crown.addEventListener('click', press);
  crown.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      press();
    }
  });
}

function initLight() {
  const easel = document.querySelector<HTMLElement>('[data-easel]');
  const light = easel?.querySelector<HTMLButtonElement>('[data-egg="light"]');
  const glass = easel?.querySelector<HTMLElement>('.frame__glass');
  if (!easel || !light || !glass) return;

  // The switch: lamp, or a light with a character.
  light.addEventListener('click', () => {
    const on = easel.classList.toggle('is-sweeping');
    light.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  // The knock. Four taps whose gaps sit in 2 : 2 : 3, at any tempo in
  // reason, and the light answers in the same figure.
  const taps: number[] = [];
  let answering = false;
  const answer = () => {
    if (answering || reduced) return;
    answering = true;
    easel.classList.add('is-knocking');
    setTimeout(() => {
      easel.classList.remove('is-knocking');
      answering = false;
    }, BEAT * 7.5);
  };
  glass.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      const now = e.timeStamp;
      taps.push(now);
      if (taps.length > 4) taps.shift();
      if (taps.length < 4) return;
      const [a, b, c, d] = taps;
      const g1 = b - a, g2 = c - b, g3 = d - c;
      const unit = (g1 + g2) / 4; // one eighth, from the two short gaps
      if (unit < 120 || unit > 700) return; // 42 to 250 bpm, roughly
      const close = (gap: number, n: number) => Math.abs(gap - n * unit) < unit * 0.45;
      if (close(g1, 2) && close(g2, 2) && close(g3, 3)) {
        taps.length = 0;
        answer();
      }
    },
    { passive: true },
  );
}

function initKey() {
  if (reduced) return;
  for (const m of document.querySelectorAll<HTMLElement>('.meander')) {
    const patterns = m.querySelectorAll<SVGPatternElement>('pattern');
    if (!patterns.length) continue;
    let x = 0, v = 0, frame = 0, running = false;
    const tick = () => {
      // 24px per beat while the pointer rests; a long settle once it leaves.
      v += ((running ? 24 / BEAT : 0) - v) * 0.08;
      x = (x + v * 16) % 24;
      for (const p of patterns) p.setAttribute('patternTransform', `translate(${x.toFixed(2)} 0)`);
      frame = Math.abs(v) > 0.0005 || running ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      running = true;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
    };
    m.addEventListener('pointerenter', start);
    m.addEventListener('pointerleave', stop);
    m.addEventListener('pointerdown', start, { passive: true });
    m.addEventListener('pointerup', stop);
    m.addEventListener('pointercancel', stop);
  }
}

function initJanus() {
  const root = document.documentElement;
  const brand = document.querySelector<HTMLAnchorElement>('[data-egg="janus"]');
  if (!brand) return;

  const apply = (night: boolean) => {
    root.classList.toggle('is-night', night);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', night ? '#0f0d12' : '#f4eee2');
    brand.setAttribute('aria-pressed', night ? 'true' : 'false');
  };
  try {
    if (sessionStorage.getItem(NIGHT_KEY) === '1') {
      root.classList.add('is-night-instant');
      apply(true);
      requestAnimationFrame(() => root.classList.remove('is-night-instant'));
    }
  } catch {
    /* private mode */
  }

  const HOLD = BEAT * 3.5; // one bar of 7/8
  let timer = 0;
  let held = false;
  const begin = (e: Event) => {
    if (e instanceof PointerEvent && e.button !== 0) return;
    held = false;
    brand.classList.add('is-holding');
    timer = window.setTimeout(() => {
      held = true;
      brand.classList.remove('is-holding');
      const night = !root.classList.contains('is-night');
      apply(night);
      try {
        sessionStorage.setItem(NIGHT_KEY, night ? '1' : '0');
      } catch {
        /* private mode */
      }
    }, HOLD);
  };
  const end = () => {
    clearTimeout(timer);
    brand.classList.remove('is-holding');
  };
  brand.style.setProperty('--hold', `${HOLD}ms`);
  brand.addEventListener('pointerdown', begin);
  brand.addEventListener('pointerup', end);
  brand.addEventListener('pointerleave', end);
  brand.addEventListener('pointercancel', end);
  brand.addEventListener('contextmenu', (e) => e.preventDefault());
  // A completed hold is not a click: stay where you are.
  brand.addEventListener('click', (e) => {
    if (held) {
      e.preventDefault();
      held = false;
    }
  });
  brand.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.repeat) {
      e.preventDefault();
      begin(e);
    }
  });
  brand.addEventListener('keyup', (e) => {
    if (e.key === ' ') end();
  });
}

function initBalance() {
  const mark = document.querySelector<HTMLElement>('[data-egg="balance"]');
  if (!mark || reduced) return;
  let timer = 0;
  mark.addEventListener('click', () => {
    mark.classList.remove('is-weighing');
    void mark.offsetWidth;
    mark.classList.add('is-weighing');
    clearTimeout(timer);
    timer = window.setTimeout(() => mark.classList.remove('is-weighing'), BEAT * 6);
  });
}

export function initEggs() {
  initCrown();
  initLight();
  initKey();
  initJanus();
  initBalance();
}
