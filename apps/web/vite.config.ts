import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const gameRecordingMarker = '<!-- NOVA_GAME_RECORDING -->';
const gameScriptType = 'application/vnd.project-nova.game+json';

/**
 * `nova play` injects the recording into the built index.html. During `vite dev`
 * there is no CLI in the loop, so point NOVA_GAME at a recording to get the same
 * markup and work on the visuals against a real board.
 */
const injectDevRecording = (): Plugin => ({
  name: 'nova-dev-recording',
  apply: 'serve',
  // Resolve workspace packages through their `source` export so editing the
  // renderer hot-reloads instead of needing a `tsc -b` between every change.
  config: () => ({ resolve: { conditions: ['source', 'module', 'browser', 'development|production'] } }),
  transformIndexHtml: (html) => {
    const gamePath = process.env.NOVA_GAME;
    if (!gamePath) {
      return html;
    }
    const content = readFileSync(resolve(process.cwd(), gamePath), 'utf8')
      .replaceAll('<', '\\u003c')
      .replaceAll('>', '\\u003e')
      .replaceAll('&', '\\u0026');
    return html.replace(
      gameRecordingMarker,
      `<script type="${gameScriptType}" data-name="${gamePath.split('/').pop()}">${content}</script>`,
    );
  },
});

export default defineConfig({
  plugins: [injectDevRecording(), TanStackRouterVite({ quoteStyle: 'single' }), react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    host: process.env.HOST ?? undefined,
  },
});
