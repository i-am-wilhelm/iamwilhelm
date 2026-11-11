/**
 * The series. Every live piece on the site belongs to one, declared here
 * once; a piece joins with two frontmatter fields on its collection entry
 * (`series`, `seriesNo`), on the `gallery` entry for a scroll page and on
 * the `writings` entry for a reading. The label ("In the Original · No. 1"),
 * the accent, the Gallery card, the reading-room row, the scroll-page
 * header, the series index at `href` and the series feed at `feed` all
 * follow from that entry. The unified view of both collections is
 * src/lib/pieces.ts.
 *
 * A new series is one more key here plus its index page, a two-line file
 * at src/pages/writings/<id>/index.astro that renders SeriesIndex. The feed
 * (src/pages/writings/[series]/rss.xml.ts) needs nothing.
 */

interface SeriesSpec {
  /** Short name, used in labels: "Futurist · No. 1". */
  name: string;
  /** Collection name for titles and schema: "Futurist essays". */
  title: string;
  /** The series index. Its page lives at src/pages/writings/<id>/index.astro. */
  href: string;
  /** Accent hex. Every value clears 4.5:1 as text on the museum's ivory walls. */
  accent: string;
  /** One line for the index page, its meta description and the feed. */
  statement: string;
}

export const series = {
  'in-the-original': {
    name: 'In the Original',
    title: 'In the Original',
    href: '/writings/in-the-original/',
    accent: '#7b4128',
    /* TODO(owner): the series' one-line statement, shown on /writings/in-the-original/ and in its feed. */
    statement: 'Essays that read a myth back through the Greek it was first told in.',
  },
  'through-the-lens': {
    name: 'Through the Lens',
    title: 'Through the Lens',
    href: '/writings/through-the-lens/',
    accent: '#6a3fa0',
    /* TODO(owner): the series' one-line statement, shown on /writings/through-the-lens/ and in its feed. */
    statement: 'Modern ideas read back through the Greek words underneath them.',
  },
  futurist: {
    name: 'Futurist',
    title: 'Futurist essays',
    href: '/writings/futurist/',
    accent: '#c0281c',
    /* TODO(owner): the series' one-line statement, shown on /writings/futurist/ and in its feed. */
    statement: 'The Futurist installments: essays on what comes next, each staged as its own scrolling page.',
  },
  mimics: {
    name: 'Mimics',
    title: 'Mimics',
    href: '/writings/mimics/',
    accent: '#1d6d84',
    /* TODO(owner): the series' one-line statement, shown on /writings/mimics/ and in its feed. */
    statement: 'Essays on men, mirrors, and the stories they copy.',
  },
  poems: {
    name: 'Poems',
    title: 'Visualized poems',
    href: '/writings/poems/',
    accent: '#5a3c63',
    /* TODO(owner): the series' one-line statement, shown on /writings/poems/ and in its feed. */
    statement: 'Poems set on their own night pages, each with a canvas that answers the reader.',
  },
  seen: {
    name: 'Seen',
    title: 'Seen',
    href: '/writings/seen/',
    accent: '#7d5f18',
    statement: 'Essays on how a picture resolves: the double image, the lit room, the broken dab, and the glyph dither they lead to.',
  },
  readings: {
    name: 'Readings',
    title: 'Readings',
    href: '/writings/readings/',
    accent: '#3d5a4b',
    /* TODO(owner): the series' one-line statement, shown on /writings/readings/ and in its feed. */
    statement: 'Wall text from the reading room: the long pieces read straight through.',
  },
} as const satisfies Record<string, SeriesSpec>;

export type SeriesId = keyof typeof series;
export const seriesIds = Object.keys(series) as [SeriesId, ...SeriesId[]];

/** "Futurist · No. 1" */
export function seriesLabel(id: SeriesId, no: number): string {
  return `${series[id].name} · No. ${no}`;
}

/** The series' accent hex. */
export function seriesAccent(id: SeriesId): string {
  return series[id].accent;
}

/** The series' feed: /writings/<id>/rss.xml */
export function seriesFeed(id: SeriesId): string {
  return `${series[id].href}rss.xml`;
}
