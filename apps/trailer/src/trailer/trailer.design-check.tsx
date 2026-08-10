import { AbsoluteFill, Sequence } from 'remotion';

import { Broadcast } from '../overlay/overlay.broadcast.tsx';
import { CodePanel } from '../overlay/overlay.code-panel.tsx';
import { Kicker } from '../overlay/overlay.kicker.tsx';
import { NovaFrame } from '../overlay/overlay.frame.tsx';
import { RoundTicker } from '../overlay/overlay.round.tsx';
import { Scoreboard } from '../overlay/overlay.scoreboard.tsx';
import { Telemetry } from '../overlay/overlay.telemetry.tsx';
import { camera, cut, world } from '../board/board.cues.ts';
import { colors, factions } from '../overlay/overlay.tokens.ts';
import { NovaBoard } from '../board/board.tsx';

import { colonyRace } from './trailer.recordings.ts';

/**
 * Every overlay component at once, over a real board.
 *
 * A contact sheet for the film's 2D layer, in the same spirit as the renderer's
 * `--contact-sheet`: the set has to be judged together, because the failure modes
 * that matter are collisions and inconsistency between cards rather than anything
 * visible in one of them alone. It is also where a missing font shows up, since
 * every text style in the film appears here.
 */
const checkCues = [
  world(0, 14),
  cut(0, { distance: 12, position: { x: 6, y: 6 } }),
  camera(1, { distance: 10, duration: 6 }),
];

const DesignCheck = (): React.ReactNode => {
  const before = colonyRace.frames[13]?.world;
  const after = colonyRace.frames[14]?.world;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.void }}>
      <NovaBoard cues={checkCues} recording={colonyRace.recording} />
      <NovaFrame />
      {after ? <Scoreboard from={before} world={after} /> : null}
      <CodePanel
        accent={factions.aurora.accent}
        callout={2}
        glyph={factions.aurora.glyph}
        name="aurora-hauler"
        source={
          "// aurora-hauler v3 — cross the plain to the east cache field.\n// TODO(v4): read here.composition.acid before stepping.\nconst me = world.androids.find((a) => a.id === androidId);\nconst carried = Object.values(me.cargo ?? {}).reduce((s, n) => s + n, 0);\n\nif (carried >= 10) {\n  ({ type: 'android.move', direction: 'west' });\n}"
        }
        width={660}
      />
      <Telemetry
        accent={factions.aurora.accent}
        cargo="cargo · metal 2"
        glyph={factions.aurora.glyph}
        meters={[
          { max: 100, name: 'Battery', value: 48 },
          { accent: colors.warning, max: 100, name: 'Hull', value: 2.1 },
        ]}
        subject="android-3"
        x={1_310}
        y={560}
      />
      <Broadcast
        accent={factions.aurora.accent}
        content="hull integrity failing. acid at 8,7 is deeper than mapped."
        distress
        glyph={factions.aurora.glyph}
        round={53}
        sender="android-3"
        y={716}
      />
      <RoundTicker cues={checkCues} frames={colonyRace.frames} />
      <Sequence durationInFrames={200} from={40}>
        <Kicker eyebrow="Colony readiness" lines={['The planet does not', 'forgive bad code.']} place="bottom-right" />
      </Sequence>
    </AbsoluteFill>
  );
};

export { DesignCheck };
