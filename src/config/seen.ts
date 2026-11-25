/**
 * The Seen institutions batch: pages mounted exactly as their approved
 * source files (in _incoming/art-scrollies/), by src/lib/seen.ts.
 *
 * `SEEN_CHAIN` is the reading order of the pages that take their
 * "Previous" and "Next" links from it, by slug: No. 1 to No. 3, then No. 7
 * to No. 15. No. 4 to No. 6 name their own neighbours (SEEN_SOURCES below),
 * and No. 16 to No. 18 name none. The Snowflake Machine is unnumbered and
 * stands outside the chain.
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
 * The making-of line in every numbered page's colophon, and in the colophon
 * of any other page mounted from a source file that carries it (Nine
 * Hundred Lights, Per My Last Memo). The wording is pending the owner's
 * decision: change it here and every page mounted from a source file
 * follows. `SOURCE` is the sentence as the source files carry it (what gets
 * replaced); `LINE` is what the site prints.
 */
export const SEEN_AI_LINE_SOURCE =
  'Research, writing and code made with AI assistance and checked against the sources listed.';
export const SEEN_AI_LINE = SEEN_AI_LINE_SOURCE;

/**
 * Pages built on the same system (hero, pinned stages, cards) that were
 * delivered on their own, outside the batch: slug to source file.
 * src/lib/seen.ts mounts them the same way. Such a file may carry no meta
 * description; the gallery entry's `description` is printed in its place.
 * Fall Line and Off Soundings are filed beside the batch's sources and
 * shelved in Seen, but stand outside SEEN_CHAIN: their colophons name no
 * previous piece and carry no making-of line.
 */
export const SEEN_SOURCES: Record<string, string> = {
  'due-space': '_incoming/due-space/due-space.html',
  'nine-hundred-lights': '_incoming/elsewhere/nine-hundred-lights.html',
  'per-my-last-memo': '_incoming/elsewhere/per-my-last-memo.html',
  'fall-line': '_incoming/art-scrollies/fall-line.html',
  'off-soundings': '_incoming/art-scrollies/off-soundings.html',
  /* Seen No. 4 to 6, from their published artifacts. They name their own
     previous and next pieces, which src/lib/seen.ts links, so they too
     stand outside SEEN_CHAIN; like it, they follow Monet Invented the
     Dither and lead to Blake Wrote It Backwards. */
  'panofsky-for-internet-people': '_incoming/art-scrollies/panofsky-for-internet-people.html',
  'root-rectangles-in-desmos': '_incoming/art-scrollies/root-rectangles-in-desmos.html',
  'the-paranoiac-critical-method-applied': '_incoming/art-scrollies/the-paranoiac-critical-method-applied.html',
  'those-who-heard-the-sky': '_incoming/elsewhere/those-who-heard-the-sky.html',
  'backgold-scrolly': '_incoming/elsewhere/backgold-scrolly.html',
  'lla-scrolly-homepage': '_incoming/elsewhere/lla-scrolly-homepage.html',
  /* Seen No. 18, from its published artifact with the approval notes taken
     out. Like Fall Line and Off Soundings it is shelved in Seen and stands
     outside SEEN_CHAIN: its foot names no previous piece and carries no
     making-of line. */
  'the-label-comes-last': '_incoming/elsewhere/the-label-comes-last.html',
};

/**
 * Where each mounted page wears its breadcrumb trail (src/lib/crumbs.ts).
 * By default a small chip in the top-left corner: "Foyer / Gallery /
 * Seen" while the page opens, gone once the reader is under way (the
 * pages' own control bars use the top of the screen as they scroll), back
 * near the top. `side: 'right'` moves it to the top-right corner, for a
 * page whose own label sits top-left; `tone: 'light'` dresses it in ivory
 * for a light page. `none` leaves the top alone, for a page with
 * its own masthead across the top. Every page also ends on the trail and
 * its tags (the "Filed under" foot), after its own colophon, except the
 * pages in SEEN_NO_FOOT.
 */
export const SEEN_CRUMB_EXIT: Record<string, { side?: 'right'; tone?: 'light' } | 'none'> = {
  'fall-line': { side: 'right' },
  'off-soundings': { side: 'right', tone: 'light' },
  'the-label-comes-last': { side: 'right', tone: 'light' },
  'due-space': { tone: 'light' },
  'type-is-an-image': { tone: 'light' },
  'root-rectangles-in-desmos': { tone: 'light' },
  'backgold-scrolly': 'none',
  'lla-scrolly-homepage': 'none',
  'per-my-last-memo': 'none',
  'the-snowflake-machine': 'none',
};

/**
 * A page that holds the screen (no scroll, so no foot to reach) wears its
 * trail inline in its own bottom line instead: the exact source text the
 * trail goes in front of. Exhibit mode hides it with the rest of the line.
 */
export const SEEN_CRUMB_INLINE: Record<string, string> = {
  'the-snowflake-machine': '<button type="button" id="exhibitBtn"',
};

/** Pages that end without the "Filed under" foot: the screen-holding toy. */
export const SEEN_NO_FOOT: readonly string[] = ['the-snowflake-machine'];
