/**
 * Declarative egg registry — flash-site spirit (homestarrunner.com): small
 * clickable secrets that swap the dither treatment, flash a splash of
 * section color, or shift the pose of the visual layer. Section agents place
 * the anchors (data-egg-anchor="…"); the engine binds lazily and tolerates
 * any anchor being absent.
 *
 * Symbology register (per src/design/tokens.ts guardrails): classical,
 * alchemical, Greco-Egyptian only.
 */
import { accents } from '../../design/tokens';
import { birthdaySequence, isDawn } from './natal.config';
import type { EggDef } from './types';

export const eggs: EggDef[] = [
  {
    // The black swan preens — triple-tap shows her white under-feather
    // (inverse dither) for one long breath.
    id: 'swan-preen',
    scope: 'home',
    binding: '[data-egg-anchor="hero-swan"]',
    trigger: { kind: 'n-clicks', count: 3, withinMs: 1600 },
    effects: [
      { kind: 'dither', style: 'inverse', revertMs: 5600 },
      { kind: 'splash', id: 'hero', color: accents.hero, at: 120 },
    ],
    toast: 'The swan shows her white under-feather.',
  },
  {
    // Birthday-as-coded-egg: click the Pleiades nodes in the order derived
    // from natal.config keyDate. Nodes carry data-egg-step="0".."6".
    id: 'natal-ascent',
    scope: 'home',
    binding: '[data-egg-anchor="cluster-node"]',
    trigger: { kind: 'sequence', order: birthdaySequence(7) },
    effects: [
      { kind: 'dither', style: 'chaos', revertMs: 7000 },
      { kind: 'splash', id: 'cluster', color: accents.cluster, at: 200 },
    ],
    toast: 'The seven rise in their appointed order.',
  },
  {
    // Ma'at's feather — rest the pointer on it for one full 7/8 bar at 84bpm
    // (7 eighth-notes ≈ 2500ms) and the scale settles level.
    id: 'maat-feather',
    scope: 'home',
    binding: '[data-egg-anchor="underworld-feather"]',
    trigger: { kind: 'hover-hold', holdMs: 2500 },
    effects: [
      { kind: 'dither', style: 'dense', revertMs: 5000 },
      { kind: 'splash', id: 'underworld', color: accents.underworld, at: 150 },
    ],
    toast: 'The heart weighs even with the feather.',
  },
  {
    // The orphic lyre — seven strings, seven quick plucks.
    id: 'orphic-lyre',
    scope: 'home',
    binding: '[data-egg-anchor="underworld-lyre"]',
    trigger: { kind: 'n-clicks', count: 7, withinMs: 4000 },
    effects: [
      { kind: 'splash', id: 'underworld', color: accents.underworld },
      { kind: 'dither', style: 'inverse', revertMs: 3500, at: 400 },
    ],
    toast: 'Seven strings, and the stones lean closer to listen.',
  },
  {
    // The monsoon cloud opens on a triple tap.
    id: 'monsoon-rainmaker',
    scope: 'home',
    binding: '[data-egg-anchor="monsoon-cloud"]',
    trigger: { kind: 'n-clicks', count: 3, withinMs: 1200 },
    effects: [
      { kind: 'dither', style: 'dense', revertMs: 6000 },
      { kind: 'splash', id: 'monsoon', color: accents.monsoon, at: 100 },
    ],
    toast: 'The cloud opens over the valley.',
  },
  {
    // Pharmakon sigil on the writings index — one deliberate click.
    id: 'pharmakon-sigil',
    scope: 'writings',
    binding: '[data-egg-anchor="writings-pharmakon"]',
    trigger: { kind: 'click' },
    effects: [
      { kind: 'splash', id: 'writings', color: accents.writings },
      { kind: 'dither', style: 'inverse', revertMs: 4000, at: 250 },
    ],
    toast: 'The remedy and the dose are one art.',
  },
  {
    // Venus as Phosphoros — the morning star answers only in the dawn band
    // (natal.config dawnWindow; Venus 12th-house theme). A grace note
    // outside the hunt's required path.
    id: 'phosphoros-dawn',
    scope: 'any',
    binding: '[data-egg-anchor="phosphoros-star"]',
    trigger: { kind: 'click' },
    condition: () => isDawn(),
    effects: [
      { kind: 'splash', id: 'hero', color: '#e8d9b0' },
    ],
    toast: 'The morning star stands above the threshold.',
  },
  {
    // Late-hunt threshold egg. The controversial series lives on a separate
    // domain; discipline: the destination appears nowhere on this site.
    // Ships disabled with an empty payload.
    // TODO(owner): destination revealed via egg only — set payload to the
    // destination and flip enabled to true when ready. The egg binds only
    // after the hunt reaches 'awaiting-seal'.
    id: 'psychopomp-door',
    scope: 'any',
    binding: '[data-egg-anchor="psychopomp-door"]',
    trigger: { kind: 'click' },
    effects: [],
    enabled: false,
    lateHunt: true,
    payload: null,
  },
];
