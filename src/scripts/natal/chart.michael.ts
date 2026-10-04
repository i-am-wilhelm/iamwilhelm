/**
 * Michael's chart — the first data file the natal engine draws. Swiss
 * Ephemeris, 1991-03-01 17:00 UT, Safford AZ (32.834 N, 109.707 W), Placidus.
 *
 * Nothing here is explained in the UI. The eggs' natal.config.ts derives its
 * placements and keyDate from this object instead of carrying placeholders.
 */
import type { ChartData } from './types';

export const CHART: ChartData = {
  mc: 302.0342,
  asc: 48.3416,
  vertex: 202.2901,
  house12cusp: 5.748,
  cusps: [
    48.3416, 75.9414, 98.8494, 122.0342, 149.6519, 185.748,
    228.3416, 255.9414, 278.8494, 302.0342, 329.6519, 5.748,
  ],
  bodies: {
    sun:     { lon: 340.6065, spd: 1.00328,  retro: false },
    mercury: { lon: 340.2568, spd: 1.87525,  retro: false }, // cazimi — rides inside the Sun
    moon:    { lon: 172.6298, spd: 13.63952, retro: false }, // full
    venus:   { lon: 9.0222,   spd: 1.22742,  retro: false }, // chart ruler, 12th house
    mars:    { lon: 74.0065,  spd: 0.45081,  retro: false },
    jupiter: { lon: 124.8545, spd: 0.08777,  retro: true },
    saturn:  { lon: 302.5105, spd: 0.10194,  retro: false }, // partile on the MC — the crown
    uranus:  { lon: 282.8672, spd: 0.03831,  retro: false },
    neptune: { lon: 286.1374, spd: 0.02503,  retro: false },
    pluto:   { lon: 230.3599, spd: 0.00454,  retro: true },
    nn:      { lon: 295.9728, spd: 0.05299,  retro: true },
    vesta:   { lon: 55.4756,  spd: 0.29743,  retro: false },
  },
  lilith: 263.8747, // 23°52' Sag — a lens, never an orb
  birth: { year: 1991, month: 3, day: 1, hourUT: 17, lat: 32.834, lon: -109.707 },
  portrait: {
    src: '/assets/portrait.webp',
    // Square crop of the 1024² source that fills the disc. The face sits at
    // roughly 50% / 45% of the frame; a 0.36 half-width keeps hair and
    // jawline inside the circle.
    crop: { cx: 0.5, cy: 0.45, half: 0.36 },
    // Measured against the real portrait (eyes at ≈40% / 59.5% across,
    // 40.5% down in source space) and mapped through the crop above.
    eyes: [
      { x: 0.36, y: 0.44, rx: 0.07, ry: 0.045 },
      { x: 0.635, y: 0.44, rx: 0.07, ry: 0.045 },
    ],
  },
};
