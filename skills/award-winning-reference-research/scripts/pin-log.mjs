#!/usr/bin/env node
// pin-log.mjs: log Pinterest website-design references with an honest record of what
// was actually seen. A pin is never an award claim; it is a look to learn from.
// Node >= 22, no dependencies.
//   node pin-log.mjs add <pin-url> [--title "..."] [--note "..."] [--out work/references]
//   node pin-log.mjs list [--out work/references]
// reviewed levels: "none" (only the URL known), "cover-only" (cover thumbnail seen,
// pin page NOT opened), "pin-page" (pin page opened and read).
// MIT, Zyqor Studio (Sujon Hoque) 2026.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 (compatible; pin-log/1.0)';
const REVIEWED = ['none', 'cover-only', 'pin-page'];

export function pinIdFromUrl(url) {
  const m = String(url).match(/pinterest\.[a-z.]+\/pin\/(\d+)/i);
  return m ? m[1] : null;
}

export function loadLog(dir) {
  const p = join(dir, 'pinterest-refs.json');
  if (!existsSync(p)) return { policy: 'A pin is never award evidence. reviewed says what was actually seen: none / cover-only / pin-page.', entries: [] };
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function renderMarkdown(log) {
  const L = ['# Pinterest website-design references', '', log.policy, ''];
  for (const e of log.entries) {
    L.push(`- **${e.title || '(untitled pin)'}** - ${e.url}`);
    L.push(`  reviewed: ${e.reviewed}${e.fetched ? ' (pin page fetched by script)' : ''}${e.note ? ` - ${e.note}` : ''} - added ${e.addedAt}`);
  }
  if (!log.entries.length) L.push('(no pins logged yet)');
  L.push('', 'Learn layout, type, spacing and composition. Never reuse the pin\'s images, logos, fonts or illustrations.');
  return L.join('\n');
}

const isCli = typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const a = process.argv.slice(2);
  const cmd = a[0];
  const val = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const out = val('--out', 'work/references');

  if (cmd === 'add') {
    const url = a[1];
    if (!url || !pinIdFromUrl(url)) { console.error('usage: pin-log.mjs add <pinterest pin URL> [--title ".."] [--note ".."] [--reviewed none|cover-only|pin-page] [--out DIR]'); process.exit(2); }
    const reviewed = val('--reviewed', 'cover-only');
    if (!REVIEWED.includes(reviewed)) { console.error(`--reviewed must be one of ${REVIEWED.join(', ')}`); process.exit(2); }
    let fetchedTitle = null; let fetched = false;
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const html = await res.text();
        const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
        if (og) { fetchedTitle = og[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim(); fetched = true; }
      }
    } catch { /* pinterest often blocks scripts; the log records fetched:false */ }
    const log = loadLog(out);
    const entry = { url, pinId: pinIdFromUrl(url), title: val('--title', null) || fetchedTitle, note: val('--note', null), reviewed, fetched, addedAt: new Date().toISOString() };
    log.entries = log.entries.filter((e) => e.pinId !== entry.pinId);
    log.entries.push(entry);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'pinterest-refs.json'), JSON.stringify(log, null, 2));
    writeFileSync(join(out, 'PINTEREST-REFS.md'), renderMarkdown(log));
    console.log(`logged pin ${entry.pinId} - reviewed: ${entry.reviewed}, fetched: ${entry.fetched}${entry.title ? `, title: ${entry.title}` : ', no title (pass --title if you saw one)'}`);
  } else if (cmd === 'list') {
    const log = loadLog(out);
    console.log(renderMarkdown(log));
  } else {
    console.log('usage:\n  pin-log.mjs add <pin-url> [--title ".."] [--note ".."] [--reviewed none|cover-only|pin-page] [--out DIR]\n  pin-log.mjs list [--out DIR]');
    process.exit(2);
  }
}
