/**
 * The secret knock (egg 9) — a tapped 7/8 summons the Orchestra Pit.
 *
 * Four taps — spacebar or pointer — whose three intervals sit in 2:2:3.
 * Tempo-free: the intervals are normalized by their sum and matched
 * against the bar's fractions (2/7, 2/7, 3/7) with ±22% tolerance per
 * interval, like a rhythm game judging relative time. Taps on
 * interactive elements never count, and no key counts while a control
 * or text field holds focus, so ordinary use of the site cannot knock
 * by accident. On detection the egg is marked and the pit rises;
 * thereafter the lyre waits bottom-left on every page. This module also
 * starts the section-visit ledger the pit's track shelf reads.
 */

import { mark } from './eggs';
import { isSummoned, mountLyre, summonPit } from './pit/ui';
import { initVisits } from './pit/visits';

/** The 2+2+3 bar as fractions of its own length. */
const RATIOS: readonly number[] = [2 / 7, 2 / 7, 3 / 7];

/** ±22% of each expected fraction — even 1:1:1 tapping just misses. */
const TOLERANCE = 0.22;

/** Below this an interval is a bounce, not a beat. */
const MIN_GAP_MS = 90;

/** Beyond this the phrase has ended; the next tap starts fresh. */
const MAX_GAP_MS = 2000;

const INTERACTIVE =
  'a, button, input, select, textarea, summary, label, iframe, audio, video, ' +
  '[role="button"], [contenteditable], .pit-panel, .pit-lyre';

let taps: number[] = [];

function isInteractive(el: EventTarget | null): boolean {
  return el instanceof Element && el.closest(INTERACTIVE) !== null;
}

function matchesKnock(times: number[]): boolean {
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i]! - times[i - 1]!);
  if (gaps.some((g) => g < MIN_GAP_MS || g > MAX_GAP_MS)) return false;
  const sum = gaps.reduce((a, b) => a + b, 0);
  return gaps.every((g, i) => Math.abs(g / sum - RATIOS[i]!) <= RATIOS[i]! * TOLERANCE);
}

function tap(now: number): void {
  const last = taps[taps.length - 1];
  if (last !== undefined && now - last > MAX_GAP_MS) taps = [];
  taps.push(now);
  if (taps.length > 4) taps.shift(); // judge the last four, sliding
  if (taps.length === 4 && matchesKnock(taps)) {
    taps = [];
    mark('secret-knock');
    summonPit();
  }
}

export function initKnock(): void {
  initVisits();
  if (isSummoned()) mountLyre();

  // spacebar taps — default kept, so space still scrolls the page
  window.addEventListener('keydown', (e) => {
    if (e.repeat || (e.key !== ' ' && e.code !== 'Space')) return;
    if (isInteractive(document.activeElement)) return;
    tap(performance.now());
  });

  // pointer taps — primary button, anywhere that is not a control
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (isInteractive(e.target)) return;
    tap(performance.now());
  });
}
