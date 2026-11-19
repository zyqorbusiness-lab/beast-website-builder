---
name: gravitas-thinking
description: A model-neutral working discipline for AI coding agents on website builds, adapted from the Gravitas project (udaysharmadev, MIT). Six working agreements (ground before mutating, declared scope, fresh executed evidence, no blind retries, satisfy the stated contract, say what you cannot verify), planning depth by risk, a verification hierarchy using this repo's own commands, and paste-ready adapters for Gemini, Claude, ChatGPT, repo-reading coding agents, and any chat model.
when_to_use: give it to any AI model before it writes or changes code; read it before any build, fix or review in this repo; pick the adapter in adapters/ that matches the model you are briefing
license: MIT (adapted from Gravitas, github.com/udaysharmadev/Gravitas; see LICENSE and CREDITS.md)
version: 1.0.0
---

# Gravitas thinking, for every model

The original [Gravitas](https://github.com/udaysharmadev/Gravitas) is a reliability
runtime for coding agents: hooks, validators and a CLI that *enforce* good habits.
Most models you will brief (Gemini on the web, ChatGPT, Claude, a repo-reading
agent) cannot run that runtime. This skill carries the part that survives without
it: the working agreements, phrased so any model can follow them, and wired to
this repo's own verification commands.

One honest line before the rules: **these agreements make any model's work
verifiable; they do not turn one model into another model.** No prompt can do
that. What the agreements do is remove the failure modes that make AI-built
sites look finished when they are not: ungrounded edits, silent scope creep,
"done" with no evidence, and the same failing command retried forever.

## The six working agreements

1. **Ground before mutating.** Read the file you will change, its tests and its
   callers before editing. Never act on assumed file state; open it.
2. **Stay in declared scope.** Before writing, say which files you will touch.
   Writes stay inside that list. If the list was wrong, say so and amend it
   openly; do not route around it.
3. **Completion needs fresh, executed evidence.** "Done" means a check ran
   *after* your last edit and passed, and you paste the output. A green run
   from before the final change does not count. Neither does self-review.
4. **Never exact-retry a failure.** A failed approach may be retried only after
   something material changed: the diagnosis, the context or the strategy.
5. **Satisfy the stated contract.** The brief's acceptance criteria gate
   completion. "Tests passed" does not cover an unrelated criterion that was
   asked for.
6. **Say what you cannot verify.** Mark unverifiable claims explicitly and
   downgrade confidence instead of inventing certainty. "Not verified" is a
   normal, expected section of a report.

## Planning depth follows risk

No universal ceremony. Pick one and say which:

- **direct**: a trivial, localized change in files you have read.
- **compact**: dependent changes across a few files, moderate uncertainty.
- **deep**: architecture, security, migration, broad blast radius. Plan first,
  get the plan agreed, then build.
- **replan**: evidence invalidated the assumptions, the scope grew, or an
  approach has failed twice. Stop and re-plan instead of pushing on.

## Verification hierarchy (this repo)

Prefer executable evidence over prose, strongest first:

1. The acceptance check named in the brief, run fresh.
2. `node skills/qa-harness/qa.mjs <site>`: rendered pages at 1440 / 390 / 360
   plus reduced motion, 0 console errors, 0 overflow, screenshots looked at.
3. The skill scripts for the layer you touched (`parity-check.mjs`,
   `budget-check.mjs`, `a11y-check.mjs`, `seo-check.mjs`, `copy-lint.mjs`,
   `tier-check.mjs`, `tools/credits-check.mjs`).
4. `npm run guidance -- legacy-scan <site-dir>` for legacy platform patterns.
5. `npm run validate` and `npm test` for repo-level work.
6. Independent review by a second model, then same-model self-review last,
   and self-review alone never counts as completion evidence.

Every verification ends with exactly `VERDICT: PASS` or
`VERDICT: FAIL - [reason] with the failing output`.

## Reporting contract

Every non-trivial answer ends with:

```
## What changed
[files, behaviour]

## Evidence
[actual command output]

## Why
[the key decision's rationale]

## Not verified
[what you did not or could not check]
```

## Per-model adapters

Paste-ready versions of these agreements, shaped for each home:

| File | For |
|---|---|
| [adapters/gemini-saved-instructions.md](adapters/gemini-saved-instructions.md) | Gemini: saved instructions, a Gem, or the top of a Task-mode brief |
| [adapters/claude-md.md](adapters/claude-md.md) | Claude Code / Claude projects: a `CLAUDE.md` or project instruction |
| [adapters/chatgpt-custom-instructions.md](adapters/chatgpt-custom-instructions.md) | ChatGPT custom instructions (fits the length limit) |
| [adapters/agents-snippet.md](adapters/agents-snippet.md) | Repo-reading coding agents (Cursor, Codex, Aider, others): an `AGENTS.md` block |
| [adapters/any-model-prompt.md](adapters/any-model-prompt.md) | Any chat model: one prompt to paste at the start of a coding session |

## Sources

Adapted from Gravitas by udaysharmadev (MIT): the six invariants, the planning
tiers and the verification hierarchy. The runtime-specific machinery (`gravitas`
CLI, hooks, contract.json, validators) is not reproduced here; it needs the
upstream project. See [CREDITS.md](CREDITS.md).
