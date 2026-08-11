import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

import { docSlugForFile } from './doc-pages.ts';

const repositoryBlobBase = 'https://github.com/morten-olsen/nova/blob/main';

/**
 * Rewrites a link written for the repository into one that works on this site.
 *
 * The documents are read by three audiences: on GitHub, inside a factory that
 * `nova init` created, and here. Their links are relative markdown paths, which
 * are correct in the first two places and dead in the third. Anything that has a
 * page here becomes an internal route; anything that does not keeps working by
 * pointing at the repository, rather than 404ing quietly.
 */
const rewriteHref = (href: string, base: string): string | undefined => {
  if (!href.endsWith('.md') && !href.includes('.md#')) {
    return undefined;
  }
  const [path, anchor] = href.split('#');
  if (path === undefined) {
    return undefined;
  }
  const file = path.replace(/^(\.\/)+/, '');
  const suffix = anchor === undefined ? '' : `#${anchor}`;

  const slug = docSlugForFile(file);
  if (slug) {
    return `${base}docs/${slug}/${suffix}`;
  }
  // `../README.md` and the contributor documents, which live in the repository.
  const repositoryPath = file.startsWith('../') ? file.replace('../', '') : `docs/${file}`;
  return `${repositoryBlobBase}/${repositoryPath}${suffix}`;
};

/**
 * Wraps a table so it can scroll on its own.
 *
 * The rulebook's building and rules tables are wider than a phone, and a table
 * that overflows its column pushes the whole page sideways instead.
 */
const wrapTable = (node: Element, parent: Root | Element, index: number): void => {
  if (parent.type === 'element' && parent.properties?.['className']?.toString().includes('table-scroll')) {
    return;
  }
  const wrapper: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['table-scroll'] },
    children: [node],
  };
  parent.children[index] = wrapper;
};

/**
 * Drops the document's own top-level heading.
 *
 * Every one of these files opens with an H1, which is right when the file is
 * read on its own. Here the page shell has already set the title, so rendering it
 * again gives the page two H1s and a visible duplicate.
 */
const dropLeadingHeading = (tree: Root): void => {
  const index = tree.children.findIndex((child) => child.type === 'element' && child.tagName === 'h1');
  if (index !== -1) {
    tree.children.splice(index, 1);
  }
};

/**
 * Astro passes the site's base path in, so internal links survive a sub-path
 * deploy.
 *
 * Note when editing this file: Astro caches rendered collection entries in
 * `apps/site/.astro`, and its cache digest covers `astro.config.ts` rather than
 * the modules the config imports. Changes here therefore need
 * `rm -rf apps/site/.astro` before a local rebuild shows them. CI always builds
 * from a fresh checkout, so it never sees a stale render.
 */
const rewriteDocMarkup = (options: { base: string }) => {
  return (tree: Root): void => {
    dropLeadingHeading(tree);
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName === 'a') {
        const href = node.properties?.['href'];
        if (typeof href === 'string') {
          const rewritten = rewriteHref(href, options.base);
          if (rewritten !== undefined && node.properties) {
            node.properties['href'] = rewritten;
          }
        }
        return;
      }
      if (node.tagName === 'table' && parent && index !== undefined) {
        wrapTable(node, parent, index);
      }
    });
  };
};

export { rewriteDocMarkup };
