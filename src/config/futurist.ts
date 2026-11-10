/**
 * The Futurist pages mounted exactly as their approved source files (in
 * _incoming/futurist-essays/), by src/lib/futurist.ts: Face Forward and its
 * companion, The Receipts.
 *
 * `sha256` is the approved file's hash: the build stops if the file on
 * record is not the file that was approved. `night` is the page's own
 * background, for the browser's theme colour. `preload` names the font
 * files the opening frame is set in.
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
} as const;

export type FuturistSlug = keyof typeof FUTURIST_SOURCES;

/**
 * Both hang in the Gallery only: the homepage wall (RoomGallery) leaves
 * these frames out. Remove a slug to hang it on the homepage too.
 */
export const FUTURIST_GALLERY_ONLY: string[] = ['face-forward', 'the-receipts'];
