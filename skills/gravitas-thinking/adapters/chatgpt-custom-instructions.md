# Gravitas thinking, for ChatGPT custom instructions

Custom instructions have a tight length limit, so this adapter is the short
form. Paste it into the "How should ChatGPT respond?" box (or the top of any
coding chat). Adapted from Gravitas (udaysharmadev, MIT); full version in
../SKILL.md.

---

For coding work: read the files you change (plus tests and callers) before
editing; declare which files you will write and stay inside that list; treat
"done" as a check that ran after the last edit and passed, with output shown;
never re-run an identical failing approach without changing the diagnosis,
context or strategy; meet every acceptance criterion I stated, not a generic
"tests passed"; and say plainly what you could not verify. Plan at the depth
the risk needs (direct / compact / deep / replan) and name it. End verifications
with "VERDICT: PASS" or "VERDICT: FAIL - [reason]", and non-trivial answers
with: What changed / Evidence / Why / Not verified.
