import { createTabletopRenderer, type TabletopRenderer } from '@morten-olsen/nova-renderer';

import { loadBoardTimeline, type BoardReadout } from './board-recording.ts';

type BoardStageOptions = {
  /** Element the canvas is appended to. Must already have a size. */
  host: HTMLElement;
  /** Called once the first frame is on screen, so the poster can be faded out. */
  onFirstFrame: () => void;
  /** Called on every round change, to drive the telemetry panel. */
  onReadout: (readout: BoardReadout) => void;
  /** URL of the recording to replay. */
  recordingUrl: string;
  /** Seconds each round is held before the next is applied. */
  secondsPerRound?: number;
};

type BoardStage = {
  dispose: () => void;
};

const defaultSecondsPerRound = 1.6;
/** Beat at the end of the recording before it loops, so the finished colony reads. */
const loopHoldSeconds = 3;
/**
 * Fraction of the whole-board distance the hero sits at.
 *
 * The replay viewer opens framing every tile, because a player needs to see the
 * board they are reasoning about. A hero is the opposite job: close enough that
 * the pieces have weight and the board runs past the edges of the frame, so the
 * page reads as a view into the world rather than a picture of it.
 */
const heroDistanceFactor = 0.56;

/**
 * Drives the renderer's own animation loop rather than its internal one, so the
 * board can be stopped the moment it scrolls out of view. A background board
 * that keeps a WebGL loop and a raycaster running behind three screens of copy
 * is the difference between a page that feels alive and one that drains a
 * laptop battery.
 */
const createFrameLoop = (step: (deltaSeconds: number) => void): { start: () => void; stop: () => void } => {
  let handle: number | undefined;
  let last: number | undefined;

  const tick = (now: number): void => {
    // Clamped: returning to a backgrounded tab hands rAF a delta of many
    // seconds, which would fast-forward every actor animation at once.
    const delta = last === undefined ? 0 : Math.min((now - last) / 1000, 1 / 15);
    last = now;
    step(delta);
    handle = requestAnimationFrame(tick);
  };

  return {
    start: (): void => {
      if (handle !== undefined) {
        return;
      }
      last = undefined;
      handle = requestAnimationFrame(tick);
    },
    stop: (): void => {
      if (handle === undefined) {
        return;
      }
      cancelAnimationFrame(handle);
      handle = undefined;
    },
  };
};

const startBoardStage = async (options: BoardStageOptions): Promise<BoardStage> => {
  const { host, onFirstFrame, onReadout, recordingUrl } = options;
  const secondsPerRound = options.secondsPerRound ?? defaultSecondsPerRound;
  const controller = new AbortController();
  const timeline = await loadBoardTimeline(recordingUrl, controller.signal);

  // Spectator framing. The recording is a two-faction game, so replaying it
  // under one player's line of sight would black out most of the board; a
  // spectator sees the whole table.
  const renderer: TabletopRenderer = createTabletopRenderer(host, { autoPlay: false, fogOfWar: false });

  let index = 0;
  let held = 0;
  let announced = false;
  const apply = (next: number): void => {
    const frame = timeline.frames[next];
    if (!frame) {
      return;
    }
    renderer.setWorld(frame.world);
    onReadout(timeline.readAt(next));
  };

  const loop = createFrameLoop((delta) => {
    renderer.advance(delta);
    if (!announced) {
      announced = true;
      onFirstFrame();
    }
    held += delta;
    const isLast = index === timeline.frames.length - 1;
    if (held < (isLast ? loopHoldSeconds : secondsPerRound)) {
      return;
    }
    held = 0;
    index = isLast ? 0 : index + 1;
    apply(index);
  });

  apply(0);

  // After the first world, because the framing distance is only known once the
  // board's extent is.
  const framing = renderer.getCameraFraming();
  renderer.moveCamera({
    distance: Math.max(framing.minimumDistance, framing.boardDistance * heroDistanceFactor),
    duration: 0,
  });

  // Only run while the board is actually on screen. `visibilitychange` covers
  // the other half: a hidden tab throttles rAF but does not stop it.
  const visibility = new IntersectionObserver((entries) => {
    const isVisible = entries.some((entry) => entry.isIntersecting) && !document.hidden;
    if (isVisible) {
      loop.start();
    } else {
      loop.stop();
    }
  });
  visibility.observe(host);

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      loop.stop();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    dispose: (): void => {
      controller.abort();
      loop.stop();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.dispose();
    },
  };
};

export type { BoardStage, BoardStageOptions };
export { startBoardStage };
