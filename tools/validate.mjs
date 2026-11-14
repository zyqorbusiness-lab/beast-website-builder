#!/usr/bin/env node
// Structural self-check for this repo. Exit 1 on any failure.
// Checks: root docs present, every skill has SKILL.md, all 14 components have
// index.html + README.md, guidance provenance matches the vendored build,
// every local file reference inside components resolves on disk, and no
// leftover references to the source repo's site/ layout remain.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL ' + msg); };
const ok = (msg) => console.log('ok   ' + msg);

// 1. Root documents
for (const f of ['README.md', 'WORKFLOW.md', 'LICENSE', 'NOTICE', 'CREDITS.md', 'docs/INTEGRATION.md']) {
  existsSync(join(ROOT, f)) ? ok(f) : fail(`missing root doc ${f}`);
}

// 2. Skills
const skills = readdirSync(join(ROOT, 'skills'), { withFileTypes: true }).filter(d => d.isDirectory());
let skillOk = 0;
for (const s of skills) {
  if (existsSync(join(ROOT, 'skills', s.name, 'SKILL.md'))) skillOk++;
  else fail(`skills/${s.name} has no SKILL.md`);
}
ok(`${skillOk}/${skills.length} skills have SKILL.md`);

// 3. Components
const comps = readdirSync(join(ROOT, 'components'), { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== '_shared');
if (comps.length !== 14) fail(`expected 14 components, found ${comps.length}`);
for (const c of comps) {
  for (const f of ['index.html', 'README.md']) {
    if (!existsSync(join(ROOT, 'components', c.name, f))) fail(`components/${c.name}/${f} missing`);
  }
}
ok(`${comps.length} components checked for index.html + README.md`);

// 4. Guidance provenance
const vendored = JSON.parse(readFileSync(join(ROOT, 'guidance', 'VENDORED.json'), 'utf8'));
const build = readFileSync(join(ROOT, 'guidance', 'skills', 'modern-web-guidance', 'skill-version.txt'), 'utf8').trim();
if (!existsSync(join(ROOT, 'guidance', 'LICENSE'))) fail('guidance/LICENSE (Apache-2.0) missing');
if (build !== vendored.skill_content_build) fail(`VENDORED.json build ${vendored.skill_content_build} != vendored ${build}`);
else ok(`guidance v${vendored.npm_version} content ${build} matches VENDORED.json`);
const guideCount = execFileSync('find', [join(ROOT, 'guidance/skills/modern-web-guidance/guides'), '-name', '*.md'], { encoding: 'utf8' }).trim().split('\n').length;
if (guideCount < 200) fail(`expected 200+ guides, found ${guideCount}`);
else ok(`${guideCount} guidance guides present`);

// 5. Component local references resolve
const refRe = [
  /(?:src|href)="([^"#]+)"/g,
  /url\(["']?([^)'"]+)["']?\)/g,
  /from\s+["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']/g,
];
function* walk(dir) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory() && d.name === '.git') continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else yield p;
  }
}
let checked = 0;
for (const p of walk(join(ROOT, 'components'))) {
  if (!/\.(html|css|js)$/.test(p)) continue;
  if (p.includes('_shared/vendor')) continue; // third-party, importmap-resolved
  const t = readFileSync(p, 'utf8');
  const refs = new Set();
  for (const re of refRe) for (const m of t.matchAll(re)) refs.add(m[1]);
  for (const m of t.matchAll(/data-assets='([^']+)'/g)) {
    try { for (const a of JSON.parse(m[1])) refs.add(a); } catch {}
  }
  for (let r of refs) {
    if (!r || r.includes('${')) continue;
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(r)) continue;
    r = decodeURIComponent(r.split('#')[0].split('?')[0]);
    if (!r || !r.startsWith('.')) continue;
    checked++;
    const target = resolve(dirname(p), r);
    if (!target.startsWith(resolve(ROOT, 'components'))) fail(`${relative(ROOT, p)}: escapes components/ -> ${r}`);
    else if (!existsSync(target)) fail(`${relative(ROOT, p)}: missing -> ${r}`);
  }
}
ok(`${checked} component local refs resolve`);

// 6. No stale source-repo layout references
for (const p of [...walk(join(ROOT, 'components')), ...walk(join(ROOT, 'skills'))]) {
  if (!/\.(html|css|js|md)$/.test(p) || p.includes('_shared/vendor')) continue;
  const t = readFileSync(p, 'utf8');
  for (const bad of ['../../site/', 'tree/main/site/components', 'blob/main/site/']) {
    if (t.includes(bad)) fail(`${relative(ROOT, p)}: stale reference ${bad}`);
  }
}
ok('no stale site/ layout references');

// 7. Markdown links resolve on disk
// Every relative link target in every .md file must exist. Exceptions:
// - skills/reference-to-video/kit/examples/ref8_breakdown/breakdown.md links to
//   contact sheets that are intentionally not shipped (130 MB); SKILL.md
//   documents regenerating them with ref_breakdown.py.
let mdChecked = 0;
const MD_ALLOW = [/ref8_breakdown\/breakdown\.md:.*sheets\/sec_\d+\.jpg$/];
for (const p of walk(ROOT)) {
  if (!p.endsWith('.md')) continue;
  const t = readFileSync(p, 'utf8');
  for (const m of t.matchAll(/\]\(([^)\s]+)\)/g)) {
    let r = m[1];
    if (/^(https?:|mailto:|tel:|#)/.test(r)) continue;
    r = decodeURIComponent(r.split('#')[0]);
    if (!r) continue;
    const rel = `${relative(ROOT, p)}:${r}`;
    if (MD_ALLOW.some((a) => a.test(rel))) continue;
    mdChecked++;
    if (!existsSync(resolve(dirname(p), r))) fail(`${relative(ROOT, p)}: broken markdown link -> ${r}`);
  }
}
ok(`${mdChecked} markdown links resolve`);

// 8. Playbook route lint: all routed skills present, named, linked, start commands exist
try {
  execFileSync(process.execPath, [join(ROOT, 'skills', 'premium-website-playbook', 'scripts', 'route.mjs'), '--lint', '.'], { cwd: ROOT, stdio: 'pipe' });
  ok('playbook route lint');
} catch (e) {
  fail(`playbook route lint: ${String(e.stdout || e.message).trim().split('\n').pop()}`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nvalidate: PASS');
process.exit(failures ? 1 : 0);
