// Regression tests for the 2026-11-19 fixes: the qa-harness text-collision
// check (overlapProbe) and the playbook router's --steps / --step modes.
// Run: npm test  (router tests are dependency-free; the collision tests need
// the qa-harness browser: `npm install` in skills/qa-harness, then
// `npx playwright install chromium`. Without it they skip with a message, and
// CI installs the browser so they always run there.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE = join(ROOT, 'skills', 'premium-website-playbook', 'scripts', 'route.mjs');
const QA = join(ROOT, 'skills', 'qa-harness', 'qa.mjs');

// ---------- router --steps / --step ----------

test('route --steps lists every step of the tier in order', () => {
  const out = execFileSync(process.execPath, [ROUTE, '--steps', '--tier', 'premium'], { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  assert.equal(lines.length, 19, 'premium tier without feature flags routes 19 steps');
  assert.match(lines[0], /^1\. brief /);
  assert.match(lines.at(-1), /^19\. deliver /);
  assert.ok(lines.some(l => l.startsWith('8. copy ')), 'copy step present');
});

test('route --step prints one step with its gate and the next step', () => {
  const out = execFileSync(process.execPath, [ROUTE, '--step', 'copy', '--tier', 'premium'], { encoding: 'utf8' });
  assert.match(out, /Step 8\/19: Copy \(copy\)/);
  assert.match(out, /skill: copywriting-for-premium-sites/);
  assert.match(out, /gate:/);
  assert.match(out, /Next when the gate passes: assets/);
  assert.ok(!out.includes('Step 9/19'), 'only the requested step is printed');
});

test('route --step accepts a step number', () => {
  const out = execFileSync(process.execPath, [ROUTE, '--step', '1', '--tier', 'normal'], { encoding: 'utf8' });
  assert.match(out, /Step 1\/18: Intake and brief \(brief\)/);
});

test('route --step with an unknown step exits 2 and names the valid steps', () => {
  const r = spawnSync(process.execPath, [ROUTE, '--step', 'bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /No step "bogus"/);
  assert.match(r.stderr, /brief, research, idea/);
});

// ---------- qa-harness overlap probe ----------

function browserReady() {
  if (!existsSync(join(ROOT, 'skills', 'qa-harness', 'node_modules', 'playwright'))) return false;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  try { return readdirSync(cache).some(d => d.startsWith('chromium')); } catch { return false; }
}

function runHarness(site) {
  const out = mkdtempSync(join(tmpdir(), 'qa-overlap-'));
  const r = spawnSync(process.execPath, [QA, site, '--profiles', 'desktop', '--throttle', 'off', '--out', out, '--quiet'], { encoding: 'utf8' });
  const results = JSON.parse(readFileSync(join(out, 'results.json'), 'utf8'));
  const run = results.pages[0].runs.desktop;
  return { code: r.status, run, cleanup: () => rmSync(out, { recursive: true, force: true }) };
}

test('overlap probe flags a known text collision as a warning, not a failure', { skip: !browserReady() && 'qa-harness browser not installed (npm install + npx playwright install chromium in skills/qa-harness)' }, () => {
  const { code, run, cleanup } = runHarness(join(ROOT, 'tests', 'fixtures', 'overlap', 'collision'));
  try {
    assert.equal(code, 0, 'a collision warns; it does not fail the run');
    assert.equal(run.verdict, 'PASS');
    const w = run.warn.find(w => w.includes('collide'));
    assert.ok(w, 'expected a collision warning, got: ' + JSON.stringify(run.warn));
    assert.match(w, /h1 over p/);
  } finally { cleanup(); }
});

test('overlap probe stays silent on a clean layout with a sticky nav (regression: chrome-layer false positives)', { skip: !browserReady() && 'qa-harness browser not installed' }, () => {
  const { code, run, cleanup } = runHarness(join(ROOT, 'tests', 'fixtures', 'overlap', 'clean'));
  try {
    assert.equal(code, 0);
    assert.equal(run.verdict, 'PASS');
    const hits = run.warn.filter(w => w.includes('collide'));
    assert.deepEqual(hits, [], 'no collision warnings expected, got: ' + JSON.stringify(hits));
  } finally { cleanup(); }
});
