/**
 * Scroll choreography (spec §2.2, §2.4) — the layout-and-scroll workstream.
 *
 * Owns, for every page:
 *   1. the imperceptible global black→white background fade (+ ink crossfade
 *      and the --scroll-progress CSS var), tied to total document progress;
 *   2. the 'iw:scroll' event stream {progress, velocity} (velocity smoothed,
 *      px/s, signed — positive scrolling down);
 * and, on pages that have `.section[data-section]` markup (the homepage):
 *   3. per-section 'iw:section-enter' / 'iw:section-leave' /
 *      'iw:section-progress' events;
 *   4. morph drives ('iw:morph') through the transition zones between
 *      adjacent sections, plus 'atlas-columbia' inside philosophy;
 *   5. copy reveals staggered to the site's 7/8 (2+2+3) meter;
 *   6. the --active-accent CSS var tweened to the dominant section's accent.
 *
 * Communication with other subsystems happens ONLY via the events in
 * ./events — the shader core renders the morphs; we merely drive progress.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { accents, backgroundFade, meter, type SectionId } from '../design/tokens';
import { emit } from './events';
import '../styles/scroll.css';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Ink crossfade endpoints: light ink on dark ground → dark ink on light. */
const INK = { from: '#e8e4dc', to: '#181510' } as const;
const INK_DIM = { from: '#9a958c', to: '#5f594e' } as const;

/**
 * The ink flips light→dark in a deliberately narrow band around the point
 * where the background luminance crosses legibility parity. A linear ink
 * fade would put mid-grey text on a mid-grey ground at p≈0.5; a sharp
 * smoothstep crossover keeps the low-contrast zone as small as possible.
 */
const INK_CROSS = { start: 0.42, end: 0.58 } as const;

/** One beat at the site tempo (84 bpm) in seconds ≈ 0.714 s. */
const BEAT = 60 / meter.bpm;
/** Sixteenth-note at 84 bpm ≈ 0.179 s — base unit for reveal staggers. */
const SIXTEENTH = BEAT / 4;

/**
 * Morphs between adjacent section pairs. The transition zone runs from the
 * last 40% of `from` (its 60% line) through the first 40% of `to` (its 40%
 * line), measured against the viewport centerline.
 */
const PAIR_MORPHS: ReadonlyArray<{ from: SectionId; to: SectionId; name: string }> = [
  { from: 'cluster', to: 'philosophy', name: 'cross-cube' },
  { from: 'philosophy', to: 'underworld', name: 'trismegistus' },
];

