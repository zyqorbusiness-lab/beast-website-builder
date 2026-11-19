# Beast Website Builder

One free toolkit for designing and building premium websites with an AI coding
agent: **37 design skills** that teach the craft, **14 production UI
components** you can drop in, **203 modern-web use-case guides with a search
CLI** that keep the code current, and a **workflow** that ties them together
with an evidence gate before anything ships.

It combines two repos that were never competitors:

| Layer | From | What it gives you |
|---|---|---|
| Design brain | [best-website-designer](https://github.com/zyqorbusiness-lab/best-website-designer) (Zyqor Studio, MIT) | How to make a site look and feel hand-made and premium: idea, colour, type, layout, motion, 3D, phone parity, copy, QA. |
| Technical guardrail | [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) (Google Chrome + Edge + Firefox + MDN stewards, Apache-2.0) | What the platform can do today: search 203 use-case guides (250 indexed platform features) and scan code for legacy patterns before you write UI. |
| Build loop | this repo (+ [Gravitas](https://github.com/udaysharmadev/Gravitas) invariants, adapted in [skills/gravitas-thinking](skills/gravitas-thinking/)) | How to run the two together: brief → design → guidance-checked build → measured QA → evidence-based ship. See [WORKFLOW.md](WORKFLOW.md). |

No paid dependencies. Static files, Node >= 22 scripts, self-hosted assets.

## Quickstart

```bash
git clone <this repo>
cd beast-website-builder

# 1. The design route for the site you are about to build
node skills/premium-website-playbook/scripts/route.mjs --tier premium

# 2. Before writing any UI code, check the modern pattern for it
npm run guidance -- search "modal dialog"
npm run guidance -- retrieve "dialog"

# 3. After building, scan for legacy patterns
npm run guidance -- legacy-scan path/to/your/site

# 4. Repo self-check + smoke tests
npm run validate
npm test
```

Telemetry note: the upstream guidance CLI collects anonymous usage data unless
opted out. `npm run guidance` sets `DISABLE_TELEMETRY=1` for you; running the
CLI directly does not. Details in [guidance/VENDORED.json](guidance/VENDORED.json).

## What's inside

- **[skills/](skills/README.md)** - 37 self-contained skills (38 entries
  including the index README). Each skill is a folder
  an agent (or a person) can read: `SKILL.md` with rules, numbers and reasons,
  runnable scripts, a working example and a pre-ship checklist. Start with
  [premium-website-playbook](skills/premium-website-playbook/) - it names the
  skill and the gate for every step from brief to deploy. New here as a coding
  agent? [AGENTS.md](AGENTS.md) is your entry point, and
  [gravitas-thinking](skills/gravitas-thinking/) carries the working
  discipline with paste-ready adapters for Gemini, Claude, ChatGPT and other
  models.
- **[components/](components/README.md)** - 14 reusable UI components
  (magnetic button, split text, liquid glass card, sticky story, marquee,
  cursor follower, image trail, preloader, page transition, pricing switcher,
  quote carousel, mega menu, footer wordmark, scroll-scrubbed 3D stage). Plain
  HTML/CSS/JS, no framework, no build step; keyboard and touch support,
  reduced-motion handling, own README and credits each. Self-contained: shared
  fonts, vendor three.js, HDRI and demo assets live in `components/_shared/`.
- **[guidance/](guidance/)** - Modern Web Guidance vendored from npm v1.0.0
  (content build 2026_11_09-5bcc021b): the `search` / `retrieve` /
  `legacy-scan` CLI and 203 use-case guides across CSS, forms, performance,
  accessibility, UI components, security and more. Update with
  `npm run update-guidance`.
- **[docs/](docs/)** - design rules, the QA checklist, the skills source map,
  a teardown study of award-winning sites, motion references, a full case
  study, and [INTEGRATION.md](docs/INTEGRATION.md): which guidance guides to
  query at each step of each design skill.
- **[tools/](tools/)** - `validate.mjs` (repo self-check), `guidance.mjs`
  (telemetry-opted-out CLI wrapper), `update-guidance.mjs` (upstream refresh),
  plus the original toolkit: `credits-check.mjs` (credit gate over every
  asset), `credits-build.mjs`, `check-links.mjs`, `join-parts.mjs` +
  `parts.json` (reassemble split `.glb` parts; the library `site/` entries
  stay in the source repo, only the vendored flight-helmet is indexed here),
  `library-build.mjs`, `qa-library.mjs`, `new-concept.mjs` (library
  maintainers' tooling, operate on a `site/` tree) and `video-flow/`.
- **[tests/](tests/)** - dependency-free `node:test` smoke tests plus
  regression tests for the router's `--step` modes and the qa-harness
  collision check (the collision tests use the harness's own browser and skip
  with a message when it is not installed; CI installs it so they always run
  there). CI is live
  on this repo: [.github/workflows/ci.yml](.github/workflows/ci.yml) runs
  `validate.mjs`, the smoke and regression tests and a guidance legacy-scan on every push
  (green on commit `d438ac6`, 2026-11-19). Forks get the same workflow
  automatically. A reference copy is kept at [tools/ci.yml](tools/ci.yml);
  edit `.github/workflows/ci.yml` and keep the two in sync.

## The method in one paragraph

Design decisions come from the skills; implementation decisions get checked
against the guidance CLI *before* the code is written; nothing ships until the
QA gates pass and the evidence exists. "It works" means a measured page at
1440 / 390 / 360 px with zero console errors, a clean legacy-scan, passing
budget / accessibility / SEO / copy / credits scripts, and a record of what
was *not* tested. The full loop: [WORKFLOW.md](WORKFLOW.md).

## Honest scope

- The 14 component demos are byte-equivalent to the live
  [gallery](https://zyqor-portfolio.vercel.app/components/) with their shared
  assets re-homed into `_shared/`; run them locally with any static server
  (`npx serve components`).
- This repo is the **toolkit**. The portfolio that showcases it lives in the
  [source repo](https://github.com/zyqorbusiness-lab/best-website-designer)
  and at [zyqor-portfolio.vercel.app](https://zyqor-portfolio.vercel.app/) -
  neither is copied or changed by this repo.
- Skills teach and scripts check; no tool guarantees an award-winning site.
  The skills' own claim is narrower: every shipped example passed its QA
  harness at three viewport sizes with zero console errors.

## Credits and licence

Original work MIT, (c) 2026 Sujon Hoque (Zyqor Studio) - see [LICENSE](LICENSE).
Third-party work keeps its own licence: Modern Web Guidance is Apache-2.0
(Google LLC and stewards), three.js is MIT, fonts are SIL OFL 1.1, HDRI/model
assets are CC0. Full attribution in [NOTICE](NOTICE) and [CREDITS.md](CREDITS.md).
This is an independent bundle; no upstream project endorses it.
