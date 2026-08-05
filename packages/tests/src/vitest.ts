import { resolve } from 'node:path';

import { findWorkspacePackages } from '@pnpm/find-workspace-packages';

type PackageManifest = {
  name?: string;
  exports?: {
    '.'?: {
      source?: string;
    };
  };
};

const getAliases = async (): Promise<Record<string, string>> => {
  const packages = await findWorkspacePackages(process.cwd());
  const aliases = packages.flatMap((pkg): [string, string][] => {
    const manifest = pkg.manifest as PackageManifest;

    if (!manifest.name || !manifest.exports?.['.']?.source) {
      return [];
    }

    return [[manifest.name, resolve(pkg.dir, manifest.exports['.'].source)]];
  });

  return Object.fromEntries(aliases);
};

export { getAliases };
