#!/usr/bin/env node
// award-refs.mjs: collect award-listing candidates from the top award galleries,
// and verify a single site's award claim on the gallery's own page.
// Node >= 22, no dependencies. Awwwards first (Sujon's #1), then FWA; CSSDA and others
// are attempted and honestly recorded when unavailable - never fabricated.
//
// Verification hard rules (21 Nov 2026 audit):
//   * the input URL must be an https awwwards.com /sites/<slug> page;
//   * the FINAL URL after redirects must still be one - a redirect off awwwards.com
//     or to a non-/sites/ page rejects the verification;
//   * the award mark counts only from scoped page evidence (the <title> award
//     suffix), never from the string "Site of the Day" anywhere in raw HTML;
//   * a mark alone never passes: jury evidence on the page must corroborate it.
// Collected list entries are archive/feed listing candidates - their individual
// awards are NOT verified until `verify` passes for that site.
//
//   node award-refs.mjs collect [--source all|awwwards|fwa|cssda] [--pages 1] [--out work/references] [--delay 1500] [--json]
//   node award-refs.mjs verify <awwwards-site-url> [--json]
// MIT, Zyqor Studio (Sujon Hoque) 2026.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 (compatible; award-refs/1.1; reference research)';
const AWW_SOTD = 'https://www.awwwards.com/websites/sites_of_the_day/';
const FWA_WINNERS = 'https://thefwa.com/feed/winners.xml';
const CSSDA_WOTD = 'https://www.cssdesignawards.com/website-of-the-day/';
const LISTING_CANDIDATE = 'listing-candidate (not individually verified)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8' }, redirect: 'follow' });
  const body = await res.text();
  return { ok: res.ok, status: res.status, url: res.url, body };
}

function unescapeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// --- URL + status helpers (exported for tests; pure functions, no network) ---

// Only an https awwwards.com /sites/<slug> page is verifiable input or an
// acceptable redirect target. Anything else is rejected before any parsing.
export function validateAwwwardsSiteUrl(url) {
  let u;
  try { u = new URL(url); } catch { return { ok: false, reason: 'not a valid URL' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: `protocol ${u.protocol} is not https:` };
  if (u.hostname !== 'www.awwwards.com' && u.hostname !== 'awwwards.com') return { ok: false, reason: `host ${u.hostname} is not awwwards.com` };
  if (!/^\/sites\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname)) return { ok: false, reason: `path ${u.pathname} is not an Awwwards /sites/<slug> page` };
  return { ok: true, reason: null };
}

// One honest status per collect source. HTTP 200 with zero parsed entries is
// 'parse-empty', never 'ok'; HTTP and network failures are 'unavailable'.
export function sourceStatus({ networkError = null, httpOk = true, httpStatus = 200, entryCount = 0 } = {}) {
  if (networkError) return { status: 'unavailable', error: `network error: ${String(networkError)}` };
  if (!httpOk) return { status: 'unavailable', error: `HTTP ${httpStatus}` };
  if (entryCount === 0) return { status: 'parse-empty', error: 'page loaded (HTTP 200) but no entries parsed - markup may have changed, check in a browser' };
  return { status: 'ok', error: null };
}

// --- Parsers (exported for tests; pure functions, no network) ---

// Awwwards listing cards carry their data as entity-encoded JSON in
// data-collectable-model-value="{...}" (slug, title, createdAt, tags).
// Entries are listing candidates from the SOTD archive, not individually verified.
export function parseAwwwardsListing(html) {
  const out = [];
  for (const m of html.matchAll(/data-collectable-model-value="([^"]+)"/g)) {
    let data;
    try { data = JSON.parse(unescapeHtml(m[1])); } catch { continue; }
    if (data.type !== 'submission' || !data.slug || !data.title) continue;
    out.push({
      source: 'awwwards',
      award: 'Site of the Day (Awwwards SOTD archive listing)',
      verification: LISTING_CANDIDATE,
      title: data.title,
      galleryUrl: `https://www.awwwards.com/sites/${data.slug}`,
      tags: Array.isArray(data.tags) ? data.tags : [],
      listedAt: typeof data.createdAt === 'number' ? new Date(data.createdAt * 1000).toISOString().slice(0, 10) : null,
    });
  }
  return out;
}

