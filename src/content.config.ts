import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { seriesIds } from './config/series';

/**
 * Local markdown collections. A Ghost backend can be wired in later by
 * swapping this glob loader for a Ghost Content API loader, the schema is
 * the stable interface the pages depend on.
 */
const writings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writings' }),
  schema: z
    .object({
      title: z.string(),
      date: z.coerce.date(),
      /** Symbols chosen for thematic relevance to the piece (spec §4.6). */
      symbols: z.array(z.string()).default([]),
      /** Accent token id from src/design/tokens.ts. */
      accent: z.string().default('writings'),
      draft: z.boolean().default(false),
      description: z.string().optional(),
      /**
       * How /writings/[slug] stages the piece. `museum` is wall text in the
       * reading room. `descent` renders the same route through Base.astro,
       * with the WebGL stage, scroll choreography, and the orchestra pit, for
       * pieces whose movements are marked up as `.section[data-section]`.
       *
       * `scrolly` opts the route out of all of that: [slug] does not render
       * the entry, and the piece is its own page at
       * src/pages/writings/<id>.astro on Poem.astro, the page system of The
       * Dual Thing. Poem.astro never mounts Base.astro's stack, so there is no
       * #gl-stage (no glyph dither, no smoke), no data-fade backdrop fade, and
       * the orchestra pit is never imported: the audio layer stays dormant (no
       * Tone.js, no tap listener, nothing sounds). The entry still lists the
       * piece in the reading room and carries its meta and series.
       */
      treatment: z.enum(['museum', 'descent', 'scrolly']).default('museum'),
      /** Fade mode for the descent treatment (src/design/tokens.ts fadeModes). */
      fade: z.enum(['dawn', 'descent']).default('dawn'),
      /** Series id from src/config/series.ts; the piece is No. `seriesNumber` in it. */
      series: z.enum(seriesIds).optional(),
      seriesNumber: z.number().int().positive().optional(),
    })
    .refine((d) => (d.series === undefined) === (d.seriesNumber === undefined), {
      message: '`series` and `seriesNumber` go together: set both or neither.',
      path: ['seriesNumber'],
    }),
});

/**
 * The Gallery of Visualized Poetry. One markdown file per framed poem in
 * src/content/gallery; the homepage's Room II and /gallery both render
 * every entry, sorted by `order`. To hang a new poem, add a file: title,
 * year, a one-line epigraph, and `href` pointing at its interactive page.
 * Entries with `status: forthcoming` render as an empty frame with no link.
 * A frame whose id matches a `writings` entry in a series shows that series'
 * label ("Futurist · No. 1") from the writings entry; nothing to repeat here.
 */
const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: z.object({
    title: z.string(),
    /** Display form of the title inside the frame (e.g. spaced caps). */
    plateTitle: z.string().optional(),
    year: z.coerce.string().optional(),
    epigraph: z.string().optional(),
    /** The poem's full interactive page. Required once the poem is on view. */
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
  }),
});

export const collections = { writings, gallery };
