/**
 * The works on the wall in Room III (Advancing Liberty Media / Websites by
 * Wilhelm). Four pieces, chosen for what they show rather than how many
 * there are: the manifesto, the rain, the product site, and the poems.
 *
 * Pictures live in public/work/<slug>.webp at 960x600 (the ALM captures
 * come from advancing-liberty-media2's scripts/capture.mjs; the poem still
 * is a capture of this site's own gallery page).
 *
 * Every outbound URL is checked by scripts/verify-links.mjs in the preview
 * deploy. An entry whose link stops resolving gets `hidden: true` until it
 * is fixed; hidden entries are never rendered.
 */
export interface PortfolioItem {
  slug: string;
  title: string;
  /** Shown in the wall label under the title. */
  medium: string;
  /** One or two sentences for the caption beneath the frame. */
  caption: string;
  /** Where "Visit the work" goes. Absolute for client sites, a path here. */
  href: string;
  /** Printed under the caption. */
  domain: string;
  year: string;
  /** Alt text for the picture. */
  alt: string;
  /** Live scene module in src/scripts/case/live/, played over the still. */
  live?: 'rain';
  /** The flagship hangs first and boots on the wall. */
  flagship?: boolean;
  /** Withheld from the page (see verify-links). */
  hidden?: boolean;
}

const work: PortfolioItem[] = [
  {
    slug: 'the-manifesto',
    title: 'The Great Libertarian Data Loss',
    medium: 'Interactive essay; scroll page with a page that degrades and resolves',
    caption:
      'A manifesto that reads like a game. The margins forget as you scroll, the page decays, and a press-and-hold turn resolves it. Written to be lifted: every section quotes cleanly into a post.',
    href: 'https://libertariantoolsuite.com/the-manifesto',
    domain: 'libertariantoolsuite.com/the-manifesto',
    year: '2026',
    alt: 'The opening of The Great Libertarian Data Loss, an interactive essay on libertariantoolsuite.com.',
    flagship: true,
  },
  {
    slug: 'greasyporcupines',
    title: 'Greasy Porcupines',
    medium: 'Website for a mobile mechanic crew in the White Mountains; dispatch form, parts fund',
    caption:
      "Headlights in the rain on a two-lane mountain road. A wrench crew's site with a dispatch form, a parts fund, and a door to join. The picture on the wall plays: cars pass, the ridge lights up.",
    href: 'https://greasyporcupines.com',
    domain: 'greasyporcupines.com',
    year: '2026',
    alt: 'The greasyporcupines.com homepage: a night road in the rain.',
    live: 'rain',
  },
  {
    slug: 'libertariantoolsuite',
    title: 'Libertarian Tool Suite',
    medium: 'Product site for BackGold; long-scroll argument, built for search',
    caption:
      'One long-scroll argument for one login, sold to one reader: the candidate who has lost a list before. Order from chaos, told through a gentle dither, and the front door to the manifesto.',
    href: 'https://libertariantoolsuite.com',
    domain: 'libertariantoolsuite.com',
    year: '2026',
    alt: 'The libertariantoolsuite.com homepage.',
  },
  {
    slug: 'the-keeper-and-the-flame',
    title: 'The Visualized Poems',
    medium: 'Four interactive pages: The Keeper and the Flame, PHARMAKON, The Only Sighted One, Equal Volume',
    caption:
      'Poems and essays set on pages you walk through. Lines fall loose on the screen, a beam turns on a seven-second sweep, a vessel fills while you hold it. The newest line of work, and the one growing fastest.',
    href: '/gallery/',
    domain: 'iamwilhelm.com/gallery',
    year: '2026',
    alt: 'The Keeper and the Flame: a lighthouse beam over black water, the title set in the night.',
  },
];

/** The works, in hanging order, with their catalogue numbers. */
export const portfolio = work
  .filter((w) => !w.hidden)
  .map((w, i) => ({ ...w, code: `III.${String(i + 1).padStart(2, '0')}` }));

export type Work = (typeof portfolio)[number];

/** Every outbound link the museum depends on, for scripts/verify-links.mjs. */
export const allPortfolioUrls = work
  .filter((w) => w.href.startsWith('http'))
  .map((w) => ({ slug: w.slug, url: w.href, hidden: !!w.hidden }));
