/**
 * The Great Fade — nigredo → albedo.
 *
 * The page opens pure black and eases toward white across the full
 * homepage scroll, so gradually it barely registers. The curve is
 * weighted to stay dark long into the scroll (t^2.6); ink crosses over
 * smoothly past the midpoint. Scroll-driven, so it also holds under
 * prefers-reduced-motion — position, not animation, moves it.
 */

const VOID: [number, number, number] = [5, 5, 5]; // --void
const PAPER: [number, number, number] = [244, 242, 238]; // --paper
const INK_LIGHT: [number, number, number] = [232, 230, 225];
const INK_DARK: [number, number, number] = [24, 23, 21];

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function initGreatFade(): void {
  const root = document.documentElement;
  let raf = 0;

  const apply = () => {
    raf = 0;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const t = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    const fade = Math.pow(t, 2.6); // stays dark long into the scroll

    const inkT = smoothstep(0.45, 0.62, fade); // the crossover
    root.style.setProperty('--fade', fade.toFixed(4));
    root.style.setProperty('--bg', mix(VOID, PAPER, fade));
    root.style.setProperty('--ink', mix(INK_LIGHT, INK_DARK, inkT));
    root.style.setProperty(
      '--ink-dim',
      inkT < 0.5 ? 'rgba(232, 230, 225, 0.55)' : 'rgba(24, 23, 21, 0.55)'
    );
    root.dataset.phase = inkT < 0.5 ? 'nigredo' : 'albedo';
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  apply();
}
