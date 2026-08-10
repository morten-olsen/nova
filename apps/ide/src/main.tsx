import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './app.css';
import { getScriptRunner } from './runner/script-runner.ts';
import { routeTree } from './routeTree.gen.ts';

// Spawns the script worker now so it loads its interpreter while the user is
// still finding their way to the editor, rather than on the first Run.
getScriptRunner();

// Vite fills BASE_URL from `base`, which on GitHub Pages is the repository
// sub-path. The router needs it too, or every link it builds points at the
// domain root instead.
const router = createRouter({ routeTree, basepath: import.meta.env.BASE_URL });

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
