/**
 * Client sites for Room III (Advancing Liberty Media / Websites by Wilhelm).
 *
 * Source of truth: advancing-liberty-media2, src/content/work.ts. Entries
 * are copied verbatim (featured, public cartridges, in cartridge order) and
 * the console screenshots come from that repo's public/work/<slug>.webp. When
 * the ALM portfolio changes, mirror it here.
 *
 * Every URL is checked by scripts/verify-links.mjs (run in the preview
 * deploy workflow). An entry whose link stops resolving gets `hidden: true`
 * until it is fixed; hidden entries are never rendered.
 */
export interface PortfolioItem {
  slug: string;
  name: string;
  /** Race, office, or one-line description. */
  detail: string;
  /** Short label printed on the cartridge band. */
  kind: string;
  service: string;
  url: string;
  domain: string;
  tagline: string;
  year: string;
  /** The gold cartridge. */
  flagship?: boolean;
  /** Live scene module in src/scripts/case/live/. */
  live?: 'rain';
  /** Withheld from the page (see verify-links). */
  hidden?: boolean;
  /** Sprite name in components/museum/case/sprites.ts; defaults to the slug. */
  sprite?: string;
}

const work: PortfolioItem[] = [
  {
    slug: 'the-manifesto',
    name: 'The Great Libertarian Data Loss',
    detail: 'An interactive essay on libertariantoolsuite.com',
    kind: 'Interactive essay',
    service: 'Interactive design in storytelling',
    url: 'https://libertariantoolsuite.com/the-manifesto',
    domain: 'libertariantoolsuite.com/the-manifesto',
    flagship: true,
    sprite: 'torch',
    tagline: 'A manifesto that reads like a game: the page degrades, then resolves as you turn it.',
    year: '2026',
  },
  {
    slug: 'lpwa',
    name: 'Libertarian Party of Washington',
    detail: 'Washington State',
    kind: 'State party',
    service: 'Website by Wilhelm',
    url: 'https://lpwa.org',
    domain: 'lpwa.org',
    tagline: 'A state party site with candidates, county affiliates, and a store.',
    year: '2026',
  },
  {
    slug: 'greasyporcupines',
    name: 'Greasy Porcupines',
    detail: "Mobile mechanics in Arizona's White Mountains",
    kind: 'Local business',
    service: 'Website by Wilhelm',
    url: 'https://greasyporcupines.com',
    domain: 'greasyporcupines.com',
    live: 'rain',
    tagline: 'Headlights in the rain: a wrench crew with a dispatch form, a parts fund, and a door to join.',
    year: '2026',
  },
  {
    slug: 'electpattiegray',
    name: 'Pattie Gray',
    detail: 'Pacific County Commissioner, Position 3',
    kind: 'Candidate',
    service: 'Website by Wilhelm',
    url: 'https://electpattiegray.com',
    domain: 'electpattiegray.com',
    tagline: 'A county campaign with donations, events, and volunteers in one place.',
    year: '2026',
  },
  {
    slug: 'libertariantoolsuite',
    name: 'Libertarian Tool Suite',
    detail: 'BackGold for liberty candidates and organizations',
    kind: 'Product site',
    service: 'Website by Wilhelm',
    url: 'https://libertariantoolsuite.com',
    domain: 'libertariantoolsuite.com',
    tagline: 'One long-scroll argument for one login, sold to one reader.',
    year: '2026',
  },
  {
    slug: 'ryanforwyoming',
    name: 'Ryan Shollenberger',
    detail: 'Wyoming House District 11',
    kind: 'Candidate',
    service: 'Website by Wilhelm',
    url: 'https://ryanforwyoming.com',
    domain: 'ryanforwyoming.com',
    tagline: 'Big sky, short ballot: a district campaign with a clear ask.',
    year: '2026',
  },
  {
    slug: 'libertarianleadership',
    name: 'Libertarian Leadership Academy',
    detail: 'Training for candidates, campaign staff, and organizers',
    kind: 'Organization',
    service: 'Website by Wilhelm',
    url: 'https://libertarianleadership.org',
    domain: 'libertarianleadership.org',
    tagline: "The academy that trains the movement's next candidates.",
    year: '2026',
  },
  {
    slug: 'justinperoli',
    name: 'Justin Peroli',
    detail: 'Ohio House District 66',
    kind: 'Candidate',
    service: 'Website by Wilhelm',
    url: 'https://justinperoli.com',
    domain: 'justinperoli.com',
    tagline: 'A statehouse campaign site built to raise from day one.',
    year: '2026',
  },
  {
    slug: 'donmyers',
    name: 'Don Myers',
    detail: 'Washington State House District 13',
    kind: 'Candidate',
    service: 'Website by Wilhelm',
    url: 'https://donmyers4wastaterep13.com',
    domain: 'donmyers4wastaterep13.com',
    tagline: 'A legislative campaign with the platform, the plan, and the donate button.',
    year: '2026',
  },
  {
    slug: 'terpac',
    name: 'The Existentialist Republic PAC',
    detail: 'Political action committee',
    kind: 'PAC',
    service: 'Website by Wilhelm',
    url: 'https://terpac.org',
    domain: 'terpac.org',
    tagline: 'A PAC site with an argument, a ledger, and a way to give.',
    year: '2026',
  },
];

/** Cartridges, in order, with their two-digit codes. */
export const portfolio = work
  .filter((w) => !w.hidden)
  .map((w, i) => ({ ...w, code: String(i + 1).padStart(2, '0'), sprite: w.sprite ?? w.slug }));

export type Cart = (typeof portfolio)[number];

/** Every outbound link the museum depends on, for scripts/verify-links.mjs. */
export const allPortfolioUrls = work.map((w) => ({ slug: w.slug, url: w.url, hidden: !!w.hidden }));
