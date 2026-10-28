/**
 * Site-wide constants for the museum (public) side of iamwilhelm.com.
 * The archived esoteric homepage at /atelier keeps its own Base layout and
 * does not read from here.
 */
export const SITE_URL = 'https://iamwilhelm.com';
export const SITE_NAME = 'Michael Wilhelm';

export const DEFAULT_TITLE = 'Michael Wilhelm · Devoted to something, but no one knows what.';
export const DEFAULT_DESCRIPTION =
  'Michael Wilhelm: CEO and cofounder of BackGold, founder of Advancing Liberty Media, and a writer of visualized poetry. A small museum of his work and writing.';

export const BACKGOLD_URL = 'https://backgold.com';
export const ALM_URL = 'https://advancinglibertymedia.com';
export const MANIFESTO_URL = 'https://libertariantoolsuite.com/the-manifesto';

/** Published in the manifesto's closing section (libertariantoolsuite MANIFESTO.md). */
export const CONTACT_EMAIL = 'wilhelm@backgold.com';

/**
 * PLACEHOLDER(owner): the BackGold scheduler link for booking a call.
 * Neither this repo nor advancing-liberty-media2 carries the final link
 * (ALM's SCHEDULER_URL is also a TODO pointing at the BackGold homepage),
 * so the booking CTA falls back to backgold.com until this is set.
 */
export const SCHEDULER_URL = 'https://backgold.com';
export const SCHEDULER_IS_PLACEHOLDER = true;

/**
 * PLACEHOLDER(owner): the BackGold embeddable newsletter form.
 * Paste the embed snippet from BackGold (JS drop-in or iframe) into
 * NEWSLETTER_EMBED_HTML and it renders verbatim inside the colophon, in place
 * of the stand-in form. Until then the stand-in form renders in the museum
 * style and tells visitors that sign-up opens soon.
 */
export const NEWSLETTER_EMBED_HTML = '';

/** Primary navigation. `id` is the homepage room; `page` the standalone route, if any. */
export const NAV = [
  { label: 'Work', id: 'work' },
  { label: 'BackGold', id: 'backgold' },
  { label: 'Manifesto', id: 'manifesto' },
  { label: 'Gallery', id: 'gallery', page: '/gallery/' },
  { label: 'Writings', id: 'writings', page: '/writings/' },
  { label: 'Contact', id: 'contact' },
] as const;
