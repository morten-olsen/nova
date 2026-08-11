import { createRequire } from 'node:module';
import { basename, dirname } from 'node:path';

import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

import { docSlugForFile } from './docs/doc-pages.ts';

// Resolved through the package rather than by walking up the tree, the same way
// `apps/cli/src/factory.ts` finds the documents it copies into a new factory.
// One source of truth: the site renders the files a player gets locally.
const require = createRequire(import.meta.url);
const docsDirectory = dirname(require.resolve('@morten-olsen/nova-docs/package.json'));

const docs = defineCollection({
  loader: glob({
    base: docsDirectory,
    pattern: '*.md',
    // Stated rather than inherited. The default lowercases `RULEBOOK.md` into
    // `rulebook`, which happens to be the route too, and a page that resolves by
    // coincidence breaks the day a file is renamed.
    generateId: ({ entry }) => docSlugForFile(basename(entry)) ?? basename(entry, '.md'),
  }),
});

export const collections = { docs };
