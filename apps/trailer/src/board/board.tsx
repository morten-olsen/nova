import { createTabletopRenderer, preloadPieceModels, type TabletopRenderer } from '@morten-olsen/nova-renderer';
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createTimeline, usesFogOfWar, type Recording, type TimelineFrame } from './board.timeline.ts';
import { toFrameCues, type BoardCue, type FrameCues } from './board.cues.ts';

type NovaBoardProps = {
  cues: BoardCue[];
  /** Seeded so separately rendered passes of the same shot match. */
  particleSeed?: number;
  recording: Recording;
};

const applyCues = (renderer: TabletopRenderer, frames: TimelineFrame[], cues: BoardCue[]): void => {
  for (const cue of cues) {
    if (cue.type === 'world') {
      const frame = frames[Math.min(Math.max(cue.world, 0), frames.length - 1)];
      if (frame) {
        renderer.setWorld(frame.world);
      }
    }
    if (cue.type === 'camera') {
      renderer.moveCamera(cue.move);
    }
    if (cue.type === 'camera-reset') {
      renderer.resetCamera(cue.duration);
    }
    if (cue.type === 'select') {
      renderer.setSelection(cue.selection);
    }
  }
};

/**
 * Steps the renderer from wherever it is to `frame`, applying cues on the way.
 *
 * The board is a stateful simulation, not a function of a clock: piece positions
 * ease toward targets and fog eases per tile, so frame N only exists as the
 * result of N `advance` calls. Catching up rather than seeking is what keeps a
 * rendered shot identical to live playback.
 */
type StepRequest = {
  cuesByFrame: FrameCues;
  fps: number;
  frames: TimelineFrame[];
  from: number;
  renderer: TabletopRenderer;
  to: number;
};

const stepTo = ({ cuesByFrame, fps, frames, from, renderer, to }: StepRequest): void => {
  for (let at = from; at <= to; at += 1) {
    const cues = cuesByFrame.get(at);
    if (cues) {
      applyCues(renderer, frames, cues);
    }
    renderer.advance(1 / fps);
  }
};

/**
 * Renders one recording through the real game renderer, one `advance` per output
 * frame, directed by a cue list.
 *
 * One instance owns one WebGL context, so a film that cuts between two boards
 * mounts this twice rather than swapping the world underneath a single renderer —
 * a diff between two different boards animates every piece across the cut.
 */
const NovaBoard = ({ cues, particleSeed = 1_742, recording }: NovaBoardProps): React.ReactNode => {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TabletopRenderer | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);
  const lastFrameRef = useRef(-1);
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();

  const frames = useMemo(() => createTimeline(recording), [recording]);
  const fogOfWar = useMemo(() => usesFogOfWar(frames), [frames]);
  const cuesByFrame = useMemo(() => toFrameCues(cues, fps), [cues, fps]);

  /**
   * Rebuilds the renderer from scratch. Easing simulations have no rewind, so
   * this is also the only honest way to answer a backward seek: throw the state
   * away and replay the shot from its first frame.
   */
  const rebuild = useCallback((): TabletopRenderer | null => {
    const host = hostRef.current;
    if (!host) {
      return null;
    }
    rendererRef.current?.dispose();
    const renderer = createTabletopRenderer(host, { autoPlay: false, fogOfWar, particleSeed });
    rendererRef.current = renderer;
    lastFrameRef.current = -1;
    return renderer;
  }, [fogOfWar, particleSeed]);

  useEffect(() => {
    rebuild();
    // Placeholder primitives stand in until the GLBs land. In capture that would
    // be permanent, so nothing is stepped until the real models are cached.
    readyRef.current = preloadPieceModels();
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
      readyRef.current = null;
    };
  }, [rebuild]);

  useEffect(() => {
    const ready = readyRef.current;
    if (!rendererRef.current || !ready) {
      return;
    }
    const handle = delayRender(`Nova board frame ${frame}`);
    void ready.then(() => {
      const rewinding = frame < lastFrameRef.current;
      const renderer = rewinding ? rebuild() : rendererRef.current;
      if (!renderer || frame === lastFrameRef.current) {
        continueRender(handle);
        return;
      }
      stepTo({ cuesByFrame, fps, frames, from: lastFrameRef.current + 1, renderer, to: frame });
      lastFrameRef.current = frame;
      continueRender(handle);
    });
  }, [cuesByFrame, fps, frame, frames, rebuild]);

  return <div ref={hostRef} style={{ height, width }} />;
};

export type { NovaBoardProps };
export { NovaBoard };
