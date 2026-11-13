/**
 * Site-wide constants for the museum (public) side of iamwilhelm.com.
 * The archived esoteric homepage at /atelier keeps its own Base layout and
 * does not read from here.
 */
export const SITE_URL = 'https://iamwilhelm.com';
export const SITE_NAME = 'Michael Wilhelm';

export const DEFAULT_TITLE = 'Michael Wilhelm · Please touch the exhibits.';
export const DEFAULT_DESCRIPTION =
  'Michael Wilhelm: CEO and cofounder of BackGold, founder of Advancing Liberty Media, and a writer of visualized poetry. A small museum of his work and writing.';

export const BACKGOLD_URL = 'https://backgold.com';
export const ALM_URL = 'https://advancinglibertymedia.com';
export const MANIFESTO_URL = 'https://libertariantoolsuite.com/the-manifesto';

/** Published in the manifesto's closing section (libertariantoolsuite MANIFESTO.md). */
export const CONTACT_EMAIL = 'wilhelm@backgold.com';

/** Scrollbrief, the litigation-support studio (Room V, /scrollbrief/). */
export const SCROLLBRIEF_URL = 'https://scrollbrief.com';
/** The Scrollbrief intake: a BackGold form, "Bring one case." */
export const SCROLLBRIEF_INTAKE_URL =
  'https://api.backgold.com/f/834246565e3527a7e2aea230d4402fd7/FormBlock-67ecbfa84894da4f1210140c8c2cc9b8';

/**
 * The scrolly commissions intake: a BackGold form, embedded in the close of
 * /services (IV.06). PLACEHOLDER(owner): paste the hosted form's address
 * (https://api.backgold.com/f/<page>/<FormBlock-id>) once the form exists in
 * BackGold. While this is empty the page closes with the call and mail
 * links only, and nothing is embedded.
 */
export const SCROLLY_INTAKE_URL = '';

/** The BackGold scheduler: a web design consultation with Michael. */
export const SCHEDULER_URL = 'https://app.backgold.com/book/backgold/web-design-consultation';
export const SCHEDULER_IS_PLACEHOLDER = false;

/**
 * PLACEHOLDER(owner): the BackGold embeddable newsletter form.
 * Paste the embed snippet from BackGold (JS drop-in or iframe) into
 * NEWSLETTER_EMBED_HTML and it renders verbatim inside the colophon, in place
 * of the stand-in form. Until then the stand-in form renders in the museum
 * style and tells visitors that sign-up opens soon.
 */
export const NEWSLETTER_EMBED_HTML = '';

/**
 * Primary navigation. `id` is the homepage room; `page` the standalone route,
 * if any. `room: false` marks a page with no room on the homepage: the link
 * always goes to the route, and the homepage scroll-spy leaves it alone.
 */
export const NAV = [
  { label: 'BackGold', id: 'backgold' },
  { label: 'Gallery', id: 'gallery', page: '/gallery/' },
  { label: 'Scrollbrief', id: 'scrollbrief', page: '/scrollbrief/', room: false },
  { label: 'Futurist', id: 'futurist', page: '/writings/futurist/', room: false },
  { label: 'Writings', id: 'writings', page: '/writings/' },
  { label: 'Commissions', id: 'services', page: '/services/', room: false },
  { label: 'Earl', id: 'earl', page: '/earl/', room: false },
  { label: 'Contact', id: 'contact' },
] as const;

/** The site feeds, linked from every page head and listed in the footer. */
export const FEEDS = [
  { href: '/rss.xml', type: 'application/rss+xml', title: `${SITE_NAME} · RSS` },
  { href: '/atom.xml', type: 'application/atom+xml', title: `${SITE_NAME} · Atom` },
] as const;
