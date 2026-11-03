/**
 * THE UNSEEN ONE: the two Canvas 2D drawings, lifted from the prototype.
 *
 *   narcissus  Nine six-tepal flowers on a hillside below the title, the
 *              same hillside every visit (seeded), fading to near-nothing
 *              as the viewer scrolls the first viewport.
 *   hall       The hall of asphodel: perspective floor lines to a vanishing
 *              point at 42% height, a river band at 86% with a hairline of
 *              light and a pressed flower on the near bank, about 900 pale
 *              heads denser and smaller toward the far end with the aisle
 *              kept clearer, two converging walls of darkness, and a throne
 *              in silhouette facing the door with a light behind it that
 *              comes from nothing. In the seat, a black slit with one lit
 *              edge. The nearer heads breathe; the frame is rebuilt every
 *              ~420 frames so the restamped alpha never piles up.
 *
 * Zero runtime deps. Classical register only: the flower is the narcissus
 * of the Hymn to Demeter, the field is Homer's asphodel meadow.
 */

/** mulberry32: a tiny seeded PRNG, so the hillside and the hall are fixed. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NARCISSUS_W = 800;
const NARCISSUS_H = 150;

interface Flower {
  x: number;
  h: number;
  lean: number;
  r: number;
  ph: number;
}

export interface Narcissus {
  canvas: HTMLCanvasElement;
  /** 0 = full, 1 = pressed to near-nothing. */
  setFade(fade: number): void;
}

