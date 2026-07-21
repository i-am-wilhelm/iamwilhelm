/**
 * Section visits — the ledger the track shelf reads.
 *
 * Which homepage sections the visitor has actually stood in, tracked by
 * IntersectionObserver over the tuned section ids and persisted as a
 * JSON array in localStorage ('wilhelm.visited'). Each drone track in
 * the Orchestra Pit stays a dim locked glyph until its section has been
 * visited. Pages without the sections (writings, underworld) observe
 * nothing and cost nothing. New sightings are announced on document as
 * `pit:visited` ({ id }) so an open pit can unlock its shelf live.
 */

import { SECTIONS } from '../audio/sections';

const STORE_KEY = 'wilhelm.visited';

function read(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

/** The sections this visitor has stood in. */
export function visited(): ReadonlySet<string> {
  return read();
}

/** Watch this page's tuned sections; record each first sighting. */
export function initVisits(): void {
  const seen = read();
  const pending = SECTIONS.map((t) => document.getElementById(t.id)).filter(
    (el): el is HTMLElement => el !== null && !seen.has(el.id)
  );
  if (pending.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const id = entry.target.id;
        // re-read before writing — another tab may hold the same ledger
        const now = read();
        if (now.has(id)) continue;
        now.add(id);
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify([...now]));
        } catch {
          /* no ledger — every visit stays a first visit */
        }
        document.dispatchEvent(new CustomEvent('pit:visited', { detail: { id } }));
      }
    },
    { threshold: 0.2 }
  );
  for (const el of pending) io.observe(el);
}
