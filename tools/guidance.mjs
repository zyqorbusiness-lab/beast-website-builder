#!/usr/bin/env node
// Wrapper around the vendored Modern Web Guidance CLI.
// Telemetry: the upstream CLI collects anonymous usage data unless
// DISABLE_TELEMETRY=1 is set (see isTelemetryEnabled in
// guidance/skills/modern-web-guidance/modern-web.mjs). This wrapper opts out
// by default. To allow telemetry, run the CLI directly:
//   node guidance/skills/modern-web-guidance/modern-web.mjs <args>
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'guidance', 'skills', 'modern-web-guidance', 'modern-web.mjs');
const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DISABLE_TELEMETRY: process.env.DISABLE_TELEMETRY ?? '1' },
});
process.exit(r.status ?? 1);
