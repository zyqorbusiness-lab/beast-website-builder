# The build workflow

The loop that ties the two halves of this repo together. Design calls come
from the skills; implementation calls get checked against Modern Web Guidance
before code is written; completion is gated on executed evidence.

The evidence rules below follow the six invariants of
[Gravitas](https://github.com/udaysharmadev/Gravitas) (MIT, udaysharmadev):
ground before mutating, stay in declared scope, completion needs fresh
executed evidence, never exact-retry a failure, satisfy the stated contract,
and say what you cannot verify. Read the upstream skill for the full method;
this file applies it to website builds.

---

## Phase 0 - Brief and spec (before any design)

**Skills:** `build-spec-and-storyboard`, `client-site-delivery-workflow` (intake).
**Do:** write the spec and storyboard first; lint it.

```bash
node skills/build-spec-and-storyboard/scripts/spec-lint.mjs <spec.md>
```

**Gate:** spec names the audience, the one big thing the page must do, the
tier (normal / advanced / premium) and what is explicitly out of scope.

## Phase 1 - Idea and concept

**Skills:** `unique-idea-and-concept`, `unique-concepts`.
**Do:** one big idea ("[product] as [thing or place]"), its metaphor, story
arc and chapters. Check the idea sentence:

```bash
node skills/unique-idea-and-concept/scripts/storyboard.mjs <idea>
```

**Gate:** the idea survives the skill's constraint cards; it is not a generic
"modern landing page".

## Phase 2 - Design tokens

**Skills:** `colour-systems`, `typography-premium`, `layout-grid-spacing`.
**Do:** pick the palette, type scale and page structure as tokens before
pixels. Generate and check them:

```bash
node skills/colour-systems/scripts/palette.mjs        # OKLCH + WCAG checks
node skills/unique-concepts/tools/palette-check.mjs
```

**Guidance check:** query the platform guides for the layout primitives you
plan to use *before* hand-rolling them:

```bash
npm run guidance -- search "container queries layout"
npm run guidance -- search "oklch color palette"
npm run guidance -- search "fluid typography clamp"
```

**Gate:** palette passes WCAG at the sizes the type scale assigns; layout is
one of the 14 named structures or a documented deviation.

## Phase 3 - Build plan (scope the work)

**Gravitas invariants 1-2.** Declare what will be written: pages, components
from `components/`, new code. Read every file you will touch first. Planning
effort follows risk: a one-section page is `direct`, a multi-page premium
site is `deep`. Writes stay inside the declared scope; if the scope is wrong,
amend it openly, don't route around it.

## Phase 4 - Build, guidance-checked

**Skills:** `motion-and-scroll-storytelling`, `threejs-3d-premium`,
`micro-interactions-and-cursor`, `liquid-glass-ui`, `scroll-video-hero`,
`interactive-product-configurator` - whichever the design needs.
**Components:** start from `components/` where one fits instead of writing
from scratch; each has keyboard/touch/reduced-motion handling built in.

**Guidance check at every UI primitive.** Before writing a dialog, popover,
form, menu, carousel, animation or view transition, search and retrieve the
guide and follow its pattern and fallbacks:

```bash
npm run guidance -- search "light dismiss dialog"        # 2-5 word, single-pattern queries
npm run guidance -- retrieve "dialog,animate-to-from-top-layer"
npm run guidance -- search "scroll driven animation"
npm run guidance -- search "form validation styling"
```

Topic map for which guides exist: [docs/INTEGRATION.md](docs/INTEGRATION.md).
Queries describe the platform feature, never your app or framework names.

**Copy:** write real copy, then lint it:

```bash
node skills/copywriting-for-premium-sites/scripts/copy-lint.mjs <page.html>
```

**Gravitas invariant 4.** When a build step fails, change the diagnosis,
context or strategy before retrying - never re-run the identical failing
approach.

## Phase 5 - Assets and credits

**Skills:** `imagery-assets-licensing`, `asset-sources-and-licence-check`,
`model-optimisation-phone`.
**Do:** real assets only, free sources, a `<file>.credit.json` next to every
asset, unclear licence means skip. Optimise 3D for phones.

```bash
node skills/asset-sources-and-licence-check/scripts/licence-probe.mjs <url>
```

**Gate:** every asset has a credit file with a licence that permits the use.

## Phase 6 - QA gates (measured, not vibes)

Run the whole battery; each script prints pass/fail:

```bash
node skills/responsive-phone-pc-parity/scripts/parity-check.mjs <url>   # 10 sizes
node skills/performance-desktop-max-and-mobile/scripts/budget-check.mjs <url>  # tier budgets
node skills/accessibility-and-reduced-motion/scripts/a11y-check.mjs <url>
node skills/seo-and-meta/scripts/seo-check.mjs <url>
node skills/premium-tiers-normal-advanced-premium/scripts/tier-check.mjs <url>
npm run guidance -- legacy-scan <site-dir>                              # legacy patterns
```

Plus the QA harness for rendered evidence at 1440 / 390 / 360 with zero
console errors: `skills/qa-harness/`. Visual check at exact widths with the
entrance animations settled; screenshot artifacts are not bugs - re-measure
after settling before reporting overflow.

**Gate:** every applicable check passes *after the last edit*. A green run
from before the final change does not count (invariant 3).

## Phase 7 - Ship

**Skill:** `client-site-delivery-workflow` (staging, evidence, handover).
Deploy static (Vercel or equivalent), verify the live URL serves the commit
you built, run the Phase 6 battery against the live URL, record what was not
tested (real devices, screen readers, Lighthouse) and say so in the handover
(invariant 6).

---

## The contract for "done"

A build is done when: the spec's scope is what got built; every QA gate ran
after the final edit and passed; every asset has a passing credit file; the
legacy-scan findings are triaged (fixed, or kept with the guide's `keepWhen`
reason); and the report states plainly what was not verified. Anything less is
"in progress", whatever the page looks like.
