/**
 * The rooms and pages search can find beside the pieces themselves (the
 * pieces, the series and the tags come from their own registries). Each
 * entry is indexed from its built page: `source` is the page to read and
 * `section` the id of the part of it to read (the homepage's rooms);
 * without `section` the page's main text is read, weighted below a piece's
 * own words so a room never outranks the piece it lists.
 */
export interface SearchRoom {
  /** Where the result goes. */
  url: string;
  title: string;
  /** The small line above the title in a result. */
  label: string;
  /** One line under it. */
  line: string;
  /** The built page to read, when it is not `url`. */
  source?: string;
  /** The id of the element on `source` to read. */
  section?: string;
}

export const SEARCH_ROOMS: SearchRoom[] = [
  { url: '/#backgold', source: '/', section: 'backgold', title: 'BackGold', label: 'Room I · The Treasury', line: 'The platform for campaigns and organizations: giving, email, text, calls, field, sites and compliance in one record.' },
  { url: '/gallery/', title: 'The Gallery', label: 'Room II', line: 'Every scroll page, hung by series.' },
  { url: '/writings/', title: 'Writings', label: 'Room III · The reading room', line: 'The readings, newest first: wall text read straight through.' },
  { url: '/services/', title: 'Commissions', label: 'Room IV', line: 'Scrollies built to order: what I build, the process, the price, and the questions people ask.' },
  { url: '/what-is-a-scrolly/', title: 'What is a scrolly?', label: 'Room IV · Glossary', line: 'The definition, the parts, what one costs, and examples.' },
  { url: '/method/', title: 'Method', label: 'Room IV · Method', line: 'How these pieces are made: what is read in the original, and what is machine-assisted.' },
  { url: '/scrollbrief/', title: 'Scrollbrief', label: 'Room V · The studio', line: 'Interactive case stories for trial lawyers.' },
  { url: '/support/', title: 'Patronage', label: 'Keep the lights on', line: 'These pages are free to read and slow to make: how to support the work.' },
  { url: '/earl/', title: 'Wilhelm for Earl', label: 'A broadsheet', line: 'A satirical campaign for earl, with a boat, a pledge and a mead-hall band.' },
  { url: '/#contact', source: '/', section: 'contact', title: 'Contact', label: 'The colophon', line: 'Write, book a call, or sign up for the newsletter.' },
];

/** One thing search can find, as src/pages/search/records.json.ts lists it for src/integrations/search.ts. */
export interface SearchRecord {
  url: string;
  /** The built page the text is read from, and the part of it. */
  source: string;
  read: 'twin' | 'main' | 'section' | 'none';
  section?: string;
  kind: 'scroll' | 'reading' | 'series' | 'room';
  title: string;
  label: string;
  line: string;
  /** A series id, `elsewhere` for a scroll page in none, or empty. */
  series: string;
  tags: string[];
  /** YYYY-MM-DD, for newest-first when browsing a tag. */
  date: string;
  image: string;
}
