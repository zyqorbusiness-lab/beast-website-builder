#!/usr/bin/env node
// award-refs.mjs: collect verified award-winning website references from the top
// award galleries, and verify a single site's award claim on the gallery's own page.
// Node >= 22, no dependencies. Awwwards first (Sujon's #1), then FWA; CSSDA and others
// are attempted and honestly recorded when unavailable - never fabricated.
//   node award-refs.mjs collect [--source all|awwwards|fwa|cssda] [--pages 1] [--out work/references] [--delay 1500] [--json]
//   node award-refs.mjs verify <awwwards-site-url> [--json]
// MIT, Zyqor Studio (Sujon Hoque) 2026.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 (compatible; award-refs/1.0; reference research)';
const AWW_SOTD = 'https://www.awwwards.com/websites/sites_of_the_day/';
const FWA_WINNERS = 'https://thefwa.com/feed/winners.xml';
const CSSDA_WOTD = 'https://www.cssdesignawards.com/website-of-the-day/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8' }, redirect: 'follow' });
  const body = await res.text();
  return { ok: res.ok, status: res.status, url: res.url, body };
}

function unescapeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// --- Parsers (exported for tests; pure functions, no network) ---

// Awwwards listing cards carry their data as entity-encoded JSON in
// data-collectable-model-value="{...}" (slug, title, createdAt, tags).
export function parseAwwwardsListing(html) {
  const out = [];
  for (const m of html.matchAll(/data-collectable-model-value="([^"]+)"/g)) {
    let data;
    try { data = JSON.parse(unescapeHtml(m[1])); } catch { continue; }
    if (data.type !== 'submission' || !data.slug || !data.title) continue;
    out.push({
      source: 'awwwards',
      award: 'Site of the Day (Awwwards SOTD archive listing)',
      title: data.title,
      galleryUrl: `https://www.awwwards.com/sites/${data.slug}`,
      tags: Array.isArray(data.tags) ? data.tags : [],
      listedAt: typeof data.createdAt === 'number' ? new Date(data.createdAt * 1000).toISOString().slice(0, 10) : null,
    });
  }
  return out;
}

// One Awwwards /sites/<slug> page: award mark from the page <title>, jury overall
// from box-score__note <strong>, subscore columns from grid-score--titles, the live
// URL from the first external toolbar-bts__item link.
export function parseAwwwardsSite(html, url) {
  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleTag ? unescapeHtml(titleTag[1]).trim() : null;
  const awardMarks = [];
  if (/- Awwwards SOTD\b/i.test(rawTitle || '') || /Site of the Day/i.test(html)) awardMarks.push('Site of the Day');
  if (/- Awwwards SOTM\b/i.test(rawTitle || '')) awardMarks.push('Site of the Month');
  if (/- Awwwards SOTY\b/i.test(rawTitle || '')) awardMarks.push('Site of the Year');
  const jury = html.match(/box-score__note[^>]*>\s*<strong>\s*([0-9]+(?:\.[0-9]+)?)/);
  const columnsBlock = html.match(/grid-score--titles[\s\S]{0,1200}?<\/div>\s*<\/div>/);
  const columns = columnsBlock ? [...columnsBlock[0].matchAll(/grid-score__item">([^<]+)</g)].map((m) => m[1].trim()) : [];
  let liveUrl = null;
  const SOCIAL = /\/(\/|www\.)?(facebook|instagram|twitter|x|youtube|linkedin|threads|tiktok|pinterest)\.[a-z.]+\//;
  for (const m of html.matchAll(/class="toolbar-bts__item" href="(https?:\/\/[^"]+)"/g)) {
    if (!/awwwards\.com/.test(m[1]) && !SOCIAL.test(m[1])) { liveUrl = m[1]; break; }
  }
  const title = rawTitle ? rawTitle.replace(/\s*-\s*Awwwards.*$/, '').trim() : null;
  return {
    galleryUrl: url,
    title,
    verified: awardMarks.length > 0,
    awardMarks,
    juryScore: jury ? Number(jury[1]) : null,
    juryColumns: columns,
    liveUrl,
  };
}

// The FWA winners feed is RSS 2.0: <item> with title, link, pubDate, description.
export function parseFwaFeed(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    const pick = (tag) => { const t = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return t ? unescapeHtml(t[1].replace(/<!\[CDATA\[|\]\]>/g, '')).trim() : null; };
    const title = pick('title'); const link = pick('link');
    if (!title || !link) continue;
    const desc = pick('description') || '';
    out.push({
      source: 'fwa',
      award: 'FWA winner (The FWA winners feed)',
      title,
      galleryUrl: link,
      date: pick('pubDate'),
      description: desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300),
    });
  }
  return out;
}

// CSSDA markup changes and the site often blocks scripts; extract winner page links
// generically and label them unverified-category rather than guessing the award.
export function parseCssdaListing(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/href="(https:\/\/www\.cssdesignawards\.com\/sites\/[^"]+)"/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    out.push({ source: 'cssda', award: 'CSSDA listing entry (award category not verified by script)', title: m[1].split('/sites/')[1].replace(/\/$/, '').replace(/-/g, ' '), galleryUrl: m[1] });
  }
  return out;
}

// --- Collect ---

