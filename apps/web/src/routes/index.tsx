import { createTimeline, usesFogOfWar, type TimelineFrame } from '@morten-olsen/nova-game';
import type { TabletopRenderer, TileClickEvent, TilePosition } from '@morten-olsen/nova-renderer';
import {
  CameraControls,
  getSelectedPieceId,
  Inspector,
  isSameSelection,
  resolveSelection,
  Scoreboard,
  selectionFromBoardClick,
  TimelineControls,
  WorldRenderer,
  type Selection,
} from '@morten-olsen/nova-replay-ui';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadEmbeddedRecording } from '../game/embedded-recording.ts';

const baseFrameDuration = 900;

type ReplayScreenProps = {
  camera: {
    onFocusSelection: (() => void) | undefined;
    onFrameBoard: () => void;
    onReady: (renderer: TabletopRenderer | null) => void;
    onZoom: (factor: number) => void;
  };
  fogOfWar: boolean;
  frame: TimelineFrame;
  frameIndex: number;
  isPlaying: boolean;
  maxFrame: number;
  onFrameChange: (value: number) => void;
  onSelect: (selection: Selection | undefined) => void;
  onSpeedChange: (speed: number) => void;
  onTileClick: (event: TileClickEvent) => void;
  onTogglePlayback: () => void;
  recordingName: string;
  selection: Selection | undefined;
  speed: number;
};

const Stat = ({ label, value }: { label: string; value: number }): React.ReactNode => (
  <div className="text-right">
    <p className="label !text-[0.6rem]">{label}</p>
    <p className="num text-sm font-semibold">{value}</p>
  </div>
);

const HudHeader = ({ frame, recordingName }: { frame: TimelineFrame; recordingName: string }): React.ReactNode => (
  <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-3">
    <div className="hud pointer-events-auto flex items-center gap-3 px-3 py-2">
      <span aria-hidden className="text-sm text-system">
        ◆
      </span>
      <div className="min-w-0">
        <h1 className="text-sm leading-tight font-semibold tracking-tight">Project Nova</h1>
        <p className="num max-w-[18rem] truncate text-[0.7rem] text-ink-faint">{recordingName}</p>
      </div>
    </div>
    <div className="hud pointer-events-auto flex items-center gap-4 px-3 py-2">
      <Stat label="Round" value={frame.round} />
      <div className="h-7 w-px bg-hairline" />
      <Stat label="Androids" value={frame.world.androids.length} />
      <div className="h-7 w-px bg-hairline" />
      <Stat label="Structures" value={frame.world.buildings.length} />
    </div>
  </header>
);

const ReplayScreen = ({
  camera,
  fogOfWar,
  frame,
  frameIndex,
  isPlaying,
  maxFrame,
  onFrameChange,
  onSelect,
  onSpeedChange,
  onTileClick,
  onTogglePlayback,
  recordingName,
  selection,
  speed,
}: ReplayScreenProps): React.ReactNode => {
  const resolved = resolveSelection(frame.world, selection);
  return (
    <main className="relative h-dvh overflow-hidden bg-transparent text-ink">
      {/* The board is the stage; everything else floats over it. */}
      <div className="absolute inset-0">
        <WorldRenderer
          className="h-full"
          fogOfWar={fogOfWar}
          selection={{ pieceId: getSelectedPieceId(selection), position: resolved?.position }}
          world={frame.world}
          onReady={camera.onReady}
          onTileClick={onTileClick}
        />
      </div>

      <HudHeader frame={frame} recordingName={recordingName} />

      <div className="pointer-events-none absolute inset-x-0 top-20 bottom-24 flex items-start justify-between gap-4 px-3">
        <div className="pointer-events-auto">
          <Scoreboard world={frame.world} />
        </div>
        <div className="pointer-events-auto flex items-start gap-2">
          <CameraControls
            onFocusSelection={camera.onFocusSelection}
            onFrameBoard={camera.onFrameBoard}
            onZoom={camera.onZoom}
          />
          <Inspector selection={resolved} world={frame.world} onSelect={onSelect} />
        </div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 p-3">
        <TimelineControls
          frame={frame}
          isPlaying={isPlaying}
          maxFrame={maxFrame}
          speed={speed}
          value={frameIndex}
          onChange={onFrameChange}
          onSpeedChange={onSpeedChange}
          onTogglePlayback={onTogglePlayback}
        />
      </footer>
    </main>
  );
};

type AutoAdvance = {
  isPlaying: boolean;
  maxFrame: number;
  setFrameIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  speed: number;
};

