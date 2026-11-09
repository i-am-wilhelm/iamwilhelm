import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { seriesIds } from './config/series';

/**
 * Local markdown collections. A Ghost backend can be wired in later by
 * swapping this glob loader for a Ghost Content API loader, the schema is
 * the stable interface the pages depend on.
 *
 * Both collections carry the same series fields: `series` (an id from
 * src/config/series.ts) and `seriesNo` (the piece's number in it). A scroll
 * page is numbered on its `gallery` entry, a reading on its `writings`
 * entry; a piece with both entries (PHARMAKON, The Unseen One, Everyone,
 * Searchable, Where It Was) carries the same pair on both and the build
 * refuses a mismatch (src/lib/pieces.ts).
 */
const seriesFields = {
  series: z.enum(seriesIds).optional(),
  seriesNo: z.number().int().positive().optional(),
};
const seriesTogether = {
  check: (d: { series?: string; seriesNo?: number }) => (d.series === undefined) === (d.seriesNo === undefined),
  message: '`series` and `seriesNo` go together: set both or neither.',
};

const writings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writings' }),
  schema: z
    .object({
      title: z.string(),
      date: z.coerce.date(),
      /** Last substantive revision, for dateModified; `date` when absent. */
      updated: z.coerce.date().optional(),
      /** Symbols chosen for thematic relevance to the piece (spec §4.6). */
      symbols: z.array(z.string()).default([]),
      /** Accent token id from src/design/tokens.ts. */
      accent: z.string().default('writings'),
      draft: z.boolean().default(false),
      description: z.string().optional(),
      /**
       * How the piece is staged. `museum` is wall text in the reading room
       * at /writings/[slug]. `descent` renders the entry through Base.astro,
       * with the WebGL stage, scroll choreography, and the orchestra pit,
       * for pieces whose movements are marked up as `.section[data-section]`;
       * since the face-lift its page lives in the Gallery, at
       * src/pages/gallery/<id>.astro (The Unseen One).
       *
       * `scrolly` means the piece is its own page at
       * src/pages/gallery/<id>.astro on Poem.astro, the page system of The
       * Dual Thing. Poem.astro never mounts Base.astro's stack, so there is no
       * #gl-stage (no glyph dither, no smoke), no data-fade backdrop fade, and
       * the orchestra pit is never imported: the audio layer stays dormant.
       * The entry carries the piece's meta; the `gallery` entry hangs it.
       *
       * /writings/[slug] renders only `museum` entries: the reading room is
       * the readings shelf, every scroll page is in the Gallery.
       */
      treatment: z.enum(['museum', 'descent', 'scrolly']).default('museum'),
      /** Fade mode for the descent treatment (src/design/tokens.ts fadeModes). */
      fade: z.enum(['dawn', 'descent']).default('dawn'),
      /** Show the link to /method in the reading's placard (the Philosophy page). */
      methodLink: z.boolean().default(false),
      ...seriesFields,
    })
    .refine(seriesTogether.check, { message: seriesTogether.message, path: ['seriesNo'] }),
});

/**
 * The Gallery. One markdown file per framed piece in src/content/gallery;
 * the homepage's Room II and /gallery both render every entry, sorted by
 * `order` (the catalogue number is a sort key, never a label). To hang a
 * new piece, add a file: title, date, a one-line epigraph, the `verb` line,
 * its `series` and `seriesNo`, and `href` pointing at its interactive page.
 * Entries with `status: forthcoming` render as an empty frame with no link.
 */
const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: z
    .object({
      title: z.string(),
      /** Display form of the title inside the frame (e.g. spaced caps). */
      plateTitle: z.string().optional(),
      year: z.coerce.string().optional(),
      /** Publication date, for the feeds and newest-first ordering. */
      date: z.coerce.date().optional(),
      /** Last substantive revision, for dateModified in the piece's Article schema; `date` when absent. */
      updated: z.coerce.date().optional(),
      /** One line under the title on the card and the plate. */
      epigraph: z.string().optional(),
      /** Longer summary for feeds and meta; the epigraph stands in when absent. */
      description: z.string().optional(),
      /**
       * The verb line on the card: what the page is and what the reader does
       * in it, "nine steps · you draw the bow".
       */
      verb: z.string().optional(),
      /** The piece's full interactive page. Required once the piece is on view. */
      href: z.string().optional(),
      medium: z.string().default('Visualized poem; interactive page'),
      order: z.number().default(100),
      status: z.enum(['on-view', 'forthcoming']).default('on-view'),
      /** Zodiac sign for the frame's wayfinding mark (components/museum/zodiac.ts). */
      sign: z
        .enum([
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
        ])
        .default('pisces'),
      /** Plate colour inside the frame; a muted, dark hue reads best. */
      plate: z.string().default('#2b2230'),
      /**
       * The Bureau of Coincidence's docket. A poem with `subject: feminine`
       * and a `case` carries the Bureau's stamp at its foot
       * (src/components/scroll/BureauStamp.astro: "Certified coincidental,
       * Case No. …", linking to the hearing, /gallery/ladies-ladies/).
       *
       * The case number is the ecliptic longitude of the natal placement
       * that governs the poem, written degrees.minutes from 0° Aries
       * (000.00 to 359.59; three digits, a point, two): Venus at 9°01'
       * Aries is 009.01, Neptune at 16°08' Capricorn 286.08, Black Moon
       * Lilith at 23°52' Sagittarius 263.52. The hearing's own number,
       * 302.30, is Saturn at 2°30' Aquarius on the MC. Placements come
       * from the Author's chart, src/scripts/natal/chart.michael.ts.
       */
      subject: z.enum(['feminine']).optional(),
      case: z
        .string()
        .regex(/^(?:[0-2]\d\d|3[0-5]\d)\.[0-5]\d$/, '`case` is degrees.minutes of ecliptic longitude, e.g. "009.01".')
        .optional(),
      ...seriesFields,
    })
    .refine(seriesTogether.check, { message: seriesTogether.message, path: ['seriesNo'] })
    .refine((d) => (d.subject === undefined) === (d.case === undefined), {
      message: '`subject` and `case` go together: the stamp needs both.',
      path: ['case'],
    }),
});

export const collections = { writings, gallery };
