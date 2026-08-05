import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { RecordingLoader } from '../components/recording-loader.tsx';
import { TimelineControls } from '../components/timeline-controls.tsx';
import { createTimeline, type Recording } from '../game/recording.ts';
import { WorldRenderer } from '../visualization/world-renderer.tsx';

const VisualizerPage = (): React.ReactNode => {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [recordingName, setRecordingName] = useState<string>('');
  const [frameIndex, setFrameIndex] = useState(0);
  const timeline = useMemo(() => (recording ? createTimeline(recording) : []), [recording]);
  const frame = timeline[frameIndex];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">Project Nova</p>
          <h1 className="mt-2 text-4xl font-bold">World visualizer</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Load a JSON recording, scrub through the event log, and inspect the reconstructed world at each event.
          </p>
        </header>

        <RecordingLoader
          onLoad={(nextRecording, name) => {
            setRecording(nextRecording);
            setRecordingName(name);
            setFrameIndex(0);
          }}
        />

        {recording && frame ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-100">{recordingName}</h2>
                <span className="text-sm text-slate-400">{recording.events.length} events</span>
              </div>
              <WorldRenderer world={frame.world} />
            </section>
            <aside className="flex flex-col gap-4">
              <TimelineControls
                frame={frame}
                maxFrame={timeline.length - 1}
                value={frameIndex}
                onChange={setFrameIndex}
              />
              <pre className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                {JSON.stringify(frame.world.androids, null, 2)}
              </pre>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
};

const Route = createFileRoute('/')({
  component: VisualizerPage,
});

export { Route };
