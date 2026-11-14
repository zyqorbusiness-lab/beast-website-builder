# Credits

## Upstream projects

| What | Who | Licence | Where in this repo |
|---|---|---|---|
| Modern Web Guidance | Google LLC + Chrome / Edge / Firefox / MDN stewards | Apache-2.0 | `guidance/` (vendored npm 1.0.0, unmodified; `guidance/VENDORED.json`, `guidance/THIRD_PARTY_NOTICES`) |
| Design skills, components, docs | Sujon Hoque (Zyqor Studio) | MIT | `skills/`, `components/`, `docs/`, `tools/`, `tests/` |
| scroll-world (engine rules adapted) | cyw | MIT | mapped in `docs/beast/SKILLS_SOURCE_MAP.md` |
| three.js | three.js authors | MIT | `components/_shared/vendor/three/` |
| Gravitas (methodology credit) | udaysharmadev | MIT | referenced in `WORKFLOW.md`, not vendored |

## Bundled assets (components/_shared/assets/)

Each file has a machine-readable `<file>.credit.json` next to it.

| Asset | Author | Licence |
|---|---|---|
| Bricolage Grotesque, Archivo, Instrument Serif, JetBrains Mono (woff2) | Mathieu Triay / Omnibus-Type / R. Fuenzalida & J. Egstad / JetBrains | SIL OFL 1.1 |
| Studio Small 09 HDRI | Sergej Majboroda (Poly Haven) | CC0 1.0 |
| Binoculars model | Derek Wight (Poly Haven) | CC0 1.0 |
| Component demo thumbnails (12 concept stills) | Zyqor Studio (own renders) | MIT |
| Component preview images | Zyqor Studio (own work) | MIT |

## Skill-level and component-level credits

Every skill folder and every component folder carries its own README and, where
applicable, its own CREDITS.md / credit files listing the specific sources,
inspirations and licences for that piece. The per-file credit JSONs are the
source of truth; this file is the summary.

## Licence review status

The source portfolio repo ran a full credit audit (519 credit files,
2026-10-28 → resolved 2026-10-31): Fontshare fonts were replaced with OFL
alternatives and all Mixkit footage removed. This repo inherits only the
already-cleaned component + skill assets. 101 of the portfolio's other asset
records remain "licence under review" in the source repo; none of those files
are included here.
