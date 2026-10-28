/**
 * The twelve zodiac signs as hairline stroke paths on a 24x24 grid. Drawn
 * as SVG rather than set as Unicode so no platform swaps in a colour emoji,
 * and so the strokes match the ring's hairline weight. Classical register
 * only: these are wayfinding marks, the same glyphs an engraved celestial
 * ring would carry.
 */
export type Sign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export const SIGNS: Sign[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

export const SIGN_NAMES: Record<Sign, string> = {
  aries: 'Aries',
  taurus: 'Taurus',
  gemini: 'Gemini',
  cancer: 'Cancer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Scorpio',
  sagittarius: 'Sagittarius',
  capricorn: 'Capricorn',
  aquarius: 'Aquarius',
  pisces: 'Pisces',
};

export const GLYPHS: Record<Sign, string> = {
  aries:
    'M12 21V9M12 9C12 4.5 9.5 3 7.5 3.5S4.5 6 5 8M12 9C12 4.5 14.5 3 16.5 3.5S19.5 6 19 8',
  taurus:
    'M4.5 3.5C5.5 7.5 8.5 9.5 12 9.5S18.5 7.5 19.5 3.5M12 9.5A5.5 5.5 0 1 0 12.01 9.5',
  gemini: 'M4.5 4C9.5 6 14.5 6 19.5 4M4.5 20C9.5 18 14.5 18 19.5 20M9 5.3V18.7M15 5.3V18.7',
  cancer:
    'M20 8.5C18 5.5 15 4.5 12 4.5C8 4.5 5 6 4.5 9M4.5 9A2.6 2.6 0 1 0 9.7 9A2.6 2.6 0 1 0 4.5 9M4 15.5C6 18.5 9 19.5 12 19.5C16 19.5 19 18 19.5 15M14.3 15A2.6 2.6 0 1 0 19.5 15A2.6 2.6 0 1 0 14.3 15',
  leo: 'M5 14A3 3 0 1 0 11 14A3 3 0 1 0 5 14M11 14C11 9 8.5 6.5 10.5 4.5S16.5 3.5 16.5 7.5C16.5 11 13.5 14 14 17.5S18 21 20 18.5',
  virgo:
    'M3 6.5C4 5.5 5 6 5 8V18M5 9C5 5.5 9 5.5 9 9V18M9 9C9 5.5 13 5.5 13 9V15.5C13 18.5 15.5 20 18.5 18.5M13 13C14.5 9.5 19.5 10 19.5 13.5C19.5 17 16 19.5 12.5 21',
  libra: 'M4 19.5H20M4 15.5H9C7 13.5 7 7.5 12 7.5S17 13.5 15 15.5H20',
  scorpio:
    'M3 6.5C4 5.5 5 6 5 8V18M5 9C5 5.5 9 5.5 9 9V18M9 9C9 5.5 13 5.5 13 9V17C13 19 14.5 19.5 16.5 18.5L20.5 16.5M20.5 16.5L17.5 15.5M20.5 16.5L19.5 19.5',
  sagittarius: 'M4.5 19.5L19.5 4.5M12 4.5H19.5V12M7.5 10L14 16.5',
  capricorn:
    'M3.5 6C4.5 5 6 5.5 6 7.5V17M6 9C6 5 11 5 11 9V15C11 19 15.5 20.5 17.5 17C19 14 15.5 12 14 14.5C12.5 17 11 19.5 8 20.5',
  aquarius: 'M3 10.5L6 7.5L9 10.5L12 7.5L15 10.5L18 7.5L21 10.5M3 17L6 14L9 17L12 14L15 17L18 14L21 17',
  pisces: 'M5.5 3C10 7.5 10 16.5 5.5 21M18.5 3C14 7.5 14 16.5 18.5 21M6.5 12H17.5',
};

const ROMAN: [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Roman numeral for a room number (1 to 39 is plenty for a small museum). */
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
