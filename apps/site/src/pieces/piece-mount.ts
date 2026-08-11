/**
 * Whether to draw the catalogue live.
 *
 * The same gates as the hero board, for the same reasons and with one addition
 * that matters more here than there. The board's models are a cost the desktop
 * visitor has already paid by the time the catalogue is reached, so live pieces
 * are a saving: the eleven still renders stop being downloaded. On a phone the
 * board never starts, so nothing is warm, and the identical decision would trade
 * about 200KB of images for 4.7MB of models to animate something the width of a
 * thumb. Hence the width check, which is not about capability at all.
 */
const shouldRunPieces = (): boolean => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  if (window.matchMedia('(max-width: 767px)').matches) {
    return false;
  }
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData === true) {
    return false;
  }
  const probe = document.createElement('canvas');
  return probe.getContext('webgl2') !== null;
};

const mountPieces = async (): Promise<void> => {
  const section = document.querySelector<HTMLElement>('[data-piece-catalogue]');
  if (!section || !shouldRunPieces()) {
    return;
  }

  const { startPieceStage } = await import('./piece-stage.ts');
  try {
    await startPieceStage({ section });
  } catch (error) {
    // The stills are still on the page, so this is a quality regression rather
    // than a broken section — but it is one nobody would otherwise notice.
    console.warn('Project Nova: the live piece previews could not start, showing the still renders instead.', error);
  }
};

/**
 * Deferred to idle, and behind the hero board.
 *
 * The order is deliberate. Both want the same eleven GLBs; letting the board ask
 * first means the catalogue's models arrive as cache hits rather than as eleven
 * requests racing the board for the connection while the visitor is still
 * looking at the top of the page.
 */
const schedulePieces = (): void => {
  const run = (): void => {
    void mountPieces();
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 4000 });
    return;
  }
  window.setTimeout(run, 600);
};

export { schedulePieces };
