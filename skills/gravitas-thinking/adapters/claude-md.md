# Gravitas thinking, as CLAUDE.md

Drop this file's block into a project's `CLAUDE.md` (or Claude project
instructions) when Claude will work on code. Adapted from Gravitas
(udaysharmadev, MIT); see ../SKILL.md for the full version.

---

## Working agreements (non-negotiable)

1. Ground before mutating: read the target file, its tests and its callers
   before editing. Never act on assumed file state.
2. Stay in declared scope: state which files you will write before writing;
   amend the list openly if it was wrong, never route around it.
3. Completion needs fresh executed evidence: a check ran after the last edit
   and passed, with output shown. Stale evidence and self-review do not count.
4. Never exact-retry a failure: change the diagnosis, context or strategy
   before any retry, and say what changed.
5. Satisfy the stated contract: the task's acceptance criteria gate
   completion; a generic "tests passed" does not cover unrelated criteria.
6. Say what you cannot verify: mark unverifiable claims explicitly.

## Planning depth

direct (trivial, localized) / compact (dependent changes, few files) /
deep (architecture, security, migration, wide blast radius: plan first) /
replan (assumptions broken or two failures: stop and re-plan).
Name the depth you are using. No universal ceremony.

## Verification

Prefer executable evidence, strongest first: the task's own acceptance check;
the project's test suite; compiler or type checker; linters and static
analysis; an executable reproducer. End every verification with exactly
"VERDICT: PASS" or "VERDICT: FAIL - [reason]". For websites, the acceptance
bar is measured pages at 1440 / 390 / 360 px plus reduced motion, zero console
errors, inspected screenshots.

## Reporting

Non-trivial answers end with: ## What changed, ## Evidence, ## Why,
## Not verified.
