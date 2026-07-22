/**
 * Easter-egg engine (spec §5). Declarative registry lives in eggs.config.ts;
 * this module binds triggers to anchors that section agents place as
 * data-egg-anchor attributes, runs effects by emitting 'iw:dither-style' /
 * 'iw:splash' through the shared event bus, and advances the cross-page
 * hunt (hunt.ts / hunt.config.ts).
 *
 * Binding is lazy and tolerant: anchors may appear late (or never) — an
 * initial scan plus a MutationObserver picks them up whenever they exist.
 */
import { emit } from '../events';
import { eggs } from './eggs.config';
import {
  getState,
  isFound,
  marksForPage,
  pageMatches,
  recordFind,
} from './hunt';
import { completionSigil } from './hunt.config';
import { initDawnGate } from './dawn';
import { natalCssHooks } from './natal.config';
import { addMark, injectStyle, showCompletionSigil, toast } from './ui';
import type { EffectAction, EggDef, PageScope } from './types';

declare global {
  interface Window {
    __iwEggsInit?: boolean;
  }
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function runEffect(action: EffectAction) {
  const run = () => {
    if (action.kind === 'dither') {
      emit('iw:dither-style', { style: action.style });
      if (action.revertMs) {
        window.setTimeout(() => emit('iw:dither-style', { style: 'default' }), action.revertMs);
      }
    } else {
      emit('iw:splash', { id: action.id, color: action.color });
    }
  };
  if (action.at) window.setTimeout(run, action.at);
  else run();
}

function fire(egg: EggDef) {
  if (egg.condition && !egg.condition()) return;
  // Flash-site spirit: the visual play repeats on every successful
  // interaction; discovery bookkeeping happens exactly once.
  for (const action of egg.effects) runEffect(action);
  if (isFound(egg.id)) return;
  emit('iw:egg-found', { eggId: egg.id });
  if (egg.toast) toast(egg.toast);
  const report = recordFind(egg.id);
  for (const step of report.newlyCompleted) {
    if (step.markPages.some((p) => pageMatches(p, location.pathname))) {
      addMark(step.glyph, step.title);
    }
    if (step.copy) window.setTimeout(() => toast(step.copy), 4200);
  }
  if (report.phaseChangedTo === 'awaiting-seal') {
    window.setTimeout(() => {
      showCompletionSigil(completionSigil.glyph, completionSigil.copy);
    }, 5200);
    scan(); // late-hunt eggs may bind now
  }
}

// ---------------------------------------------------------------------------
// Trigger wiring
// ---------------------------------------------------------------------------

/** Per-egg set of elements already wired, so rescans never double-bind. */
const bound = new Map<string, WeakSet<Element>>();
/** Per-egg click buffer for sequence triggers. */
const seqBuffer = new Map<string, string[]>();
/** Per-egg counter for assigning fallback sequence step tokens. */
const seqAutoIndex = new Map<string, number>();

function wire(egg: EggDef, el: Element) {
  const t = egg.trigger;
  if (t.kind === 'click') {
    el.addEventListener('click', () => fire(egg));
    return;
  }
  if (t.kind === 'n-clicks') {
    let stamps: number[] = [];
    el.addEventListener('click', () => {
      const now = performance.now();
      stamps = stamps.filter((s) => now - s < t.withinMs);
      stamps.push(now);
      if (stamps.length >= t.count) {
        stamps = [];
        fire(egg);
      }
    });
    return;
  }
  if (t.kind === 'hover-hold') {
    let timer = 0;
    const start = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fire(egg), t.holdMs);
    };
    const cancel = () => window.clearTimeout(timer);
    el.addEventListener('pointerenter', start);
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointercancel', cancel);
    return;
  }
  // sequence — token from data-egg-step, else bind-order index.
  const explicit = el.getAttribute('data-egg-step');
  let token: string;
  if (explicit !== null) {
    token = explicit;
  } else {
    const next = seqAutoIndex.get(egg.id) ?? 0;
    seqAutoIndex.set(egg.id, next + 1);
    token = String(next);
  }
  el.addEventListener('click', () => {
    const order = t.order;
    const buf = seqBuffer.get(egg.id) ?? [];
    const candidate = [...buf, token];
    const isPrefix = candidate.every((v, i) => order[i] === v);
    if (isPrefix) {
      if (candidate.length === order.length) {
        seqBuffer.set(egg.id, []);
        fire(egg);
      } else {
        seqBuffer.set(egg.id, candidate);
      }
    } else {
      seqBuffer.set(egg.id, token === order[0] ? [token] : []);
    }
  });
}

// ---------------------------------------------------------------------------
// Scanning / lazy binding
// ---------------------------------------------------------------------------

function scopeMatches(scope: PageScope, pathname: string): boolean {
  if (scope === 'any') return true;
  if (scope === 'home') return pageMatches('/', pathname);
  return pageMatches('/writings', pathname);
}

function active(egg: EggDef): boolean {
  if (egg.enabled === false) return false;
  if (!scopeMatches(egg.scope, location.pathname)) return false;
  if (egg.lateHunt && getState().phase !== 'awaiting-seal' && getState().phase !== 'sealed') {
    return false;
  }
  return true;
}

/** Bind every active egg to any currently-present, not-yet-wired anchors. */
function scan(root: ParentNode = document) {
  for (const egg of eggs) {
    if (!active(egg)) continue;
    let seen = bound.get(egg.id);
    if (!seen) {
      seen = new WeakSet();
      bound.set(egg.id, seen);
    }
    const matches = root.querySelectorAll(egg.binding);
    for (const el of matches) {
      if (seen.has(el)) continue;
      seen.add(el);
      wire(egg, el);
    }
  }
}

function observe() {
  const mo = new MutationObserver((records) => {
    const anyElements = records.some((r) =>
      Array.from(r.addedNodes).some((n) => n.nodeType === Node.ELEMENT_NODE),
    );
    if (anyElements) scan();
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Natal placement hooks — degree values exposed as CSS custom properties the
// visual layer reads as animation offsets / constellation rotations. Quiet
// by design; nothing in the UI names them.
// ---------------------------------------------------------------------------

function applyNatalHooks() {
  const hooks = natalCssHooks();
  for (const [prop, value] of Object.entries(hooks)) {
    document.documentElement.style.setProperty(prop, value);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function initEggs() {
  if (window.__iwEggsInit) return;
  window.__iwEggsInit = true;

  if (!document.body) {
    await new Promise<void>((resolve) =>
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }),
    );
  }

  injectStyle();
  applyNatalHooks();

  // Restore marks earned on earlier visits/pages.
  for (const mark of marksForPage(location.pathname)) {
    addMark(mark.glyph, mark.title);
  }
  const phase = getState().phase;
  if (phase === 'awaiting-seal' || phase === 'sealed') {
    showCompletionSigil(completionSigil.glyph, completionSigil.copy);
  }

  scan();
  observe();
  initDawnGate();
}
