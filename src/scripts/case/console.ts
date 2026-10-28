/**
 * The display case's console-and-cartridge portfolio, ported from
 * advancing-liberty-media2 (src/scripts/console.ts) with its behaviour
 * intact: click a cartridge and it slots into the deck, the CRT flickers on,
 * a one-beat boot logo plays, then the project's hero screenshot resolves
 * from heavy pixelation toward clarity. Cartridges with `data-live` then play
 * a live scene (src/scripts/case/live/) over the still.
 *
 * Changes from the source: the Saturn Easter egg and its secret cartridge
 * are gone (the secret was this very site), and the module is imported
 * lazily by Console.astro once the case nears the viewport.
 *
 * Markup contract: [data-console] (Console.astro), .cart[data-cart]
 * buttons (Cartridge.astro).
 */
import type { LiveMount, LiveScene } from "./live/types";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduced ? 0 : ms));

/** Live scenes, by the `live` name in work.ts. Each is its own chunk. */
const LIVE: Record<string, () => Promise<{ mount: LiveMount }>> = {
  rain: () => import("./live/rain"),
};

function init(consoleEl: HTMLElement) {
  const screen = consoleEl.querySelector<HTMLElement>("[data-screen]")!;
  const canvas = consoleEl.querySelector<HTMLCanvasElement>("[data-screen-canvas]")!;
  const ctx = canvas.getContext("2d")!;
  const liveCanvas = consoleEl.querySelector<HTMLCanvasElement>("[data-screen-live-canvas]")!;
  const title = consoleEl.querySelector<HTMLElement>("[data-screen-title]")!;
  const nosignal = consoleEl.querySelector<HTMLElement>("[data-screen-nosignal]")!;
  const nameEl = consoleEl.querySelector<HTMLElement>("[data-screen-name]")!;
  const tagEl = consoleEl.querySelector<HTMLElement>("[data-screen-tagline]")!;
  const kindEl = consoleEl.querySelector<HTMLElement>("[data-screen-kind]")!;
  const codeEl = consoleEl.querySelector<HTMLElement>("[data-screen-code]")!;
  const domainEl = consoleEl.querySelector<HTMLElement>("[data-screen-domain]")!;
  const startEl = consoleEl.querySelector<HTMLAnchorElement>("[data-screen-start]")!;
  const nowEl = consoleEl.querySelector<HTMLElement>("[data-screen-now]")!;
  const liveEl = consoleEl.querySelector<HTMLElement>("[data-screen-live]")!;
  const bay = consoleEl.querySelector<HTMLElement>("[data-bay]")!;
  const mini = consoleEl.querySelector<HTMLElement>("[data-mini]")!;
  const led = consoleEl.querySelector<HTMLElement>("[data-led]")!;
  const power = consoleEl.querySelector<HTMLElement>("[data-power]")!;
  const eject = consoleEl.querySelector<HTMLButtonElement>("[data-eject]")!;
  const carts = Array.from(document.querySelectorAll<HTMLButtonElement>(".cart[data-cart]"));

  let current: string | null = null;
  let token = 0;
  let scene: LiveScene | null = null;
  let onScreen = true;
  const images = new Map<string, Promise<HTMLImageElement | null>>();

  function loadImage(src: string) {
    if (!images.has(src)) {
      images.set(
        src,
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        }),
      );
    }
    return images.get(src)!;
  }

  function fitCanvas() {
    const r = screen.getBoundingClientRect();
    const w = Math.max(160, Math.round(r.width));
    const h = Math.max(100, Math.round(r.height));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  /** Draw `img` covering the canvas at a given pixel size (blocky). */
  function drawPixelated(img: HTMLImageElement, px: number) {
    fitCanvas();
    const W = canvas.width, H = canvas.height;
    const sw = Math.max(1, Math.round(W / px)), sh = Math.max(1, Math.round(H / px));
    const off = drawPixelated.off ?? (drawPixelated.off = document.createElement("canvas"));
    off.width = sw; off.height = sh;
    const octx = off.getContext("2d")!;
    // Cover-fit crop from the source image.
    const scale = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
    const cw = sw / scale, ch = sh / scale;
    const cx = (img.naturalWidth - cw) / 2;
    octx.imageSmoothingEnabled = true;
    octx.drawImage(img, cx, 0, cw, ch, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0, sw, sh, 0, 0, W, H);
  }
  drawPixelated.off = null as HTMLCanvasElement | null;

  async function resolveImage(img: HTMLImageElement, myToken: number) {
    // Heavy → clear, snapping through a few steps; final grain stays at 2px.
    const steps = reduced ? [2] : [40, 28, 20, 14, 10, 7, 5, 3, 2];
    for (let i = 0; i < steps.length; i++) {
      if (myToken !== token) return;
      drawPixelated(img, steps[i]);
      await wait(i < 4 ? 70 : 55);
    }
  }

  // ---- Live scenes ------------------------------------------------------
  function killLive() {
    if (scene) {
      scene.destroy();
      scene = null;
    }
    liveCanvas.classList.remove("is-on");
    liveCanvas.hidden = true;
    liveCanvas.width = 1;
    liveCanvas.height = 1;
    liveCanvas.style.imageRendering = "";
  }

  function mountLive(mount: LiveMount) {
    killLive();
    liveCanvas.hidden = false; // sized by the scene once it is laid out
    try {
      scene = mount(liveCanvas, { reduced });
    } catch (err) {
      console.error("Live scene failed to mount", err);
      killLive();
      return false;
    }
    if (!onScreen || document.hidden) scene.pause();
    requestAnimationFrame(() => liveCanvas.classList.add("is-on"));
    return true;
  }

  function setPressed(slug: string | null) {
    for (const c of carts) c.setAttribute("aria-pressed", c.dataset.cart === slug ? "true" : "false");
  }

  function cloneIntoBay(cart: HTMLButtonElement) {
    const copy = cart.cloneNode(true) as HTMLElement;
    copy.removeAttribute("aria-pressed");
    copy.removeAttribute("data-cart");
    copy.setAttribute("aria-hidden", "true");
    copy.setAttribute("tabindex", "-1");
    copy.classList.remove("cart--flagship");
    copy.classList.add("cart--grid", "is-inserting");
    bay.replaceChildren(copy);
  }

  async function ejectCurrent(myToken: number) {
    killLive();
    const inBay = bay.firstElementChild as HTMLElement | null;
    if (inBay) {
      inBay.classList.remove("is-inserting");
      inBay.classList.add("is-ejecting");
      await wait(320);
      if (myToken !== token) return;
      bay.replaceChildren();
    }
    screen.classList.remove("is-title", "is-booting");
    title.hidden = true;
    nosignal.hidden = true;
    current = null;
    setPressed(null);
    nowEl.textContent = "nothing";
    mini.textContent = "Empty slot";
  }

  async function insert(cart: HTMLButtonElement) {
    const slug = cart.dataset.cart!;
    if (slug === current) return;
    const myToken = ++token;
    const d = cart.dataset;

    // Swap: eject what is in there first.
    if (current) await ejectCurrent(myToken);
    if (myToken !== token) return;
    killLive();

    current = slug;
    setPressed(slug);
    cloneIntoBay(cart);
    power.classList.add("is-on");

    // Boot: CRT on, scanlines roll, logo for one beat. The live module, if
    // any, downloads in the meantime.
    screen.classList.remove("is-title");
    title.hidden = true;
    nosignal.hidden = true;
    screen.classList.add("is-booting", "crt__flash");
    led.classList.add("is-on");
    const imgP = d.shot ? loadImage(d.shot) : Promise.resolve(null);
    const liveP = d.live && LIVE[d.live] ? LIVE[d.live]().catch(() => null) : Promise.resolve(null);
    await wait(950);
    screen.classList.remove("crt__flash");
    if (myToken !== token) return;

    // Title screen.
    nameEl.textContent = d.name ?? "";
    tagEl.textContent = d.tagline ?? "";
    kindEl.textContent = d.kind ?? "";
    codeEl.textContent = d.code ? `CART ${d.code}` : "";
    domainEl.textContent = d.domain ?? "";
    startEl.href = d.url ?? "#";
    nowEl.textContent = d.name ?? "";
    mini.textContent = `Cart ${d.code} · ${d.name}`;
    liveEl.textContent = `Now playing: ${d.name}. Press start opens ${d.domain} in a new tab.`;

    const img = await imgP;
    if (myToken !== token) return;
    screen.classList.remove("is-booting");
    screen.classList.add("is-title");
    title.hidden = false;
    if (img) {
      await resolveImage(img, myToken);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nosignal.hidden = false;
    }

    // Then the hero itself, live.
    const mod = await liveP;
    if (myToken !== token || !mod) return;
    if (mountLive(mod.mount)) nosignal.hidden = true;
  }

  function bringIntoView() {
    // On small screens the console sits above the grid: bring it into view.
    const r = consoleEl.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      consoleEl.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }

  for (const cart of carts) {
    cart.addEventListener("click", () => {
      insert(cart);
      bringIntoView();
    });
  }
  eject.addEventListener("click", () => {
    const myToken = ++token;
    ejectCurrent(myToken).then(() => {
      if (myToken === token) { led.classList.remove("is-on"); }
    });
  });

  addEventListener("resize", () => {
    if (!current) return;
    const cart = carts.find((c) => c.dataset.cart === current);
    if (cart?.dataset.shot) loadImage(cart.dataset.shot).then((img) => img && drawPixelated(img, 2));
  }, { passive: true });

  // Idle the live scene while the console is off screen or the tab hidden.
  const syncScene = () => {
    if (!scene) return;
    if (onScreen && !document.hidden) scene.resume();
    else scene.pause();
  };
  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    syncScene();
  }, { threshold: 0 }).observe(consoleEl);
  document.addEventListener("visibilitychange", syncScene);

  // Deep link (#play-<slug>) or the configured boot cartridge, once the
  // console is on screen.
  const hashSlug = location.hash.startsWith("#play-") ? location.hash.slice(6) : null;
  const bootSlug = hashSlug ?? consoleEl.dataset.boot ?? null;
  const bootCart = carts.find((c) => c.dataset.cart === bootSlug);
  if (bootCart) {
    if (bootCart.dataset.shot) loadImage(bootCart.dataset.shot);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        if (!current) insert(bootCart);
      }
    }, { threshold: 0.35 });
    io.observe(consoleEl);
  }
}

export function initConsoles() {
  document.querySelectorAll<HTMLElement>("[data-console]").forEach(init);
}
