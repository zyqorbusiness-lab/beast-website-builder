#!/usr/bin/env node
// Re-vendor the latest Modern Web Guidance npm release into guidance/.
// Keeps Apache-2.0 LICENSE / THIRD_PARTY_NOTICES, rewrites VENDORED.json.
// Usage: npm run update-guidance            (latest)
//        npm run update-guidance -- 1.0.0   (pinned version)
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2] || 'latest';
const tmp = mkdtempSync(join(tmpdir(), 'mwg-'));
try {
  execSync(`npm pack modern-web-guidance@${version}`, { cwd: tmp, stdio: 'inherit' });
  const { readdirSync } = await import('node:fs');
  const tgz = readdirSync(tmp).find(f => f.endsWith('.tgz'));
  if (!tgz) throw new Error('npm pack produced no tarball');
  execSync(`tar xzf ${tgz}`, { cwd: tmp });
  const pkg = join(tmp, 'package');
  const meta = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  const build = readFileSync(join(pkg, 'skills/modern-web-guidance/skill-version.txt'), 'utf8').trim();
  const dest = join(ROOT, 'guidance');
  rmSync(dest, { recursive: true, force: true });
  cpSync(pkg, dest, { recursive: true });
  const vendored = {
    upstream: 'https://github.com/GoogleChrome/modern-web-guidance',
    upstream_source_repo: 'https://github.com/GoogleChrome/modern-web-guidance-src',
    npm_package: 'modern-web-guidance',
    npm_version: meta.version,
    skill_content_build: build,
    vendored_on: new Date().toISOString().slice(0, 10),
    vendored_from: `npm tarball ${tgz} (unmodified, includes Apache-2.0 LICENSE and THIRD_PARTY_NOTICES)`,
    licence: 'Apache-2.0',
    stewards: 'Google Chrome, Microsoft Edge, Mozilla Firefox and MDN teams (per upstream README)',
    telemetry_note: 'The CLI collects anonymous usage data unless DISABLE_TELEMETRY=1. This repo\'s wrapper (tools/guidance.mjs, `npm run guidance`) sets DISABLE_TELEMETRY=1 by default.',
    update: 'Run `npm run update-guidance` to re-vendor the latest npm release and rewrite this file.'
  };
  writeFileSync(join(dest, 'VENDORED.json'), JSON.stringify(vendored, null, 2) + '\n');
  console.log(`Vendored modern-web-guidance ${meta.version} (content ${build})`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
