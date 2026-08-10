import type { TileClickEvent } from '@morten-olsen/nova-renderer';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TileInspector } from '../components/tile-inspector.tsx';
import { TimelineControls } from '../components/timeline-controls.tsx';
import { loadEmbeddedRecording } from '../game/embedded-recording.ts';
import { createTimeline, type TimelineFrame } from '../game/recording.ts';
import { WorldRenderer } from '../visualization/world-renderer.tsx';

type ReplayScreenProps = {
  frame: TimelineFrame;
  frameIndex: number;
  isPlaying: boolean;
  maxFrame: number;
  onFrameChange: (value: number) => void;
  onTileClick: (event: TileClickEvent) => void;
  onTogglePlayback: () => void;
  recordingName: string;
  selectedTile: { x: number; y: number } | null;
};

const ReplayScreen = ({
  frame,
  frameIndex,
  isPlaying,
  maxFrame,
  onFrameChange,
  onTileClick,
  onTogglePlayback,
  recordingName,
  selectedTile,
}: ReplayScreenProps): React.ReactNode => {
  return (
    <main className="h-dvh overflow-y-auto bg-transparent p-3 font-mono text-slate-100 sm:p-4 xl:overflow-hidden">
      <div className="mx-auto flex h-full max-w-[100rem] flex-col gap-2">
        <header className="command-panel shrink-0 flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <p className="command-label text-cyan-300">Project Nova · replay command</p>
            <h1 className="mt-1 max-w-xl truncate text-base font-bold tracking-wide text-slate-100">{recordingName}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>UNITS {frame.world.androids.length}</span>
            <span className="h-1 w-1 bg-cyan-700" />
            <span>STRUCTURES {frame.world.buildings.length}</span>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="command-panel flex min-h-0 flex-col p-2">
            <div className="mb-2 shrink-0 flex items-center justify-between px-1">
              <p className="command-label text-slate-300">Tabletop replay</p>
              <p className="text-[0.65rem] uppercase tracking-wider text-slate-500">
                Pan: drag · zoom: scroll · inspect: click
              </p>
            </div>
            <WorldRenderer className="min-h-0 flex-1" world={frame.world} onTileClick={onTileClick} />
          </section>
          <TileInspector world={frame.world} position={selectedTile} />
        </div>

        <footer className="shrink-0">
          <TimelineControls
            frame={frame}
            isPlaying={isPlaying}
            maxFrame={maxFrame}
            value={frameIndex}
            onChange={onFrameChange}
            onTogglePlayback={onTogglePlayback}
          />
        </footer>
      </div>
    </main>
  );
};

const VisualizerPage = (): React.ReactNode => {
  const [embeddedRecording] = useState(loadEmbeddedRecording);
  const [frameIndex, setFrameIndex] = useState(() =>
    Math.max(0, createTimeline(embeddedRecording.recording).length - 1),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const timeline = useMemo(() => createTimeline(embeddedRecording.recording), [embeddedRecording.recording]);
  const frame = timeline[frameIndex];
  const maxFrame = Math.max(0, timeline.length - 1);

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
    }, 900);
    return () => window.clearInterval(timer);
  }, [isPlaying, maxFrame]);

  const handleTileClick = useCallback((event: TileClickEvent): void => setSelectedTile(event.position), []);
  const handleFrameChange = useCallback((value: number): void => {
    setFrameIndex(value);
    setIsPlaying(false);
  }, []);
  const handleTogglePlayback = useCallback((): void => {
    if (frameIndex === maxFrame) {
      setFrameIndex(0);
    }
    setIsPlaying((playing) => !playing);
  }, [frameIndex, maxFrame]);

  if (!frame) {
    throw new Error('The supplied game recording contains no replay frames.');
  }
  return (
    <ReplayScreen
      frame={frame}
      frameIndex={frameIndex}
      isPlaying={isPlaying}
      maxFrame={maxFrame}
      recordingName={embeddedRecording.name}
      selectedTile={selectedTile}
      onFrameChange={handleFrameChange}
      onTileClick={handleTileClick}
      onTogglePlayback={handleTogglePlayback}
    />
  );
};

const Route = createFileRoute('/')({
  component: VisualizerPage,
});

export { Route };
