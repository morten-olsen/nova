import type { TimelineFrame } from '@morten-olsen/nova-game';

import { Select } from '../ui/select.tsx';

import { Board } from './board.tsx';

const sizeOptions = [
  { label: '8 × 8', value: 8 },
  { label: '12 × 12', value: 12 },
  { label: '16 × 16', value: 16 },
  { label: '24 × 24', value: 24 },
];

const roundOptions = [
  { label: '12 rounds', value: 12 },
  { label: '24 rounds', value: 24 },
  { label: '60 rounds', value: 60 },
  { label: '120 rounds', value: 120 },
];

type BoardPanelProps = {
  fogOfWar: boolean;
  frames: TimelineFrame[];
  onRoundsChange: (rounds: number) => void;
  onSizeChange: (size: number) => void;
  rounds: number;
  /** Changes per run, so the board resets its scrubber and selection. */
  runId: number;
  size: number;
};

const BoardPanel = ({
  fogOfWar,
  frames,
  onRoundsChange,
  onSizeChange,
  rounds,
  runId,
  size,
}: BoardPanelProps): React.ReactNode => (
  <section className="relative h-full">
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
      <Select label="Map size" onChange={onSizeChange} options={sizeOptions} value={size} />
      <Select label="Rounds" onChange={onRoundsChange} options={roundOptions} value={rounds} />
    </div>
    {/*
      Keyed per run so a new run resets the scrubber and selection — holding
      frame 7 of the previous run while showing the new one reads as a bug, and
      a stale selected android may not exist any more.
    */}
    <Board fogOfWar={fogOfWar} frames={frames} key={runId} />
  </section>
);

export { BoardPanel };
