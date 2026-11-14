# Integration map: design skill ↔ modern-web guide

Which vendored Modern Web Guidance guides to consult while working through
each design skill. The corpus is organised into these categories under
`guidance/skills/modern-web-guidance/guides/`. Counting precisely (reconciled
against upstream's index and release notes): 209 raw guide files, 208 unique
guides (built-in-ai/language-model.md is a byte-identical alias of
prompt-api.md), of which 203 are use-case guides - the other 5 are category
overview entries (accessibility, forms, html, performance, security). The
guides index 250 web platform features. Per-category file counts:

| Category | Guides | Use it when the build touches |
|---|---|---|
| css | 18 | layout, colour, typography primitives |
| ui-behaviors | 40 | scroll, animation, transitions, interaction states |
| performance | 26 | Core Web Vitals, loading, rendering cost |
| ui-components | 22 | dialogs, menus, carousels, drawers, tables |
| forms | 19 | inputs, validation, autofill |
| visual-design | 22 | theming, dark mode, media, motion design |
| ui-atoms | 13 | buttons, links, images, icons |
| security | 17 | sanitisation, iframes, credentials |
| html | 8 | document structure, meta, semantics |
| js | 5 | client-side platform APIs |
| accessibility | 4 | screen readers, keyboard, discoverability |
| built-in-ai | 5 | native translation / summarisation APIs |
| user-experience | 3 | content-first patterns |
| pwa | 2 | installability, offline |
| webmcp | 3 | agent-facing pages |
| privacy, wasm | 1 + 1 | privacy APIs, WebAssembly |

Query style: 2-5 words, one platform capability per search, no framework or
app names. `npm run guidance -- search "<query>"` then `retrieve "<id>"`.

## Per-skill checkpoints

### premium-website-playbook (the route)
Run a `legacy-scan` on the starting codebase before planning edits:
`npm run guidance -- legacy-scan .`

### colour-systems, typography-premium, layout-grid-spacing
- `search "oklch color palette"` → css / visual-design guides on modern colour
- `search "fluid typography clamp"` → type scale primitives
- `search "container queries layout"` → component-level responsiveness
- `search "subgrid nested layout"` → card/list alignment

### motion-and-scroll-storytelling, scroll-video-hero
- `search "scroll driven animation"` → CSS scroll-driven animations + fallback
- `search "view transition between pages"` → cross-document view transitions
- `search "animate dialog popover entry exit"` → top-layer animation
- `search "parallax scroll effect"` → performance-safe patterns
- Check `performance` category before pinning long scroll scenes.

### threejs-3d-premium, model-optimisation-phone
- `search "lazy load below fold"` → loading strategy for heavy media
- `search "image format avif webp"` → poster/fallback formats
- `search "content visibility rendering"` → skipping off-screen work

### micro-interactions-and-cursor, liquid-glass-ui, interactive-product-configurator
- `search "button press feedback"` → ui-atoms states
- `search "drag floating element"` → the `drag` guide
- `search "backdrop blur filter"` → glass effects and fallbacks
- `search "popover tooltip anchor"` → anchor positioning

### Components that match guides one-to-one
| Component | Retrieve before modifying |
|---|---|
| mega-menu | `navigation-drawer`, `menu` patterns |
| page-transition | `cross-document view transitions` guides |
| quote-carousel | carousel / scroll-snap guides |
| pricing-table | tab/accordion guides |
| preloader | `performance` loading guides |
| sticky-story | scroll-driven animation guides |

### copywriting-for-premium-sites, seo-and-meta
- `search "open graph social preview"` → html meta guides
- Guidance covers platform mechanics; voice and honesty rules stay with the
  skill and `copy-lint.mjs`.

### accessibility-and-reduced-motion
- `search "keyboard navigation menu"` → accessibility + ui-behaviors
- `search "prefers reduced motion"` → motion fallbacks
- The skill's `a11y-check.mjs` is the gate; guides are the reference.

### performance-desktop-max-and-mobile
- `search "largest contentful paint"` / `"interaction to next paint"` → CWV guides
- `search "preload critical resources"` → fetch priority
- The skill's `budget-check.mjs` is the gate.

### client-site-delivery-workflow, qa-harness
- Final pass: `legacy-scan <site-dir>`, triage each finding by its `keepWhen` /
  `dropWhen` rubric; a scan hit is not automatically a bug (fallbacks and
  vendor code are legitimate).

## When guidance and a skill disagree

The skills are opinionated about *taste*; the guides are authoritative about
*platform behaviour*. If a platform fact conflicts, the guide wins (and file
an issue on the skill). If a taste rule conflicts (colour, spacing, drama),
the skill wins - the guides deliberately don't prescribe visual style.
