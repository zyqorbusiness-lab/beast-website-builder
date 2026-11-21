// Shared page fixtures for the award-refs tests. Shapes mirror the live
// Awwwards / FWA markup read on 21 Nov 2026: the overall score lives inside
// the class="box-score" jury box in the head toolbar, and the jury axes row
// (grid-score--titles) lives inside the id="jury_votes" section.

export const AWW_LISTING = `
<ul class="grid-cards js-ajax-entries">
<li class="col-3 js-collectable" data-collectable-model-value="{&quot;collectableIdentifier&quot;:&quot;197-historias-ilustradas&quot;,&quot;id&quot;:66229,&quot;slug&quot;:&quot;197-historias-ilustradas&quot;,&quot;title&quot;:&quot;197 Historias Ilustradas&quot;,&quot;createdAt&quot;:1795132800,&quot;tags&quot;:[&quot;Animation&quot;,&quot;Clean&quot;],&quot;type&quot;:&quot;submission&quot;}"></li>
<li class="col-3 js-collectable" data-collectable-model-value="{&quot;slug&quot;:&quot;carter-ogunsola&quot;,&quot;title&quot;:&quot;Carter Ogunsola O.&quot;,&quot;createdAt&quot;:1795220000,&quot;type&quot;:&quot;submission&quot;}"></li>
<li class="col-3 js-collectable" data-collectable-model-value="{&quot;slug&quot;:&quot;not-a-site&quot;,&quot;title&quot;:&quot;Collection&quot;,&quot;type&quot;:&quot;collection&quot;}"></li>
</ul>`;

// A real winner page: exact end-anchored title mark + jury box score + jury axes.
export const AWW_SITE = `<!DOCTYPE html><html><head>
<title>197 Historias Ilustradas - Awwwards SOTD</title>
</head><body>
<div class="head-toolbar__left">
  <div class="box-score">
    <div class="box-score__top"><strong>SOTD</strong></div>
    <div class="box-score__bottom">
      <div class="box-score__note"><strong>7.3</strong><sub class="hidden-sm">/10</sub></div>
    </div>
  </div>
</div>
<section id="jury_votes" data-controller="list-with-hidden-elements">
  <div class="grid-score grid-score--titles" style="--score-cols: 5">
    <div class="grid-score__item">Design</div>
    <div class="grid-score__item">Usability</div>
    <div class="grid-score__item">Creativity</div>
    <div class="grid-score__item">Content</div>
    <div class="grid-score__item">Overall</div>
  </div>
  <ul class="list-jury-notes"><li>jury note</li></ul>
</section>
<a class="toolbar-bts__item" href="https://www.facebook.com/awwwards" target="_blank" rel="noopener"></a>
<a class="toolbar-bts__item" href="https://www.197historiasilustradas.com/" target="_blank" rel="noopener"></a>
</body></html>`;

// "Site of the Day" text in nav/footer and an ORPHAN box-score__note (outside
// the class="box-score" jury box): neither is award or jury evidence.
export const AWW_PAGE_SOTD_TEXT_ONLY = `<!DOCTYPE html><html><head>
<title>Some Random Site - Awwwards</title>
</head><body>
<nav><a href="/websites/sites_of_the_day/">Site of the Day</a></nav>
<div class="sidebar-score"><div class="box-score__note"><strong>6.9</strong></div></div>
<footer>Previous Site of the Day winners</footer>
</body></html>`;

// Title carries the exact mark but the page has no jury structures at all.
export const AWW_PAGE_MARK_NO_JURY = `<!DOCTYPE html><html><head>
<title>Half Evidence - Awwwards SOTD</title>
</head><body><p>No jury box here.</p></body></html>`;

// The title suffix is not end-anchored: "Awwwards SOTD archive" must NOT read
// as the Site of the Day mark, even with valid jury structures on the page.
export const AWW_TITLE_SUFFIX_TRAP = `<!DOCTYPE html><html><head>
<title>Not A Winner - Awwwards SOTD archive</title>
</head><body>
<div class="head-toolbar__left">
  <div class="box-score">
    <div class="box-score__bottom">
      <div class="box-score__note"><strong>8.1</strong><sub>/10</sub></div>
    </div>
  </div>
</div>
<section id="jury_votes">
  <div class="grid-score grid-score--titles">
    <div class="grid-score__item">Design</div>
    <div class="grid-score__item">Usability</div>
  </div>
</section>
</body></html>`;

// Exact title mark, but the only score is an orphan box-score__note outside
// the jury box: unrelated numbers must not corroborate.
export const AWW_UNRELATED_SCORE = `<!DOCTYPE html><html><head>
<title>Orphan Score - Awwwards SOTD</title>
</head><body>
<div class="promo"><div class="box-score__note"><strong>9.9</strong></div></div>
</body></html>`;

// Exact title mark and a grid-score row inside jury_votes, but the labels are
// not the recognised Awwwards jury axes: unrelated axes must not corroborate.
export const AWW_UNRECOGNIZED_AXES = `<!DOCTYPE html><html><head>
<title>Wrong Axes - Awwwards SOTD</title>
</head><body>
<section id="jury_votes">
  <div class="grid-score grid-score--titles">
    <div class="grid-score__item">Speed</div>
    <div class="grid-score__item">Price</div>
    <div class="grid-score__item">Popularity</div>
  </div>
</section>
</body></html>`;

// Exact title mark and a jury box, but the score is outside the valid 0-10
// range: an impossible jury score must not corroborate.
export const AWW_OUT_OF_RANGE_SCORE = `<!DOCTYPE html><html><head>
<title>Bad Score - Awwwards SOTD</title>
</head><body>
<div class="box-score">
  <div class="box-score__bottom">
    <div class="box-score__note"><strong>97.3</strong></div>
  </div>
</div>
</body></html>`;

export const FWA_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>The FWA — Winners</title>
<item><title>Your Perfect Partner</title><link>https://thefwa.com/w/your-perfect-partner</link><pubDate>Tue, 17 Nov 2026 00:00:00 GMT</pubDate><description>By Parallel; Hyundai Middle East. An FWA Website winner.</description></item>
<item><title>Second Winner</title><link>https://thefwa.com/w/second-winner</link><pubDate>Mon, 16 Nov 2026 00:00:00 GMT</pubDate><description>Another one.</description></item>
</channel></rss>`;

export const CSSDA_LISTING = '<a href="https://www.cssdesignawards.com/sites/some-winner/123">x</a>';
