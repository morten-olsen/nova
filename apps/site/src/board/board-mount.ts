import type { BoardReadout } from './board-recording.ts';

/**
 * Whether to spend a WebGL context, three.js and a 51KB recording on this
 * visitor at all.
 *
 * The poster underneath the canvas is a real frame of the same board, so every
 * path out of here still shows the game. Nothing below is a fallback for a
 * broken page; they are all cases where the still image is the better answer.
 */
const shouldRunBoard = (): boolean => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  // A phone renders the board at a size where individual pieces stop being
  // legible, which is the entire point of the shot, and pays the most for it.
  if (window.matchMedia('(max-width: 767px)').matches) {
    return false;
  }
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData === true) {
    return false;
  }
  const canvas = document.createElement('canvas');
  return canvas.getContext('webgl2') !== null;
};

const formatReadout = (value: number): string => value.toString().padStart(2, '0');

const writeReadout = (root: HTMLElement, readout: BoardReadout): void => {
  const fields: Record<string, string> = {
    androids: formatReadout(readout.androids),
    readiness: readout.readiness.toString(),
    round: formatReadout(readout.round),
    structures: formatReadout(readout.structures),
  };
  for (const [field, value] of Object.entries(fields)) {
    const target = root.querySelector<HTMLElement>(`[data-readout='${field}']`);
    if (target) {
      target.textContent = value;
    }
  }
};

/**
 * Settles the hero on the still frame.
 *
 * The telemetry panel goes with it: left up, it would sit on the opening round
 * forever, which reads as a broken counter rather than as a still image.
 */
const declineBoard = (stage: HTMLElement, telemetry: HTMLElement): void => {
  stage.dataset.boardStage = 'declined';
  telemetry.hidden = true;
};

const mountBoard = async (): Promise<void> => {
  const stage = document.querySelector<HTMLElement>('[data-board-stage]');
  const host = document.querySelector<HTMLElement>('[data-board-host]');
  const telemetry = document.querySelector<HTMLElement>('[data-board-telemetry]');
  const recordingUrl = stage?.dataset.recording;
  if (!stage || !host || !telemetry || !recordingUrl) {
    return;
  }

  if (!shouldRunBoard()) {
    declineBoard(stage, telemetry);
    return;
  }

  const { startBoardStage } = await import('./board-stage.ts');
  try {
    await startBoardStage({
      host,
      onFirstFrame: () => {
        stage.dataset.boardStage = 'running';
      },
      onReadout: (readout) => {
        writeReadout(telemetry, readout);
      },
      recordingUrl,
    });
  } catch (error) {
    // Worth a console line: a failure here means the recording or the renderer
    // regressed, and the page would otherwise hide that behind a still image.
    declineBoard(stage, telemetry);
    console.warn('Project Nova: the live board could not start, showing the still frame instead.', error);
  }
};

/**
 * Held until the browser is idle so the board never competes with the hero
 * image, the fonts, or the copy for the first paint.
 */
const scheduleBoard = (): void => {
  const run = (): void => {
    void mountBoard();
  };
  // Checked through the property rather than with `in`, which narrows `window`
  // itself and leaves the fallback branch typed as `never`: the DOM lib declares
  // requestIdleCallback as always present, and Safari only shipped it recently.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2000 });
    return;
  }
  window.setTimeout(run, 200);
};

export { scheduleBoard };
