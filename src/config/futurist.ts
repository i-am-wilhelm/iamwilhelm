/**
 * The Futurist pages mounted exactly as their approved source files (in
 * _incoming/futurist-essays/), by src/lib/futurist.ts: Face Forward, The
 * Receipts, Depth Chart, Quantum Banking and Free Won't, the third to
 * seventh Futurist installments; and one page from another series mounted
 * the same way, The So-Called Count (Mythmaking No. 3), and after it
 * Cannot Be Uninstalled (Mythmaking No. 4).
 *
 * `sha256` is the approved file's hash: the build stops if the file on
 * record is not the file that was approved. `night` is the page's own
 * background, for the browser's theme colour. `preload` names the font
 * files the opening frame is set in. `dir` names the folder under _incoming/
 * when the file is filed somewhere other than futurist-essays/: The
 * So-Called Count (Mythmaking No. 3) arrived as one whole document like
 * these, so the same function mounts it from _incoming/mythmaking/.
 */
export const FUTURIST_SOURCES = {
  'face-forward': {
    sha256: 'a180131b3323edd873f22805fc4dd67844db5fe612a8364bc41199d832233069',
    night: '#070b16',
    preload: ['/fonts/big-shoulders-display-latin-wght-normal.woff2', '/fonts/public-sans-latin-wght-normal.woff2'],
  },
  'the-receipts': {
    sha256: 'a51be4be6b8d801e4e397c023c684f50c104c1cb55a9345e2172f6cf074e5899',
    night: '#22262b',
    preload: ['/fonts/doto-latin-wght-normal.woff2', '/fonts/ibm-plex-mono-latin-400-normal.woff2'],
  },
  'depth-chart': {
    sha256: '7b0d2bd8c2e9611cb020980130e177d2fa3236af82b5b0bcb785a633b6e6dddd',
    night: '#0e1419',
    preload: ['/fonts/barlow-condensed-latin-800-normal.woff2', '/fonts/public-sans-latin-wght-normal.woff2'],
  },
  'quantum-banking': {
    sha256: '8c5bdb978bd96a258261cee2465e690622b9eb0b9808c2a4ce00673e03afeebe',
    night: '#0c1814',
    preload: ['/fonts/barlow-condensed-latin-800-normal.woff2', '/fonts/public-sans-latin-wght-normal.woff2'],
  },
  'free-wont': {
    sha256: '501aa9169d4266e3dc249b8f13c1572b5800a25f4d1141bd879e497cf3187696',
    night: '#0a0c11',
    preload: ['/fonts/alegreya-latin-wght-normal.woff2', '/fonts/alegreya-latin-wght-italic.woff2'],
  },
  'the-so-called-count': {
    dir: 'mythmaking',
    sha256: '6ae27f7c5943d1d36e8b5da698c9ce82d988f7209474d557888e4f32ceca136f',
    night: '#0b0908',
    preload: ['/fonts/bodoni-moda-latin-opsz-normal.woff2', '/fonts/pinyon-script-latin-400-normal.woff2', '/fonts/martian-mono-latin-wght-normal.woff2'],
  },
  'cannot-be-uninstalled': {
    dir: 'mythmaking',
    sha256: '6f601eaf01cdcbb56e9f537f156e06c1663a58a716193071d029930d5732458f',
    night: '#0d0c0b',
    preload: ['/fonts/im-fell-english-latin-400-normal.woff2', '/fonts/vt323-latin-400-normal.woff2'],
  },
} as const;

export type FuturistSlug = keyof typeof FUTURIST_SOURCES;
