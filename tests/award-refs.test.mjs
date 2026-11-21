// Offline tests for award-winning-reference-research: parsers run on saved fixtures,
// never the network. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  parseAwwwardsListing, parseAwwwardsSite, parseFwaFeed, parseCssdaListing,
  validateAwwwardsSiteUrl, validateAwwwardsListingUrl, validateFwaFeedUrl, validateCssdaListingUrl,
  evaluateVerification, sourceStatus, fetchGuarded,
} = await import(join(ROOT, 'skills/award-winning-reference-research/scripts/award-refs.mjs'));
const { pinIdFromUrl, renderMarkdown } = await import(join(ROOT, 'skills/award-winning-reference-research/scripts/pin-log.mjs'));
const {
  AWW_LISTING, AWW_SITE, AWW_PAGE_SOTD_TEXT_ONLY, AWW_PAGE_MARK_NO_JURY,
  AWW_TITLE_SUFFIX_TRAP, AWW_UNRELATED_SCORE, AWW_UNRECOGNIZED_AXES, AWW_OUT_OF_RANGE_SCORE,
  FWA_FEED, CSSDA_LISTING,
} = await import(join(ROOT, 'tests/fixtures/award-refs-pages.mjs'));

test('parseAwwwardsListing reads submission cards, skips non-submissions', () => {
  const cards = parseAwwwardsListing(AWW_LISTING);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].title, '197 Historias Ilustradas');
  assert.equal(cards[0].galleryUrl, 'https://www.awwwards.com/sites/197-historias-ilustradas');
  assert.equal(cards[0].listedAt, '2026-11-20');
  assert.deepEqual(cards[0].tags, ['Animation', 'Clean']);
  assert.match(cards[0].award, /Site of the Day/);
  assert.ok(cards.every((c) => c.source === 'awwwards'));
});

test('parseAwwwardsListing returns [] on markup it does not know (no fabrication)', () => {
  assert.deepEqual(parseAwwwardsListing('<html><body>nothing here</body></html>'), []);
});

test('parseAwwwardsSite verifies the award mark, jury score and live URL', () => {
  const v = parseAwwwardsSite(AWW_SITE, 'https://www.awwwards.com/sites/197-historias-ilustradas');
  assert.equal(v.verified, true);
  assert.ok(v.awardMarks.includes('Site of the Day'));
  assert.equal(v.title, '197 Historias Ilustradas');
  assert.equal(v.juryScore, 7.3);
  assert.deepEqual(v.juryColumns, ['Design', 'Usability', 'Creativity', 'Content', 'Overall']);
  // the gallery's own social links are not the live site
  assert.equal(v.liveUrl, 'https://www.197historiasilustradas.com/');
});

test('parseAwwwardsSite does not verify a page without an award mark', () => {
  const v = parseAwwwardsSite('<html><head><title>Random Site - Awwwards</title></head><body></body></html>', 'https://www.awwwards.com/sites/random');
  assert.equal(v.verified, false);
  assert.equal(v.juryScore, null);
});

test('parseFwaFeed reads winners from the RSS feed', () => {
  const items = parseFwaFeed(FWA_FEED);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Your Perfect Partner');
  assert.equal(items[0].galleryUrl, 'https://thefwa.com/w/your-perfect-partner');
  assert.match(items[0].description, /Parallel/);
});

test('parseCssdaListing extracts site links without inventing award categories', () => {
  const items = parseCssdaListing(CSSDA_LISTING);
  assert.equal(items.length, 1);
  assert.match(items[0].award, /not verified/);
});

test('pinIdFromUrl reads the numeric pin id across pinterest domains', () => {
  assert.equal(pinIdFromUrl('https://www.pinterest.com/pin/1234567890123456/'), '1234567890123456');
  assert.equal(pinIdFromUrl('https://in.pinterest.com/pin/42/'), '42');
  assert.equal(pinIdFromUrl('https://example.com/not-a-pin'), null);
});

test('pin-log markdown states the honesty policy and review level', () => {
  const md = renderMarkdown({ policy: 'A pin is never award evidence.', entries: [{ url: 'https://www.pinterest.com/pin/42/', title: 'Hero layout', reviewed: 'cover-only', fetched: false, note: 'sticky nav', addedAt: '2026-11-21' }] });
  assert.match(md, /never award evidence/);
  assert.match(md, /reviewed: cover-only/);
});

// --- 21 Nov 2026 audit regression tests: verification must fail closed ---

