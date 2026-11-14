// Smoke tests: repo structure, vendored guidance CLI, component integrity.
// Run: npm test   (Node >= 22, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'guidance', 'skills', 'modern-web-guidance', 'modern-web.mjs');
const ENV = { ...process.env, DISABLE_TELEMETRY: '1' };

test('tools/validate.mjs passes', () => {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'validate.mjs')], { stdio: 'pipe' });
});

test('all 14 components have index.html, README.md and parseable JS', () => {
  const comps = readdirSync(join(ROOT, 'components'), { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_shared').map(d => d.name);
  assert.equal(comps.length, 14);
  for (const c of comps) {
    assert.ok(existsSync(join(ROOT, 'components', c, 'index.html')), `${c}/index.html`);
    assert.ok(existsSync(join(ROOT, 'components', c, 'README.md')), `${c}/README.md`);
    for (const f of readdirSync(join(ROOT, 'components', c))) {
      if (f.endsWith('.js')) {
        execFileSync(process.execPath, ['--check', join(ROOT, 'components', c, f)]); // syntax
      }
    }
  }
});

test('guidance search returns relevant results (telemetry opted out)', () => {
  const out = execFileSync(process.execPath, [CLI, 'search', 'modal dialog', '--skill-version', '2026_11_09-5bcc021b'], { encoding: 'utf8', env: ENV });
  const results = JSON.parse(out);
  assert.ok(Array.isArray(results) && results.length > 0, 'search returned results');
  assert.ok(results.some(r => r.id === 'dialog'), 'dialog guide found');
});

test('guidance retrieve returns the dialog guide', () => {
  let out = execFileSync(process.execPath, [CLI, 'retrieve', 'dialog', '--skill-version', '2026_11_09-5bcc021b'], { encoding: 'utf8', env: ENV });
  // large guides are saved to a temp file to prevent stdout truncation
  const saved = out.match(/saved to (\/tmp\/\S+\.md)/);
  if (saved) out = readFileSync(saved[1], 'utf8');
  assert.match(out, /dialog/i);
  assert.ok(out.length > 500, 'guide has substance');
});

test('guidance legacy-scan runs on the component library', () => {
  const out = execFileSync(process.execPath, [CLI, 'legacy-scan', join(ROOT, 'components')], { encoding: 'utf8', env: ENV });
  assert.match(out, /findings from \d+ qualified guides/);
});

test('vendored guidance provenance is intact', () => {
  const v = JSON.parse(readFileSync(join(ROOT, 'guidance', 'VENDORED.json'), 'utf8'));
  assert.equal(v.npm_version, '1.0.0');
  assert.equal(v.licence, 'Apache-2.0');
  assert.ok(existsSync(join(ROOT, 'guidance', 'LICENSE')), 'Apache-2.0 licence file vendored');
  assert.ok(existsSync(join(ROOT, 'guidance', 'THIRD_PARTY_NOTICES')), 'upstream third-party notices vendored');
});
