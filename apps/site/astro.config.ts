import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';

import { novaCodeTheme } from './src/docs/nova-code-theme.ts';
import { rewriteDocMarkup } from './src/docs/rewrite-doc-markup.ts';

// GitHub Pages serves this repository from a sub-path rather than the domain
// root, so CI passes the path reported by actions/configure-pages through here.
// Unset locally, where dev and preview both serve from the root.
const pagesBasePath = process.env.PAGES_BASE_PATH ?? '/';
// The link rewriter builds absolute paths, so it needs exactly one trailing
// slash whichever form CI passed in.
const normalisedBase = pagesBasePath.endsWith('/') ? pagesBasePath : `${pagesBasePath}/`;

export default defineConfig({
  base: pagesBasePath,
  // Written into canonical and Open Graph URLs. Overridden in CI with the real
  // Pages origin so a share card never points at localhost.
  site: process.env.PAGES_ORIGIN ?? 'https://morten-olsen.github.io',
  integrations: [icon({ include: { ph: ['*'] } })],
  markdown: {
    // The documents are written for the repository, so their relative markdown
    // links have to be pointed at this site's routes before they render.
    rehypePlugins: [[rewriteDocMarkup, { base: normalisedBase }]],
    shikiConfig: { theme: novaCodeTheme, wrap: false },
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // The trailer stills, the piece renders and the example recordings are all
      // committed once, where the README and the CLI already read them from.
      // Aliased rather than copied so there is no second stale set to maintain.
      alias: {
        '@media': fileURLToPath(new URL('../../docs/media', import.meta.url)),
        '@previews': fileURLToPath(new URL('../../packages/renderer/assets/previews', import.meta.url)),
        '@recordings': fileURLToPath(new URL('../../examples/games', import.meta.url)),
      },
      // Resolve workspace packages through their `source` export so editing the
      // renderer hot-reloads instead of needing a `tsc -b` between every change.
      // Scoped to the client bundle below: Astro renders these pages in Node,
      // and handing its own dependencies a `browser` condition breaks that pass.
      conditions: ['source', 'module', 'browser', 'development|production'],
    },
    ssr: {
      resolve: {
        conditions: ['module', 'node', 'development|production'],
      },
    },
    build: {
      rollupOptions: {
        output: {
          // three is most of the board island's payload and changes only when
          // its version does. Split out so editing page code does not
          // invalidate it. Matched by module id because three reaches this app
          // transitively through the renderer, and rollup cannot resolve a
          // non-dependency as a chunk entry.
          manualChunks: (id: string) => (id.includes('/three/') ? 'three' : undefined),
        },
      },
    },
  },
});
