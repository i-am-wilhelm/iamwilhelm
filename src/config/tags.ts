/**
 * The tags. Every piece on the site carries a handful, chosen from this one
 * list: what it is about, who is in it, the old sources it reads, and the
 * threads that run between pieces (fire, gold, mirrors, descents). A tag is
 * a way across the collection: series run down a wall, tags run between
 * walls.
 *
 * A piece takes its tags on the same entry that numbers it: a scroll page
 * on its `gallery` entry, a reading on its `writings` entry
 * (src/content.config.ts refuses an id that is not declared here). From
 * that one field follow the tag's page at /tags/<id>/, its line under
 * "Filed under" at the foot of every piece, the subject index at /tags/,
 * and the tag filter in search (/search/).
 *
 * To add a tag: one more entry here (a lowercase, hyphenated id), then name
 * it on the pieces. Its page is built from that; nothing else needs
 * touching. To rename one, change `label` and keep the id, so its address
 * and every piece that carries it stay put.
 *
 * TODO(owner): the first pass of tags and their one-line notes was drafted
 * from the pieces' own text (Nov 2026). Reword, merge or drop any of them.
 */

export interface TagGroupSpec {
  /** Heading on the subject index (/tags/). */
  name: string;
}

export const tagGroups = {
  myth: { name: 'Gods & myths' },
  words: { name: 'Words & old sources' },
  art: { name: 'Art & seeing' },
  people: { name: 'People' },
  sky: { name: 'Sky & sound' },
  mind: { name: 'Mind & soul' },
  money: { name: 'Money' },
  power: { name: 'Privacy & power' },
  world: { name: 'Sea, land & creatures' },
  civic: { name: 'Liberty & civic life' },
  threads: { name: 'Running threads' },
  forms: { name: 'Forms' },
} as const satisfies Record<string, TagGroupSpec>;

export type TagGroupId = keyof typeof tagGroups;

export interface TagSpec {
  /** Shown on the tag's page, in "Filed under" lines and in search. */
  label: string;
  group: TagGroupId;
  /** One line for the tag's page and its meta description. */
  note: string;
}

