import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const LOGO_REL_PATH = 'public/image/ensembles-glow.png';

/** First IHDR width/height (intrinsic pixel size). */
function readPngIntrinsicSize(buf: Buffer): { w: number; h: number } | null {
  if (
    buf.length < 24 ||
    buf[0] !== 0x89 ||
    buf.toString('ascii', 1, 4) !== 'PNG'
  ) {
    return null;
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w > 0 && w < 10000 && h > 0 && h < 10000) return { w, h };
  return null;
}

/** Astro/Netlify bundles live under `.netlify/build`; use cwd (project root at build time). */
function repoRoot(): string {
  return process.cwd();
}

let font600Promise: Promise<ArrayBuffer> | null = null;

function loadPublicSans600(): Promise<ArrayBuffer> {
  if (!font600Promise) {
    const path = join(
      repoRoot(),
      'node_modules/@fontsource/public-sans/files/public-sans-latin-600-normal.woff'
    );
    font600Promise = readFile(path).then(b =>
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    );
  }
  return font600Promise;
}

function titleFontSize(name: string): number {
  const len = name.length;
  if (len > 52) return 40;
  if (len > 40) return 48;
  if (len > 28) return 54;
  return 60;
}

function imageMime(imagePath: string): string {
  const lower = imagePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export type ActivityOgInput = {
  /** Activity display name */
  name: string;
  /** Public URL path e.g. `/activity/foo.jpg` */
  imagePath?: string;
};

/**
 * Renders a 1200×630 PNG for Open Graph (Satori → SVG → Resvg).
 */
export async function renderActivityOgPng(
  input: ActivityOgInput
): Promise<Uint8Array> {
  const root = repoRoot();
  const [fontData, logoBuf] = await Promise.all([
    loadPublicSans600(),
    readFile(join(root, LOGO_REL_PATH)),
  ]);

  const logoDims =
    readPngIntrinsicSize(logoBuf) ?? ({ w: 250, h: 86 } as const);
  const logoDataUrl = `data:image/png;base64,${logoBuf.toString('base64')}`;

  let bgDataUrl: string | undefined;
  if (input.imagePath?.startsWith('/')) {
    const publicDir = resolve(root, 'public');
    const rel = input.imagePath.slice(1);
    const abs = resolve(publicDir, rel);
    const underPublic = abs.startsWith(publicDir + sep);
    if (underPublic) {
      try {
        const buf = await readFile(abs);
        const mime = imageMime(input.imagePath);
        bgDataUrl = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
      } catch {
        bgDataUrl = undefined;
      }
    }
  }

  const fontSize = titleFontSize(input.name);

  const tree = {
    type: 'div',
    props: {
      style: {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: 'flex',
        position: 'relative',
        backgroundColor: '#1a1a1a',
      },
      children: [
        ...(bgDataUrl
          ? [
              {
                type: 'img',
                props: {
                  src: bgDataUrl,
                  width: OG_WIDTH,
                  height: OG_HEIGHT,
                  style: {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: OG_WIDTH,
                    height: OG_HEIGHT,
                    objectFit: 'cover',
                  },
                },
              },
            ]
          : []),
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.88) 100%)',
            },
          },
        },
        {
          type: 'img',
          props: {
            src: logoDataUrl,
            width: logoDims.w,
            height: logoDims.h,
            style: {
              position: 'absolute',
              top: 26,
              right: 26,
              objectFit: 'fill',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '36px 44px 42px',
              display: 'flex',
            },
            children: {
              type: 'div',
              props: {
                style: {
                  color: '#ffffff',
                  fontSize,
                  fontWeight: 600,
                  fontFamily: 'Public Sans',
                  lineHeight: 1.12,
                  letterSpacing: '-0.02em',
                  maxWidth: OG_WIDTH - 88,
                },
                children: input.name,
              },
            },
          },
        },
      ],
    },
  };

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      {
        name: 'Public Sans',
        data: fontData,
        style: 'normal',
        weight: 600,
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
  });
  return resvg.render().asPng();
}
