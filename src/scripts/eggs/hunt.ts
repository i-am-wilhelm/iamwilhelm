/**
 * Hunt state machine. Persisted in localStorage under ONE namespaced,
 * versioned key. Pure state + persistence — no DOM; the engine (registry.ts)
 * renders marks/toasts from the transition reports returned here.
 *
 * Phases:
 *   'unbegun'       — no eggs found yet
 *   'in-progress'   — at least one egg found, steps completing in order
 *   'awaiting-seal' — every configured step complete; terminal until the
 *                     final mail-in step (hunt.config.ts finalStep) is wired
 *   'sealed'        — finalStep is configured and recordSeal() has been
 *                     called by the (later-built) mail-in wiring
 */
import { finalStep, huntSteps, type HuntStep } from './hunt.config';

const STORAGE_KEY = 'iw:hunt';
const VERSION = 1;

export type HuntPhase = 'unbegun' | 'in-progress' | 'awaiting-seal' | 'sealed';

export interface HuntState {
  version: number;
  /** Egg ids discovered, in discovery order. */
  found: string[];
  /** Step ids completed, always a prefix of huntSteps order. */
  completedSteps: string[];
  phase: HuntPhase;
  /** Set by recordSeal() once the mail-in step is wired and verified. */
  sealed: boolean;
}

export interface FindReport {
  newlyFound: boolean;
  newlyCompleted: HuntStep[];
  /** Present when this find moved the hunt into a new phase. */
  phaseChangedTo?: HuntPhase;
  state: HuntState;
}

function freshState(): HuntState {
  return { version: VERSION, found: [], completedSteps: [], phase: 'unbegun', sealed: false };
}

function load(): HuntState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<HuntState>;
    if (parsed.version !== VERSION) {
      // Migration policy: carry the found set forward, recompute the rest.
      const carried = freshState();
      if (Array.isArray(parsed.found)) carried.found = parsed.found.filter((f) => typeof f === 'string');
      return recompute(carried);
    }
    return recompute({
      ...freshState(),
      ...parsed,
      found: Array.isArray(parsed.found) ? parsed.found : [],
      sealed: parsed.sealed === true,
    });
  } catch {
    return freshState();
  }
}

function save(state: HuntState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private-mode storage failures leave the hunt session-local */
  }
}

/** Recompute completed steps (strictly in order) and the phase. */
function recompute(state: HuntState): HuntState {
  const found = new Set(state.found);
  const completed: string[] = [];
  for (const step of huntSteps) {
    if (step.requires.every((id) => found.has(id))) completed.push(step.id);
    else break; // steps unlock in order — a gap halts the cascade
  }
  state.completedSteps = completed;
  if (completed.length === huntSteps.length) {
    state.phase = finalStep !== null && state.sealed ? 'sealed' : 'awaiting-seal';
  } else if (state.found.length > 0) {
    state.phase = 'in-progress';
  } else {
    state.phase = 'unbegun';
  }
  return state;
}

let state: HuntState = typeof localStorage === 'undefined' ? freshState() : load();

export function getState(): HuntState {
  return state;
}

export function isFound(eggId: string): boolean {
  return state.found.includes(eggId);
}

/** Record a discovery; returns what changed so the engine can render it. */
export function recordFind(eggId: string): FindReport {
  if (state.found.includes(eggId)) {
    return { newlyFound: false, newlyCompleted: [], state };
  }
  const beforeSteps = new Set(state.completedSteps);
  const beforePhase = state.phase;
  state.found = [...state.found, eggId];
  state = recompute(state);
  save(state);
  const newlyCompleted = huntSteps.filter(
    (s) => state.completedSteps.includes(s.id) && !beforeSteps.has(s.id),
  );
  return {
    newlyFound: true,
    newlyCompleted,
    phaseChangedTo: state.phase !== beforePhase ? state.phase : undefined,
    state,
  };
}

/**
 * Called by the future mail-in wiring once finalStep is configured and the
 * seal is verified. Without a configured finalStep this is a no-op — the
 * hunt rests at 'awaiting-seal'.
 */
export function recordSeal(): HuntState {
  if (finalStep !== null && state.phase === 'awaiting-seal') {
    state.sealed = true;
    state = recompute(state);
    save(state);
  }
  return state;
}

/** Glyphs of completed steps whose marks belong on the given pathname. */
export function marksForPage(pathname: string): { glyph: string; title: string }[] {
  const done = new Set(state.completedSteps);
  return huntSteps
    .filter((s) => done.has(s.id) && s.markPages.some((p) => pageMatches(p, pathname)))
    .map((s) => ({ glyph: s.glyph, title: s.title }));
}

/** '/' matches the homepage exactly; other patterns match as path prefixes. */
export function pageMatches(pattern: string, pathname: string): boolean {
  const path = pathname.replace(/\/index\.html$/, '/');
  if (pattern === '/') return path === '/';
  return path === pattern || path.startsWith(pattern.endsWith('/') ? pattern : `${pattern}/`);
}
