import { useMemo } from 'react';
import type { TimelineFrame } from '@morten-olsen/nova-game';

type TimelineControlsProps = {
  frame: TimelineFrame;
  isPlaying: boolean;
  maxFrame: number;
  onChange: (value: number) => void;
  onSpeedChange: (speed: number) => void;
  onTogglePlayback: () => void;
  speed: number;
  value: number;
};

const speeds = [0.5, 1, 2, 4];

/** Rulebook verbs, so the replay names actions the way the rules do. */
const actionVerbs: Record<string, string> = {
  'android.move': 'move',
  'android.collect': 'collect',
  'android.charge': 'charge',
  'android.deposit': 'deposit',
  'android.withdraw': 'withdraw',
  'android.start-construction': 'construct',
  'android.continue-construction': 'construct',
  'android.salvage': 'salvage',
  'android.dismantle': 'dismantle',
  'android.broadcast': 'broadcast',
  'android.clean-acid': 'clean acid',
  'user.launch-android': 'launch',
  'game.android-failed-turn': 'failed turn',
};

const summariseRound = (frame: TimelineFrame): string => {
  const counts = new Map<string, number>();
  for (const event of frame.events) {
    const verb = actionVerbs[event.type];
    if (verb) {
      counts.set(verb, (counts.get(verb) ?? 0) + 1);
    }
  }
  const ordered = [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4);
  return ordered.length ? ordered.map(([verb, count]) => `${count} ${verb}`).join(' · ') : 'No android actions';
};

const StepButton = ({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}): React.ReactNode => (
  <button aria-label={label} className="btn size-8" disabled={disabled} title={label} type="button" onClick={onClick}>
    {children}
  </button>
);

const icons = {
  start: 'M18 5v14L7 12zM6 5h1.5v14H6z',
  prev: 'M15 5v14L5 12z',
  next: 'M9 5v14l10-7z',
  end: 'M6 5v14l11-7zM16.5 5H18v14h-1.5z',
};

type TransportProps = {
  atEnd: boolean;
  isPlaying: boolean;
  maxFrame: number;
  onChange: (value: number) => void;
  onTogglePlayback: () => void;
  value: number;
};

const Transport = ({
  atEnd,
  isPlaying,
  maxFrame,
  onChange,
  onTogglePlayback,
  value,
}: TransportProps): React.ReactNode => (
  <div className="flex shrink-0 items-center gap-1.5">
    <button
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className="btn btn-primary size-9"
      type="button"
      onClick={onTogglePlayback}
    >
      <svg aria-hidden className="size-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d={isPlaying ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'} />
      </svg>
    </button>
    {(
      [
        ['Jump to first round', icons.start, value === 0, 0],
        ['Previous round', icons.prev, value === 0, value - 1],
        ['Next round', icons.next, atEnd, value + 1],
        ['Jump to last round', icons.end, atEnd, maxFrame],
      ] as const
    ).map(([label, path, disabled, target]) => (
      <StepButton key={label} disabled={disabled} label={label} onClick={() => onChange(target)}>
        <svg aria-hidden className="size-3" fill="currentColor" viewBox="0 0 24 24">
          <path d={path} />
        </svg>
      </StepButton>
    ))}
  </div>
);

const TimelineControls = ({
  frame,
  isPlaying,
  maxFrame,
  onChange,
  onSpeedChange,
  onTogglePlayback,
  speed,
  value,
}: TimelineControlsProps): React.ReactNode => {
  const atEnd = value >= maxFrame;
  const summary = useMemo(() => summariseRound(frame), [frame]);
  const progress = maxFrame > 0 ? (value / maxFrame) * 100 : 100;

  return (
    <section className="hud flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center">
      <Transport
        atEnd={atEnd}
        isPlaying={isPlaying}
        maxFrame={maxFrame}
        value={value}
        onChange={onChange}
        onTogglePlayback={onTogglePlayback}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-ink-dim">
            <span className="font-semibold text-ink">Round {frame.round}</span>
            <span className="mx-1.5 text-ink-faint">·</span>
            {summary}
          </p>
          <p className="num shrink-0 text-[0.7rem] text-ink-faint">
            {value + 1} / {maxFrame + 1}
          </p>
        </div>
        <div className="relative mt-0.5">
          {/* Tick per round, sitting behind the range so the scrubber reads as
              discrete checkpoints rather than a continuous bar. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[0.5625rem] flex justify-between">
            {Array.from({ length: Math.min(maxFrame + 1, 60) }, (_, index) => (
              <span key={index} className="h-1.5 w-px bg-hairline-bright" />
            ))}
          </div>
          <input
            aria-label="Replay round"
            className="scrub relative"
            max={maxFrame}
            min={0}
            step={1}
            style={{
              ['--scrub-track' as string]: `linear-gradient(90deg, var(--color-system) ${progress}%, var(--color-hairline) ${progress}%)`,
            }}
            type="range"
            value={value}
            onChange={(event) => onChange(Number.parseInt(event.currentTarget.value, 10))}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Playback speed">
        {speeds.map((option) => (
          <button
            key={option}
            aria-pressed={speed === option}
            className={`btn num h-7 px-2 text-[0.7rem] ${
              speed === option ? '!border-system/60 !bg-system/15 !text-system' : '!text-ink-faint'
            }`}
            type="button"
            onClick={() => onSpeedChange(option)}
          >
            {option}×
          </button>
        ))}
      </div>
    </section>
  );
};

export { TimelineControls };
