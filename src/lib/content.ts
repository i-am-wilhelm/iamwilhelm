/**
 * The single content interface.
 *
 * Every page fetches writings through this file and nowhere else, so a
 * future swap to a headless Ghost backend is a one-file change: keep the
 * `Writing` shape, reimplement `getWritings` / `getWriting` against the
 * Ghost Content API, and the rest of the site never notices.
 */

import { getCollection, render, type CollectionEntry } from 'astro:content';
import { getSymbol, type SiteSymbol } from './symbols';

export interface Writing {
  slug: string;
  title: string;
  description: string;
  date: Date;
  /** The post's governing symbol — themes the page and its header art. */
  symbol: SiteSymbol;
  /** CSS color for the post accent (defaults to the symbol's smoke). */
  accent: string;
  draft: boolean;
  entry: CollectionEntry<'writings'>;
}

function toWriting(entry: CollectionEntry<'writings'>): Writing {
  const symbol = getSymbol(entry.data.symbol);
  return {
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    date: entry.data.date,
    symbol,
    accent: entry.data.accent ?? symbol.accent,
    draft: entry.data.draft,
    entry,
  };
}

/** All published writings, newest first. */
export async function getWritings(): Promise<Writing[]> {
  const entries = await getCollection('writings', ({ data }) => !data.draft);
  return entries.map(toWriting).sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

export async function getWriting(slug: string): Promise<Writing | undefined> {
  const all = await getWritings();
  return all.find((w) => w.slug === slug);
}

/** Renders a writing's body to a component. */
export async function renderWriting(writing: Writing) {
  return render(writing.entry);
}
