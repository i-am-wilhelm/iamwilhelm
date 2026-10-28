/**
 * Checks every outbound link on the built public pages: the hrefs, plus the
 * console cartridges' data-url targets. Run after `astro build`:
 *
 *   node scripts/verify-links.mjs            report only
 *   node scripts/verify-links.mjs --strict   exit 1 if any link fails
 *
 * The archived pages (/atelier, /lab) are skipped. A failing client site in
 * src/data/portfolio.ts should be set `hidden: true` until it resolves.
 * Writes a Markdown table to $GITHUB_STEP_SUMMARY when present.
 */
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SKIP = [/^atelier\//, /^lab\//];
const strict = process.argv.includes('--strict');

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return p.endsWith('.html') ? [p] : [];
  });
}

const links = new Map();
for (const file of htmlFiles(DIST)) {
  const rel = relative(DIST, file);
  if (SKIP.some((re) => re.test(rel))) continue;
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:href|data-url)="(https?:\/\/[^"#]+)[^"]*"/g)) {
    const url = m[1];
    if (url.startsWith('https://iamwilhelm.com')) continue;
    if (!links.has(url)) links.set(url, new Set());
    links.get(url).add(rel);
  }
}

async function check(url) {
  const opts = {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; iamwilhelm-link-check/1.0; +https://iamwilhelm.com)',
      accept: 'text/html,*/*',
    },
  };
  try {
    let res = await fetch(url, { ...opts, method: 'HEAD' });
    if (res.status >= 400) res = await fetch(url, { ...opts, method: 'GET' });
    return { url, status: res.status, final: res.url, ok: res.status < 400 };
  } catch (err) {
    return { url, status: 0, final: '', ok: false, error: err.cause?.code ?? err.name };
  }
}

const results = await Promise.all([...links.keys()].map(check));
results.sort((a, b) => Number(a.ok) - Number(b.ok) || a.url.localeCompare(b.url));

let md = '### Outbound links\n\n| Result | Status | URL | Final URL |\n|---|---|---|---|\n';
for (const r of results) {
  const mark = r.ok ? 'OK  ' : 'FAIL';
  console.log(`${mark} ${String(r.status).padStart(3)} ${r.url}${r.final && r.final !== r.url ? ` -> ${r.final}` : ''}${r.error ? ` (${r.error})` : ''}`);
  md += `| ${r.ok ? 'ok' : '**fail**'} | ${r.status || r.error} | ${r.url} | ${r.final !== r.url ? r.final : ''} |\n`;
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length} links, ${failed.length} failing.`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
if (strict && failed.length) process.exit(1);
