/**
 * Throwaway test chart for /lab/hero?chart=test — proves the engine renders
 * from any ChartData without code changes. Values are invented: a loose
 * grand cross plus a stellium so every beam type appears. No portrait, so
 * the disc stays empty and the centre splits play naked from the start.
 */
import type { ChartData } from './types';

export const TEST_CHART: ChartData = {
  mc: 95.0,
  asc: 190.0,
  vertex: 20.0,
  house12cusp: 160.0,
  cusps: [190, 220, 250, 275, 300, 330, 10, 40, 70, 95, 120, 160],
  bodies: {
    sun:     { lon: 10.0,  spd: 0.98,  retro: false },
    mercury: { lon: 12.5,  spd: 1.4,   retro: true },
    moon:    { lon: 188.0, spd: 12.1,  retro: false },
    venus:   { lon: 175.0, spd: 1.1,   retro: false },
    mars:    { lon: 100.0, spd: 0.6,   retro: false },
    jupiter: { lon: 280.0, spd: 0.12,  retro: false },
    saturn:  { lon: 97.0,  spd: 0.09,  retro: true },
    uranus:  { lon: 250.0, spd: 0.04,  retro: true },
    neptune: { lon: 130.0, spd: 0.02,  retro: false },
    pluto:   { lon: 70.0,  spd: 0.01,  retro: false },
    nn:      { lon: 308.0, spd: 0.05,  retro: true },
    vesta:   { lon: 68.0,  spd: 0.3,   retro: false },
  },
  lilith: 40.0,
};
