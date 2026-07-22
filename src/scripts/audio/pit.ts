/**
 * ORCHESTRA PIT — hidden audio layer entry point (site spec §6).
 *
 * Flow:
 *   - Always listening (cheaply, no Tone.js loaded): pointer taps on
 *     [data-tap-zone] elements (falling back to the document body) feed the
 *     7/8 onset matcher in tap.ts. Tapping the site's 2+2+3 figure —
 *     "short short long", the same accents the score's knock plays — opens
 *     the pit and emits 'iw:pit-open'.
 *   - Audio is strictly gesture-gated: Tone.js is dynamically imported and
 *     Tone.start() called only inside a qualifying user interaction (the
 *     completed tap figure, a toggle click, or — when a previous choice is
 *     being restored from sessionStorage — the first pointer/key gesture of
 *     the new page view). Nothing sounds on load, ever.
 *   - 'iw:section-enter' retunes the drone to that section's `drone` pitch
 *     (C2→G2→D2→A2→E2 — the circle of fifths, music of the spheres).
 *   - Drawer state, score choice, and the sequencer pattern persist in
 *     sessionStorage.
 */

import { emit, on } from '../events';
import { sections } from '../../design/tokens';
import { createTapDetector } from './tap';
import { GROUP_STARTS, emptyPattern } from './grid';

const SS_OPEN = 'iw-pit:open';
const SS_SCORE = 'iw-pit:score';
const SS_PATTERN = 'iw-pit:pattern';

type Engine = import('./engine').PitEngine;
type PitUI = import('./ui').PitUI;

export async function initOrchestraPit(): Promise<void> {
  let ui: PitUI | null = null;
  let engine: Engine | null = null;
  let enginePromise: Promise<Engine> | null = null;

  let scoreOn = sessionStorage.getItem(SS_SCORE) === '1';
  let seqOn = false;
  let currentDrone = sections[0].drone; // C2 until a section reports in
  const pattern = loadPattern();

  function loadPattern(): boolean[][] {
    try {
      const raw = sessionStorage.getItem(SS_PATTERN);
      if (raw) {
        const parsed = JSON.parse(raw) as boolean[][];
        const base = emptyPattern();
        parsed.forEach((row, r) =>
          row.forEach((v, s) => {
            if (base[r] && s < base[r].length) base[r][s] = !!v;
          }),
        );
        return base;
      }
    } catch {
      /* fall through to the seeded default */
    }
    // First visit: seed the knock row on the 2+2+3 group starts so pressing
    // play demonstrates the site's figure immediately.
    const seeded = emptyPattern();
    GROUP_STARTS.forEach((s) => (seeded[0][s] = true));
    return seeded;
  }

  function savePattern(): void {
    sessionStorage.setItem(SS_PATTERN, JSON.stringify(pattern));
  }

  /** Lazy-load Tone.js + engine. Call only from a user-gesture path. */
  async function getEngine(): Promise<Engine> {
    if (!enginePromise) {
      enginePromise = import('./engine').then((mod) => {
        const e = mod.getEngine();
        e.setPattern(pattern);
        e.setDroneNote(currentDrone);
        e.onStep((step) => ui?.markStep(step));
        engine = e;
        return e;
      });
    }
    return enginePromise;
  }

  async function setScore(next: boolean): Promise<void> {
    scoreOn = next;
    sessionStorage.setItem(SS_SCORE, next ? '1' : '0');
    ui?.setScoreOn(next);
    if (next) {
      const e = await getEngine();
      await e.ensureRunning();
      await e.setScoreOn(true);
    } else if (engine) {
      await engine.setScoreOn(false);
    }
  }

  async function ensureUI(): Promise<PitUI> {
    if (ui) return ui;
    const { createPitUI } = await import('./ui');
    ui = createPitUI({
      initialPattern: pattern,
      initialScoreOn: scoreOn,
      onScoreToggle: (next) => void setScore(next),
      onSeqToggle: (playing) => {
        seqOn = playing;
        void (async () => {
          const e = await getEngine();
          await e.ensureRunning();
          e.setSeqOn(playing);
        })();
      },
      onCellToggle: (row, step, value) => {
        pattern[row][step] = value;
        savePattern();
        engine?.setCell(row, step, value);
      },
      onClose: () => closePit(),
    });
    return ui;
  }

  async function openPit(opts: { fromTap: boolean }): Promise<void> {
    const drawer = await ensureUI();
    drawer.open();
    sessionStorage.setItem(SS_OPEN, '1');
    if (opts.fromTap) {
      emit('iw:pit-open', {});
      // The completed 7/8 figure is a deliberate performance — treat it as
      // opting into sound and let the orchestra tune up.
      await setScore(true);
    }
  }

  function closePit(): void {
    ui?.close();
    sessionStorage.setItem(SS_OPEN, '0');
    if (seqOn) {
      seqOn = false;
      ui?.setSeqPlaying(false);
      engine?.setSeqOn(false);
    }
  }

  // ---- Music of the spheres: retune on section entry --------------------
  on('iw:section-enter', ({ id }) => {
    const spec = sections.find((s) => s.id === id);
    if (!spec) return;
    currentDrone = spec.drone;
    engine?.setDroneNote(spec.drone);
  });

  // ---- 7/8 tap detection ------------------------------------------------
  const detector = createTapDetector();
  const zones = document.querySelectorAll<HTMLElement>('[data-tap-zone]');
  const targets: (HTMLElement | Document)[] =
    zones.length > 0 ? Array.from(zones) : [document];
  const onPointer = (e: Event) => {
    if (!(e as PointerEvent).isTrusted) return;
    // Taps inside the pit drawer drive the toy, and stay out of the matcher.
    if (ui && ui.root.contains(e.target as Node)) return;
    if (detector.onset(performance.now())) {
      detector.reset();
      void openPit({ fromTap: true });
    }
  };
  targets.forEach((t) => t.addEventListener('pointerdown', onPointer));

  // ---- Escape closes the drawer -----------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui?.isOpen()) closePit();
  });

  // ---- Restore prior state (UI immediately; sound on first gesture) -----
  if (sessionStorage.getItem(SS_OPEN) === '1') {
    void ensureUI().then((drawer) => drawer.open());
  }
  if (scoreOn) {
    const resume = () => {
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
      void setScore(true);
    };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  }
}
