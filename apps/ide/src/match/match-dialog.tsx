import { Dialog } from '@base-ui-components/react/dialog';
import { Copy, Loader2, Radio, Swords, Trophy, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../ui/button.tsx';
import { cn } from '../ui/cn.ts';
import { Select } from '../ui/select.tsx';

import { MatchOffer } from './match-offer.tsx';
import { MatchScores } from './match-scores.tsx';
import type { useMatch } from './use-match.ts';

type MatchDialogProps = {
  match: ReturnType<typeof useMatch>;
  onClose: () => void;
  onLoadReplay: () => void;
  open: boolean;
  /** The draft in the editor — the android this player is entering. */
  script: string;
  scriptName: string;
};

const roundOptions = [
  { label: '12 rounds', value: 12 },
  { label: '24 rounds', value: 24 },
  { label: '60 rounds', value: 60 },
];

const sizeOptions = [
  { label: '12 × 12', value: 12 },
  { label: '16 × 16', value: 16 },
  { label: '24 × 24', value: 24 },
];

const disclosureOptions = [
  { label: 'Full replay', value: 'full' as const },
  { label: 'Recording only', value: 'recording' as const },
];

const Field = ({ children, label }: { children: React.ReactNode; label: string }): React.ReactNode => (
  <label className="flex items-center justify-between gap-3">
    <span className="label">{label}</span>
    {children}
  </label>
);

const TextInput = (props: React.ComponentPropsWithoutRef<'input'>): React.ReactNode => (
  <input
    {...props}
    className={cn(
      'min-w-0 rounded-md border border-hairline-bright bg-panel-raised px-2 py-1.5 text-sm outline-none',
      'focus-visible:border-system/60',
      props.className,
    )}
  />
);

const Setup = ({
  match,
  script,
  scriptName,
}: {
  match: MatchDialogProps['match'];
  script: string;
  scriptName: string;
}): React.ReactNode => {
  const [name, setName] = useState('Player');
  const [code, setCode] = useState('');
  const [rounds, setRounds] = useState(24);
  const [size, setSize] = useState(16);
  const [disclosure, setDisclosure] = useState<'full' | 'recording'>('full');

  return (
    <div className="flex flex-col gap-5">
      <Field label="Your name">
        <TextInput className="w-48" onChange={(event) => setName(event.target.value)} value={name} />
      </Field>

      <section className="flex flex-col gap-3 rounded-lg border border-hairline p-3">
        <div className="flex items-center gap-2">
          <Radio className="size-3.5 text-system" />
          <h3 className="text-sm font-semibold">Host a match</h3>
        </div>
        <Field label="Rounds">
          <Select label="Rounds" onChange={setRounds} options={roundOptions} value={rounds} />
        </Field>
        <Field label="World">
          <Select label="World size" onChange={setSize} options={sizeOptions} value={size} />
        </Field>
        <Field label="Disclosure">
          <Select label="Disclosure" onChange={setDisclosure} options={disclosureOptions} value={disclosure} />
        </Field>
        {/*
          Said plainly rather than buried: the host executes the opponent's
          script. The Worker sandbox isolates each turn and kills runaway
          scripts, but it is not a security boundary.
        */}
        <p className="text-xs leading-relaxed text-ink-faint">
          As host, your browser runs both androids — including your opponent&rsquo;s script, in the same sandboxed
          worker used by Run.
        </p>
        <Button
          onClick={() => match.host({ disclosure, playerName: name, rounds, script, scriptName, size })}
          variant="primary"
        >
          <Radio />
          Create invite code
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-hairline p-3">
        <div className="flex items-center gap-2">
          <Swords className="size-3.5 text-energy" />
          <h3 className="text-sm font-semibold">Join a match</h3>
        </div>
        <Field label="Invite code">
          <TextInput
            className="num w-48 tracking-widest uppercase"
            onChange={(event) => setCode(event.target.value)}
            placeholder="ABCDE-FGHJK"
            value={code}
          />
        </Field>
        <p className="text-xs leading-relaxed text-ink-faint">
          Works with a match hosted from the terminal with <span className="num">nova host</span> too.
        </p>
        <Button
          disabled={code.trim().length === 0}
          onClick={() => match.join({ code, playerName: name, script, scriptName })}
        >
          <Swords />
          Join match
        </Button>
      </section>
    </div>
  );
};

const Waiting = ({ match }: { match: MatchDialogProps['match'] }): React.ReactNode => (
  <div className="flex flex-col items-center gap-4 py-4 text-center">
    <p className="label">Share this invite code</p>
    <div className="flex items-center gap-2">
      <p className="num text-2xl font-semibold tracking-[0.2em] text-system">{match.code}</p>
      <Button onClick={() => void navigator.clipboard?.writeText(match.code ?? '')} size="icon" variant="ghost">
        <Copy />
      </Button>
    </div>
    <p className="max-w-sm text-xs leading-relaxed text-ink-dim">
      They can join from another browser lab, or from a terminal with{' '}
      <span className="num text-ink">nova join {match.code}</span>
    </p>
    <p className="flex items-center gap-2 text-xs text-ink-faint">
      <Loader2 className="size-3 animate-spin" />
      {match.status}
    </p>
  </div>
);

const Playing = ({ match }: { match: MatchDialogProps['match'] }): React.ReactNode => (
  <div className="flex flex-col items-center gap-3 py-6 text-center">
    <Loader2 className="size-5 animate-spin text-system" />
    <p className="text-sm">
      {match.progress ? `Round ${match.progress.round} of ${match.progress.rounds}` : match.status}
    </p>
    {match.progress ? (
      <div className="h-1 w-56 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full bg-system transition-[width] duration-200"
          style={{ width: `${(match.progress.round / match.progress.rounds) * 100}%` }}
        />
      </div>
    ) : null}
  </div>
);

const Body = ({
  match,
  onLoadReplay,
  script,
  scriptName,
}: Omit<MatchDialogProps, 'open' | 'onClose'>): React.ReactNode => {
  if (match.phase === 'offered' && match.offer) {
    return <MatchOffer offer={match.offer} onAccept={match.accept} onDecline={match.decline} />;
  }
  if (match.phase === 'waiting') {
    return <Waiting match={match} />;
  }
  if (match.phase === 'connecting' || match.phase === 'playing') {
    return <Playing match={match} />;
  }
  if (match.phase === 'done' && match.result) {
    return <MatchScores onLoadReplay={onLoadReplay} result={match.result} />;
  }
  if (match.phase === 'error') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <p className="text-sm text-warning">{match.error}</p>
        <Button onClick={match.cancel}>Back</Button>
      </div>
    );
  }
  return <Setup match={match} script={script} scriptName={scriptName} />;
};

const MatchDialog = ({ match, onClose, onLoadReplay, open, script, scriptName }: MatchDialogProps): React.ReactNode => (
  <Dialog.Root onOpenChange={(next) => !next && onClose()} open={open}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 bg-void/70 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
      <Dialog.Popup
        className={cn(
          'panel fixed top-1/2 left-1/2 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5',
          'max-h-[calc(100vh-2rem)] overflow-y-auto transition-[transform,opacity] duration-150',
          'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
        )}
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="size-4 text-system" />
          <Dialog.Title className="text-sm font-semibold tracking-tight">Peer match</Dialog.Title>
          <Dialog.Close render={(props) => <Button {...props} className="ml-auto" size="icon" variant="ghost" />}>
            <X />
          </Dialog.Close>
        </div>
        <Body match={match} onLoadReplay={onLoadReplay} script={script} scriptName={scriptName} />
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);

export { MatchDialog };
