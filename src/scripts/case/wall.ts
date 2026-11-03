/**
 * The studio wall in Room III: one framed picture under a picture light,
 * and a column of wall labels that choose what hangs there.
 *
 * Choosing a label dims the picture light, dissolves the new picture in
 * over the old one (two image layers, swapped), updates the caption beneath
 * the frame, then brings the light back up. A work with a live scene
 * (src/scripts/case/live/) plays on a canvas over its still, smooth-scaled
 * rather than pixel-crisp so it reads as a moving picture in a frame.
 *
 * Markup contract: [data-wall] wraps everything; .wall-label[data-work]
 * buttons carry the work as data attributes; [data-pic-a] / [data-pic-b] are
 * the two image layers; [data-live-canvas] the scene canvas; the caption
 * fields are [data-cap-*]. One work boots from data-boot.
 */
import type { LiveMount, LiveScene } from './live/types';

const LIVE: Record<string, () => Promise<{ mount: LiveMount }>> = {
  rain: () => import('./live/rain'),
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduced ? 0 : ms));
const BEAT = 714; // one beat at 84 bpm, the site tempo

function init(root: HTMLElement) {
  const labels = Array.from(root.querySelectorAll<HTMLButtonElement>('.wall-label[data-work]'));
  const picA = root.querySelector<HTMLImageElement>('[data-pic-a]')!;
  const picB = root.querySelector<HTMLImageElement>('[data-pic-b]')!;
  const live = root.querySelector<HTMLCanvasElement>('[data-live-canvas]')!;
  const frame = root.querySelector<HTMLElement>('[data-frame]')!;
  const cap = {
    title: root.querySelector<HTMLElement>('[data-cap-title]')!,
    medium: root.querySelector<HTMLElement>('[data-cap-medium]')!,
    text: root.querySelector<HTMLElement>('[data-cap-text]')!,
    link: root.querySelector<HTMLAnchorElement>('[data-cap-link]')!,
    domain: root.querySelector<HTMLElement>('[data-cap-domain]')!,
    code: root.querySelector<HTMLElement>('[data-cap-code]')!,
    body: root.querySelector<HTMLElement>('[data-caption]')!,
  };
  const status = root.querySelector<HTMLElement>('[data-wall-status]');

  let current: string | null = null;
  let front: HTMLImageElement = picA;
  let token = 0;
  let scene: LiveScene | null = null;
  let onScreen = true;

  function preload(src: string) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  function killLive() {
    scene?.destroy();
    scene = null;
    live.classList.remove('is-on');
    live.hidden = true;
  }

  async function hang(label: HTMLButtonElement) {
    const d = label.dataset;
    const slug = d.work!;
    if (slug === current) return;
    const my = ++token;
    current = slug;
    for (const l of labels) l.setAttribute('aria-pressed', l === label ? 'true' : 'false');

    // The light dims, the caption fades.
    frame.classList.add('is-changing');
    cap.body.classList.add('is-changing');
    killLive();
    const liveP = d.live && LIVE[d.live] ? LIVE[d.live]().catch(() => null) : Promise.resolve(null);
    await Promise.all([preload(d.src!), wait(BEAT * 0.6)]);
    if (my !== token) return;

    // The new picture rises through the old one.
    const back = front === picA ? picB : picA;
    back.src = d.src!;
    back.alt = d.alt ?? '';
    back.classList.add('is-front');
    front.classList.remove('is-front');
    front = back;

    cap.title.textContent = d.title ?? '';
    cap.medium.textContent = d.medium ?? '';
    cap.text.textContent = d.caption ?? '';
    cap.link.href = d.href ?? '#';
    const external = (d.href ?? '').startsWith('http');
    cap.link.target = external ? '_blank' : '';
    cap.link.rel = external ? 'noopener' : '';
    cap.domain.textContent = d.domain ?? '';
    cap.code.textContent = d.code ? `Cat. ${d.code}` : '';
    cap.body.classList.remove('is-changing');
    if (status) status.textContent = `${d.title} is on the wall.`;

    await wait(BEAT * 0.8);
    if (my !== token) return;
    frame.classList.remove('is-changing');

    // The moving picture, if this work has one.
    const mod = await liveP;
    if (my !== token || !mod) return;
    live.hidden = false;
    try {
      scene = mod.mount(live, { reduced });
      live.style.imageRendering = 'auto';
      if (!onScreen || document.hidden) scene.pause();
      requestAnimationFrame(() => live.classList.add('is-on'));
    } catch (err) {
      console.error('Live scene failed to mount', err);
      killLive();
    }
  }

  for (const label of labels) {
    label.addEventListener('click', () => {
      if (label.dataset.work === current) return;
      hang(label);
      // On a narrow screen the labels sit under the caption: bring the
      // frame back into view so the change is seen.
      const r = frame.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) {
        root.querySelector('.easel')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  // Idle the scene while the wall is off screen or the tab is hidden.
  const sync = () => {
    if (!scene) return;
    if (onScreen && !document.hidden) scene.resume();
    else scene.pause();
  };
  new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      sync();
    },
    { threshold: 0 },
  ).observe(frame);
  document.addEventListener('visibilitychange', sync);

  // The first work is already on the wall from the server render; if it
  // has a moving picture, that starts once the wall comes into view.
  const bootSlug = root.dataset.boot ?? labels[0]?.dataset.work;
  const boot = labels.find((l) => l.dataset.work === bootSlug) ?? labels[0];
  if (boot) {
    current = boot.dataset.work ?? null;
    const liveName = boot.dataset.live;
    if (liveName && LIVE[liveName]) {
      const my = token;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          LIVE[liveName]()
            .then((mod) => {
              if (my !== token) return;
              live.hidden = false;
              scene = mod.mount(live, { reduced });
              live.style.imageRendering = 'auto';
              requestAnimationFrame(() => live.classList.add('is-on'));
            })
            .catch(() => killLive());
        },
        { threshold: 0.2 },
      );
      io.observe(frame);
    }
  }
}

document.querySelectorAll<HTMLElement>('[data-wall]').forEach(init);
