import { createPiecePreviewStage, type PieceKind } from '@morten-olsen/nova-renderer';

type StartPieceStageOptions = {
  /** The catalogue section. Owns the shared canvas and the `data-pieces` state. */
  section: HTMLElement;
};

/**
 * Turns the catalogue's still renders into live pieces.
 *
 * Kept in its own chunk so the still-image path never downloads three.js. On the
 * front page that import is free by the time this runs — the hero board pulled
 * the same module and the same eleven GLBs, and the loader caches both — which
 * is the whole reason this is worth doing: the models are already paid for, and
 * the stills they replace are not.
 *
 * The stills come down first, before a single model is requested, and that
 * ordering is the whole trick. Loading everything and then cutting over means
 * eleven cards change at once under a visitor who may well be looking at them,
 * and a simultaneous swap between two renders of the same object at different
 * framings reads as a bug. Taken down first, the swap happens while the section
 * is still far below the fold, and each piece simply fades up into a slot that
 * was already empty.
 */
const startPieceStage = async (options: StartPieceStageOptions): Promise<void> => {
  const { section } = options;
  const grid = section.querySelector<HTMLElement>('[data-piece-grid]');
  const cards = [...section.querySelectorAll<HTMLElement>('[data-piece-slot]')];
  if (!grid || cards.length === 0) {
    return;
  }

  section.dataset.pieces = 'live';
  const stage = createPiecePreviewStage({ container: grid });

  try {
    // Sequentially, not with `Promise.all`: eleven parallel GLB requests on a
    // cold cache would compete with whatever the page is still loading, and a
    // piece that arrives on its own fades into its own card anyway.
    for (const card of cards) {
      const kind = card.dataset.pieceSlot;
      if (kind) {
        await stage.add(card, kind as PieceKind);
      }
    }
  } catch (error) {
    // Put the page back the way it was found. The stills are still in the DOM
    // and have not been fetched yet, so this costs a request rather than a hole.
    delete section.dataset.pieces;
    stage.dispose();
    throw error;
  }
};

export { startPieceStage };
