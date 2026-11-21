// Integration tests for award-refs.mjs: the real CLI argument parsing, guarded
// network dispatch, written JSON/Markdown output and process exit codes, with a
// mocked fetch. Two layers:
//   1. in-process: runCli with an injected recording fetch;
//   2. child-process: the real `node award-refs.mjs` command using the
//      AWARD_REFS_TEST_FETCH_MODULE test hook, asserting real exit codes and
//      exactly which URLs were dispatched (via the mock's call log).
// No test here touches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'skills/award-winning-reference-research/scripts/award-refs.mjs');
const MOCK_MODULE = join(ROOT, 'tests/fixtures/award-refs-test-fetch.mjs');
const { runCli } = await import(SCRIPT);
const { AWW_LISTING, AWW_SITE, AWW_PAGE_MARK_NO_JURY, FWA_FEED, CSSDA_LISTING } = await import(join(ROOT, 'tests/fixtures/award-refs-pages.mjs'));

const AWW_SOTD = 'https://www.awwwards.com/websites/sites_of_the_day/';
const FWA_WINNERS = 'https://thefwa.com/feed/winners.xml';
const CSSDA_WOTD = 'https://www.cssdesignawards.com/website-of-the-day/';
const WINNER = 'https://www.awwwards.com/sites/197-historias-ilustradas';

function recordingFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const r = routes[url];
    if (!r) throw new Error(`no route for ${url}`);
    if (r.networkError) throw new Error(r.networkError);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (n) => (String(n).toLowerCase() === 'location' ? r.location ?? null : null) },
      text: async () => r.body ?? '',
    };
  };
  return { fetchImpl, calls };
}

async function run(argv, fetchImpl) {
  const out = []; const err = [];
  const code = await runCli(argv, { fetchImpl, stdout: (s) => out.push(String(s)), stderr: (s) => err.push(String(s)) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function tmpOut() {
  return mkdtempSync(join(tmpdir(), 'award-refs-test-'));
}

// --- verify: dispatch guards and exit codes ---

test('CLI verify rejects an invalid URL before any network dispatch (exit 2)', async () => {
  for (const bad of ['https://example.com/sites/x', 'http://www.awwwards.com/sites/x', 'https://www.awwwards.com/', 'not-a-url']) {
    const { fetchImpl, calls } = recordingFetch({});
    const { code } = await run(['verify', bad], fetchImpl);
    assert.equal(code, 2, `expected exit 2 for ${bad}`);
    assert.equal(calls.length, 0, `no request may be dispatched for ${bad}`);
  }
});

test('CLI verify never dispatches a rejected off-domain redirect target (exit 1)', async () => {
  const { fetchImpl, calls } = recordingFetch({
    [WINNER]: { status: 302, location: 'https://evil.example/collect-credentials' },
  });
  const { code, out } = await run(['verify', WINNER, '--json'], fetchImpl);
  assert.equal(code, 1);
  assert.deepEqual(calls, [WINNER]); // the redirect target was never fetched
  const v = JSON.parse(out);
  assert.equal(v.status, 'redirect-rejected');
  assert.equal(v.verified, false);
  assert.equal(v.blockedTarget, 'https://evil.example/collect-credentials');
});

test('CLI verify passes a real winner page end to end (exit 0)', async () => {
  const { fetchImpl, calls } = recordingFetch({ [WINNER]: { status: 200, body: AWW_SITE } });
  const { code, out } = await run(['verify', WINNER, '--json'], fetchImpl);
  assert.equal(code, 0);
  assert.deepEqual(calls, [WINNER]);
  const v = JSON.parse(out);
  assert.equal(v.status, 'verified');
  assert.equal(v.verified, true);
  assert.equal(v.juryScore, 7.3);
});

test('CLI verify: title mark without jury evidence is inconclusive (exit 1)', async () => {
  const { fetchImpl } = recordingFetch({ [WINNER]: { status: 200, body: AWW_PAGE_MARK_NO_JURY } });
  const { code, out } = await run(['verify', WINNER, '--json'], fetchImpl);
  assert.equal(code, 1);
  assert.equal(JSON.parse(out).status, 'inconclusive');
});

test('CLI verify: HTTP and network failures are structured (exit 1)', async () => {
  let { fetchImpl } = recordingFetch({ [WINNER]: { status: 503 } });
  let r = await run(['verify', WINNER, '--json'], fetchImpl);
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.out).status, 'fetch-failed');
  ({ fetchImpl } = recordingFetch({ [WINNER]: { networkError: 'socket hang up' } }));
  r = await run(['verify', WINNER, '--json'], fetchImpl);
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.out).status, 'fetch-failed');
});

