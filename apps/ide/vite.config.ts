import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves this app from a repository sub-path rather than the
// domain root, so CI passes the path reported by actions/configure-pages
// through here. Unset locally, where dev and preview both serve from the root.
const pagesBasePath = process.env.PAGES_BASE_PATH ?? '/';

export default defineConfig({
  // Vite requires a leading and trailing slash; configure-pages reports the
  // path without the trailing one.
  base: pagesBasePath.endsWith('/') ? pagesBasePath : `${pagesBasePath}/`,
  plugins: [TanStackRouterVite({ quoteStyle: 'single' }), react(), tailwindcss()],
  // Resolve workspace packages through their `source` export so editing the
  // renderer or the shared replay UI hot-reloads instead of needing a `tsc -b`
  // between every change.
  resolve: {
    conditions: ['source', 'module', 'browser', 'development|production'],
  },
  build: {
    rollupOptions: {
      output: {
        // Monaco and three are most of the payload and change only when their
        // versions do. Split out so editing app code does not invalidate them.
        // Matched by module id rather than by name because `three` reaches this
        // app transitively through the renderer, and rollup cannot resolve a
        // non-dependency as a chunk entry.
        manualChunks: (id: string) => {
          if (id.includes('monaco-editor')) {
            return 'monaco';
          }
          if (id.includes('/three/')) {
            return 'three';
          }
          return undefined;
        },
      },
    },
    // Monaco alone clears the default warning threshold; raised so the warning
    // stays meaningful for chunks that are genuinely unexpected.
    chunkSizeWarningLimit: 3500,
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    host: process.env.HOST ?? undefined,
  },
});
