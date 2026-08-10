import { CircleAlert, CircleCheck, Loader2, Terminal } from 'lucide-react';

import type { SandboxResult } from '../sandbox/sandbox.ts';

type RunConsoleProps = {
  error: string | undefined;
  isRunning: boolean;
  result: SandboxResult | undefined;
};

const Line = ({
  children,
  icon,
  kind = 'note',
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  kind?: 'note' | 'error';
}): React.ReactNode => (
  <p className="console-line num flex items-start gap-2 text-xs" data-kind={kind}>
    <span className="mt-px shrink-0">{icon}</span>
    <span className="min-w-0">{children}</span>
  </p>
);

const RunConsole = ({ error, isRunning, result }: RunConsoleProps): React.ReactNode => {
  if (isRunning) {
    return <Line icon={<Loader2 className="size-3 animate-spin text-system" />}>Running…</Line>;
  }

  if (error) {
    return (
      <Line icon={<CircleAlert className="size-3 text-warning" />} kind="error">
        {error}
      </Line>
    );
  }

  if (!result) {
    return (
      <Line icon={<Terminal className="size-3 text-ink-faint" />}>Run the script to see what your android did.</Line>
    );
  }

  const { failures, recording } = result;
  const rounds = recording.events.filter((event) => event.type === 'game.round-end').length;

  return (
    <div className="flex flex-col gap-1.5">
      <Line
        icon={
          failures.length === 0 ? (
            <CircleCheck className="size-3 text-acid" />
          ) : (
            <CircleAlert className="size-3 text-energy" />
          )
        }
      >
        {rounds} rounds · {recording.events.length} events ·{' '}
        {failures.length === 0 ? 'no failed turns' : `${failures.length} failed turns`}
      </Line>
      {/*
        Every failure, not just the first: a script that dies the same way each
        round is a different problem from one that fails once and recovers.
      */}
      {failures.map((failure, index) => (
        <Line icon={<CircleAlert className="size-3 text-warning" />} key={`${failure.round}-${index}`} kind="error">
          Round {failure.round}: {failure.message}
        </Line>
      ))}
    </div>
  );
};

export { RunConsole };