/** Advances the replay while playing, at a cadence set by the speed control. */
const useAutoAdvance = ({ isPlaying, maxFrame, setFrameIndex, setIsPlaying, speed }: AutoAdvance): void => {
  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= maxFrame) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, baseFrameDuration / speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, maxFrame, setFrameIndex, setIsPlaying, speed]);
};

type Shortcuts = Record<string, () => void>;

const useKeyboardShortcuts = (shortcuts: Shortcuts): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // Leave the scrubber's own arrow-key handling alone while it has focus.
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey) {
        return;
      }
      const action = shortcuts[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
};

/** Wires the HUD camera cluster to the live renderer's camera API. */
const useCameraControls = (focusPosition: TilePosition | undefined): ReplayScreenProps['camera'] => {
  const rendererRef = useRef<TabletopRenderer | null>(null);
  return useMemo(
    () => ({
      onReady: (renderer: TabletopRenderer | null) => {
        rendererRef.current = renderer;
      },
      onZoom: (factor: number) => {
        const renderer = rendererRef.current;
        if (!renderer) {
          return;
        }
        const { maximumDistance, minimumDistance } = renderer.getCameraFraming();
        const distance = renderer.getCameraDistance() * factor;
        renderer.moveCamera({
          distance: Math.min(maximumDistance, Math.max(minimumDistance, distance)),
          duration: 0.35,
        });
      },
      onFrameBoard: () => rendererRef.current?.resetCamera(0.7),
      onFocusSelection: focusPosition
        ? () => rendererRef.current?.moveCamera({ position: focusPosition, duration: 0.7 })
        : undefined,
    }),
    [focusPosition],
  );
};

const VisualizerPage = (): React.ReactNode => {
  const [embeddedRecording] = useState(loadEmbeddedRecording);
  const timeline = useMemo(() => createTimeline(embeddedRecording.recording), [embeddedRecording.recording]);
  const fogOfWar = useMemo(() => usesFogOfWar(timeline), [timeline]);
  const maxFrame = Math.max(0, timeline.length - 1);
  const [frameIndex, setFrameIndex] = useState(maxFrame);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selection, setSelection] = useState<Selection | undefined>(undefined);
  const frame = timeline[frameIndex];

  useAutoAdvance({ isPlaying, maxFrame, setFrameIndex, setIsPlaying, speed });

  const handleFrameChange = useCallback((value: number): void => {
    setFrameIndex(value);
    setIsPlaying(false);
  }, []);

  const handleTogglePlayback = useCallback((): void => {
    setFrameIndex((current) => (current >= maxFrame ? 0 : current));
    setIsPlaying((playing) => !playing);
  }, [maxFrame]);

  const handleTileClick = useCallback(
    (event: TileClickEvent): void => {
      const world = timeline[frameIndex]?.world;
      if (!world) {
        return;
      }
      const next = selectionFromBoardClick(world, event);
      // Clicking the current selection again clears it.
      setSelection((current) => (isSameSelection(current, next) ? undefined : next));
    },
    [frameIndex, timeline],
  );

  const camera = useCameraControls(frame ? resolveSelection(frame.world, selection)?.position : undefined);

  const shortcuts = useMemo<Shortcuts>(
    () => ({
      ' ': handleTogglePlayback,
      ArrowLeft: () => handleFrameChange(Math.max(0, frameIndex - 1)),
      ArrowRight: () => handleFrameChange(Math.min(maxFrame, frameIndex + 1)),
      Home: () => handleFrameChange(0),
      End: () => handleFrameChange(maxFrame),
      Escape: () => setSelection(undefined),
    }),
    [frameIndex, handleFrameChange, handleTogglePlayback, maxFrame],
  );
  useKeyboardShortcuts(shortcuts);

  if (!frame) {
    throw new Error('The supplied game recording contains no replay frames.');
  }
  return (
    <ReplayScreen
      camera={camera}
      fogOfWar={fogOfWar}
      frame={frame}
      frameIndex={frameIndex}
      isPlaying={isPlaying}
      maxFrame={maxFrame}
      recordingName={embeddedRecording.name}
      selection={selection}
      speed={speed}
      onFrameChange={handleFrameChange}
      onSelect={setSelection}
      onSpeedChange={setSpeed}
      onTileClick={handleTileClick}
      onTogglePlayback={handleTogglePlayback}
    />
  );
};

const Route = createFileRoute('/')({
  component: VisualizerPage,
});

export { Route };
