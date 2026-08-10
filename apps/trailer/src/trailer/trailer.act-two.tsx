import type { World } from '@morten-olsen/nova-game';
import { AbsoluteFill, Sequence } from 'remotion';

import { Broadcast } from '../overlay/overlay.broadcast.tsx';
import { CodePanel } from '../overlay/overlay.code-panel.tsx';
import { Kicker } from '../overlay/overlay.kicker.tsx';
import { NovaFrame } from '../overlay/overlay.frame.tsx';
import { RoundTicker } from '../overlay/overlay.round.tsx';
import { Scoreboard } from '../overlay/overlay.scoreboard.tsx';
import { Telemetry } from '../overlay/overlay.telemetry.tsx';
import { colors, factions } from '../overlay/overlay.tokens.ts';
import { NovaBoard } from '../board/board.tsx';

import { actTwoCues } from './trailer.act-two.cues.ts';
import { colonyRace } from './trailer.recordings.ts';
import { at } from './trailer.timing.ts';

/**
 * Act two — the colony race.
 *
 * The overlay layer here carries the argument the board cannot make on its own:
 * that the hull number ticking down is arithmetic rather than drama, that the
 * fog closing is a consequence rather than a transition, and that the 1,000
 * points are the game's own scoring rather than a graphic. Everything numeric on
 * screen comes out of the world snapshot the board is showing at that moment.
 */
const aurora = factions.aurora;
const borealis = factions.borealis;

/** The line that killed android-3, shown while it is dying. */
const haulerExcerpt = [
  '// aurora-hauler v3',
  '// TODO(v4): read here.composition.acid',
  '//   before stepping.',
  '',
  'if (carried >= 10) {',
  "  ({ type: 'android.move', direction: 'west' });",
  '} else {',
  '  // Straight line east.',
  "  ({ type: 'android.move', direction: 'east' });",
  '}',
].join('\n');

/**
 * The world at a given round of the recording.
 *
 * Throws rather than falling back to an empty world: an out-of-range index means
 * the shot list and the recording have gone out of step, and a scoreboard quietly
 * reading zeroes is the hardest version of that bug to notice.
 */
const frameAt = (index: number): World => {
  const world = colonyRace.frames[index]?.world;
  if (!world) {
    throw new Error(`Act two cues frame ${index}, but trailer-colony-race has ${colonyRace.frames.length} frames`);
  }
  return world;
};

/**
 * android-3's hull, over the three rounds it takes the acid to finish it.
 *
 * The readings are the recording's own arithmetic — 5.2 hull at round 46, then
 * `acid * 0.5` plus 0.1 decay per round end on tiles of acid 2, 3 and 3. Written
 * as data because the point of the beat is the sequence of numbers, and three
 * hand-copied card bodies hide that behind markup.
 */
const hullReadings = [
  { battery: 49, from: 20.4, hold: 2.2, hull: 3.7 },
  { battery: 48, from: 22.6, hold: 2.2, hull: 2.1 },
  { battery: 48, from: 24.8, hold: 2.4, hull: 0.5 },
];

const HullFailure = (): React.ReactNode => (
  <>
    {hullReadings.map((reading) => (
      <Sequence durationInFrames={at(reading.hold)} from={at(reading.from)} key={reading.from}>
        <Telemetry
          accent={aurora.accent}
          cargo="cargo · metal 2"
          glyph={aurora.glyph}
          meters={[
            { max: 100, name: 'Battery', value: reading.battery },
            { accent: colors.warning, max: 100, name: 'Hull', value: reading.hull },
          ]}
          subject="android-3"
          x={1_330}
          y={392}
        />
      </Sequence>
    ))}
  </>
);

const ActTwoOverlay = (): React.ReactNode => (
  <>
    <Sequence durationInFrames={at(5.4)} from={at(1.6)}>
      <Kicker eyebrow="Two colony programmes" lines={['Only one founding', 'colony authority.']} />
    </Sequence>

    {/* Borealis ahead on readiness, so the climax has something to overturn. */}
    <Sequence durationInFrames={at(9)} from={at(7.4)}>
      <Scoreboard from={frameAt(0)} world={frameAt(3)} />
    </Sequence>

    <Sequence durationInFrames={at(4.4)} from={at(9.2)}>
      <Kicker lines={['Extract. Process.', 'Expand.']} place="bottom-right" size={66} />
    </Sequence>

    <Sequence durationInFrames={at(4.2)} from={at(14.4)}>
      <Kicker eyebrow="Nine building types" lines={['Every piece does', 'exactly one job.']} size={62} />
    </Sequence>

    {/* The hazard beat: the bug on the left, the consequence in the meters. */}
    <Sequence durationInFrames={at(7.4)} from={at(19.6)}>
      <CodePanel
        accent={aurora.accent}
        callout={2}
        glyph={aurora.glyph}
        name="aurora-hauler"
        source={haulerExcerpt}
        width={664}
      />
    </Sequence>

    <HullFailure />

    <Sequence durationInFrames={at(4)} from={at(23.8)}>
      <Broadcast
        accent={aurora.accent}
        content="hull integrity failing. acid at 8,7 is deeper than mapped."
        distress
        glyph={aurora.glyph}
        round={53}
        sender="android-3"
        y={806}
      />
    </Sequence>

    <Sequence durationInFrames={at(4.6)} from={at(26.4)}>
      <Kicker lines={['The planet does not', 'forgive bad code.']} place="bottom-right" />
    </Sequence>

    {/* Sabotage: what Aurora loses is not points, it is sight. */}
    <Sequence durationInFrames={at(3.6)} from={at(30.6)}>
      <Broadcast
        accent={borealis.accent}
        content="aurora eye at 5,8 is dark. borealis owns the west approach."
        glyph={borealis.glyph}
        round={55}
        sender="android-4"
        y={806}
      />
    </Sequence>
    <Sequence durationInFrames={at(4.4)} from={at(31.8)}>
      <Kicker eyebrow="Hostile salvage" lines={['They cannot take', 'your ground.', 'Only your eyes.']} size={58} />
    </Sequence>

    <Sequence durationInFrames={at(4.4)} from={at(36.6)}>
      <Kicker
        eyebrow="Acid processing"
        lines={['Or you make the', 'planet survivable.']}
        place="bottom-right"
        size={62}
      />
    </Sequence>

    {/* The climax. The count-up runs the game's own +1,000. */}
    <Sequence durationInFrames={at(9.4)} from={at(42.6)}>
      <Scoreboard countSeconds={1.4} from={frameAt(13)} world={frameAt(14)} />
    </Sequence>
    <Sequence durationInFrames={at(4.8)} from={at(43.4)}>
      <Kicker eyebrow="Colony module · 1,000" lines={['One of you gets', 'to stay.']} />
    </Sequence>

    <Sequence durationInFrames={at(46.4)} from={at(1.4)}>
      <RoundTicker cues={actTwoCues} frames={colonyRace.frames} offset={1.4} />
    </Sequence>
  </>
);

const ActTwo = (): React.ReactNode => (
  <AbsoluteFill>
    <NovaBoard cues={actTwoCues} particleSeed={9_301} recording={colonyRace.recording} />
    <NovaFrame />
    <ActTwoOverlay />
  </AbsoluteFill>
);

export { ActTwo };