/** Section whose own progress drives an intra-section morph. */
const SELF_MORPHS: Partial<Record<SectionId, string>> = {
  philosophy: 'atlas-columbia',
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Cumulative reveal offset (seconds) for the nth copy child, following the
 * 2+2+3 septuple grouping: successive gaps are 2, 2, 3 sixteenths (repeating)
 * instead of a uniform stagger, so reveals land like a bar of 7/8.
 */
function meterOffset(index: number): number {
  const pattern = meter.septuple; // [2, 2, 3]
  let t = 0;
  for (let i = 0; i < index; i++) t += pattern[i % pattern.length] * SIXTEENTH;
  return t;
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

let booted = false;

export async function initScroll(): Promise<void> {
  // The site is an MPA, so each navigation re-evaluates modules — but guard
  // against double-boot anyway (astro:page-load replays, HMR, manual calls).
  if (booted || typeof window === 'undefined') return;
  booted = true;

  gsap.registerPlugin(ScrollTrigger);

  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bgLerp = gsap.utils.interpolate(backgroundFade.from, backgroundFade.to);
  const inkLerp = gsap.utils.interpolate(INK.from, INK.to);
  const inkDimLerp = gsap.utils.interpolate(INK_DIM.from, INK_DIM.to);

  /* ---------------- 1 + 2. Global fade & iw:scroll stream ---------------- */

  let maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
  const remeasure = () => {
    maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
  };
  window.addEventListener('resize', remeasure);
  // Fires after fonts/images/layout shifts too — keeps maxScroll honest.
  ScrollTrigger.addEventListener('refresh', remeasure);

  const applyFade = (p: number) => {
    body.style.backgroundColor = bgLerp(p);
    root.style.setProperty('--scroll-progress', String(p));
    const inkT = smoothstep(INK_CROSS.start, INK_CROSS.end, p);
    root.style.setProperty('--ink', inkLerp(inkT));
    root.style.setProperty('--ink-dim', inkDimLerp(inkT));
  };

  let lastY = window.scrollY;
  let lastProgress = -1;
  let velocity = 0; // smoothed, px/s, +down

  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.max(deltaMs, 1) / 1000;
    const y = window.scrollY;
    const progress = maxScroll > 0 ? clamp01(y / maxScroll) : 0;

    const instant = (y - lastY) / dt;
    lastY = y;
    // Exponential moving average — settles in ~1/8 s, immune to frame jitter.
    velocity += (instant - velocity) * Math.min(1, dt * 8);
    if (Math.abs(velocity) < 0.5 && instant === 0) velocity = 0;

    const moved = progress !== lastProgress;
    if (moved) {
      lastProgress = progress;
      // Reduced motion still gets the fade — it is position-derived, not
      // animated, so it simply snaps to wherever the user has scrolled.
      applyFade(progress);
    }
    if (moved || velocity !== 0) {
      emit('iw:scroll', { progress, velocity });
    }
  };

  gsap.ticker.add(tick);
  // Paint the initial state immediately (deep links / restored scroll).
  applyFade(maxScroll > 0 ? clamp01(window.scrollY / maxScroll) : 0);
  emit('iw:scroll', { progress: lastProgress < 0 ? 0 : lastProgress, velocity: 0 });

  /* ---------------- Section-driven choreography ---------------- */

  const sectionEls = Array.from(
    document.querySelectorAll<HTMLElement>('.section[data-section]'),
  );
  const byId = new Map(sectionEls.map((el) => [el.dataset.section as SectionId, el]));

  // Seed --active-accent with a concrete color so gsap has an interpolation
  // origin (the stylesheet default is fine for pre-hydration paint only).
  const firstId = sectionEls[0]?.dataset.section as SectionId | undefined;
  gsap.set(root, { '--active-accent': accents[firstId ?? 'hero'] ?? accents.hero });

  const setAccent = (color: string) => {
    if (reduced) {
      gsap.set(root, { '--active-accent': color });
    } else {
      gsap.to(root, {
        '--active-accent': color,
        duration: BEAT * 2, // two beats ≈ 1.43 s — unhurried, musical
        ease: 'sine.inOut',
        overwrite: 'auto',
      });
    }
  };

  for (const el of sectionEls) {
    const id = el.dataset.section as SectionId;
    const selfMorph = SELF_MORPHS[id];

    // 3. Enter/leave + continuous local progress across the section's full
    // scroll span: top edge meeting viewport bottom → bottom edge meeting
    // viewport top. Events fire under reduced motion too.
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onEnter: () => emit('iw:section-enter', { id }),
      onEnterBack: () => emit('iw:section-enter', { id }),
      onLeave: () => emit('iw:section-leave', { id }),
      onLeaveBack: () => emit('iw:section-leave', { id }),
      onUpdate: (self) => {
        emit('iw:section-progress', { id, progress: self.progress });
        // 4b. Intra-section morph rides the section's own progress.
        if (selfMorph) emit('iw:morph', { name: selfMorph, progress: self.progress });
      },
    });

    // 6. Accent handoff — a section is "active" while it straddles the
    // viewport centerline.
    if (accents[id]) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: (self) => {
          if (self.isActive) setAccent(accents[id]);
        },
      });
    }

    // 5. Copy reveal staggered to the 7/8 meter.
    const copy = el.querySelector<HTMLElement>('.copy');
    const children = copy ? (Array.from(copy.children) as HTMLElement[]) : [];
    if (copy && children.length && !reduced) {
      copy.classList.add('iw-revealing');
      gsap.set(children, { autoAlpha: 0, y: 28 });
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top 62%', once: true },
        onComplete: () => copy.classList.remove('iw-revealing'),
      });
      children.forEach((child, i) => {
        tl.to(
          child,
          { autoAlpha: 1, y: 0, duration: BEAT, ease: 'power2.out' },
          meterOffset(i), // gaps of 2, 2, 3 sixteenths — a bar of 7/8
        );
      });
    }
  }

  // 4a. Pair morphs through the transition zone between adjacent sections:
  // viewport centerline traveling from the 60% line of `from` to the 40%
  // line of `to` drives progress 0→1. Edge callbacks pin the boundary
  // values so the shader always settles exactly resolved.
  for (const { from, to, name } of PAIR_MORPHS) {
    const fromEl = byId.get(from);
    const toEl = byId.get(to);
    if (!fromEl || !toEl) continue;
    ScrollTrigger.create({
      trigger: fromEl,
      start: '60% 50%',
      endTrigger: toEl,
      end: '40% 50%',
      onUpdate: (self) => emit('iw:morph', { name, progress: self.progress }),
      onLeave: () => emit('iw:morph', { name, progress: 1 }),
      onLeaveBack: () => emit('iw:morph', { name, progress: 0 }),
    });
  }
}
