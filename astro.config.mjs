// @ts-check
import { defineConfig } from 'astro/config';
import { remarkModifiedTime } from './remark-modified-time.mjs';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import clerk from '@clerk/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://ensemblesinc.org',

  redirects: {
    '/classes': '/activities?kind=class',
    '/contact-us': '/contact',
    '/mission': '/about',
    '/events': '/activities?kind=event',
  },

  markdown: {
    remarkPlugins: [remarkModifiedTime],
  },

  integrations: [mdx(), icon(), sitemap(), clerk()],

  vite: {
    envPrefix: ['PUBLIC_'],
    build: {
      sourcemap: true,
    },
  },

  adapter: netlify(),
});
