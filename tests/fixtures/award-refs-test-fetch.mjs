// Test hook for award-refs.mjs, loaded by the CLI when
// AWARD_REFS_TEST_FETCH_MODULE points at this file. It serves canned responses
// from AWARD_REFS_TEST_FETCH_ROUTES (JSON: url -> { status, body, location } or
// { networkError }) and appends every requested URL, one per line, to
// AWARD_REFS_TEST_FETCH_LOG so tests can prove exactly what was dispatched.
// Used only by tests; never loaded in normal runs.
import { appendFileSync } from 'node:fs';

const routes = JSON.parse(process.env.AWARD_REFS_TEST_FETCH_ROUTES || '{}');
const logPath = process.env.AWARD_REFS_TEST_FETCH_LOG || null;

export async function mockFetch(url) {
  if (logPath) appendFileSync(logPath, `${url}\n`);
  const route = routes[url];
  if (!route) throw new Error(`test fetch: no route configured for ${url}`);
  if (route.networkError) throw new Error(route.networkError);
  return {
    ok: route.status >= 200 && route.status < 300,
    status: route.status,
    headers: { get: (name) => (String(name).toLowerCase() === 'location' ? route.location ?? null : null) },
    text: async () => route.body ?? '',
  };
}
