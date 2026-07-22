/**
 * Shared types for the easter-egg engine. Pure declarations — no DOM work
 * here. The engine (registry.ts) interprets these; the configs
 * (eggs.config.ts, natal.config.ts, hunt.config.ts) instantiate them.
 */

/** Which page(s) an egg binds on. */
export type PageScope = 'home' | 'writings' | 'any';

/** Dither styles understood by the WebGL pipeline via 'iw:dither-style'. */
export type DitherStyle = 'default' | 'dense' | 'inverse' | 'chaos';

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

/** Single click/tap on the bound element. */
export interface TriggerClick {
  kind: 'click';
}

/** N clicks on the bound element inside a rolling time window. */
export interface TriggerNClicks {
  kind: 'n-clicks';
  count: number;
  /** Rolling window in ms — clicks older than this age out. */
  withinMs: number;
}

/** Pointer rests on the element for holdMs without leaving or pressing. */
export interface TriggerHoverHold {
  kind: 'hover-hold';
  holdMs: number;
}

/**
 * Click the egg's bound elements in a fixed order. Each bound element
 * contributes a step token: its `data-egg-step` attribute when present,
 * otherwise its index in DOM order at bind time. A click that breaks the
 * order restarts the buffer (a click on the first token restarts cleanly
 * from step one).
 */
export interface TriggerSequence {
  kind: 'sequence';
  /** Ordered step tokens, e.g. ['3', '0', '5', '1']. */
  order: string[];
}

export type Trigger =
  | TriggerClick
  | TriggerNClicks
  | TriggerHoverHold
  | TriggerSequence;

// ---------------------------------------------------------------------------
// Effects — every effect is an event emitted through src/scripts/events.ts.
// ---------------------------------------------------------------------------

/** Swap the dither glyph treatment; optionally revert to 'default' later. */
export interface EffectDither {
  kind: 'dither';
  style: DitherStyle;
  /** When set, 'iw:dither-style' {style:'default'} fires after this delay. */
  revertMs?: number;
}

/** Recolor / flash a section splash in the pipeline. */
export interface EffectSplash {
  kind: 'splash';
  /** Splash id — by convention the section id ('hero', 'monsoon', …). */
  id: string;
  color?: string;
}

/** One action in an egg's effect script. `at` delays it (ms after firing). */
export type EffectAction = (EffectDither | EffectSplash) & { at?: number };

// ---------------------------------------------------------------------------
// Egg definition
// ---------------------------------------------------------------------------

export interface EggDef {
  /** Stable id — persisted in the hunt store and emitted in 'iw:egg-found'. */
  id: string;
  scope: PageScope;
  /**
   * CSS selector for the anchor(s). Section agents place attributes like
   * data-egg-anchor="hero-swan"; the engine binds lazily and tolerates the
   * selector matching nothing (yet, or ever).
   */
  binding: string;
  trigger: Trigger;
  effects: EffectAction[];
  /** Short affirmative line shown as a quiet toast on first discovery. */
  toast?: string;
  /** Defaults to true. Disabled eggs never bind. */
  enabled?: boolean;
  /** Bind only after the hunt reaches 'awaiting-seal'. */
  lateHunt?: boolean;
  /** Extra gate evaluated at fire time (e.g. a dawn-hours window). */
  condition?: () => boolean;
  /**
   * Optional opaque payload the effect layer may act on once configured
   * (e.g. a destination URL). Ships null until the owner supplies it.
   */
  payload?: string | null;
}
