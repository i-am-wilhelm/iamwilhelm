/**
 * THE UNSEEN ONE PLEADS HIS CASE: the descent island.
 *
 * Mounted by boot.ts where `.seed-gate` markup exists (the writings page
 * rendered with treatment: descent). Owns:
 *
 *   - the seed gates (gates.ts): click for seeds 1 to 5, press-and-hold
 *     for the sixth; each take reveals its .litany-part, scrolls to it,
 *     and shows the next gate;
 *   - the metamorphosis (metamorphosis.ts) after the sixth seed, then
 *     movements IV (Elysium: the hall canvas and the seat-mirror) and V;
 *   - the narcissus band at the door, fading with the first viewport;
 *   - "Read it straight through": un-gates everything, marks the seeds
 *     taken, renders the metamorphosis instantly. Also what reduced
 *     motion gets;
 *   - the voice controller (audio.ts), shown only when cue files exist;
 *   - an actual rest in the orchestra pit for the length of the hold.
 *
 * Talks to the other subsystems only through window events
 * (iw:pit-rest, iw:layout). Everything here tolerates missing markup.
 */

import { emit } from '../events';
import { probeVoice, type VoiceController } from './audio';
import { COUPLETS, LITANY, LOOK, RETURN, SIXTH, TAKE } from './cues';
import { buildGates, type Gate } from './gates';
import { mountHall, mountNarcissus } from './canvases';
import { runMetamorphosis } from './metamorphosis';
import { mountMirror } from './mirror';

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export async function mountUnseen(): Promise<void> {
  const root = document.querySelector<HTMLElement>('.descent') ?? document.body;
  const gateRoots = Array.from(root.querySelectorAll<HTMLElement>('.seed-gate'));
  if (!gateRoots.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = Array.from(root.querySelectorAll<HTMLElement>('.litany-part'));
  const partFor = (n: number) => parts.find((p) => p.dataset.part === String(n)) ?? null;
  const front = root.querySelector<HTMLElement>('.poem-front .copy');
  const coupletsSection = root.querySelector<HTMLElement>('[data-section="unseen-1"]');
  const litanySection = root.querySelector<HTMLElement>('.poem-litany');
  const metaSection = root.querySelector<HTMLElement>('.poem-metamorphosis');
  const metaLines = metaSection?.querySelector<HTMLElement>('.meta-lines') ?? null;
  const elysium = root.querySelector<HTMLElement>('.poem-elysium');
  const ret = root.querySelector<HTMLElement>('.poem-return');
  const hallHost = root.querySelector<HTMLElement>('[data-island="hall"]');
  const mirrorHost = root.querySelector<HTMLElement>('[data-island="mirror"]');
  const straight = document.getElementById('unseen-straight') as HTMLButtonElement | null;

  let ungated = false;
  let metaRan = false;
  let voice: VoiceController | null = null;

  // ---- Headnote scrim --------------------------------------------------
  // The title block and the prose before the first movement arrive with no
  // .copy around them; wrap both in one column so they get a single
  // feathered pane of page colour, like the sections, over the glyph field.
  const head = root.querySelector<HTMLElement>('.descent__head');
  const text = root.querySelector<HTMLElement>('.descent__text');
  if (head && text && !root.querySelector('.descent__headnote')) {
    const lead: Element[] = [];
    for (const child of Array.from(text.children)) {
      if (child.classList.contains('section')) break;
      lead.push(child);
    }
    const wrap = document.createElement('div');
    wrap.className = 'copy descent__headnote';
    head.before(wrap);
    wrap.appendChild(head);
    lead.forEach((el) => wrap.appendChild(el));
  }

  // ---- Initial state: everything past the first gate waits ------------
  for (const p of parts) {
    p.classList.add('reveal');
    p.hidden = true;
  }
  if (metaSection) metaSection.hidden = true;
  if (elysium) elysium.hidden = true;
  if (ret) ret.hidden = true;

  // ---- Narcissus at the door ------------------------------------------
  const narcissus = front ? mountNarcissus(front) : null;
  if (front && narcissus) {
    const cap = document.createElement('p');
    cap.className = 'eyebrow eyebrow--faint';
    cap.textContent = 'Narcissus, pressed. The rumor of her. Left at the door.';
    front.appendChild(cap);
    const onScroll = () => narcissus.setFade(Math.min(1, window.scrollY / (window.innerHeight * 1.2)));
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---- Elysium pieces, built now, started when the hall is reached ----
  const hall = hallHost ? mountHall(hallHost, reduced) : null;
  const mirror = mirrorHost ? mountMirror(mirrorHost) : null;

  // ---- Reveal helpers --------------------------------------------------
  const show = (el: HTMLElement | null) => {
    if (!el) return;
    el.hidden = false;
    if (el.classList.contains('reveal')) {
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    }
  };
  const scrollTo = (el: HTMLElement | null) => {
    if (!el || ungated) return;
    window.setTimeout(() => el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 80);
  };
  const layoutChanged = () => emit('iw:layout', {});

  // ---- Voice (only when cue files exist) -----------------------------
  async function speakPart(n: number) {
    if (!voice?.on) return;
    const part = partFor(n);
    if (!part) return;
    const ps = Array.from(part.querySelectorAll<HTMLElement>('p'));
    for (const cue of LITANY[n] ?? []) {
      if (!voice.on) return;
      await voice.play(cue, cue.line === null ? null : ps[cue.line] ?? null);
    }
    if (n === 5 && voice.on) {
      await voice.play(SIXTH.take);
      await voice.play(SIXTH.hold);
    }
  }
  async function speakCouplets(section: HTMLElement | null, cues: typeof COUPLETS) {
    if (!voice?.on || !section) return;
    const ps = Array.from(section.querySelectorAll<HTMLElement>('.couplet'));
    for (let i = 0; i < cues.length; i++) {
      if (!voice.on) return;
      await voice.play(cues[i], ps[i] ?? null);
    }
  }

  // ---- Gates -----------------------------------------------------------
  let gates: Gate[] = [];
  const gateFor = (n: number) => gates.find((g) => g.n === n) ?? null;

  function take(n: number) {
    if (n < 6) {
      const p = partFor(n);
      show(p);
      gateFor(n + 1)?.show();
      layoutChanged();
      scrollTo(p);
      voice?.hush();
      void (async () => {
        const intro = TAKE[n];
        if (intro && voice?.on) await voice.play(intro);
        await speakPart(n);
      })();
      return;
    }
    // The sixth seed, held all the way.
    emit('iw:pit-rest', { resting: false });
    voice?.stopLoop();
    voice?.hush();
    void (async () => {
      if (voice?.on) await voice.play(SIXTH.now);
      await runMeta(false);
    })();
  }

  gates = buildGates(gateRoots, {
    onTake: take,
    onHoldStart: () => {
      emit('iw:pit-rest', { resting: true });
      voice?.hush();
      voice?.loop(SIXTH.holdLoop);
    },
    onHoldCancel: () => {
      emit('iw:pit-rest', { resting: false });
      voice?.stopLoop();
      voice?.hush();
    },
  });
  for (const g of gates) if (g.n > 1) g.root.hidden = true;

  // ---- Metamorphosis, then Elysium and the return ----------------------
  async function runMeta(instant: boolean) {
    if (metaRan) return;
    metaRan = true;
    show(metaSection);
    layoutChanged();
    if (!instant && !reduced) scrollTo(metaSection);
    if (metaLines) {
      await runMetamorphosis(metaLines, { instant: instant || reduced, reduced, voice });
    }
    afterMeta(instant);
  }

  function afterMeta(instant: boolean) {
    show(elysium);
    show(ret);
    hall?.start();
    layoutChanged();
    if (!instant && !reduced && !ungated) {
      window.setTimeout(() => elysium?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
    window.setTimeout(() => mirror?.reveal(), instant ? 400 : 2200);
    if (voice?.on && !ungated) {
      const look = elysium?.querySelector<HTMLElement>('.look') ?? null;
      window.setTimeout(() => {
        void (async () => {
          await voice!.play(LOOK, look);
          await speakCouplets(ret, RETURN);
        })();
      }, 1600);
    }
  }

  // ---- Read it straight through ---------------------------------------
  function readStraight() {
    ungated = true;
    voice?.hush();
    for (const g of gates) {
      g.show();
      g.markTaken();
    }
    for (const p of parts) show(p);
    void runMeta(true);
    if (straight) straight.hidden = true;
  }
  if (straight) {
    straight.hidden = false;
    straight.addEventListener('click', readStraight);
  }
  if (reduced) readStraight();

  // ---- Voice toggle, only when files exist -----------------------------
  voice = await probeVoice();
  if (voice && litanySection && !ungated) {
    const copy = litanySection.querySelector<HTMLElement>('.copy') ?? litanySection;
    const bar = document.createElement('div');
    bar.className = 'voicebar';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voice';
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = 'Hear it';
    const note = document.createElement('span');
    note.className = 'vnote';
    note.textContent = 'Two voices. His in the room, hers where you stand.';
    bar.append(btn, note);
    const firstGate = copy.querySelector('.seed-gate');
    if (firstGate) copy.insertBefore(bar, firstGate);
    else copy.appendChild(bar);

    voice.onChange((on) => {
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Quiet' : 'Hear it';
      note.textContent = on
        ? 'His voice is low and slow. Hers answers.'
        : 'Two voices. His in the room, hers where you stand.';
    });
    btn.addEventListener('click', () => {
      const on = voice!.toggle();
      if (!on) return;
      // Read whatever is open from the last open part; before the first
      // seed, the line that offers the fruit.
      const open = parts.filter((p) => !p.hidden);
      if (open.length) {
        void speakPart(Number(open[open.length - 1].dataset.part));
      } else {
        void voice!.play(COUPLETS[COUPLETS.length - 1], coupletsSection?.querySelector('.couplet:last-of-type') ?? null);
      }
    });
    window.addEventListener('pagehide', () => voice?.hush());
  }

  await sleep(0);
}
