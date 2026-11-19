# AGENTS.md: how to work in this repo

This repo is a toolkit for designing and building premium websites with an AI
coding agent. If you are that agent, read these first, in this order:

1. [WORKFLOW.md](WORKFLOW.md): the build loop (brief, design, guidance-checked
   build, measured QA, evidence-based ship). Its phase gates are not optional.
2. [skills/gravitas-thinking/SKILL.md](skills/gravitas-thinking/SKILL.md): the
   working discipline for every code change here (ground before mutating,
   declared scope, fresh executed evidence, no blind retries, say what you
   could not verify).
3. The route for the site you are building:
   `node skills/premium-website-playbook/scripts/route.mjs --tier <normal|advanced|premium>`.
   While working, use `--step <id>` so only the current step's 1-2 skills are
   in context; open the next skill only when the current gate has passed.

## Layout

- `skills/`: 37 self-contained design and build skills. Start with
  `skills/premium-website-playbook/`.
- `components/`: 14 reusable UI components (plain HTML/CSS/JS, keyboard,
  touch, reduced motion handled). Start from one before writing from scratch.
- `guidance/`: vendored Modern Web Guidance (Google, Apache-2.0). Query it
  before writing UI code: `npm run guidance -- search "<platform pattern>"`,
  and scan finished code with `npm run guidance -- legacy-scan <dir>`.
- `library/`, `showcase/`: preserved concept library and showcase pages.
- `docs/`: design notes, integration map, QA checklist, case studies.
- `tools/`, `tests/`: repo self-check (`npm run validate`) and smoke tests
  (`npm test`).

## Before you say done

- `npm run validate` and `npm test` pass *after your last edit*.
- Every page you touched passes `node skills/qa-harness/qa.mjs <folder>`
  (1440 / 390 / 360 plus reduced motion, zero console errors; warnings read).
- Every asset you added carries a `<file>.credit.json`
  (see `skills/imagery-assets-licensing/`); unclear licence means skip.
- Your report says what was *not* verified.

## House rules

- No paid dependencies; static files and Node >= 22 scripts only.
- Component demos reference shared assets relatively; do not move files
  without updating references (`npm run validate` checks them).
- Licences: original work is MIT (Zyqor Studio); `guidance/` is Apache-2.0
  (Google LLC and stewards). Keep attribution intact; see `NOTICE` and
  `CREDITS.md`.
