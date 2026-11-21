---
name: award-winning-reference-research
description: Collect and verify award-winning website references from the top award galleries - Awwwards first (Sujon's #1 source), then FWA, CSS Design Awards and the Webby Awards, with curated galleries labelled as curated (never "award-winning") - plus Pinterest for visual web-design references. Every award claim must be verified on the gallery's own award page or feed with the date checked; thumbnails, footer badges and search snippets never count as proof. Includes scripts/award-refs.mjs (collect verified winners lists and verify a single site's award and jury scores) and scripts/pin-log.mjs (log Pinterest references honestly: cover seen vs pin page opened).
when_to_use: before designing any site ("take references from Pinterest and award-winning sites", "use the best award websites as reference"), step 2 of the premium-website-playbook, when a reference list must only contain verified winners, when judging whether a site really won something
license: MIT (text and code). Sources credited in CREDITS.md.
version: 1.2.0
---

# Award-winning reference research

Sujon, 21 Nov 2026: references should come from Pinterest and the best award-winning websites - not only Awwwards,
but every top award gallery - with Awwwards first: *"Sirf awwards website se nahi savi best best awards website"* and
*"Awwward sabse best ga to a ak num par hona chahiye"* (Awwwards is the best, so it stays number one).

The craft rule under it: **a reference is only as good as its proof.** "Award-winning" is a claim to verify, not a
look. A gallery thumbnail, a badge the site drew on itself, or a Google snippet is not proof. Proof is the gallery's
own award page or feed, opened and read, with the date you checked.

```
pick sources from the ladder -> award-refs.mjs collect (verified winners lists, dated)
  -> choose 3-5 that fit THIS project -> award-refs.mjs verify <site> (award + jury scores + live URL)
  -> Pinterest searches for layout / type / motion ideas (pin-log.mjs, honest review status)
  -> hand the shortlist to award-site-teardown-method (teardown.mjs per site)
  -> take structure / rhythm / choreography; never take content
```

## 1. The source ladder

In priority order. Awwwards is first because Sujon said so; the rest follow by jury credibility and how checkable
they are.

| # | Source | What it gives | How to verify | Scriptable |
|---|---|---|---|---|
| 1 | **Awwwards** (awwwards.com) | Site of the Day / Month / Year, jury scores Design 40 / Usability 30 / Creativity 20 / Content 10, tech tags | The site's `/sites/<slug>` page: title carries the award mark, the jury box carries the scores | yes: `award-refs.mjs collect --source awwwards`, `verify` |
| 2 | **The FWA** (thefwa.com) | FWA of the Day / Month / Year, human jury since 2000 | The winners feed (`/feed/winners.xml`) and the winner's own `/w/<slug>` page | yes: `award-refs.mjs collect --source fwa` |
| 3 | **CSS Design Awards** (cssdesignawards.com) | Website of the Day, scored UI / UX / Innovation | The site's award page with its three scores | often blocks scripts (502/403): collect in the browser, record what you saw |
| 4 | **Webby Awards** (winners.webbyawards.com) | Websites & Mobile Sites winners, big-jury credibility | The winner's page on winners.webbyawards.com naming year + category | JS app: verify in the browser |
| 5 | **Curated galleries - NOT awards**: siteinspire, Land-book, Lapa Ninja, Minimal Gallery | Calm, well-filtered design references | Their listing is the whole claim | label every entry "curated", never "award-winning" |
| 6 | **Pinterest** | The widest visual net for layout / type / motion / composition ideas | A pin is never an award claim; it is a look to learn from | `pin-log.mjs` logs each pin with what was actually seen |

Rules that keep the ladder honest:

1. **Award claims come from the gallery's own page or feed only**, opened and read on the day you use them. Record
   the gallery URL and the check date next to every entry.
2. **Thumbnails, self-drawn badges, footers and search snippets are leads, not proof.** A site saying "Awwwards SOTD"
   in its own footer is confirmed only when its Awwwards page says so.
3. **A source that is down is down.** Record `unavailable` with the HTTP status and the time; never substitute a
   "similar" site and never fabricate entries. CSSDA returned 502 to scripts on 21 Nov 2026 - that is what the log
   says, nothing more.
4. **"Curated" is not "award-winning".** siteinspire / Land-book / Lapa Ninja / Minimal Gallery entries go in the
   list with the label `curated`; mixing them into the award tier is how fake credibility starts.
5. **Scores are quoted, not invented.** If the page does not publish a number, the entry has no number.
6. **Verification fails closed, before the network.** `award-refs.mjs verify` validates the input URL before any
   request is dispatched: only an https `awwwards.com/sites/<slug>` page is ever fetched. Redirects are followed
   one hop at a time and every redirect target is validated *before the request to it is dispatched* - an
   off-domain or off-`/sites/` target is rejected without being fetched. The award mark counts only from an exact,
   end-anchored `<title>` suffix (`<name> - Awwwards SOTD/SOTM/SOTY`); a longer suffix like "Awwwards SOTD archive"
   is not a mark, and award text anywhere else in the HTML never is. A mark alone never passes: jury corroboration
   must come from the award's own jury structures - the overall score (0-10) inside the `class="box-score"` jury
   box, or the recognised jury axes (Design / Usability / Creativity / Content / Overall) inside the
   `id="jury_votes"` section - never from an orphan `box-score__note` number or an arbitrary grid-score row
   elsewhere on the page. Anything else - wrong domain, rejected redirect, missing mark, mark without jury
   evidence, HTTP or network failure - is a structured non-zero-exit result (`invalid-url`, `redirect-rejected`,
   `not-verified`, `inconclusive`, `fetch-failed`), never a pass.
7. **A collected list is candidates, not verdicts.** `collect` entries are archive/feed listing candidates labelled
   `listing-candidate (not individually verified)`; an individual award claim stands only after `verify` passes for
   that site. A source that answers HTTP 200 with nothing parseable is `parse-empty`, not `ok`. Every source fetch
   is validated the same way as `verify`: the final URL must stay on the source's own host and listing/feed path,
   or the source is recorded `redirect-rejected` and the redirected content is never parsed as source data.
8. **Invalid options stop before the network.** `--pages` must be a positive integer, `--source` one of
   `all|awwwards|fwa|cssda`, `--delay` a non-negative number; anything else exits 2 without a single request.
   Exit codes: `verify` 0 verified / 1 not verified, fetch failure or rejected redirect / 2 invalid input;
   `collect` 0 when at least one requested source collected entries (per-source statuses record partial
   failures), 1 when every requested source failed, 2 for invalid options.

## 2. Choosing the 3-5 references for a project

Same discipline as `award-site-teardown-method` §2, now fed by verified lists:

1. **3-5 per project.** More becomes a mood board.
2. **Awwwards first** (Sujon's order): at least one current Site of the Day and one Site of the Year / Month winner.
3. **At least two from outside the client's industry** - the unexpected idea comes from there.
4. **Not three from the same agency** - that teaches one studio's habits.
5. **Match the tier.** For a NORMAL site, study well-made simple winners too, not only the spectacular ones.
6. **Still live, opens in a normal browser, works on a phone.** `award-refs.mjs verify` prints the live URL it found;
   a dead winner is a history lesson, not a reference.
7. Relevance beats fame: the best reference for this brief outranks the biggest name on the list.

## 3. Scripts

Node >= 22, no dependencies. Both write dated, source-stamped files you keep in the project notes.

```bash
# Collect today's verified winners from the galleries (Awwwards SOTD archive + FWA winners feed by default)
node skills/award-winning-reference-research/scripts/award-refs.mjs collect --out work/references
# -> work/references/award-refs.json + REFERENCES.md, one section per source with per-source status

# Verify one site before it goes on the shortlist: award mark, jury scores, live URL
node skills/award-winning-reference-research/scripts/award-refs.mjs verify https://www.awwwards.com/sites/197-historias-ilustradas
node skills/award-winning-reference-research/scripts/award-refs.mjs verify <url> --json

# Log Pinterest references with honest review status (cover seen vs pin page opened)
node skills/award-winning-reference-research/scripts/pin-log.mjs add https://www.pinterest.com/pin/<id>/ --out work/references --note "sticky chapter nav"
node skills/award-winning-reference-research/scripts/pin-log.mjs list --out work/references
```

Politeness is part of the craft: one request at a time, a delay between pages (`--delay`, default 1500 ms), no
crawling, no re-fetching the same page in a loop. If a gallery rate-limits or blocks you, stop and use the browser.

## 4. Pinterest for website references (the honest half)

Pinterest is where the volume is; honesty about what you saw is what keeps it useful.

1. Search per design need, not per vibe: "awwwards winning website design", "landing page design inspiration",
   "website hero section design", "web design typography layout", "<industry> website design". Save nothing, follow
   nothing; you are mining, not socialising.
2. **`reviewed: cover-only` means the cover thumbnail was seen and the pin page was not opened.** Say that wherever
   you give a count. Open the pin page (and the outbound site) for the ones that make the shortlist; upgrade the log
   entry to `pin-page`.
3. Learn layout, type scale, colour relationships, spacing rhythm and composition. **Never download or reuse the
   pin's images, logos, fonts or illustrations** - that content belongs to someone (see
   `asset-sources-and-licence-check`: unclear licence means skip).
4. Palette caution: skip pins whose look is purple / violet / blue neon / cyan glow as palette references - learn
   the layout, never the palette (per `colour-systems` and Sujon's no-purple note for client samples, 4 Nov 2026).
5. A pin is never "award-winning" evidence, even when its title says so. Verify any award claim on the gallery.

## 5. From reference to build

The shortlist feeds `award-site-teardown-method`: one `teardown.mjs` run per chosen site, judgment card, take /
never-take lines, then into the playbook route. The summary that does not change:

- **Take:** structure, rhythm, hierarchy, choreography, a measured technique.
- **Never take:** logo, brand, copy, photos, illustrations, models, fonts without a licence, code without a licence.
- The result must read as designed, not collected: one idea, chosen moves, nothing pasted.

## Worked example

`examples/REFERENCES.md` + `examples/award-refs.json`: a real `collect` run from 21 Nov 2026 (Awwwards SOTD archive
page 1 + FWA winners feed; CSSDA attempted and recorded unavailable with its HTTP status). All 66 entries are
listing candidates, not individually verified. Exactly two sites have individual verification cards in
`examples/verified/` - each card records the source page URL, the scoped award-mark evidence (title suffix + jury
box corroboration), the jury score, the live site URL and the check date from that page read.
