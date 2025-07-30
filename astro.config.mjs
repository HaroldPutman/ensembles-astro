// @ts-check
import { defineConfig } from 'astro/config';
import { remarkModifiedTime } from './remark-modified-time.mjs';

import mdx from '@astrojs/mdx';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkModifiedTime],
  },

  integrations: [mdx()],

  vite: {
    envPrefix: ['PUBLIC_', 'BREVO_'],
    build: {
      sourcemap: true,
    },
  },

  adapter: netlify(),
});