// One Awwwards /sites/<slug> page. The award mark counts ONLY from scoped page
// evidence: the <title> award suffix ("<name> - Awwwards SOTD/SOTM/SOTY"). The
// string "Site of the Day" anywhere else in the HTML (nav, related lists, footer)
// is not evidence. A mark alone never verifies: the jury box (overall score or
// jury axes) must corroborate it. `verified` is the parse-level decision;
// evaluateVerification layers URL/domain/redirect/fetch checks on top.
export function parseAwwwardsSite(html, url) {
  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleTag ? unescapeHtml(titleTag[1]).trim() : null;
  const awardMarks = [];
  if (/-\s*Awwwards\s+SOTD\b/i.test(rawTitle || '')) awardMarks.push('Site of the Day');
  if (/-\s*Awwwards\s+SOTM\b/i.test(rawTitle || '')) awardMarks.push('Site of the Month');
  if (/-\s*Awwwards\s+SOTY\b/i.test(rawTitle || '')) awardMarks.push('Site of the Year');
  const jury = html.match(/box-score__note[^>]*>\s*<strong>\s*([0-9]+(?:\.[0-9]+)?)/);
  const columnsBlock = html.match(/grid-score--titles[\s\S]{0,1200}?<\/div>\s*<\/div>/);
  const columns = columnsBlock ? [...columnsBlock[0].matchAll(/grid-score__item">([^<]+)</g)].map((m) => m[1].trim()) : [];
  const juryScore = jury ? Number(jury[1]) : null;
  const corroborated = juryScore != null || columns.length > 0;
  let liveUrl = null;
  const SOCIAL = /\/(\/|www\.)?(facebook|instagram|twitter|x|youtube|linkedin|threads|tiktok|pinterest)\.[a-z.]+\//;
  for (const m of html.matchAll(/class="toolbar-bts__item" href="(https?:\/\/[^"]+)"/g)) {
    if (!/awwwards\.com/.test(m[1]) && !SOCIAL.test(m[1])) { liveUrl = m[1]; break; }
  }
  const title = rawTitle ? rawTitle.replace(/\s*-\s*Awwwards.*$/, '').trim() : null;
  return {
    galleryUrl: url,
    title,
    verified: awardMarks.length > 0 && corroborated,
    awardMarks,
    markEvidence: awardMarks.length > 0 ? 'page <title> award suffix' : null,
    juryScore,
    juryColumns: columns,
    corroborated,
    liveUrl,
  };
}

// The FWA winners feed is RSS 2.0: <item> with title, link, pubDate, description.
// Entries are listing candidates from the feed, not individually verified.
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
      verification: LISTING_CANDIDATE,
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
    out.push({ source: 'cssda', award: 'CSSDA listing entry (award category not verified by script)', verification: LISTING_CANDIDATE, title: m[1].split('/sites/')[1].replace(/\/$/, '').replace(/-/g, ' '), galleryUrl: m[1] });
  }
  return out;
}

// --- Verification decision (pure; network happens in the CLI wrapper) ---