export function mountNarcissus(host: HTMLElement): Narcissus | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'narcissus';
  canvas.width = NARCISSUS_W;
  canvas.height = NARCISSUS_H;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Narcissus on a hillside, pale, bending');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  host.appendChild(canvas);

  const rnd = mulberry(7);
  const flowers: Flower[] = [];
  for (let i = 0; i < 9; i++) {
    flowers.push({
      x: 60 + i * 82 + rnd() * 30,
      h: 60 + rnd() * 50,
      lean: (rnd() - 0.5) * 0.5,
      r: 8 + rnd() * 5,
      ph: rnd() * 6.28,
    });
  }

  let last = -1;
  const draw = (fade: number) => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const alpha = 1 - fade * 0.92;
    for (const f of flowers) {
      const tipx = f.x + Math.sin(f.lean) * f.h;
      const tipy = h - f.h;
      ctx.strokeStyle = `rgba(120,130,90,${alpha * 0.8})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(f.x, h);
      ctx.quadraticCurveTo(f.x, h - f.h * 0.6, tipx, tipy);
      ctx.stroke();
      // Six tepals.
      for (let k = 0; k < 6; k++) {
        const a = f.ph + (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.ellipse(tipx + Math.cos(a) * f.r * 0.9, tipy + Math.sin(a) * f.r * 0.9, f.r * 0.55, f.r * 0.3, a, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,220,156,${alpha * 0.75})`;
        ctx.fill();
      }
      // Corona.
      ctx.beginPath();
      ctx.arc(tipx, tipy, f.r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(214,170,70,${alpha * 0.9})`;
      ctx.fill();
    }
  };
  draw(0);

  return {
    canvas,
    setFade(fade) {
      const f = Math.max(0, Math.min(1, fade));
      const q = Math.round(f * 100) / 100;
      if (q === last) return;
      last = q;
      draw(q);
    },
  };
}

const HALL_W = 800;
const HALL_H = 1000;
const HALL_REBUILD_FRAMES = 420;

interface Head {
  x: number;
  y: number;
  s: number;
  a: number;
  ph: number;
}

export interface Hall {
  canvas: HTMLCanvasElement;
  /** Draw the hall and start the breathing. Safe to call once. */
  start(): void;
  stop(): void;
}

export function mountHall(host: HTMLElement, reduced: boolean): Hall | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'hall';
  canvas.width = HALL_W;
  canvas.height = HALL_H;
  const label = host.getAttribute('aria-label');
  if (label) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label);
    host.removeAttribute('aria-label');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  host.appendChild(canvas);

  const w = canvas.width;
  const h = canvas.height;
  const vx = w / 2;
  const vy = h * 0.42; // vanishing point: the throne
  let heads: Head[] = [];
  let frames = 0;
  let raf = 0;
  let running = false;
  let visible = true;

  function drawHall() {
    const rnd = mulberry(23);
    ctx!.fillStyle = '#000';
    ctx!.fillRect(0, 0, w, h);

    // Floor plane: faint perspective lines.
    ctx!.strokeStyle = 'rgba(185,180,166,.05)';
    ctx!.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx!.beginPath();
      ctx!.moveTo(vx + i * w * 0.19, h);
      ctx!.lineTo(vx, vy);
      ctx!.stroke();
    }

    // The river at the entrance: a dark band with a hairline of light.
    const ry = h * 0.86;
    const grad = ctx!.createLinearGradient(0, ry - 40, 0, ry + 60);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(20,22,30,.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx!.fillStyle = grad;
    ctx!.fillRect(0, ry - 40, w, 100);
    ctx!.strokeStyle = 'rgba(185,180,166,.12)';
    ctx!.beginPath();
    ctx!.moveTo(0, ry + 2);
    ctx!.lineTo(w, ry + 2);
    ctx!.stroke();

    // A pressed flower set down at the bank, unable to float.
    ctx!.fillStyle = 'rgba(232,220,156,.35)';
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ctx!.beginPath();
      ctx!.ellipse(w * 0.3 + Math.cos(a) * 5, ry + 18 + Math.sin(a) * 3, 4, 1.6, a, 0, Math.PI * 2);
      ctx!.fill();
    }

    // Asphodel: pale heads, denser and smaller toward the throne.
    heads = [];
    for (let n = 0; n < 900; n++) {
      const t = Math.pow(rnd(), 0.6); // depth 0 near, 1 far
      const yy = ry - 30 - t * (ry - 30 - vy - 6);
      const spread = (1 - t) * w * 0.62 + 14;
      const xx = vx + (rnd() - 0.5) * spread * 2 * (0.55 + 0.45 * rnd());
      // Keep the aisle clearer.
      if (Math.abs(xx - vx) < (1 - t) * w * 0.09 + 6 && t > 0.08 && rnd() > 0.35) continue;
      heads.push({ x: xx, y: yy, s: (1 - t) * 2.4 + 0.4, a: 0.12 + (1 - t) * 0.5 + rnd() * 0.15, ph: rnd() * 6.28 });
    }

    // Walls: two dim columns of darkness converging.
    const wall = ctx!.createLinearGradient(0, 0, w, 0);
    wall.addColorStop(0, 'rgba(0,0,0,.85)');
    wall.addColorStop(0.18, 'rgba(0,0,0,0)');
    wall.addColorStop(0.82, 'rgba(0,0,0,0)');
    wall.addColorStop(1, 'rgba(0,0,0,.85)');
    ctx!.fillStyle = wall;
    ctx!.fillRect(0, 0, w, h);

    paintHeads(0);
    drawThrone();
  }

  function paintHeads(time: number) {
    for (const p of heads) {
      const fl = 0.85 + 0.15 * Math.sin(time * 0.0012 + p.ph);
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(185,180,166,${p.a * fl})`;
      ctx!.fill();
      if (p.s > 1.6) {
        ctx!.beginPath();
        ctx!.moveTo(p.x, p.y + p.s);
        ctx!.lineTo(p.x, p.y + p.s * 4);
        ctx!.strokeStyle = `rgba(120,118,105,${p.a * 0.5})`;
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
      }
    }
  }

  function drawThrone() {
    // A light that comes from nothing, behind the seat.
    const g = ctx!.createRadialGradient(vx, vy - 10, 0, vx, vy - 10, 170);
    g.addColorStop(0, 'rgba(217,210,199,.16)');
    g.addColorStop(0.35, 'rgba(217,210,199,.05)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx!.fillStyle = g;
    ctx!.fillRect(vx - 200, vy - 200, 400, 400);

    // The throne: tall back, seat, two arms, in silhouette.
    ctx!.fillStyle = '#000';
    ctx!.strokeStyle = 'rgba(217,210,199,.55)';
    ctx!.lineWidth = 1.2;
    const bw = 34;
    const bh = 74;
    const sw = 46;
    const sh = 14;
    ctx!.beginPath();
    ctx!.moveTo(vx - bw / 2, vy + 6);
    ctx!.lineTo(vx - bw / 2, vy - bh);
    ctx!.lineTo(vx + bw / 2, vy - bh);
    ctx!.lineTo(vx + bw / 2, vy + 6);
    ctx!.closePath();
    ctx!.fill();
    ctx!.stroke();
    ctx!.beginPath();
    ctx!.rect(vx - sw / 2, vy + 6, sw, sh);
    ctx!.fill();
    ctx!.stroke();
    ctx!.beginPath();
    ctx!.moveTo(vx - sw / 2, vy + 20);
    ctx!.lineTo(vx - sw / 2, vy + 42);
    ctx!.moveTo(vx + sw / 2, vy + 20);
    ctx!.lineTo(vx + sw / 2, vy + 42);
    ctx!.stroke();

    // The mirror in the seat: a slit of pure black with one edge of light.
    ctx!.fillStyle = '#000';
    ctx!.fillRect(vx - sw / 2 + 6, vy + 9, sw - 12, sh - 6);
    ctx!.strokeStyle = 'rgba(217,210,199,.9)';
    ctx!.beginPath();
    ctx!.moveTo(vx - sw / 2 + 6, vy + 9);
    ctx!.lineTo(vx + sw / 2 - 6, vy + 9);
    ctx!.stroke();
    // The crown that nobody gave: nothing. A gap above the back.
  }

  function flicker(t: number) {
    if (!running) return;
    raf = requestAnimationFrame(flicker);
    if (!visible) return;
    // Restamp the nearer heads faintly so they breathe; rebuild the frame
    // periodically so the alpha never piles up.
    frames++;
    for (const p of heads) {
      if (p.s < 1.2) continue;
      const fl = 0.5 + 0.5 * Math.sin(t * 0.0009 + p.ph);
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(185,180,166,${0.03 * fl})`;
      ctx!.fill();
    }
    if (frames >= HALL_REBUILD_FRAMES) {
      frames = 0;
      drawHall();
    }
  }

  // Breathe only while the hall is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
    }).observe(canvas);
  }

  return {
    canvas,
    start() {
      if (running) return;
      drawHall();
      if (reduced) return;
      running = true;
      raf = requestAnimationFrame(flicker);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
