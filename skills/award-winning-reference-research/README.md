# award-winning-reference-research

Collect and verify award-winning website references from the top award galleries - **Awwwards first** (SOTD/SOTM/SOTY with jury scores), then FWA, CSS Design Awards and the Webby Awards, with curated galleries labelled as curated, never "award-winning" - plus Pinterest for visual web-design references, logged with an honest record of what was actually seen.

```bash
node scripts/award-refs.mjs collect --out work/references     # verified winners lists, dated
node scripts/award-refs.mjs verify <awwwards-site-url>        # URL validated before dispatch, every redirect hop validated before it is fetched, exact title award mark corroborated by the jury box; fails closed
node scripts/pin-log.mjs add <pin-url> --out work/references  # Pinterest refs, review status honest
```

Rules: award claims only from the gallery's own page/feed, read on the day you use them; thumbnails, footer badges and search snippets are leads, not proof; an unreachable source is recorded as unavailable, never substituted or fabricated. Collected lists are archive/feed listing candidates labelled as such - an entry is individually verified only when `verify` passes for it (https awwwards.com `/sites/<slug>` input validated before any request and every redirect target validated before it is dispatched, exact end-anchored award mark from the page title evidence, jury corroboration scoped to the award's own jury box / jury_votes axes; HTTP/network failures return a structured result with a non-zero exit). `collect` validates every source's final URL against that source's own host/path (a redirect away from it is `redirect-rejected`, never parsed) and validates `--pages`/`--source` before any request. See AUDIT-2026-11-21.md for the second-pass audit fixes and their test evidence.

Feeds step 2 (reference teardown) of [`premium-website-playbook`](../premium-website-playbook/); the shortlist is torn down with [`award-site-teardown-method`](../award-site-teardown-method/). Full method in [SKILL.md](SKILL.md); a real dated run in [examples/](examples/).

MIT (text and code), (c) 2026 Sujon Hoque (Zyqor Studio).
