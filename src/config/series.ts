/**
 * Writing series. A series is declared once here; a piece joins one with two
 * frontmatter fields on its `writings` entry (`series`, `seriesNumber`), and
 * the label ("Futurist · No. 1"), the accent, the reading-room listing, the
 * Gallery card and the series index at `href` all follow from that entry.
 * See docs/handoff-everyone-searchable.md, "Adding the next futurist essay".
 *
 * A new series is one more key here plus its index page, a two-line file
 * at src/pages/writings/<id>/index.astro that renders SeriesIndex.
 */
import { accents, type SectionId } from '../design/tokens';

interface SeriesSpec {
  /** Short name, used in labels: "Futurist · No. 1". */
  name: string;
  /** Collection name for titles and schema: "Futurist essays". */
  title: string;
  /** The series index. Its page lives at src/pages/writings/<id>/index.astro. */
  href: string;
  /** Accent token id from src/design/tokens.ts. */
  accent: SectionId;
  /** One line for the index page and its meta description. */
  statement: string;
}

export const series = {
  futurist: {
    name: 'Futurist',
    title: 'Futurist essays',
    href: '/writings/futurist/',
    accent: 'futurist',
    /* PLACEHOLDER(owner): the series' one-line statement, shown on /writings/futurist/. */
    statement: 'Essays on what comes next, each staged as its own scrolling page.',
  },
} as const satisfies Record<string, SeriesSpec>;

export type SeriesId = keyof typeof series;
export const seriesIds = Object.keys(series) as [SeriesId, ...SeriesId[]];

/** "Futurist · No. 1" */
export function seriesLabel(id: SeriesId, number: number): string {
  return `${series[id].name} · No. ${number}`;
}

/** The series' accent hex, read from the design tokens. */
export function seriesAccent(id: SeriesId): string {
  return accents[series[id].accent];
}
