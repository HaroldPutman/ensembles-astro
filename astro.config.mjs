// @ts-check
import { defineConfig } from 'astro/config';
import { remarkModifiedTime } from './remark-modified-time.mjs';
import icon from 'astro-icon';

import mdx from '@astrojs/mdx';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  markdown: {
    remarkPlugins: [remarkModifiedTime],
  },

  integrations: [mdx(), icon()],

  vite: {
    envPrefix: ['PUBLIC_'],
    build: {
      sourcemap: true,
    },
  },

  adapter: netlify(),
});