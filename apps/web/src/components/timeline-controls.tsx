import type { TimelineFrame } from '../game/recording.ts';

type TimelineControlsProps = {
  frame: TimelineFrame;
  isPlaying: boolean;
  maxFrame: number;
  value: number;
  onChange: (value: number) => void;
  onTogglePlayback: () => void;
};

const TimelineControls = ({
  frame,
  isPlaying,
  maxFrame,
  value,
  onChange,
  onTogglePlayback,
}: TimelineControlsProps): React.ReactNode => {
  const atEnd = value === maxFrame;
  return (
    <section className="command-panel p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1.5">
          <button
            className="command-button command-button-primary px-4 py-2"
            disabled={atEnd && !isPlaying}
            type="button"
            onClick={onTogglePlayback}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button className="command-button px-3 py-2" disabled={value === 0} type="button" onClick={() => onChange(0)}>
            Start
          </button>
          <button
            className="command-button px-3 py-2"
            disabled={value === 0}
            type="button"
            onClick={() => onChange(value - 1)}
          >
            Prev
          </button>
          <button
            className="command-button px-3 py-2"
            disabled={atEnd}
            type="button"
            onClick={() => onChange(value + 1)}
          >
            Next
          </button>
        </div>
        <div className="min-w-0 flex-1 border-l border-slate-800 pl-3">
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="command-label text-cyan-200">{frame.label}</span>
            <span className="shrink-0 font-mono text-xs text-slate-400">
              Checkpoint {value + 1} / {maxFrame + 1}
            </span>
          </div>
          <input
            aria-label="Replay round"
            className="w-full accent-cyan-300"
            max={maxFrame}
            min={0}
            type="range"
            value={value}
            onChange={(event) => onChange(Number.parseInt(event.currentTarget.value, 10))}
          />
        </div>
      </div>
    </section>
  );
};

export { TimelineControls };