// --- collect: option validation before any network work ---

test('CLI collect validates --pages and --source before any network dispatch (exit 2)', async () => {
  for (const argv of [
    ['collect', '--pages', '0'],
    ['collect', '--pages', '-2'],
    ['collect', '--pages', '1.5'],
    ['collect', '--pages', 'abc'],
    ['collect', '--source', 'bogus'],
  ]) {
    const { fetchImpl, calls } = recordingFetch({});
    const { code } = await run(argv, fetchImpl);
    assert.equal(code, 2, `expected exit 2 for ${argv.join(' ')}`);
    assert.equal(calls.length, 0, `no request may be dispatched for ${argv.join(' ')}`);
  }
});

// --- collect: written output, counts, aggregate exit codes ---

test('CLI collect writes JSON + Markdown with listing-candidate labels (exit 0)', async () => {
  const out = tmpOut();
  try {
    const { fetchImpl } = recordingFetch({ [AWW_SOTD]: { status: 200, body: AWW_LISTING } });
    const { code } = await run(['collect', '--source', 'awwwards', '--out', out], fetchImpl);
    assert.equal(code, 0);
    const data = JSON.parse(readFileSync(join(out, 'award-refs.json'), 'utf8'));
    assert.equal(data.sources.length, 1);
    assert.equal(data.sources[0].status, 'ok');
    assert.equal(data.sources[0].count, 2);
    assert.match(data.sources[0].entries[0].verification, /not individually verified/);
    const md = readFileSync(join(out, 'REFERENCES.md'), 'utf8');
    assert.match(md, /listing candidate/i);
    assert.match(md, /awwwards - ok \(2 listing candidates\)/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CLI collect: --source all with one source ok and the others failed is a defined partial success (exit 0)', async () => {
  const out = tmpOut();
  try {
    const { fetchImpl } = recordingFetch({
      [AWW_SOTD]: { status: 200, body: AWW_LISTING },
      [FWA_WINNERS]: { networkError: 'ECONNRESET' },
      [CSSDA_WOTD]: { status: 502 },
    });
    const { code } = await run(['collect', '--source', 'all', '--out', out, '--delay', '0'], fetchImpl);
    assert.equal(code, 0); // partial success: at least one source collected
    const data = JSON.parse(readFileSync(join(out, 'award-refs.json'), 'utf8'));
    const by = Object.fromEntries(data.sources.map((s) => [s.source, s]));
    assert.equal(by.awwwards.status, 'ok');
    assert.equal(by.awwwards.count, 2);
    assert.equal(by.fwa.status, 'unavailable');
    assert.match(by.fwa.error, /ECONNRESET/);
    assert.equal(by.cssda.status, 'unavailable');
    assert.match(by.cssda.error, /HTTP 502/);
    assert.equal(by.fwa.count, 0);
    assert.equal(by.cssda.count, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CLI collect: every requested source failed is exit 1', async () => {
  const out = tmpOut();
  try {
    const { fetchImpl } = recordingFetch({
      [AWW_SOTD]: { status: 503 },
      [FWA_WINNERS]: { networkError: 'DNS lookup failed' },
      [CSSDA_WOTD]: { status: 502 },
    });
    const { code } = await run(['collect', '--source', 'all', '--out', out, '--delay', '0'], fetchImpl);
    assert.equal(code, 1);
    const data = JSON.parse(readFileSync(join(out, 'award-refs.json'), 'utf8'));
    assert.ok(data.sources.every((s) => s.status !== 'ok'));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CLI collect: a source redirect away from its host/path is a structured failure, never parsed (exit 1)', async () => {
  const out = tmpOut();
  try {
    const { fetchImpl, calls } = recordingFetch({
      [AWW_SOTD]: { status: 302, location: 'https://evil.example/fake-awwwards' },
    });
    const { code } = await run(['collect', '--source', 'awwwards', '--out', out], fetchImpl);
    assert.equal(code, 1);
    assert.deepEqual(calls, [AWW_SOTD]); // the redirect target was never fetched
    const data = JSON.parse(readFileSync(join(out, 'award-refs.json'), 'utf8'));
    assert.equal(data.sources[0].status, 'redirect-rejected');
    assert.match(data.sources[0].error, /evil\.example/);
    assert.equal(data.sources[0].count, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CLI collect: HTTP 200 with nothing parseable is parse-empty (exit 1)', async () => {
  const out = tmpOut();
  try {
    const { fetchImpl } = recordingFetch({ [AWW_SOTD]: { status: 200, body: '<html><body>redesign, no cards</body></html>' } });
    const { code } = await run(['collect', '--source', 'awwwards', '--out', out], fetchImpl);
    assert.equal(code, 1);
    const data = JSON.parse(readFileSync(join(out, 'award-refs.json'), 'utf8'));
    assert.equal(data.sources[0].status, 'parse-empty');
    assert.equal(data.sources[0].count, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// --- child-process tests against the real CLI via the test-fetch hook ---

function runProcess(argv, routes, logFile) {
  const env = {
    ...process.env,
    AWARD_REFS_TEST_FETCH_MODULE: MOCK_MODULE,
    AWARD_REFS_TEST_FETCH_ROUTES: JSON.stringify(routes),
  };
  if (logFile) env.AWARD_REFS_TEST_FETCH_LOG = logFile;
  return spawnSync(process.execPath, [SCRIPT, ...argv], { env, encoding: 'utf8' });
}

test('real CLI process: invalid verify input exits 2 and dispatches nothing', () => {
  const dir = tmpOut();
  try {
    const log = join(dir, 'calls.log');
    const p = runProcess(['verify', 'https://evil.example/sites/x'], {}, log);
    assert.equal(p.status, 2);
    assert.equal(existsSync(log), false, 'mockFetch must never be called for an invalid URL');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real CLI process: an off-domain redirect target is never dispatched', () => {
  const dir = tmpOut();
  try {
    const log = join(dir, 'calls.log');
    const p = runProcess(['verify', WINNER], { [WINNER]: { status: 302, location: 'https://evil.example/phish' } }, log);
    assert.equal(p.status, 1);
    assert.match(p.stdout, /redirect-rejected/);
    const dispatched = readFileSync(log, 'utf8').trim().split('\n');
    assert.deepEqual(dispatched, [WINNER]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real CLI process: collect writes JSON/Markdown and exits 0 on success', () => {
  const dir = tmpOut();
  try {
    const log = join(dir, 'calls.log');
    const p = runProcess(['collect', '--source', 'awwwards', '--out', dir], { [AWW_SOTD]: { status: 200, body: AWW_LISTING } }, log);
    assert.equal(p.status, 0);
    const data = JSON.parse(readFileSync(join(dir, 'award-refs.json'), 'utf8'));
    assert.equal(data.sources[0].count, 2);
    assert.equal(data.sources[0].status, 'ok');
    assert.ok(existsSync(join(dir, 'REFERENCES.md')));
    assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n'), [AWW_SOTD]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real CLI process: collect --pages 0 exits 2 and dispatches nothing', () => {
  const dir = tmpOut();
  try {
    const log = join(dir, 'calls.log');
    const p = runProcess(['collect', '--pages', '0', '--out', dir], {}, log);
    assert.equal(p.status, 2);
    assert.match(p.stderr, /--pages/);
    assert.equal(existsSync(log), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real CLI process: partial-source failure keeps exit 0 with honest per-source statuses', () => {
  const dir = tmpOut();
  try {
    const p = runProcess(['collect', '--source', 'all', '--out', dir, '--delay', '0'], {
      [AWW_SOTD]: { status: 200, body: AWW_LISTING },
      [FWA_WINNERS]: { networkError: 'ECONNRESET' },
      [CSSDA_WOTD]: { status: 502 },
    });
    assert.equal(p.status, 0);
    assert.match(p.stdout, /awwwards: ok/);
    assert.match(p.stdout, /fwa: unavailable/);
    assert.match(p.stdout, /cssda: unavailable/);
    const data = JSON.parse(readFileSync(join(dir, 'award-refs.json'), 'utf8'));
    const by = Object.fromEntries(data.sources.map((s) => [s.source, s.status]));
    assert.deepEqual(by, { awwwards: 'ok', fwa: 'unavailable', cssda: 'unavailable' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('real CLI process: verify on a real winner page shape exits 0', () => {
  const dir = tmpOut();
  try {
    const p = runProcess(['verify', WINNER], { [WINNER]: { status: 200, body: AWW_SITE } }, join(dir, 'calls.log'));
    assert.equal(p.status, 0);
    assert.match(p.stdout, /verified:\s+YES/);
    assert.match(p.stdout, /jury score: 7.3 \/ 10/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