// Fold URL validation, redirect validation, fetch outcome and page evidence into
// one structured result with an exit code. Fails closed: any doubt means not
// verified. Statuses:
//   invalid-url       input was not an https awwwards.com /sites/<slug> page (exit 2)
//   fetch-failed      network error or non-2xx HTTP (exit 1)
//   redirect-rejected final URL left awwwards.com or the /sites/ page type (exit 1)
//   not-verified      page loaded, no award mark in the title evidence (exit 1)
//   inconclusive      title mark found but no jury evidence to corroborate (exit 1)
//   verified          valid URL chain + title mark + jury corroboration (exit 0)
export function evaluateVerification({ inputUrl, networkError = null, httpOk = false, httpStatus = null, finalUrl = null, body = '' } = {}) {
  const base = { galleryUrl: inputUrl, checkedAt: new Date().toISOString() };
  const inputCheck = validateAwwwardsSiteUrl(inputUrl);
  if (!inputCheck.ok) return { ...base, verified: false, status: 'invalid-url', error: inputCheck.reason, exitCode: 2 };
  if (networkError) return { ...base, verified: false, status: 'fetch-failed', error: `network error: ${String(networkError)}`, exitCode: 1 };
  if (!httpOk) return { ...base, verified: false, status: 'fetch-failed', error: `HTTP ${httpStatus ?? 'unknown'}`, exitCode: 1 };
  const landed = finalUrl || inputUrl;
  const finalCheck = validateAwwwardsSiteUrl(landed);
  if (!finalCheck.ok) return { ...base, verified: false, status: 'redirect-rejected', finalUrl: landed, error: `final URL rejected: ${finalCheck.reason}`, exitCode: 1 };
  const v = parseAwwwardsSite(body, landed);
  const redirect = landed !== inputUrl ? { from: inputUrl, to: landed } : null;
  if (v.verified) return { ...base, ...v, status: 'verified', error: null, redirect, exitCode: 0 };
  if (v.awardMarks.length > 0 && !v.corroborated) {
    return { ...base, ...v, status: 'inconclusive', error: 'award mark found in the title but no jury evidence on the page to corroborate it - not passed', redirect, exitCode: 1 };
  }
  return { ...base, ...v, status: 'not-verified', error: 'no award mark in the page title evidence', redirect, exitCode: 1 };
}

// --- Collect ---

async function collect(opts) {
  const collectedAt = new Date().toISOString();
  const sources = [];
  const want = (s) => opts.source === 'all' || opts.source === s;

  if (want('awwwards')) {
    const entries = [];
    let st = { status: 'ok', error: null };
    for (let p = 1; p <= opts.pages; p++) {
      const url = p === 1 ? AWW_SOTD : `${AWW_SOTD}?page=${p}`;
      let r;
      try { r = await fetchText(url); }
      catch (e) { st = sourceStatus({ networkError: e.message || e }); break; }
      if (!r.ok) { st = sourceStatus({ httpOk: false, httpStatus: r.status }); break; }
      const got = parseAwwwardsListing(r.body);
      if (got.length === 0) {
        if (entries.length === 0) st = sourceStatus({ httpOk: true, entryCount: 0 });
        break; // an empty later page just ends pagination
      }
      entries.push(...got);
      if (p < opts.pages) await sleep(opts.delay);
    }
    sources.push({ source: 'awwwards', url: AWW_SOTD, status: st.status, error: st.error, count: entries.length, listing: 'archive listing candidates - individual awards not yet verified', entries });
  }

  if (want('fwa')) {
    let entries = []; let st;
    try {
      const r = await fetchText(FWA_WINNERS);
      if (!r.ok) st = sourceStatus({ httpOk: false, httpStatus: r.status });
      else st = sourceStatus({ httpOk: true, entryCount: (entries = parseFwaFeed(r.body)).length });
    } catch (e) { st = sourceStatus({ networkError: e.message || e }); }
    sources.push({ source: 'fwa', url: FWA_WINNERS, status: st.status, error: st.error, count: entries.length, listing: 'feed listing candidates - individual awards not yet verified', entries });
    await sleep(opts.delay);
  }

  if (want('cssda')) {
    let entries = []; let st;
    try {
      const r = await fetchText(CSSDA_WOTD);
      if (!r.ok) st = { ...sourceStatus({ httpOk: false, httpStatus: r.status }), error: `HTTP ${r.status} - CSSDA often blocks scripts; verify in a browser` };
      else st = sourceStatus({ httpOk: true, entryCount: (entries = parseCssdaListing(r.body)).length });
    } catch (e) { st = sourceStatus({ networkError: e.message || e }); }
    sources.push({ source: 'cssda', url: CSSDA_WOTD, status: st.status, error: st.error, count: entries.length, listing: 'listing candidates - award category not verified by script', entries });
  }

  return { collectedAt, policy: 'List entries are archive/feed listing candidates; an individual award claim stands only after `verify` passes on the gallery own page, read on checkedAt. Unavailable sources are recorded, never substituted or fabricated.', sources };
}

