/**
 * Live scene: greasyporcupines.com — cars in the rain.
 *
 * A mountain two-lane at night in the White Mountains: headlights come
 * through the rain, taillights smear on the wet asphalt, spray kicks off the
 * rear wheels, and every so often lightning lights the ridge. Rendered at
 * 320x200 and upscaled with crisp pixels so it reads like a title screen on
 * the console. Canvas 2D, no dependencies.
 *
 * Under reduced motion it paints one frame: two cars, rain standing still.
 */
import type { LiveMount } from "./types";

const W = 320;
const H = 200;
const HORIZON = 70;
const ROAD_TOP = 94;
// The console's title card covers the bottom third of the screen, so the
// traffic runs in the upper half and only the reflections smear down under it.
const LANES = [
  // Far lane: right → left, smaller.
  { y: 112, dir: -1 as const, scale: 0.74, speed: [38, 52] as const },
  // Near lane: left → right.
  { y: 142, dir: 1 as const, scale: 1.05, speed: [56, 78] as const },
];

interface Car {
  x: number;
  lane: 0 | 1;
  speed: number;
  len: number;
  h: number;
  cab: number;
  pickup: boolean;
  body: string;
  wipe: number;
}
interface Drop { x: number; y: number; len: number; spd: number; a: number }
interface Spray { x: number; y: number; vx: number; vy: number; life: number }

const BODIES = ["#1b2330", "#22202a", "#1e2a2c", "#2a2426", "#1a1f28"];

