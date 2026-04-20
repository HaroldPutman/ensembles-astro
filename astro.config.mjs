// @ts-check
import { defineConfig } from 'astro/config';
import { remarkModifiedTime } from './remark-modified-time.mjs';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import clerk from '@clerk/astro';
import { activityLegacyRedirects } from './src/data/activity-legacy-redirects.mjs';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://ensemblesinc.org',

  redirects: {
    ...activityLegacyRedirects,
    '/classes': '/activities?kind=class',
    '/camps': '/activities?kind=camp',
    '/contact-us': '/contact',
    '/mission': '/about',
    '/events': '/activities?kind=event',
    '/pirate-auditions': 'https://cal.com/charlestown-ensembles/pirates-musical?month=2026-05&overlayCalendar=true',
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