test('parseAwwwardsSite ignores "Site of the Day" text outside the title evidence', () => {
  const v = parseAwwwardsSite(AWW_PAGE_SOTD_TEXT_ONLY, 'https://www.awwwards.com/sites/some-random-site');
  assert.equal(v.verified, false);
  assert.deepEqual(v.awardMarks, []);
  assert.equal(v.markEvidence, null);
  // an orphan box-score__note outside the jury box is not jury evidence either
  assert.equal(v.juryScore, null);
  assert.equal(v.corroborated, false);
});

test('parseAwwwardsSite does not pass on a title mark without jury corroboration', () => {
  const v = parseAwwwardsSite(AWW_PAGE_MARK_NO_JURY, 'https://www.awwwards.com/sites/half-evidence');
  assert.ok(v.awardMarks.includes('Site of the Day'));
  assert.equal(v.corroborated, false);
  assert.equal(v.verified, false);
});

test('parseAwwwardsSite requires an exact end-anchored title suffix', () => {
  // "... - Awwwards SOTD archive" is not the Site of the Day mark, even with
  // valid jury structures on the page
  const trap = parseAwwwardsSite(AWW_TITLE_SUFFIX_TRAP, 'https://www.awwwards.com/sites/not-a-winner');
  assert.deepEqual(trap.awardMarks, []);
  assert.equal(trap.verified, false);
  // the exact suffix still matches, with or without trailing whitespace
  const exact = parseAwwwardsSite('<html><head><title>Site X - Awwwards SOTY </title></head><body>' + AWW_SITE.split('<body>')[1], 'https://www.awwwards.com/sites/site-x');
  assert.ok(exact.awardMarks.includes('Site of the Year'));
  assert.equal(exact.verified, true);
});

test('parseAwwwardsSite does not corroborate from unrelated scores or axes', () => {
  // an orphan box-score__note outside the class="box-score" jury box
  const orphan = parseAwwwardsSite(AWW_UNRELATED_SCORE, 'https://www.awwwards.com/sites/orphan-score');
  assert.equal(orphan.juryScore, null);
  assert.equal(orphan.corroborated, false);
  assert.equal(orphan.verified, false);
  // grid-score labels that are not the recognised jury axes
  const wrongAxes = parseAwwwardsSite(AWW_UNRECOGNIZED_AXES, 'https://www.awwwards.com/sites/wrong-axes');
  assert.deepEqual(wrongAxes.juryColumns, []);
  assert.equal(wrongAxes.corroborated, false);
  assert.equal(wrongAxes.verified, false);
  // a jury-box score outside the valid 0-10 range
  const badScore = parseAwwwardsSite(AWW_OUT_OF_RANGE_SCORE, 'https://www.awwwards.com/sites/bad-score');
  assert.equal(badScore.juryScore, null);
  assert.equal(badScore.corroborated, false);
  assert.equal(badScore.verified, false);
});

test('validateAwwwardsSiteUrl accepts only https awwwards.com /sites/<slug> pages', () => {
  assert.equal(validateAwwwardsSiteUrl('https://www.awwwards.com/sites/197-historias-ilustradas').ok, true);
  assert.equal(validateAwwwardsSiteUrl('https://awwwards.com/sites/carter-ogunsola/').ok, true);
  // wrong domain, look-alike domain, non-https, and non-/sites/ paths all rejected
  assert.equal(validateAwwwardsSiteUrl('https://evil-awwwards.com/sites/x').ok, false);
  assert.equal(validateAwwwardsSiteUrl('https://awwwards.com.evil.example/sites/x').ok, false);
  assert.equal(validateAwwwardsSiteUrl('http://www.awwwards.com/sites/x').ok, false);
  assert.equal(validateAwwwardsSiteUrl('https://www.awwwards.com/websites/sites_of_the_day/').ok, false);
  assert.equal(validateAwwwardsSiteUrl('https://www.awwwards.com/').ok, false);
  assert.equal(validateAwwwardsSiteUrl('not a url').ok, false);
});