async function collect(opts) {
  const collectedAt = new Date().toISOString();
  const sources = [];
  const want = (s) => opts.source === 'all' || opts.source === s;

  if (want('awwwards')) {
    const entries = [];
    let status = 'ok'; let error = null;
    for (let p = 1; p <= opts.pages; p++) {
      const url = p === 1 ? AWW_SOTD : `${AWW_SOTD}?page=${p}`;
      try {
        const r = await fetchText(url);
        if (!r.ok) { status = 'unavailable'; error = `HTTP ${r.status} on page ${p}`; break; }
        const got = parseAwwwardsListing(r.body);
        if (got.length === 0 && p === 1) { status = 'parse-empty'; error = 'no cards parsed - markup may have changed'; }
        entries.push(...got);
      } catch (e) { status = 'unavailable'; error = String(e.message || e); break; }
      if (p < opts.pages) await sleep(opts.delay);
    }
    sources.push({ source: 'awwwards', url: AWW_SOTD, status, error, count: entries.length, entries });
  }

  if (want('fwa')) {
    let entries = []; let status = 'ok'; let error = null;
    try {
      const r = await fetchText(FWA_WINNERS);
      if (!r.ok) { status = 'unavailable'; error = `HTTP ${r.status}`; }
      else entries = parseFwaFeed(r.body);
    } catch (e) { status = 'unavailable'; error = String(e.message || e); }
    sources.push({ source: 'fwa', url: FWA_WINNERS, status, error, count: entries.length, entries });
    await sleep(opts.delay);
  }

  if (want('cssda')) {
    let entries = []; let status = 'ok'; let error = null;
    try {
      const r = await fetchText(CSSDA_WOTD);
      if (!r.ok) { status = 'unavailable'; error = `HTTP ${r.status} - CSSDA often blocks scripts; verify in a browser`; }
      else entries = parseCssdaListing(r.body);
    } catch (e) { status = 'unavailable'; error = String(e.message || e); }
    sources.push({ source: 'cssda', url: CSSDA_WOTD, status, error, count: entries.length, entries });
  }

  return { collectedAt, policy: 'Award claims only from the gallery own page/feed, read on collectedAt. Unavailable sources are recorded, never substituted or fabricated.', sources };
}

function renderMarkdown(data) {
  const L = [];
  L.push('# Award-winning website references', '');
  L.push(`Collected ${data.collectedAt} by \`award-refs.mjs collect\`. ${data.policy}`, '');
  for (const s of data.sources) {
    L.push(`## ${s.source} - ${s.status}${s.count ? ` (${s.count} entries)` : ''}`, '');
    L.push(`Source: ${s.url}`);
    if (s.error) L.push(`Note: ${s.error}`);
    L.push('');
    for (const e of s.entries) {
      L.push(`- **${e.title}** - ${e.award}`);
      L.push(`  ${e.galleryUrl}${e.listedAt ? ` - listed ${e.listedAt}` : ''}${e.date ? ` - ${e.date}` : ''}`);
      if (e.tags && e.tags.length) L.push(`  tags: ${e.tags.join(', ')}`);
      if (e.description) L.push(`  ${e.description}`);
    }
    L.push('');
  }
  L.push('---');
  L.push('Next: pick 3-5 that fit the project (Awwwards first, at least two outside the client industry),');
  L.push('verify each with `award-refs.mjs verify <galleryUrl>`, then tear them down with');
  L.push('`skills/award-site-teardown-method/scripts/teardown.mjs`. Take structure and choreography, never content.');
  return L.join('\n');
}

// --- CLI ---

const isCli = typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const a = process.argv.slice(2);
  const cmd = a[0];
  const has = (k) => a.includes(k);
  const val = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };

  if (cmd === 'collect') {
    const opts = { source: val('--source', 'all'), pages: Number(val('--pages', 1)), out: val('--out', 'work/references'), delay: Number(val('--delay', 1500)) };
    const data = await collect(opts);
    mkdirSync(opts.out, { recursive: true });
    writeFileSync(join(opts.out, 'award-refs.json'), JSON.stringify(data, null, 2));
    writeFileSync(join(opts.out, 'REFERENCES.md'), renderMarkdown(data));
    for (const s of data.sources) console.log(`${s.source}: ${s.status}${s.count ? ` - ${s.count} entries` : ''}${s.error ? ` - ${s.error}` : ''}`);
    console.log(`wrote ${join(opts.out, 'award-refs.json')} and REFERENCES.md`);
    if (has('--json')) console.log(JSON.stringify(data, null, 2));
    process.exit(data.sources.every((s) => s.status === 'unavailable') ? 1 : 0);
  } else if (cmd === 'verify') {
    const url = a[1];
    if (!url || !/^https?:\/\//.test(url)) { console.error('usage: award-refs.mjs verify <awwwards-site-url> [--json]'); process.exit(2); }
    const r = await fetchText(url);
    if (!r.ok) { console.error(`could not open ${url}: HTTP ${r.status}. Award claim NOT verified.`); process.exit(1); }
    const v = parseAwwwardsSite(r.body, url);
    v.checkedAt = new Date().toISOString();
    if (has('--json')) { console.log(JSON.stringify(v, null, 2)); process.exit(v.verified ? 0 : 1); }
    console.log('AWARD VERIFICATION CARD');
    console.log(`  title:      ${v.title || '(not parsed)'}`);
    console.log(`  verified:   ${v.verified ? 'YES' : 'NO - no award mark found on this page'}`);
    console.log(`  award:      ${v.awardMarks.join(', ') || '(none found)'}`);
    console.log(`  jury score: ${v.juryScore != null ? `${v.juryScore} / 10` : '(not published on page)'}`);
    console.log(`  jury axes:  ${v.juryColumns.length ? v.juryColumns.join(' / ') : '(not parsed)'}`);
    console.log(`  live site:  ${v.liveUrl || '(not found)'}`);
    console.log(`  source:     ${v.galleryUrl}`);
    console.log(`  checked:    ${v.checkedAt}`);
    process.exit(v.verified ? 0 : 1);
  } else {
    console.log('usage:\n  award-refs.mjs collect [--source all|awwwards|fwa|cssda] [--pages N] [--out DIR] [--delay MS] [--json]\n  award-refs.mjs verify <awwwards-site-url> [--json]');
    process.exit(2);
  }
}
