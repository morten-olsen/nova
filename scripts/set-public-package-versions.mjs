import { findWorkspacePackages } from '@pnpm/find-workspace-packages';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [releaseTag] = process.argv.slice(2);
const version = releaseTag?.replace(/^v/, '');

if (
  !version ||
  !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)
) {
  throw new Error(`Expected a semantic-version release tag, received: ${releaseTag ?? '<none>'}`);
}

for (const workspacePackage of await findWorkspacePackages(process.cwd())) {
  if (workspacePackage.manifest.private || !workspacePackage.manifest.name) {
    continue;
  }

  const packageFile = join(workspacePackage.dir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
  packageJson.version = version;
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log(`Set ${packageJson.name} to ${version}`);
}
