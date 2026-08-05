import type { TimelineFrame } from '../game/recording.ts';

type TimelineControlsProps = {
  frame: TimelineFrame;
  maxFrame: number;
  value: number;
  onChange: (value: number) => void;
};

const TimelineControls = ({ frame, maxFrame, value, onChange }: TimelineControlsProps): React.ReactNode => {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Timeline</h2>
          <p className="text-sm text-slate-400">
            Frame {value} / {maxFrame}: {frame.label}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
            disabled={value === 0}
            type="button"
            onClick={() => onChange(Math.max(0, value - 1))}
          >
            Previous
          </button>
          <button
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
            disabled={value === maxFrame}
            type="button"
            onClick={() => onChange(Math.min(maxFrame, value + 1))}
          >
            Next
          </button>
        </div>
      </div>
      <input
        className="mt-4 w-full accent-cyan-400"
        max={maxFrame}
        min={0}
        type="range"
        value={value}
        onChange={(event) => onChange(Number.parseInt(event.currentTarget.value, 10))}
      />
    </section>
  );
};

export { TimelineControls };
