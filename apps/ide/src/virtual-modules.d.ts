declare module 'virtual:nova-declarations' {
  /**
   * The engine's `.d.ts` files, read off the installed packages at build time by
   * the `nova-declarations` Vite plugin and served to Monaco as extra libraries.
   * `path` is an absolute node_modules path, so the declarations resolve each
   * other the way they do on disk.
   */
  const declarations: { path: string; content: string }[];
  export { declarations };
}
