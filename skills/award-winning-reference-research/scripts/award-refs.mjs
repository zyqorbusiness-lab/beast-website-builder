#!/usr/bin/env node
// award-refs.mjs: collect award-listing candidates from the top award galleries,
// and verify a single site's award claim on the gallery's own page.
// Node >= 22, no dependencies. Awwwards first (Sujon's #1), then FWA; CSSDA and others
// are attempted and honestly recorded when unavailable - never fabricated.
//
// Verification hard rules (21 Nov 2026 audit, second pass):
//   * the input URL must be an https awwwards.com /sites/<slug> page, validated
//     BEFORE any network request is dispatched;
//   * redirects are followed manually one hop at a time, and every redirect
//     target is validated BEFORE the request to it is dispatched - an
//     off-domain or off-page-type target is rejected without ever being fetched;
//   * the award mark counts only from an exact, end-anchored <title> award
//     suffix ("<name> - Awwwards SOTD/SOTM/SOTY"), never from award text
//     anywhere else in the HTML, and never from a longer suffix such as
//     "Awwwards SOTD archive";
//   * a mark alone never passes: jury corroboration must come from the award's
//     own jury structures - the overall score inside the class="box-score" jury
//     box, or the recognised jury axes inside the id="jury_votes" section -
//     not from any numeric box-score__note or grid-score row elsewhere;
//   * collect validates the final URL of every source fetch against that
//     source's expected host/path; a redirect away from it is a structured
//     failure (redirect-rejected), never silently parsed as source data;
//   * --pages must be a positive integer and --source a known source; invalid
//     options exit 2 before any network work.
// Collected list entries are archive/feed listing candidates - their individual
// awards are NOT verified until `verify` passes for that site.
//
// Exit codes: verify - 0 verified, 1 not verified / fetch failure / rejected
// redirect, 2 invalid input. collect - 0 when at least one requested source
// collected entries (status ok; per-source statuses record partial failures),
// 1 when every requested source failed, 2 for invalid options.
//
//   node award-refs.mjs collect [--source all|awwwards|fwa|cssda] [--pages 1] [--out work/references] [--delay 1500] [--json]
//   node award-refs.mjs verify <awwwards-site-url> [--json]
//
// Test hook: setting AWARD_REFS_TEST_FETCH_MODULE to the path of a module
// exporting `mockFetch` makes the CLI use it instead of the global fetch, so
// integration tests can exercise the real CLI dispatch path without network.
// MIT, Zyqor Studio (Sujon Hoque) 2026.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 (compatible; award-refs/1.2; reference research)';
const AWW_SOTD = 'https://www.awwwards.com/websites/sites_of_the_day/';
const FWA_WINNERS = 'https://thefwa.com/feed/winners.xml';
const CSSDA_WOTD = 'https://www.cssdesignawards.com/website-of-the-day/';
const LISTING_CANDIDATE = 'listing-candidate (not individually verified)';
const COLLECT_SOURCES = ['all', 'awwwards', 'fwa', 'cssda'];
const MAX_REDIRECT_HOPS = 5;
const FETCH_HEADERS = { 'user-agent': UA, accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Build the redirect/final-URL validator for one collect source: https only,
// one of the source's own hosts, and exactly the expected listing/feed path.
// A collect fetch that lands anywhere else is not that source's data.
function makeListingValidator(hosts, pathRe, label) {
  return (url) => {
    let u;
    try { u = new URL(url); } catch { return { ok: false, reason: 'not a valid URL' }; }
    if (u.protocol !== 'https:') return { ok: false, reason: `protocol ${u.protocol} is not https:` };
    if (!hosts.includes(u.hostname)) return { ok: false, reason: `host ${u.hostname} is not a ${label} host` };
    if (!pathRe.test(u.pathname)) return { ok: false, reason: `path ${u.pathname} is not the ${label} path` };
    return { ok: true, reason: null };
  };
}

export const validateAwwwardsListingUrl = makeListingValidator(['www.awwwards.com', 'awwwards.com'], /^\/websites\/sites_of_the_day\/?$/, 'Awwwards SOTD archive');
export const validateFwaFeedUrl = makeListingValidator(['thefwa.com', 'www.thefwa.com'], /^\/feed\/winners\.xml$/, 'FWA winners feed');
export const validateCssdaListingUrl = makeListingValidator(['www.cssdesignawards.com', 'cssdesignawards.com'], /^\/website-of-the-day\/?$/, 'CSSDA WOTD listing');

// One honest status per collect source. HTTP 200 with zero parsed entries is
// 'parse-empty', never 'ok'; HTTP and network failures are 'unavailable'.
// A redirect away from the source's own host/path is 'redirect-rejected'
// (built at the call site with the rejected target in the error).
export function sourceStatus({ networkError = null, httpOk = true, httpStatus = 200, entryCount = 0 } = {}) {
  if (networkError) return { status: 'unavailable', error: `network error: ${String(networkError)}` };
  if (!httpOk) return { status: 'unavailable', error: `HTTP ${httpStatus}` };
  if (entryCount === 0) return { status: 'parse-empty', error: 'page loaded (HTTP 200) but no entries parsed - markup may have changed, check in a browser' };
  return { status: 'ok', error: null };
}

// --- Guarded fetch: no request is dispatched to an unvalidated URL ---

// Fetch with redirect: 'manual' and follow each hop by hand. validateHop runs
// on the initial URL and on EVERY redirect target before the request to it is
// dispatched. A rejected target is never fetched: the result is
// { dispatchBlocked: true, stage: 'initial' | 'redirect', reason, ... }.
export async function fetchGuarded(url, { validateHop, fetchImpl = fetch, maxHops = MAX_REDIRECT_HOPS } = {}) {
  const first = validateHop(url);
  if (!first.ok) return { dispatchBlocked: true, stage: 'initial', reason: first.reason };
  const chain = [];
  let current = url;
  for (;;) {
    const res = await fetchImpl(current, { headers: FETCH_HEADERS, redirect: 'manual' });
    const location = res.headers && typeof res.headers.get === 'function' ? res.headers.get('location') : null;
    if (res.status >= 300 && res.status < 400 && location) {
      const target = new URL(location, current).href;
      const check = validateHop(target);
      if (!check.ok) return { dispatchBlocked: true, stage: 'redirect', from: current, blockedTarget: target, reason: check.reason, chain };
      chain.push({ from: current, to: target });
      if (chain.length > maxHops) return { error: `too many redirects (>${maxHops} hops)`, chain };
      current = target;
      continue;
    }
    const body = await res.text();
    return { ok: res.ok, status: res.status, url: current, body, chain };
  }
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

// The award mark counts ONLY from an exact, end-anchored <title> suffix:
// "<name> - Awwwards SOTD" (or SOTM / SOTY) with nothing after it. A longer
// suffix like "X - Awwwards SOTD archive" is not a mark, and award text in
// nav/related/footer HTML is not a mark either.
const TITLE_SUFFIX = /-\s*Awwwards\s+(SOTD|SOTM|SOTY)\s*$/i;
const MARK_NAMES = { SOTD: 'Site of the Day', SOTM: 'Site of the Month', SOTY: 'Site of the Year' };
// The recognised Awwwards jury axes; grid-score rows with any other labels are
// not jury evidence.
const JURY_AXES = ['Design', 'Usability', 'Creativity', 'Content', 'Overall'];

// One Awwwards /sites/<slug> page. `verified` is the parse-level decision;
// evaluateVerification layers URL/domain/redirect/fetch checks on top.
// Jury corroboration is scoped to the award's own jury structures (grounded in
// the live /sites/ markup read on 21 Nov 2026):
//   * overall score: the box-score__note <strong> inside the class="box-score"
//     jury box in the head toolbar (other box-score__note blocks elsewhere on
//     the page do not count), valid only in the 0-10 range;
//   * jury axes: the grid-score--titles row inside the id="jury_votes"
//     section, counted only when the labels are the recognised jury axes.
export function parseAwwwardsSite(html, url) {
  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleTag ? unescapeHtml(titleTag[1]).trim() : null;
  const awardMarks = [];
  const suffix = rawTitle ? rawTitle.match(TITLE_SUFFIX) : null;
  if (suffix) awardMarks.push(MARK_NAMES[suffix[1].toUpperCase()]);

  let juryScore = null;
  const boxIdx = html.indexOf('class="box-score"');
  if (boxIdx >= 0) {
    const box = html.slice(boxIdx, boxIdx + 2000);
    const note = box.match(/box-score__note[^>]*>\s*<strong>\s*([0-9]+(?:\.[0-9]+)?)/);
    if (note) {
      const n = Number(note[1]);
      if (n >= 0 && n <= 10) juryScore = n;
    }
  }
  let columns = [];
  const juryIdx = html.search(/id="jury_votes"/);
  if (juryIdx >= 0) {
    const section = html.slice(juryIdx, juryIdx + 6000);
    const grid = section.match(/grid-score--titles[\s\S]{0,1200}?<\/div>\s*<\/div>/);
    if (grid) columns = [...grid[0].matchAll(/grid-score__item">([^<]+)</g)].map((m) => m[1].trim()).filter((c) => JURY_AXES.includes(c));
  }
  const corroborated = juryScore != null || columns.length >= 2;

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

// --- Verification decision (pure; network happens via fetchGuarded) ---

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

// Full verify flow with guarded dispatch: the input URL is validated before
// any request, every redirect hop is validated before it is requested, and a
// rejected redirect target is never fetched (redirect-rejected, exit 1).
export async function runVerify(inputUrl, { fetchImpl } = {}) {
  const pre = validateAwwwardsSiteUrl(inputUrl);
  if (!pre.ok) return evaluateVerification({ inputUrl }); // exit 2; no request dispatched
  let r = null; let networkError = null;
  try {
    r = await fetchGuarded(inputUrl, { validateHop: validateAwwwardsSiteUrl, fetchImpl });
  } catch (e) {
    networkError = e.message || e;
  }
  if (r && r.dispatchBlocked) {
    return {
      galleryUrl: inputUrl,
      checkedAt: new Date().toISOString(),
      verified: false,
      status: 'redirect-rejected',
      blockedTarget: r.blockedTarget ?? null,
      error: `redirect target rejected before dispatch: ${r.blockedTarget} - ${r.reason}`,
      redirect: r.chain && r.chain.length ? { from: r.chain[0].from, to: r.chain[r.chain.length - 1].to } : null,
      exitCode: 1,
    };
  }
  if (r && r.error) networkError = r.error;
  return evaluateVerification({
    inputUrl,
    networkError,
    httpOk: r && !r.error ? r.ok : false,
    httpStatus: r && !r.error ? r.status : null,
    finalUrl: r && !r.error ? r.url : null,
    body: r && !r.error ? r.body : '',
  });
}

// --- Collect ---

export async function collect(opts, { fetchImpl } = {}) {
  const collectedAt = new Date().toISOString();
  const sources = [];
  const want = (s) => opts.source === 'all' || opts.source === s;
  // One guarded fetch of a collect source: the source's own validator gates the
  // initial URL and every redirect hop. A redirect away from the source's
  // host/path is a structured redirect-rejected failure, never parsed as data.
  const guarded = async (url, validator) => {
    try {
      const r = await fetchGuarded(url, { validateHop: validator, fetchImpl });
      if (r.dispatchBlocked) {
        return { failed: r.stage === 'redirect'
          ? { status: 'redirect-rejected', error: `redirect target rejected before dispatch: ${r.blockedTarget} - ${r.reason}` }
          : { status: 'redirect-rejected', error: `source URL rejected before dispatch: ${r.reason}` } };
      }
      if (r.error) return { failed: sourceStatus({ networkError: r.error }) };
      return { r };
    } catch (e) {
      return { failed: sourceStatus({ networkError: e.message || e }) };
    }
  };

  if (want('awwwards')) {
    const entries = [];
    let st = { status: 'ok', error: null };
    for (let p = 1; p <= opts.pages; p++) {
      const url = p === 1 ? AWW_SOTD : `${AWW_SOTD}?page=${p}`;
      const { r, failed } = await guarded(url, validateAwwwardsListingUrl);
      if (failed) { st = failed; break; }
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
    const { r, failed } = await guarded(FWA_WINNERS, validateFwaFeedUrl);
    if (failed) st = failed;
    else if (!r.ok) st = sourceStatus({ httpOk: false, httpStatus: r.status });
    else st = sourceStatus({ httpOk: true, entryCount: (entries = parseFwaFeed(r.body)).length });
    sources.push({ source: 'fwa', url: FWA_WINNERS, status: st.status, error: st.error, count: entries.length, listing: 'feed listing candidates - individual awards not yet verified', entries });
    await sleep(opts.delay);
  }

  if (want('cssda')) {
    let entries = []; let st;
    const { r, failed } = await guarded(CSSDA_WOTD, validateCssdaListingUrl);
    if (failed) st = failed;
    else if (!r.ok) st = { ...sourceStatus({ httpOk: false, httpStatus: r.status }), error: `HTTP ${r.status} - CSSDA often blocks scripts; verify in a browser` };
    else st = sourceStatus({ httpOk: true, entryCount: (entries = parseCssdaListing(r.body)).length });
    sources.push({ source: 'cssda', url: CSSDA_WOTD, status: st.status, error: st.error, count: entries.length, listing: 'listing candidates - award category not verified by script', entries });
  }

  const data = { collectedAt, policy: 'List entries are archive/feed listing candidates; an individual award claim stands only after `verify` passes on the gallery own page, read on checkedAt. Unavailable sources are recorded, never substituted or fabricated.', sources };
  // Aggregate exit: 0 when at least one requested source collected entries
  // (status ok) - partial failures stay visible in the per-source statuses -
  // 1 when every requested source failed. Invalid options exit 2 in the CLI.
  const exitCode = sources.every((s) => s.status !== 'ok') ? 1 : 0;
  return { data, exitCode };
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

function printVerificationCard(v, out = console.log) {
  out('AWARD VERIFICATION CARD');
  out(`  status:     ${v.status}`);
  out(`  verified:   ${v.verified ? 'YES' : 'NO'}`);
  if (v.title !== undefined) out(`  title:      ${v.title || '(not parsed)'}`);
  if (v.awardMarks) out(`  award:      ${v.awardMarks.join(', ') || '(none found)'}`);
  if (v.markEvidence !== undefined) out(`  evidence:   ${v.markEvidence || '(no scoped award-mark evidence)'}${v.corroborated ? ' + jury box corroboration' : ''}`);
  if (v.juryScore !== undefined) out(`  jury score: ${v.juryScore != null ? `${v.juryScore} / 10` : '(not published on page)'}`);
  if (v.juryColumns) out(`  jury axes:  ${v.juryColumns.length ? v.juryColumns.join(' / ') : '(not parsed)'}`);
  if (v.liveUrl !== undefined) out(`  live site:  ${v.liveUrl || '(not found)'}`);
  out(`  source:     ${v.galleryUrl}`);
  if (v.finalUrl) out(`  final URL:  ${v.finalUrl}`);
  if (v.blockedTarget) out(`  blocked:    ${v.blockedTarget} (rejected before dispatch)`);
  if (v.redirect) out(`  redirect:   ${v.redirect.from} -> ${v.redirect.to} (still a valid awwwards.com /sites/ page)`);
  out(`  checked:    ${v.checkedAt}`);
  if (v.error) out(`  error:      ${v.error}`);
}

// The CLI entry, exported so integration tests can run the real argument
// parsing, dispatch, file writing and exit-code path with an injected fetch.
export async function runCli(argv, { fetchImpl, stdout = (s) => console.log(s), stderr = (s) => console.error(s) } = {}) {
  const a = argv;
  const cmd = a[0];
  const has = (k) => a.includes(k);
  const val = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };

  if (cmd === 'collect') {
    const source = val('--source', 'all');
    if (!COLLECT_SOURCES.includes(source)) { stderr(`invalid --source "${source}" - expected one of ${COLLECT_SOURCES.join('|')}`); return 2; }
    const pagesRaw = val('--pages', '1');
    if (!/^[1-9]\d*$/.test(String(pagesRaw))) { stderr(`invalid --pages "${pagesRaw}" - must be a positive integer`); return 2; }
    const delayRaw = val('--delay', '1500');
    const delay = Number(delayRaw);
    if (!Number.isFinite(delay) || delay < 0) { stderr(`invalid --delay "${delayRaw}" - must be a non-negative number of milliseconds`); return 2; }
    const opts = { source, pages: Number(pagesRaw), out: val('--out', 'work/references'), delay };
    const { data, exitCode } = await collect(opts, { fetchImpl });
    mkdirSync(opts.out, { recursive: true });
    writeFileSync(join(opts.out, 'award-refs.json'), JSON.stringify(data, null, 2));
    writeFileSync(join(opts.out, 'REFERENCES.md'), renderMarkdown(data));
    for (const s of data.sources) stdout(`${s.source}: ${s.status}${s.count ? ` - ${s.count} listing candidates` : ''}${s.error ? ` - ${s.error}` : ''}`);
    stdout(`wrote ${join(opts.out, 'award-refs.json')} and REFERENCES.md`);
    if (has('--json')) stdout(JSON.stringify(data, null, 2));
    return exitCode;
  } else if (cmd === 'verify') {
    const url = a[1];
    if (!url || !/^https?:\/\//.test(url)) { stderr('usage: award-refs.mjs verify <awwwards-site-url> [--json]'); return 2; }
    const v = await runVerify(url, { fetchImpl });
    if (has('--json')) stdout(JSON.stringify(v, null, 2)); else printVerificationCard(v, stdout);
    return v.exitCode;
  } else {
    stdout('usage:\n  award-refs.mjs collect [--source all|awwwards|fwa|cssda] [--pages N] [--out DIR] [--delay MS] [--json]\n  award-refs.mjs verify <awwwards-site-url> [--json]');
    return 2;
  }
}

const isCli = typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  // Test hook: AWARD_REFS_TEST_FETCH_MODULE points at a module exporting
  // `mockFetch`; the CLI then uses it instead of the global fetch. Tests use
  // this to prove dispatch behaviour (including that no request is dispatched
  // to an invalid or rejected URL) against the real CLI process.
  let fetchImpl;
  const mockModule = process.env.AWARD_REFS_TEST_FETCH_MODULE;
  if (mockModule) {
    const mod = await import(pathToFileURL(resolve(mockModule)).href);
    fetchImpl = mod.mockFetch;
  }
  process.exit(await runCli(process.argv.slice(2), { fetchImpl }));
}
