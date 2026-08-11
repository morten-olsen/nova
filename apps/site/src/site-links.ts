/**
 * Every destination the site links to.
 *
 * The player documents are rendered by this site from the same files
 * `@morten-olsen/nova-docs` ships into a factory, so they are internal routes
 * rather than links out to the repository. Contributor documents stay in the
 * repository, next to the code they describe.
 *
 * Internal entries are relative to the deployed base path, which differs between
 * local preview and GitHub Pages, so resolve them against `BASE_URL` at the point
 * of use rather than hard-coding a leading slash.
 */
const repository = 'https://github.com/morten-olsen/nova';

const siteLinks = {
  androidManual: 'docs/android-builder-manual/',
  cliGuide: 'docs/cli-guide/',
  docs: 'docs/',
  /**
   * The browser IDE is a separate Vite build deployed beside this page, so it is
   * a real navigation rather than a route.
   */
  ide: 'ide/',
  releases: `${repository}/releases`,
  repository,
  rulebook: 'docs/rulebook/',
} as const;

/** Resolves an entry above against the deployed base path. */
const linkTo = (link: string): string => (link.startsWith('http') ? link : `${import.meta.env.BASE_URL}${link}`);

export { linkTo, siteLinks };
