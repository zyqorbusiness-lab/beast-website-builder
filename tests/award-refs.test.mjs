// Offline tests for award-winning-reference-research: parsers run on saved fixtures,
// never the network. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { parseAwwwardsListing, parseAwwwardsSite, parseFwaFeed, parseCssdaListing } = await import(join(ROOT, 'skills/award-winning-reference-research/scripts/award-refs.mjs'));
const { pinIdFromUrl, renderMarkdown } = await import(join(ROOT, 'skills/award-winning-reference-research/scripts/pin-log.mjs'));

// Fixture shapes mirror the live markup read on 21 Nov 2026.
const AWW_LISTING = `
<ul class="grid-cards js-ajax-entries">
<li class="col-3 js-collectable" data-collectable-model-value="{&quot;collectableIdentifier&quot;:&quot;197-historias-ilustradas&quot;,&quot;id&quot;:66229,&quot;slug&quot;:&quot;197-historias-ilustradas&quot;,&quot;title&quot;:&quot;197 Historias Ilustradas&quot;,&quot;createdAt&quot;:1795132800,&quot;tags&quot;:[&quot;Animation&quot;,&quot;Clean&quot;],&quot;type&quot;:&quot;submission&quot;}"></li>
<li class="col-3 js-collectable" data-collectable-model-value="{&quot;slug&quot;:&quot;carter-ogunsola&quot;,&quot;title&quot;:&quot;Carter Ogunsola O.&quot;,&quot;createdAt&quot;:1795220000,&quot;type&quot;:&quot;submission&quot;}"></li>
<li class="col-3 js-collectable" data-collectable-model-value="{&quot;slug&quot;:&quot;not-a-site&quot;,&quot;title&quot;:&quot;Collection&quot;,&quot;type&quot;:&quot;collection&quot;}"></li>
</ul>`;

const AWW_SITE = `<!DOCTYPE html><html><head>
<title>197 Historias Ilustradas - Awwwards SOTD</title>
</head><body>
<div class="box-score__note"><strong>7.3</strong></div>
<div class="grid-score grid-score--titles" style="--score-cols: 5">
  <div class="grid-score__item">Design</div>
  <div class="grid-score__item">Usability</div>
  <div class="grid-score__item">Creativity</div>
  <div class="grid-score__item">Content</div>
  <div class="grid-score__item">Overall</div>
</div>
<a class="toolbar-bts__item" href="https://www.facebook.com/awwwards" target="_blank" rel="noopener"></a>
<a class="toolbar-bts__item" href="https://www.197historiasilustradas.com/" target="_blank" rel="noopener"></a>
</body></html>`;

const FWA_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>The FWA — Winners</title>
<item><title>Your Perfect Partner</title><link>https://thefwa.com/w/your-perfect-partner</link><pubDate>Tue, 17 Nov 2026 00:00:00 GMT</pubDate><description>By Parallel; Hyundai Middle East. An FWA Website winner.</description></item>
<item><title>Second Winner</title><link>https://thefwa.com/w/second-winner</link><pubDate>Mon, 16 Nov 2026 00:00:00 GMT</pubDate><description>Another one.</description></item>
</channel></rss>`;

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
  const items = parseCssdaListing('<a href="https://www.cssdesignawards.com/sites/some-winner/123">x</a>');
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
