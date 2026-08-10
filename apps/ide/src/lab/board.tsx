import type { TimelineFrame } from '@morten-olsen/nova-game';
import {
  getSelectedPieceId,
  Inspector,
  resolveSelection,
  selectionFromBoardClick,
  TimelineControls,
  WorldRenderer,
  type Selection,
} from '@morten-olsen/nova-replay-ui';
import { useCallback, useMemo, useState } from 'react';

import { usePlayback } from './use-playback.ts';

const EmptyBoard = (): React.ReactNode => (
  <div className="grid h-full place-items-center p-8 text-center">
    <div>
      <p className="label">No run yet</p>
      <p className="mt-2 max-w-xs text-sm text-ink-dim">
        Press <kbd className="num text-ink">⌘⏎</kbd> to play your android against a fresh map.
      </p>
    </div>
  </div>
);

const Board = ({ fogOfWar, frames }: { fogOfWar: boolean; frames: TimelineFrame[] }): React.ReactNode => {
  const maxFrame = Math.max(0, frames.length - 1);
  const [frameIndex, setFrameIndex] = useState(maxFrame);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selection, setSelection] = useState<Selection>();

  usePlayback({ isPlaying, maxFrame, setFrameIndex, setIsPlaying, speed });

  const index = Math.min(frameIndex, maxFrame);
  const frame = frames[index];
  const resolved = useMemo(() => (frame ? resolveSelection(frame.world, selection) : undefined), [frame, selection]);

  const onFrameChange = useCallback((value: number) => {
    setFrameIndex(value);
    setIsPlaying(false);
  }, []);

  const onTogglePlayback = useCallback(() => {
    // Restarting from the end is what a second press means once it has finished.
    setFrameIndex((current) => (current >= maxFrame ? 0 : current));
    setIsPlaying((playing) => !playing);
  }, [maxFrame]);

  if (!frame) {
    return <EmptyBoard />;
  }

  return (
    <>
      <WorldRenderer
        className="h-full"
        fogOfWar={fogOfWar}
        onTileClick={(event) => setSelection(selectionFromBoardClick(frame.world, event))}
        selection={{ pieceId: getSelectedPieceId(selection), position: resolved?.position }}
        world={frame.world}
      />
      {resolved ? (
        <div className="pointer-events-none absolute top-3 right-3 bottom-24 flex w-72 justify-end">
          <div className="hud pointer-events-auto max-h-full overflow-y-auto p-3">
            <Inspector onSelect={setSelection} selection={resolved} world={frame.world} />
          </div>
        </div>
      ) : null}
      <footer className="absolute inset-x-0 bottom-0 p-3">
        <TimelineControls
          frame={frame}
          isPlaying={isPlaying}
          maxFrame={maxFrame}
          onChange={onFrameChange}
          onSpeedChange={setSpeed}
          onTogglePlayback={onTogglePlayback}
          speed={speed}
          value={index}
        />
      </footer>
    </>
  );
};

export { Board };