function renderMarkdown(data) {
  const L = [];
  L.push('# Award-winning website references', '');
  L.push(`Collected ${data.collectedAt} by \`award-refs.mjs collect\`. ${data.policy}`, '');
  L.push('**Every entry below is an archive/feed listing candidate.** Its individual award is NOT yet verified;');
  L.push('run `award-refs.mjs verify <galleryUrl>` for each shortlisted site before calling it award-winning.');
  L.push('Individually verified cards live in `verified/` next to this file once `verify` has been run.', '');
  for (const s of data.sources) {
    L.push(`## ${s.source} - ${s.status}${s.count ? ` (${s.count} listing candidates)` : ''}`, '');
    L.push(`Source: ${s.url}`);
    if (s.error) L.push(`Note: ${s.error}`);
    L.push('');
    for (const e of s.entries) {
      L.push(`- **${e.title}** - ${e.award} _(${LISTING_CANDIDATE})_`);
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

function printVerificationCard(v) {
  console.log('AWARD VERIFICATION CARD');
  console.log(`  status:     ${v.status}`);
  console.log(`  verified:   ${v.verified ? 'YES' : 'NO'}`);
  if (v.title !== undefined) console.log(`  title:      ${v.title || '(not parsed)'}`);
  if (v.awardMarks) console.log(`  award:      ${v.awardMarks.join(', ') || '(none found)'}`);
  if (v.markEvidence !== undefined) console.log(`  evidence:   ${v.markEvidence || '(no scoped award-mark evidence)'}${v.corroborated ? ' + jury box corroboration' : ''}`);
  if (v.juryScore !== undefined) console.log(`  jury score: ${v.juryScore != null ? `${v.juryScore} / 10` : '(not published on page)'}`);
  if (v.juryColumns) console.log(`  jury axes:  ${v.juryColumns.length ? v.juryColumns.join(' / ') : '(not parsed)'}`);
  if (v.liveUrl !== undefined) console.log(`  live site:  ${v.liveUrl || '(not found)'}`);
  console.log(`  source:     ${v.galleryUrl}`);
  if (v.finalUrl) console.log(`  final URL:  ${v.finalUrl}`);
  if (v.redirect) console.log(`  redirect:   ${v.redirect.from} -> ${v.redirect.to} (still a valid awwwards.com /sites/ page)`);
  console.log(`  checked:    ${v.checkedAt}`);
  if (v.error) console.log(`  error:      ${v.error}`);
}

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
    for (const s of data.sources) console.log(`${s.source}: ${s.status}${s.count ? ` - ${s.count} listing candidates` : ''}${s.error ? ` - ${s.error}` : ''}`);
    console.log(`wrote ${join(opts.out, 'award-refs.json')} and REFERENCES.md`);
    if (has('--json')) console.log(JSON.stringify(data, null, 2));
    process.exit(data.sources.every((s) => s.status !== 'ok') ? 1 : 0);
  } else if (cmd === 'verify') {
    const url = a[1];
    if (!url || !/^https?:\/\//.test(url)) { console.error('usage: award-refs.mjs verify <awwwards-site-url> [--json]'); process.exit(2); }
    let r = null; let networkError = null;
    try {
      r = await fetchText(url);
    } catch (e) {
      networkError = e.message || e;
    }
    const v = evaluateVerification({
      inputUrl: url,
      networkError,
      httpOk: r ? r.ok : false,
      httpStatus: r ? r.status : null,
      finalUrl: r ? r.url : null,
      body: r ? r.body : '',
    });
    if (has('--json')) { console.log(JSON.stringify(v, null, 2)); process.exit(v.exitCode); }
    printVerificationCard(v);
    process.exit(v.exitCode);
  } else {
    console.log('usage:\n  award-refs.mjs collect [--source all|awwwards|fwa|cssda] [--pages N] [--out DIR] [--delay MS] [--json]\n  award-refs.mjs verify <awwwards-site-url> [--json]');
    process.exit(2);
  }
}
