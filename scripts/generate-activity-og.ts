/* eslint-disable no-console -- CLI build script */
/**
 * Incrementally generates activity Open Graph PNGs into public/image/og/.
 * Skips a file when the MDX source, hero image, and generator inputs are unchanged
 * (see data/activity-og-hashes.json; commit with PNGs when inputs change).
 *
 * Set ACTIVITY_OG_FORCE_ALL=1 to regenerate every image.
 */
import { createHash } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderActivityOgPng } from '../src/lib/activityOgImage.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ACTIVITIES_GLOB_DIR = join(REPO_ROOT, 'collections/activities');
const OUT_BASE = join(REPO_ROOT, 'public', 'image', 'og');
/** Committed in-repo so clean CI clones can skip work when nothing changed. */
const MANIFEST_FILE = join(REPO_ROOT, 'data', 'activity-og-hashes.json');
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const forceAll = process.env.ACTIVITY_OG_FORCE_ALL === '1';

type Manifest = {
  version: 1;
  byId: Record<string, string>;
};

function extractFrontmatter(source: string): string | null {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function getScalarField(front: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(.+)$`, 'm');
  const m = front.match(re);
  if (!m) return;
  let v = m[1].trim();
  if (v.length >= 2) {
    const a = v[0];
    const b = v[v.length - 1];
    if ((a === "'" && b === "'") || (a === '"' && b === '"'))
      v = v.slice(1, -1);
  }
  return v;
}

async function* walkMdxFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkMdxFiles(p);
    } else if (e.name.endsWith('.mdx')) {
      yield p;
    }
  }
}

function activityIdFromPath(mdxPath: string): string {
  return relative(ACTIVITIES_GLOB_DIR, mdxPath)
    .replace(/\\/g, '/')
    .replace(/\.mdx$/, '');
}

function outPngForId(id: string): string {
  const parts = id.split('/');
  const file = parts[parts.length - 1] ?? id;
  return join(OUT_BASE, ...parts.slice(0, -1), `${file}.png`);
}

async function readSharedGeneratorStamp(): Promise<Buffer> {
  const chunks: Buffer[] = [
    await readFile(join(REPO_ROOT, 'src', 'lib', 'activityOgImage.ts')),
    await readFile(
      join(
        REPO_ROOT,
        'node_modules/@fontsource/public-sans/files/public-sans-latin-600-normal.woff'
      )
    ),
  ];
  chunks.push(
    await readFile(join(REPO_ROOT, 'public', 'image', 'ensembles-glow.png'))
  );
  return Buffer.concat(chunks);
}

async function computeInputHash(
  mdxContent: string,
  imagePathFromFrontmatter: string | undefined,
  sharedStamp: Buffer
): Promise<string> {
  const h = createHash('sha256');
  h.update(sharedStamp);
  h.update(mdxContent, 'utf8');
  if (imagePathFromFrontmatter?.startsWith('/')) {
    const imageAbs = join(
      REPO_ROOT,
      'public',
      imagePathFromFrontmatter.slice(1)
    );
    try {
      const st = await stat(imageAbs);
      if (st.size > MAX_IMAGE_BYTES) h.update('__huge__');
      else h.update(await readFile(imageAbs));
    } catch {
      h.update('__missing_image__');
    }
  } else {
    h.update('__no_image__');
  }
  return h.digest('hex');
}

function loadManifest(raw: string | undefined): Manifest {
  if (!raw) return { version: 1, byId: {} };
  try {
    const o = JSON.parse(raw) as Manifest;
    if (o && o.version === 1 && o.byId && typeof o.byId === 'object') return o;
  } catch {
    // ignore
  }
  return { version: 1, byId: {} };
}

async function main() {
  process.chdir(REPO_ROOT);

  const [sharedStamp, manifestText] = await Promise.all([
    readSharedGeneratorStamp(),
    readFile(MANIFEST_FILE, 'utf8').catch(() => undefined),
  ]);
  const manifest = loadManifest(manifestText);

  const mdxList: { id: string; mdxPath: string }[] = [];
  for await (const mdxPath of walkMdxFiles(ACTIVITIES_GLOB_DIR)) {
    mdxList.push({ id: activityIdFromPath(mdxPath), mdxPath });
  }

  const currentIds = new Set(mdxList.map(x => x.id));

  for (const id of Object.keys(manifest.byId)) {
    if (!currentIds.has(id)) {
      const out = outPngForId(id);
      try {
        await rm(out);
      } catch {
        // no file
      }
      delete manifest.byId[id];
    }
  }

  let generated = 0;
  let skipped = 0;

  for (const { id, mdxPath } of mdxList) {
    const mdxContent = await readFile(mdxPath, 'utf8');
    const fm = extractFrontmatter(mdxContent);
    if (!fm) {
      console.warn(`[og] skip (no frontmatter): ${id}`);
      continue;
    }
    const name = getScalarField(fm, 'name');
    if (!name) {
      console.warn(`[og] skip (no name): ${id}`);
      continue;
    }
    const image = getScalarField(fm, 'image');

    const outPath = outPngForId(id);
    const inputHash = await computeInputHash(mdxContent, image, sharedStamp);

    let outputMissing = true;
    try {
      await stat(outPath);
      outputMissing = false;
    } catch {
      // missing or unreadable: regenerate
    }
    const needGen =
      forceAll || manifest.byId[id] !== inputHash || outputMissing;

    if (!needGen) {
      skipped++;
      continue;
    }

    const png = await renderActivityOgPng({ name, imagePath: image });
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, png);
    manifest.byId[id] = inputHash;
    generated++;
  }

  await mkdir(dirname(MANIFEST_FILE), { recursive: true });
  await writeFile(
    MANIFEST_FILE,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  console.log(
    `[og] activity Open Graph: ${generated} generated, ${skipped} up-to-date (${mdxList.length} activities)`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
