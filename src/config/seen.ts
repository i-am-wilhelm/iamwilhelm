/**
 * The Seen institutions batch: pages mounted exactly as their approved
 * source files (in _incoming/art-scrollies/), by src/lib/seen.ts.
 *
 * `SEEN_CHAIN` is the reading order of the whole series, by slug: the
 * essays already hung, then No. 7 to No. 15. The colophon's "Previous" and
 * "Next" links follow it. The Snowflake Machine is unnumbered and stands
 * outside the chain.
 */
export const SEEN_CHAIN = [
  'the-double-image',
  'varos-workshop',
  'monet-invented-the-dither',
  'blake-wrote-it-backwards',
  'nobody-sees-the-same-sea',
  'type-is-an-image',
  'the-sleep-of-reason',
  'why-klimt-went-to-ravenna',
  'redons-turn',
  'how-to-throw-a-flame-twenty-miles',
  'living-vanitas',
  'the-mask-is-the-method',
] as const;

/**
 * The making-of line in every numbered page's colophon. The wording is
 * pending the owner's decision: change it here and every page mounted from
 * a source file follows. `SOURCE` is the sentence as the source files carry
 * it (what gets replaced); `LINE` is what the site prints.
 */
export const SEEN_AI_LINE_SOURCE =
  'Research, writing and code made with AI assistance and checked against the sources listed.';
export const SEEN_AI_LINE = SEEN_AI_LINE_SOURCE;