/** Deterministic hash for the static scenery. */
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const mount: LiveMount = (canvas, { reduced }) => {
  canvas.width = W;
  canvas.height = H;
  canvas.style.imageRendering = "pixelated";
  const ctx = canvas.getContext("2d", { alpha: false })!;

  // ---- Static scenery, built once -------------------------------------
  const ridge: number[] = [];
  for (let x = 0; x <= W; x += 8) {
    const t = x / W;
    ridge.push(HORIZON - 26 - 18 * Math.sin(t * 4.1 + 0.6) - 9 * Math.sin(t * 11.3 + 2.0) - 4 * hash(x));
  }
  const pines: { x: number; h: number; w: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const x = (i / 46) * W + hash(i) * 10 - 5;
    pines.push({ x, h: 16 + hash(i + 50) * 22, w: 5 + hash(i + 90) * 5 });
  }
  const drops: Drop[] = [];
  for (let i = 0; i < 170; i++) {
    drops.push({ x: Math.random() * (W + 60) - 30, y: Math.random() * H, len: 7 + Math.random() * 9, spd: 230 + Math.random() * 120, a: 0.18 + Math.random() * 0.3 });
  }

  // ---- Dynamic state -----------------------------------------------------
  const cars: Car[] = [];
  const spray: Spray[] = [];
  let spawnIn = 0.4;
  let flash = 0;
  let nextFlash = 7 + Math.random() * 9;
  let time = 0;

  function spawn(lane?: 0 | 1, x?: number) {
    const li = lane ?? (Math.random() < 0.55 ? 1 : 0);
    const L = LANES[li];
    const pickup = Math.random() < 0.4;
    const len = Math.round((pickup ? 48 : 40) * L.scale);
    const h = Math.round((pickup ? 15 : 13) * L.scale);
    const start = x ?? (L.dir === 1 ? -len - 90 : W + 90);
    cars.push({
      x: start,
      lane: li,
      speed: L.speed[0] + Math.random() * (L.speed[1] - L.speed[0]),
      len,
      h,
      cab: Math.round(len * (pickup ? 0.34 : 0.5)),
      pickup,
      body: BODIES[Math.floor(Math.random() * BODIES.length)],
      wipe: Math.random() * Math.PI * 2,
    });
  }

  function update(dt: number) {
    time += dt;
    // Traffic.
    spawnIn -= dt;
    if (spawnIn <= 0 && cars.length < 3) {
      spawn();
      spawnIn = 2.2 + Math.random() * 3.2;
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      const L = LANES[c.lane];
      c.x += L.dir * c.speed * dt;
      c.wipe += dt * 5;
      // Spray off the rear wheels.
      if (Math.random() < 0.7) {
        const rear = L.dir === 1 ? c.x + 4 : c.x + c.len - 4;
        spray.push({ x: rear, y: L.y + 1, vx: -L.dir * (10 + Math.random() * 25), vy: -(10 + Math.random() * 22), life: 0.35 + Math.random() * 0.25 });
      }
      if (c.x > W + 100 || c.x + c.len < -100) cars.splice(i, 1);
    }
    for (let i = spray.length - 1; i >= 0; i--) {
      const s = spray[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 90 * dt;
      s.life -= dt;
      if (s.life <= 0) spray.splice(i, 1);
    }
    // Rain, blown from the right.
    for (const d of drops) {
      d.y += d.spd * dt;
      d.x -= d.spd * 0.32 * dt;
      if (d.y > H + 10) { d.y = -12; d.x = Math.random() * (W + 80) - 20; }
      if (d.x < -40) d.x += W + 80;
    }
    // Lightning.
    nextFlash -= dt;
    if (nextFlash <= 0) {
      flash = 1;
      nextFlash = 8 + Math.random() * 14;
    }
    flash = Math.max(0, flash - dt * (flash > 0.5 ? 2.6 : 5));
  }

  function drawScenery(f: number) {
    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, `rgb(${5 + f * 70},${7 + f * 80},${12 + f * 110})`);
    sky.addColorStop(1, `rgb(${14 + f * 90},${20 + f * 100},${34 + f * 120})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 8);
    // Low cloud bank.
    ctx.fillStyle = `rgba(${30 + f * 120},${36 + f * 130},${52 + f * 150},0.55)`;
    for (let i = 0; i < 7; i++) {
      const cx = (i / 6) * W + Math.sin(time * 0.05 + i) * 10;
      ctx.beginPath();
      ctx.ellipse(cx, 22 + hash(i + 7) * 20, 60 + hash(i) * 40, 12 + hash(i + 3) * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Ridge.
    ctx.fillStyle = `rgb(${8 + f * 30},${10 + f * 34},${16 + f * 44})`;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON + 8);
    ridge.forEach((y, i) => ctx.lineTo(i * 8, y));
    ctx.lineTo(W, HORIZON + 8);
    ctx.closePath();
    ctx.fill();
    // Pines along the horizon.
    ctx.fillStyle = `rgb(${5 + f * 18},${7 + f * 22},${10 + f * 26})`;
    for (const p of pines) {
      ctx.beginPath();
      ctx.moveTo(p.x, HORIZON + 6 - p.h);
      ctx.lineTo(p.x + p.w, HORIZON + 8);
      ctx.lineTo(p.x - p.w, HORIZON + 8);
      ctx.closePath();
      ctx.fill();
    }
    // Shoulder and road.
    ctx.fillStyle = "#0b0e12";
    ctx.fillRect(0, HORIZON + 6, W, ROAD_TOP - HORIZON);
    const road = ctx.createLinearGradient(0, ROAD_TOP, 0, H);
    road.addColorStop(0, "#0d1014");
    road.addColorStop(1, "#141a20");
    ctx.fillStyle = road;
    ctx.fillRect(0, ROAD_TOP, W, H - ROAD_TOP);
    // Edge line and centre dashes.
    ctx.fillStyle = "rgba(230,230,220,0.16)";
    ctx.fillRect(0, ROAD_TOP + 2, W, 1);
    ctx.fillStyle = "rgba(242,183,46,0.22)";
    for (let x = 0; x < W; x += 28) ctx.fillRect(x, 127, 14, 2);
    // One porch light far off on the ridge road: a reason to keep driving.
    ctx.fillStyle = "rgba(255,215,102,0.9)";
    ctx.fillRect(246, HORIZON - 9, 2, 2);
  }

  function drawReflections() {
    // Lights mirrored on the wet road, smeared downward and shimmering.
    ctx.globalCompositeOperation = "lighter";
    for (const c of cars) {
      const L = LANES[c.lane];
      const y0 = L.y + 2;
      const front = L.dir === 1 ? c.x + c.len : c.x;
      const back = L.dir === 1 ? c.x : c.x + c.len;
      const jit = () => (Math.random() - 0.5) * 2;
      const strip = (x: number, color: string, w: number, h: number, a: number) => {
        const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, color.replace("A", String(a)));
        g.addColorStop(1, color.replace("A", "0"));
        ctx.fillStyle = g;
        ctx.fillRect(x - w / 2 + jit(), y0, w, h);
      };
      strip(front, "rgba(255,243,214,A)", 4 * L.scale, 40 * L.scale, 0.55);
      strip(front - L.dir * 3, "rgba(255,243,214,A)", 8 * L.scale, 20 * L.scale, 0.2);
      strip(back, "rgba(255,42,26,A)", 4 * L.scale, 34 * L.scale, 0.5);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawCar(c: Car) {
    const L = LANES[c.lane];
    const s = L.scale;
    const y = L.y;
    const x = c.x;
    const d = L.dir;
    // Body.
    ctx.fillStyle = c.body;
    ctx.fillRect(x, y - c.h, c.len, c.h);
    // Cabin: cars have a centred cab, pickups a short one over the front.
    const cabX = c.pickup ? (d === 1 ? x + c.len - c.cab - 6 * s : x + 6 * s) : x + (c.len - c.cab) / 2;
    const cabH = Math.round(8 * s);
    ctx.fillRect(cabX + 2, y - c.h - cabH, c.cab - 4, cabH + 1);
    // Windows, lit faintly from the dash.
    ctx.fillStyle = "rgba(120,150,170,0.28)";
    ctx.fillRect(cabX + 4, y - c.h - cabH + 2, c.cab - 8, cabH - 3);
    // Wipers: a dim arc swinging across the windshield.
    const wx = d === 1 ? cabX + c.cab - 5 : cabX + 5;
    ctx.strokeStyle = "rgba(200,220,235,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ang = Math.sin(c.wipe) * 0.8 - Math.PI / 2;
    ctx.moveTo(wx, y - c.h - 1);
    ctx.lineTo(wx + Math.cos(ang) * 6 * s, y - c.h - 1 + Math.sin(ang) * 6 * s);
    ctx.stroke();
    // Wheels.
    ctx.fillStyle = "#06070a";
    const r = Math.round(3.5 * s);
    ctx.beginPath();
    ctx.arc(x + 8 * s, y, r, 0, Math.PI * 2);
    ctx.arc(x + c.len - 8 * s, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Lights.
    const front = d === 1 ? x + c.len : x;
    const back = d === 1 ? x : x + c.len;
    const ly = y - c.h + 3 * s;
    ctx.globalCompositeOperation = "lighter";
    // Taillights.
    ctx.fillStyle = "rgba(255,42,26,0.95)";
    ctx.fillRect(back - (d === 1 ? 0 : 2), ly, 2, 2);
    glow(back, ly + 1, 7 * s, "255,42,26", 0.45);
    // Headlights and the cone through the rain.
    ctx.fillStyle = "rgba(255,246,225,1)";
    ctx.fillRect(front - (d === 1 ? 2 : 0), ly, 2, 2);
    glow(front, ly + 1, 9 * s, "255,243,214", 0.7);
    const reach = 95 * s;
    const g = ctx.createLinearGradient(front, ly, front + d * reach, ly);
    g.addColorStop(0, "rgba(255,240,205,0.32)");
    g.addColorStop(1, "rgba(255,240,205,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(front, ly - 1);
    ctx.lineTo(front + d * reach, ly - 16 * s);
    ctx.lineTo(front + d * reach, ly + 14 * s);
    ctx.lineTo(front, ly + 3);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function glow(x: number, y: number, r: number, rgb: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawRain(f: number) {
    ctx.strokeStyle = `rgba(190,210,235,${0.9})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.32, d.y - d.len);
    }
    ctx.globalAlpha = 0.28 + f * 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Spray.
    ctx.fillStyle = "rgba(170,190,210,0.5)";
    for (const s of spray) ctx.fillRect(s.x, s.y, 1, 1);
  }

  function render() {
    const f = flash * flash;
    ctx.globalCompositeOperation = "source-over";
    drawScenery(f);
    drawReflections();
    for (const c of cars) drawCar(c);
    drawRain(f);
    if (f > 0.01) {
      ctx.fillStyle = `rgba(200,215,255,${0.22 * f})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Wet-glass vignette.
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // Warm start so the first frame already has traffic.
  spawn(1, 60);
  spawn(0, 190);
  for (let i = 0; i < 20; i++) update(1 / 30);

  let raf = 0;
  let last = 0;
  let running = false;
  const frame = (t: number) => {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 1 / 60);
    last = t;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  };
  const resume = () => {
    if (reduced) { render(); return; }
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  render();
  resume();

  return { pause, resume, destroy: pause };
};
