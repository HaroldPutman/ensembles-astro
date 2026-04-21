/**
 * One-shot: move collections/activities/*.mdx into yyyy/mm/<slug>.mdx
 * per docs/notes.md. Run: node scripts/migrate-activity-files.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'collections', 'activities');

function parseStartDateFromFm(fm) {
  const sdLine = fm.split('\n').find(l => l.startsWith('startDate:'));
  if (!sdLine) return null;
  const raw = sdLine.split(':').slice(1).join(':').trim();
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return {
    yyyy: String(year),
    mm: String(month).padStart(2, '0'),
    dd: String(day).padStart(2, '0'),
  };
}

function slugFromBasename(basename, start) {
  if (/^gather2026[1-9]$/.test(basename)) {
    return 'gather' + basename.slice(-1);
  }
  let m = basename.match(/^(.+)-(\d{6})$/);
  if (m) return m[1];
  m = basename.match(/^(.+?)(\d{8})$/);
  if (m) {
    const base = m[1];
    if (base === 'pour') return `pour-${start.dd}`;
    return base;
  }
  m = basename.match(/^(.+?)(\d{6})$/);
  if (m) return m[1];
  m = basename.match(/^(.+?)(?<![0-9])(\d{4})$/);
  if (m) return m[1];
  throw new Error('No slug rule for: ' + basename);
}

function readFm(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('No frontmatter: ' + filePath);
  return match[1];
}

const entries = fs.readdirSync(dir, { withFileTypes: true });
const files = entries
  .filter(e => e.isFile() && e.name.endsWith('.mdx'))
  .map(e => e.name);

const rows = [];
for (const f of files) {
  const full = path.join(dir, f);
  const fm = readFm(full);
  const start = parseStartDateFromFm(fm);
  if (!start) throw new Error('Bad startDate: ' + f);
  const basename = f.replace(/\.mdx$/, '');
  const slug = slugFromBasename(basename, start);
  const oldId = basename;
  const newId = `${start.yyyy}/${start.mm}/${slug}`;
  const destDir = path.join(dir, start.yyyy, start.mm);
  const newPath = path.join(destDir, `${slug}.mdx`);
  rows.push({ f, full, oldId, newId, newPath, destDir, slug });
}

const key = r => `${r.newId}`;
const byKey = new Map();
for (const r of rows) {
  if (!byKey.has(key(r))) byKey.set(key(r), []);
  byKey.get(key(r)).push(r);
}
const collisions = [...byKey.entries()].filter(([, v]) => v.length > 1);
if (collisions.length) {
  console.error(collisions);
  throw new Error('Slug collisions after pour fix');
}

for (const r of rows) {
  fs.mkdirSync(r.destDir, { recursive: true });
  fs.renameSync(r.full, r.newPath);
  console.log(r.oldId, '->', r.newId);
}

console.log(
  'Next: node scripts/generate-activity-redirects.mjs  (redirects + DB migration from git HEAD)'
);