test('collect source validators pin each source to its own host and path', () => {
  assert.equal(validateAwwwardsListingUrl('https://www.awwwards.com/websites/sites_of_the_day/').ok, true);
  assert.equal(validateAwwwardsListingUrl('https://www.awwwards.com/websites/sites_of_the_day/?page=2').ok, true);
  assert.equal(validateAwwwardsListingUrl('https://www.awwwards.com/sites/some-site').ok, false);
  assert.equal(validateAwwwardsListingUrl('https://evil.example/websites/sites_of_the_day/').ok, false);
  assert.equal(validateFwaFeedUrl('https://thefwa.com/feed/winners.xml').ok, true);
  assert.equal(validateFwaFeedUrl('https://thefwa.com/w/some-winner').ok, false);
  assert.equal(validateFwaFeedUrl('https://evil-thefwa.com/feed/winners.xml').ok, false);
  assert.equal(validateCssdaListingUrl('https://www.cssdesignawards.com/website-of-the-day/').ok, true);
  assert.equal(validateCssdaListingUrl('https://www.cssdesignawards.com/sites/some-winner/123').ok, false);
  assert.equal(validateCssdaListingUrl('http://www.cssdesignawards.com/website-of-the-day/').ok, false);
});

test('evaluateVerification rejects redirects off awwwards.com or off the /sites/ page type', () => {
  const offDomain = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/x', httpOk: true, httpStatus: 200, finalUrl: 'https://evil.example/sites/x', body: AWW_SITE });
  assert.equal(offDomain.status, 'redirect-rejected');
  assert.equal(offDomain.verified, false);
  assert.equal(offDomain.exitCode, 1);
  const toHome = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/x', httpOk: true, httpStatus: 200, finalUrl: 'https://www.awwwards.com/', body: AWW_SITE });
  assert.equal(toHome.status, 'redirect-rejected');
  assert.equal(toHome.verified, false);
});

test('evaluateVerification fails closed with structured results on HTTP and network failures', () => {
  const httpFail = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/x', httpOk: false, httpStatus: 503 });
  assert.equal(httpFail.status, 'fetch-failed');
  assert.equal(httpFail.verified, false);
  assert.equal(httpFail.exitCode, 1);
  assert.match(httpFail.error, /HTTP 503/);
  const netFail = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/x', networkError: 'socket hang up' });
  assert.equal(netFail.status, 'fetch-failed');
  assert.equal(netFail.verified, false);
  assert.equal(netFail.exitCode, 1);
  assert.match(netFail.error, /socket hang up/);
  const badUrl = evaluateVerification({ inputUrl: 'https://example.com/sites/x' });
  assert.equal(badUrl.status, 'invalid-url');
  assert.equal(badUrl.exitCode, 2);
});

test('evaluateVerification verifies only a real winner page through the full chain', () => {
  const ok = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/197-historias-ilustradas', httpOk: true, httpStatus: 200, finalUrl: 'https://www.awwwards.com/sites/197-historias-ilustradas', body: AWW_SITE });
  assert.equal(ok.status, 'verified');
  assert.equal(ok.verified, true);
  assert.equal(ok.exitCode, 0);
  assert.equal(ok.juryScore, 7.3);
  // a valid awwwards.com /sites/ redirect is recorded, not rejected
  const moved = evaluateVerification({ inputUrl: 'https://awwwards.com/sites/197-historias-ilustradas', httpOk: true, httpStatus: 200, finalUrl: 'https://www.awwwards.com/sites/197-historias-ilustradas', body: AWW_SITE });
  assert.equal(moved.verified, true);
  assert.deepEqual(moved.redirect, { from: 'https://awwwards.com/sites/197-historias-ilustradas', to: 'https://www.awwwards.com/sites/197-historias-ilustradas' });
  // mark without jury corroboration is inconclusive, never verified
  const half = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/half-evidence', httpOk: true, httpStatus: 200, finalUrl: 'https://www.awwwards.com/sites/half-evidence', body: AWW_PAGE_MARK_NO_JURY });
  assert.equal(half.status, 'inconclusive');
  assert.equal(half.verified, false);
  assert.equal(half.exitCode, 1);
  // raw "Site of the Day" text without a title mark does not verify
  const textOnly = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/some-random-site', httpOk: true, httpStatus: 200, finalUrl: 'https://www.awwwards.com/sites/some-random-site', body: AWW_PAGE_SOTD_TEXT_ONLY });
  assert.equal(textOnly.status, 'not-verified');
  assert.equal(textOnly.verified, false);
  // a non-anchored title suffix does not verify even with jury structures
  const trap = evaluateVerification({ inputUrl: 'https://www.awwwards.com/sites/not-a-winner', httpOk: true, httpStatus: 200, finalUrl: 'https://www.awwwards.com/sites/not-a-winner', body: AWW_TITLE_SUFFIX_TRAP });
  assert.equal(trap.status, 'not-verified');
  assert.equal(trap.verified, false);
});

