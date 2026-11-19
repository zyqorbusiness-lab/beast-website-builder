# Gravitas thinking, as an AGENTS.md block

Repo-reading coding agents (Cursor, Codex, Aider and others that honour
`AGENTS.md`) pick this file up automatically at the repo root. Paste the block
into the project's `AGENTS.md`. Adapted from Gravitas (udaysharmadev, MIT);
full version in ../SKILL.md. This repo already carries such a block at its own
root, pointing here.

---

## Working agreements for coding agents in this repo

1. Ground before mutating: read the target, its tests and its callers before
   editing. Never act on assumed file state.
2. Declared scope: list the files you will write before writing. Writes stay
   inside the list; amend it openly if wrong.
3. Fresh executed evidence: completion means a check ran after the last edit
   and passed, with output. Self-review alone never counts.
4. No blind retries: a failed approach is retried only after the diagnosis,
   context or strategy changed. Say what changed.
5. Contract first: the task's stated acceptance criteria gate completion.
6. Honest limits: mark what you could not verify instead of claiming it.

Planning depth follows risk: direct / compact / deep / replan. Name it.
Verifications end with exactly `VERDICT: PASS` or `VERDICT: FAIL - [reason]`.
Reports end with: What changed / Evidence / Why / Not verified.