export const tags = {
  /* ---- Gods & myths ---------------------------------------------------- */
  'greek-myth': { label: 'Greek myth', group: 'myth', note: 'Pieces that go back to the myths themselves, and read them as they were first told.' },
  underworld: { label: 'The underworld', group: 'myth', note: 'Hades, the descent, and what waits below the ground.' },
  persephone: { label: 'Persephone', group: 'myth', note: 'The Kore: the flower, the pomegranate, and the queen below.' },
  janus: { label: 'Janus', group: 'myth', note: 'The god of doors and beginnings, who looks both ways at once.' },
  narcissus: { label: 'Narcissus', group: 'myth', note: 'The pool, the face in it, and the echo.' },
  eros: { label: 'Eros', group: 'myth', note: 'Desire as a god, and what the Greeks said he does to a person.' },
  aphrodite: { label: 'Aphrodite & Venus', group: 'myth', note: 'The goddess and the planet that carries her name.' },
  dionysus: { label: 'Dionysus', group: 'myth', note: 'The god torn apart and put back together.' },
  orpheus: { label: 'Orpheus & the Orphics', group: 'myth', note: 'The singer who went down for Eurydice, and the cult that took his name.' },
  hermes: { label: 'Hermes', group: 'myth', note: 'The god of thresholds and roads, who walks souls down and back up.' },
  athena: { label: 'Athena', group: 'myth', note: 'Pallas Athena: the grey eyes, the shield, the clear head.' },
  zeus: { label: 'Zeus', group: 'myth', note: 'The sky father, and what his order cost the others.' },
  prometheus: { label: 'Prometheus', group: 'myth', note: 'The Titan who stole fire, and the liver that paid for it.' },

  /* ---- Words & old sources -------------------------------------------- */
  'greek-words': { label: 'Greek words', group: 'words', note: 'A Greek word read closely, in the original, until it gives up what it was carrying.' },
  latin: { label: 'Latin', group: 'words', note: 'The Latin underneath an English word, or the Latin that hid the Greek.' },
  'word-histories': { label: 'Word histories', group: 'words', note: 'Where a word came from, and what it brought with it.' },
  homer: { label: 'Homer', group: 'words', note: 'The Iliad and the Odyssey, quoted and read.' },
  hesiod: { label: 'Hesiod', group: 'words', note: 'The Theogony and the Works and Days, quoted and read.' },
  plato: { label: 'Plato', group: 'words', note: 'The dialogues, quoted and read.' },
  ovid: { label: 'Ovid', group: 'words', note: 'The Metamorphoses and the Fasti, quoted and read.' },
  septuagint: { label: 'The Septuagint', group: 'words', note: 'The Greek Old Testament, read beside the pagan texts that share its words.' },

  /* ---- Art & seeing --------------------------------------------------- */
  painting: { label: 'Painting', group: 'art', note: 'Painters and paintings, taken apart and redrawn in code.' },
  printmaking: { label: 'Printing & printmaking', group: 'art', note: 'Copper, acid, stone, metal type and the halftone: how a picture or a page gets printed.' },
  color: { label: 'Color', group: 'art', note: 'How color is made, mixed, lost and seen.' },
  light: { label: 'Light', group: 'art', note: 'Lamps, lenses, windows and gold: how light is caught and thrown.' },
  perception: { label: 'Perception', group: 'art', note: 'How an eye, or a mind, decides what it is looking at.' },
  surrealism: { label: 'Surrealism', group: 'art', note: 'Dalí, Varo, and the double image.' },
  symbolism: { label: 'Symbols & hidden meanings', group: 'art', note: 'What a picture says under what it shows.' },
  geometry: { label: 'Math & geometry', group: 'art', note: 'Pieces drawn from functions, compasses and mirrors, on graph paper or in Desmos.' },
  dither: { label: 'The dither', group: 'art', note: 'Dots, dabs and glyphs: how a picture resolves from little marks.' },
  letters: { label: 'Letters & type', group: 'art', note: 'The alphabet as a drawing, a piece of metal, and a map of the sky.' },

  /* ---- People ----------------------------------------------------------- */
  'william-blake': { label: 'William Blake', group: 'people', note: 'The poet-printer who wrote every page backwards on copper.' },
  'francisco-goya': { label: 'Francisco Goya', group: 'people', note: 'The etcher of the Caprichos.' },
  'salvador-dali': { label: 'Salvador Dalí', group: 'people', note: 'The paranoiac-critical method and the double image.' },
  'claude-monet': { label: 'Claude Monet', group: 'people', note: 'Broken color and the riverbank at seven times magnification.' },
  'gustav-klimt': { label: 'Gustav Klimt', group: 'people', note: 'The gold, and where he went to find it.' },
  'odilon-redon': { label: 'Odilon Redon', group: 'people', note: 'Twenty years of black, then color.' },
  'remedios-varo': { label: 'Remedios Varo', group: 'people', note: 'The workshops, the narrow figures, the thread spun from the moon.' },
  'erwin-panofsky': { label: 'Erwin Panofsky', group: 'people', note: 'Three layers in every image.' },
  'sigmund-freud': { label: 'Sigmund Freud', group: 'people', note: 'Das Ich und das Es, before the translators got to it.' },
  'johannes-kepler': { label: 'Johannes Kepler', group: 'people', note: 'The astronomer who wrote the planets out as a score.' },
  pythagoras: { label: 'Pythagoras', group: 'people', note: 'The string, the ratio, and the music of the spheres.' },
  'johannes-gutenberg': { label: 'Johannes Gutenberg', group: 'people', note: 'Metal type and the Bible in Mainz.' },
  'carlo-cipolla': { label: 'Carlo Cipolla', group: 'people', note: 'The economic historian and his five laws of human stupidity.' },

  /* ---- Sky & sound ------------------------------------------------------ */
  astrology: { label: 'Astrology', group: 'sky', note: 'Charts, signs and placements, read as the old astrologers read them.' },
  'the-sky': { label: 'Stars & planets', group: 'sky', note: 'The night sky: the Pleiades, the orbits, and what the antennas hear.' },
  music: { label: 'Music & harmony', group: 'sky', note: 'The string, the song and the music of the spheres.' },

  /* ---- Mind & soul ------------------------------------------------------ */
  psychology: { label: 'Psychology', group: 'mind', note: 'Freud, Jung, Girard and the rest, and what we do without knowing it.' },
  'the-soul': { label: 'The soul', group: 'mind', note: 'What the soul is made of, how many parts it has, and where it goes.' },
  love: { label: 'Love & desire', group: 'mind', note: 'Crushes, longing, surrender and the gods who cause them.' },
  'free-will': { label: 'Free will', group: 'mind', note: 'The will, the veto, and what survives the hijack.' },
  faith: { label: 'Faith & grace', group: 'mind', note: 'Devotion, worship, and grace for the people we disagree with.' },
  death: { label: 'Death & mortality', group: 'mind', note: 'The skull on the table, the weighing of the heart, and the way down.' },
  poison: { label: 'Poison & cure', group: 'mind', note: 'The drug that heals or kills, depending on the hand that holds it.' },

  /* ---- Money ------------------------------------------------------------ */
  money: { label: 'Money', group: 'money', note: 'Where money sits, where it goes, and who keeps the record.' },
  'the-dollar': { label: 'The dollar', group: 'money', note: 'The dollar, its rails, and what happens when it takes a hit.' },
  crypto: { label: 'Stablecoins & crypto', group: 'money', note: 'Tokens, stablecoins and the new banking rails.' },
  banking: { label: 'Banking', group: 'money', note: 'Banks: the old ones, the family ones and the new ones.' },
  'trusts-and-taxes': { label: 'Trusts & taxes', group: 'money', note: 'Trusts, estates, taxes and the forms that go with them.' },

  /* ---- Privacy & power -------------------------------------------------- */
  surveillance: { label: 'Privacy & surveillance', group: 'power', note: 'The record kept about you, and how to live next to it.' },
  ai: { label: 'AI', group: 'power', note: 'Artificial intelligence: what it can find, and who it works for.' },
  biometrics: { label: 'The body as data', group: 'power', note: 'Heartbeats, faces, walks and shadows, turned into numbers.' },
  secrecy: { label: 'Secrecy & codes', group: 'power', note: 'Sealed patents, broken ciphers, and pictures that slip past the censor.' },
  inventions: { label: 'Inventions & patents', group: 'power', note: 'What was invented, what was patented, and what was buried.' },
  preparedness: { label: 'Preparedness', group: 'power', note: 'Getting ready for the world you actually wake up in.' },

  /* ---- Sea, land & creatures ------------------------------------------- */
  'the-sea': { label: 'The sea', group: 'world', note: 'Coasts, depths, and what the water does to light.' },
  lighthouses: { label: 'Lighthouses', group: 'world', note: 'Keepers, lenses and the flame seen from twenty miles out.' },
  animals: { label: 'Animals', group: 'world', note: 'Bees, vipers, mantis shrimp and the octopus.' },
  arizona: { label: 'Arizona & the desert', group: 'world', note: 'Phoenix, the Sonoran Desert, the drought and the monsoon.' },
  'pacific-northwest': { label: 'The Pacific Northwest', group: 'world', note: 'The coast, the Columbia, and the rain that is a climate.' },
  egypt: { label: 'Ancient Egypt', group: 'world', note: 'The weighing of the heart, the feather of Ma’at, and Pharaoh’s magicians.' },

  /* ---- Liberty & civic life --------------------------------------------- */
  liberty: { label: 'The liberty movement', group: 'civic', note: 'Libertarian candidates, the Academy, and the people training to run.' },
  campaigns: { label: 'Campaigns & organizing', group: 'civic', note: 'Running for office and running the organization behind it.' },
  fundraising: { label: 'Fundraising', group: 'civic', note: 'Gifts, donors and the record that follows them.' },
  schools: { label: 'Schools', group: 'civic', note: 'School boards, classrooms and who runs them.' },
  'local-government': { label: 'Local government', group: 'civic', note: 'City councils, counties, school districts and the seats in between.' },
  'public-record': { label: 'The public record', group: 'civic', note: 'Documents, sources and receipts: claims you can check.' },

  /* ---- Running threads -------------------------------------------------- */
  fire: { label: 'Fire & flame', group: 'threads', note: 'The stolen fire, the keeper’s flame, and the beam thrown out to sea.' },
  gold: { label: 'Gold', group: 'threads', note: 'Gold cubes, gold tablets, tokenized gold, and the gold buried in the underworld.' },
  mirrors: { label: 'Mirrors & doubles', group: 'threads', note: 'Two faces, mirror writing, reflections and things seen twice.' },
  thresholds: { label: 'Doors & thresholds', group: 'threads', note: 'Hinges, gates and the dog at the door.' },
  descents: { label: 'Descents', group: 'threads', note: 'Pages you go down through: into the sea, the earth, the self.' },
  water: { label: 'Water', group: 'threads', note: 'Rain, rivers, waterfalls and the vessel filled to the brim.' },
  time: { label: 'Time & clocks', group: 'threads', note: 'Hourglasses, sky clocks and the hinge of the year.' },
  legends: { label: 'Legends & the record', group: 'threads', note: 'Who the story says a man was, set beside what the paper shows.' },
  'bureau-of-coincidence': { label: 'The Bureau of Coincidence', group: 'threads', note: 'The poems the Bureau has certified coincidental, and the hearing that did it.' },

  /* ---- Forms ------------------------------------------------------------ */
  'hands-on': { label: 'Make your own', group: 'forms', note: 'Pieces where you draw, cast or color something of your own.' },
  humor: { label: 'Humor', group: 'forms', note: 'The funny ones.' },
  'with-sound': { label: 'With sound', group: 'forms', note: 'Pieces to listen to. Turn the sound on.' },
  memoir: { label: 'Memoir', group: 'forms', note: 'Pieces told in the first person, from the author’s own life.' },
  'for-organizations': { label: 'Made for organizations', group: 'forms', note: 'Pages made for, or about, an organization and its work.' },
} as const satisfies Record<string, TagSpec>;

export type TagId = keyof typeof tags;
export const tagIds = Object.keys(tags) as [TagId, ...TagId[]];
export const groupIds = Object.keys(tagGroups) as TagGroupId[];

/** The tag's page: /tags/<id>/ */
export function tagHref(id: TagId): string {
  return `/tags/${id}/`;
}

export function tagLabel(id: TagId): string {
  return tags[id].label;
}
