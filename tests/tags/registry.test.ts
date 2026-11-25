import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { groupIds, tagGroups, tagIds, tags } from '../../src/config/tags.ts';

test('every tag id is lowercase and hyphenated, so it can be an address', () => {
  for (const id of tagIds) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id);
});

test('every tag has a label, a known group and a one-line note; no two share a label', () => {
  const seen = new Set<string>();
  for (const id of tagIds) {
    const t = tags[id];
    assert.ok(t.label.trim(), `${id}: label`);
    assert.ok(groupIds.includes(t.group), `${id}: group ${t.group}`);
    assert.ok(t.note.trim().length > 10, `${id}: note`);
    assert.ok(!seen.has(t.label.toLowerCase()), `${id}: the label "${t.label}" is taken`);
    seen.add(t.label.toLowerCase());
  }
});

test('every group holds at least one tag', () => {
  for (const g of groupIds) assert.ok(tagIds.some((id) => tags[id].group === g), `${tagGroups[g].name} is empty`);
});

test('a scroll page is tagged on its gallery entry, never on its writings entry', () => {
  const dir = new URL('../../src/content/writings/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const fm = readFileSync(new URL(f, dir), 'utf8').split('---')[1] ?? '';
    const treatment = fm.match(/^treatment:\s*(\S+)/m)?.[1] ?? 'museum';
    if (treatment !== 'museum') assert.ok(!/^tags:/m.test(fm), `${f}: tag the scroll page on its gallery entry`);
  }
});
