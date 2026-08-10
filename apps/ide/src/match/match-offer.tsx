import type { OfferMessage } from '@morten-olsen/nova-match';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '../ui/button.tsx';

type MatchOfferProps = {
  offer: OfferMessage;
  onAccept: () => void;
  onDecline: () => void;
};

const Row = ({ label, value }: { label: string; value: string }): React.ReactNode => (
  <div className="flex items-center justify-between gap-3">
    <span className="label">{label}</span>
    <span className="num text-sm">{value}</span>
  </div>
);

/**
 * The terms, shown before the script is sent anywhere.
 *
 * Disclosure is the part that matters and the part that is easy to skim past:
 * under `recording` the guest gives up any replay of the match, and gets back
 * only what their own android wrote down. Spelled out rather than named.
 */
const MatchOffer = ({ offer, onAccept, onDecline }: MatchOfferProps): React.ReactNode => (
  <div className="flex flex-col gap-4">
    <p className="text-sm">
      <span className="font-semibold">{offer.hostName}</span> invited you to a match.
    </p>

    <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
      <Row label="Rounds" value={String(offer.rounds)} />
      <Row label="World" value={`${offer.world.width} × ${offer.world.height}`} />
    </div>

    <div className="flex gap-3 rounded-lg border border-hairline p-3">
      {offer.disclosure === 'full' ? (
        <Eye className="mt-0.5 size-4 shrink-0 text-system" />
      ) : (
        <EyeOff className="mt-0.5 size-4 shrink-0 text-energy" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{offer.disclosure === 'full' ? 'Full replay' : 'Recording only'}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          {offer.disclosure === 'full'
            ? 'You both get a replay of every round and both androids. Script source, memory and recordings are redacted for the other player.'
            : "You get only what your own android wrote to its recording, plus the final scores. You will not be able to replay the match or read the host's script."}
        </p>
      </div>
    </div>

    <p className="text-xs leading-relaxed text-ink-faint">
      Your android script is sent to the host, who runs the simulation.
    </p>

    <div className="flex gap-2">
      <Button className="flex-1" onClick={onAccept} variant="primary">
        Accept and send android
      </Button>
      <Button onClick={onDecline}>Decline</Button>
    </div>
  </div>
);

export { MatchOffer };
