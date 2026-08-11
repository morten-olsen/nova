/**
 * The documents published on this site, and how they are introduced.
 *
 * The markdown files themselves carry no frontmatter on purpose: `nova init`
 * copies them into every factory, where a YAML block at the top would be noise
 * for both the player reading the file and the agent reading it. So the titles
 * and blurbs live here instead of in the documents.
 *
 * These are the player-facing three, which are also exactly what the docs
 * package publishes to npm. Contributor documents stay in the repository, linked
 * from the index.
 */
const docPages = [
  {
    blurb:
      'Every player-facing rule: the world, androids, the action API, buildings, acid, salvage, visibility, and how colony readiness is scored.',
    file: 'RULEBOOK.md',
    slug: 'rulebook',
    title: 'Rulebook',
  },
  {
    blurb:
      'Create a world, upload and launch an android, run rounds, inspect what happened, and play a match against someone else.',
    file: 'CLI-GUIDE.md',
    slug: 'cli-guide',
    title: 'CLI guide',
  },
  {
    blurb:
      'How to grow an android past its first version: reading the rules instead of repeating them, structuring a bot across files, and testing a change.',
    file: 'ANDROID-BUILDER-MANUAL.md',
    slug: 'android-builder-manual',
    title: 'Android builder manual',
  },
] as const;

type DocPage = (typeof docPages)[number];

/** Maps a markdown filename to its route on this site, if it has one. */
const docSlugForFile = (file: string): string | undefined => docPages.find((page) => page.file === file)?.slug;

export type { DocPage };
export { docPages, docSlugForFile };
