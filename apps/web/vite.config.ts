import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ quoteStyle: 'single' }), react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    host: process.env.HOST ?? undefined,
  },
});
