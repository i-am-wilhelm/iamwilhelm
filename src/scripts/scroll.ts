/**
 * Scroll choreography (spec §2.2, §2.4), the layout-and-scroll workstream.
 *
 * Owns, for every page:
 *   1. the imperceptible global black→white background fade (+ ink crossfade
 *      and the --scroll-progress CSS var), tied to total document progress;
 *   2. the 'iw:scroll' event stream {progress, velocity} (velocity smoothed,
 *      px/s, signed, positive scrolling down);
 * and, on pages that have `.section[data-section]` markup (the homepage):
 *   3. per-section 'iw:section-enter' / 'iw:section-leave' /
 *      'iw:section-progress' events;
 *   4. morph drives ('iw:morph') through the transition zones between
 *      adjacent sections, plus 'atlas-columbia' inside philosophy;
 *   5. copy reveals staggered to the site's 7/8 (2+2+3) meter;
 *   6. the --active-accent CSS var tweened to the dominant section's accent.
 *
 * Communication with other subsystems happens ONLY via the events in
 * ./events, the shader core renders the morphs; we merely drive progress.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  accentFor,
  accents,
  fadeModes,
  meter,
  type FadeMode,
  type SectionId,
} from '../design/tokens';
import { emit, on } from './events';
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
const INK_CROSS = { start: 0.5, end: 0.68 } as const;

/** One beat at the site tempo (84 bpm) in seconds ≈ 0.714 s. */
const BEAT = 60 / meter.bpm;
/** Sixteenth-note at 84 bpm ≈ 0.179 s, base unit for reveal staggers. */
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
  // The site is an MPA, so each navigation re-evaluates modules, but guard
  // against double-boot anyway (astro:page-load replays, HMR, manual calls).
  if (booted || typeof window === 'undefined') return;
  booted = true;

  gsap.registerPlugin(ScrollTrigger);

  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Per-page fade mode (tokens.fadeModes), from <html data-fade>. The dawn
  // fade is the site default; a descent page runs dark-first and keeps its
  // ink light the whole way down.
  const fadeMode: FadeMode = root.dataset.fade === 'descent' ? 'descent' : 'dawn';
  const bgLerp = gsap.utils.interpolate(fadeModes.dawn.from, fadeModes.dawn.to);
  const descent = fadeModes.descent;
  const toFloor = gsap.utils.interpolate(descent.from, descent.floor);
  const toBack = gsap.utils.interpolate(descent.floor, descent.back);
  const inkLerp = gsap.utils.interpolate(INK.from, INK.to);
  const inkDimLerp = gsap.utils.interpolate(INK_DIM.from, INK_DIM.to);

  /* ---------------- 1 + 2. Global fade & iw:scroll stream ---------------- */

  let maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
  const remeasure = () => {
    maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
  };
  window.addEventListener('resize', remeasure);
  // Fires after fonts/images/layout shifts too, keeps maxScroll honest.
  ScrollTrigger.addEventListener('refresh', remeasure);

  /**
   * Descent fade: the viewport centreline walks from the page top to the
   * top of [data-fade-floor] (from → floor), holds at the floor until it
   * passes the top of [data-fade-lift], then lifts to `back` over a
   * viewport and a half. Without markers, the floor is the page bottom.
   */
  const descentColor = (): string => {
    const y = window.scrollY + window.innerHeight * 0.5;
    // A marker still gated shut (hidden) has no geometry; until it shows,
    // the floor is the page bottom, as in the prototype before Elysium.
    const shown = (sel: string) => {
      const el = document.querySelector<HTMLElement>(sel);
      return el && !el.hidden && el.getClientRects().length > 0 ? el : null;
    };
    const floorEl = shown('[data-fade-floor]');
    const liftEl = shown('[data-fade-lift]');
    const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;
    if (!floorEl) {
      const p = maxScroll > 0 ? clamp01(window.scrollY / maxScroll) : 0;
      return toFloor(clamp01(p * 1.1));
    }
    const floorAt = Math.max(1, top(floorEl));
    if (y < floorAt) return toFloor(clamp01(y / floorAt));
    if (!liftEl) return descent.floor;
    const liftAt = top(liftEl);
    if (y < liftAt) return descent.floor;
    return toBack(clamp01((y - liftAt) / (window.innerHeight * 1.5)));
  };

  const applyFade = (p: number) => {
    const bg = fadeMode === 'descent' ? descentColor() : bgLerp(p);
    body.style.backgroundColor = bg;
    // Mirrored as a custom property so the copy scrim (global.css) can
    // tint itself to the live background instead of a fixed colour.
    root.style.setProperty('--bg-current', bg);
    root.style.setProperty('--scroll-progress', String(p));
    // Ink crossover only on the dawn fade: a descent page never brightens.
    const inkT = fadeMode === 'descent' ? 0 : smoothstep(INK_CROSS.start, INK_CROSS.end, p);
    root.style.setProperty('--ink', inkLerp(inkT));
    root.style.setProperty('--ink-dim', inkDimLerp(inkT));
  };

  let lastY = window.scrollY;
  let lastFadeY = -1;
  let lastProgress = -1;
  let velocity = 0; // smoothed, px/s, +down

  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.max(deltaMs, 1) / 1000;
    const y = window.scrollY;
    const progress = maxScroll > 0 ? clamp01(y / maxScroll) : 0;

    const instant = (y - lastY) / dt;
    lastY = y;
    // Exponential moving average, settles in ~1/8 s, immune to frame jitter.
    velocity += (instant - velocity) * Math.min(1, dt * 8);
    if (Math.abs(velocity) < 0.5 && instant === 0) velocity = 0;

    // The descent fade is position-derived from live layout, not from page
    // progress alone, so it repaints whenever the page has moved at all.
    const moved = progress !== lastProgress || (fadeMode === 'descent' && y !== lastFadeY);
    lastFadeY = y;
    if (moved) {
      lastProgress = progress;
      // Reduced motion still gets the fade, it is position-derived, not
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

  // Gated reveals: a page that shows sections under script (The Unseen One)
  // reports the height change, and every trigger re-measures.
  on('iw:layout', () => {
    remeasure();
    ScrollTrigger.refresh();
  });

  // Seed --active-accent with a concrete color so gsap has an interpolation
  // origin (the stylesheet default is fine for pre-hydration paint only).
  const firstId = sectionEls[0]?.dataset.section;
  gsap.set(root, { '--active-accent': (firstId && accentFor(firstId)) || accents.hero });

  const setAccent = (color: string) => {
    if (reduced) {
      gsap.set(root, { '--active-accent': color });
    } else {
      gsap.to(root, {
        '--active-accent': color,
        duration: BEAT * 2, // two beats ≈ 1.43 s, unhurried, musical
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

    // 6. Accent handoff, a section is "active" while it straddles the
    // viewport centerline. Aliased ids (unseen-*, pharmakon-*) resolve too.
    const accent = accentFor(id);
    if (accent) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: (self) => {
          if (self.isActive) setAccent(accent);
        },
      });
    }

    // 5. Copy reveal staggered to the 7/8 meter. A section whose island
    // reveals its own copy (data-copy-reveal="manual") is left alone.
    const copy = el.querySelector<HTMLElement>('.copy');
    const children = copy ? (Array.from(copy.children) as HTMLElement[]) : [];
    const manual = el.dataset.copyReveal === 'manual';
    if (copy && children.length && !reduced && !manual) {
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
          meterOffset(i), // gaps of 2, 2, 3 sixteenths, a bar of 7/8
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
