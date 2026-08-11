import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, sep } from 'node:path';

import type { Plugin } from 'vite';

/**
 * A declaration file as the editor will see it: an absolute path under a
 * node_modules layout, so that TypeScript's own resolver can walk between them.
 */
type Declaration = {
  path: string;
  content: string;
};

const require = createRequire(import.meta.url);

const virtualId = 'virtual:nova-declarations';

/** Zod carries a v3 compatibility tree and 53 locale files. The game's types reach none of them. */
const zodSkipped = ['v3', 'v4/locales', 'v4-mini', 'mini', 'locales', 'src'];

const declarationFiles = (root: string, current = ''): string[] => {
  const entries = readdirSync(join(root, current), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = current ? posix.join(current, entry.name) : entry.name;
    if (entry.isDirectory()) {
      return declarationFiles(root, path);
    }
    return entry.name.endsWith('.d.ts') ? [path] : [];
  });
};

const collectPackage = (packageName: string, root: string, keep: (path: string) => boolean): Declaration[] =>
  declarationFiles(root)
    .filter(keep)
    .map((path) => ({
      path: `/node_modules/${packageName}/${path}`,
      content: readFileSync(join(root, path.split(posix.sep).join(sep)), 'utf8'),
    }));

/**
 * Every declaration the editor needs to type an android, read off the installed
 * packages at build time.
 *
 * Read rather than restated: these are the same `.d.ts` files the CLI compiles a
 * factory android against, so what the lab reports and what `nova upload-script`
 * accepts cannot drift. The engine's types are Zod-inferred, which is why Zod
 * comes along — `World` is `z.infer<typeof worldSchema>`, and without Zod's own
 * declarations that resolves to nothing.
 *
 * Requires `packages/game/dist`, so a `tsc -b` has to have run. The lab still
 * works without it; it just types the android as `any`.
 */
const collectDeclarations = (): Declaration[] => {
  const gameRoot = dirname(require.resolve('@morten-olsen/nova-game/package.json'));
  const zodRoot = dirname(require.resolve('zod'));

  return [
    ...collectPackage(
      '@morten-olsen/nova-game',
      gameRoot,
      (path) => path === 'android.d.ts' || path.startsWith('dist/'),
    ),
    ...collectPackage('zod', zodRoot, (path) => !zodSkipped.some((skipped) => path.startsWith(`${skipped}/`))),
  ];
};

/**
 * Serves {@link collectDeclarations} to the app as `virtual:nova-declarations`.
 *
 * A plugin rather than `import.meta.glob` because the packages are reached
 * through pnpm's symlinks, which Vite's globber does not follow, and because the
 * app should not have to know where in the workspace the engine happens to live.
 */
const novaDeclarations = (): Plugin => ({
  name: 'nova-declarations',
  resolveId: (id) => (id === virtualId ? `\0${virtualId}` : undefined),
  load: (id) =>
    id === `\0${virtualId}` ? `export const declarations = ${JSON.stringify(collectDeclarations())};` : undefined,
});

export type { Declaration };
export { collectDeclarations, novaDeclarations };