test('sourceStatus maps HTTP 200 with zero parsed entries to parse-empty, never ok', () => {
  assert.deepEqual(sourceStatus({ httpOk: true, httpStatus: 200, entryCount: 0 }).status, 'parse-empty');
  assert.equal(sourceStatus({ httpOk: true, httpStatus: 200, entryCount: 5 }).status, 'ok');
  assert.equal(sourceStatus({ httpOk: false, httpStatus: 502 }).status, 'unavailable');
  assert.match(sourceStatus({ httpOk: false, httpStatus: 502 }).error, /HTTP 502/);
  assert.equal(sourceStatus({ networkError: 'ECONNRESET' }).status, 'unavailable');
  assert.match(sourceStatus({ networkError: 'ECONNRESET' }).error, /ECONNRESET/);
});

test('listing parsers label entries as candidates, not individually verified', () => {
  for (const e of parseAwwwardsListing(AWW_LISTING)) assert.match(e.verification, /not individually verified/);
  for (const e of parseFwaFeed(FWA_FEED)) assert.match(e.verification, /not individually verified/);
  for (const e of parseCssdaListing(CSSDA_LISTING)) assert.match(e.verification, /not individually verified/);
});

// --- fetchGuarded: validation happens BEFORE dispatch, hop by hop ---

function recordingFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const r = routes[url];
    if (!r) throw new Error(`no route for ${url}`);
    if (r.networkError) throw new Error(r.networkError);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (n) => (String(n).toLowerCase() === 'location' ? r.location ?? null : null) },
      text: async () => r.body ?? '',
    };
  };
  return { fetchImpl, calls };
}

test('fetchGuarded never dispatches a request for an invalid initial URL', async () => {
  const { fetchImpl, calls } = recordingFetch({});
  const r = await fetchGuarded('https://evil.example/sites/x', { validateHop: validateAwwwardsSiteUrl, fetchImpl });
  assert.equal(r.dispatchBlocked, true);
  assert.equal(r.stage, 'initial');
  assert.equal(calls.length, 0);
});

test('fetchGuarded rejects an off-domain redirect target without dispatching it', async () => {
  const { fetchImpl, calls } = recordingFetch({
    'https://www.awwwards.com/sites/x': { status: 302, location: 'https://evil.example/sites/x' },
  });
  const r = await fetchGuarded('https://www.awwwards.com/sites/x', { validateHop: validateAwwwardsSiteUrl, fetchImpl });
  assert.equal(r.dispatchBlocked, true);
  assert.equal(r.stage, 'redirect');
  assert.equal(r.blockedTarget, 'https://evil.example/sites/x');
  // the only request dispatched was the original URL; the target was never fetched
  assert.deepEqual(calls, ['https://www.awwwards.com/sites/x']);
});

test('fetchGuarded rejects a redirect to a non-/sites/ awwwards.com page', async () => {
  const { fetchImpl, calls } = recordingFetch({
    'https://www.awwwards.com/sites/x': { status: 301, location: 'https://www.awwwards.com/' },
  });
  const r = await fetchGuarded('https://www.awwwards.com/sites/x', { validateHop: validateAwwwardsSiteUrl, fetchImpl });
  assert.equal(r.dispatchBlocked, true);
  assert.equal(r.stage, 'redirect');
  assert.deepEqual(calls, ['https://www.awwwards.com/sites/x']);
});

test('fetchGuarded follows a valid same-source redirect and records the chain', async () => {
  const { fetchImpl, calls } = recordingFetch({
    'https://awwwards.com/sites/x': { status: 301, location: '/sites/x/' },
    'https://awwwards.com/sites/x/': { status: 200, body: '<html></html>' },
  });
  const r = await fetchGuarded('https://awwwards.com/sites/x', { validateHop: validateAwwwardsSiteUrl, fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://awwwards.com/sites/x/');
  assert.deepEqual(r.chain, [{ from: 'https://awwwards.com/sites/x', to: 'https://awwwards.com/sites/x/' }]);
  assert.deepEqual(calls, ['https://awwwards.com/sites/x', 'https://awwwards.com/sites/x/']);
});

test('fetchGuarded stops redirect loops instead of following forever', async () => {
  const routes = {};
  for (let i = 0; i <= 8; i++) routes[`https://www.awwwards.com/sites/loop-${i}`] = { status: 302, location: `https://www.awwwards.com/sites/loop-${i + 1}` };
  const { fetchImpl, calls } = recordingFetch(routes);
  const r = await fetchGuarded('https://www.awwwards.com/sites/loop-0', { validateHop: validateAwwwardsSiteUrl, fetchImpl });
  assert.match(r.error, /too many redirects/);
  assert.ok(calls.length <= 7);
});
