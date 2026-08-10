import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';

import { Broadcast } from '../overlay/overlay.broadcast.tsx';
import { CodePanel } from '../overlay/overlay.code-panel.tsx';
import { Kicker } from '../overlay/overlay.kicker.tsx';
import { NovaFrame } from '../overlay/overlay.frame.tsx';
import { RoundTicker } from '../overlay/overlay.round.tsx';
import { Telemetry } from '../overlay/overlay.telemetry.tsx';
import { camera, clearSelection, cut, rounds, select, world, type BoardCue } from '../board/board.cues.ts';
import { colors, factions } from '../overlay/overlay.tokens.ts';
import { NovaBoard } from '../board/board.tsx';

import { firstLight } from './trailer.recordings.ts';
import { at } from './trailer.timing.ts';

/**
 * Act one — first light.
 *
 * The opening has one job: establish that nobody is driving. So it opens on a
 * board that is genuinely dark rather than atmospherically dim, puts a script on
 * screen before it puts a piece on screen, and then lets the game's own fog
 * mechanic open around one walking Android. Every world index below is a round
 * that exists in `trailer-first-light.json`; the beats are the ones the generator
 * asserts, so the shot list cannot drift from the recording.
 *
 * Frames: 0 dark · 1-5 the walk · 6 collect · 8 site appears · 10 depot done ·
 * 11 deposit · 15 second haul · 19 walking on.
 */
const actOneCues: BoardCue[] = [
  world(0, 0),
  // Close and low in the dark, so the first thing with a shape is the charger.
  cut(0, { distance: 8.4, position: { x: 2, y: 6 } }),
  camera(0.3, { distance: 6.6, duration: 7, position: { x: 2.7, y: 5.6 } }),

  // The walk. Pull back as it goes, so the revealed ground opens into frame.
  camera(6.6, { distance: 9.4, duration: 5, position: { x: 4, y: 5 } }),
  ...rounds(6.6, 1, 5, 0.95),

  // The find.
  camera(11.7, { distance: 5.6, duration: 2.2, position: { x: 5, y: 4 } }),
  select(11.9, { position: { x: 5, y: 4 } }),
  world(12.5, 6),
  clearSelection(14.2),

  // The build: site, then finished depot, then the material going in.
  camera(14.4, { distance: 7.4, duration: 2, position: { x: 5, y: 4.8 } }),
  world(15.0, 8),
  world(17.0, 10),
  select(17.3, { pieceId: 'building-2', position: { x: 5, y: 5 } }),
  world(19.0, 11),
  clearSelection(20.0),

  // Out far enough to hold the charger and the new depot in one frame: act one's
  // accomplishment, and a better image to dissolve out of than an empty wide.
  camera(20.2, { distance: 9.6, duration: 3.2, position: { x: 3.8, y: 5.4 } }),
  world(21.4, 15),
  world(22.8, 19),
];

/**
 * The opening lines of the script that is about to run, typed out.
 *
 * Wrapped to stay inside the panel: the code layer never wraps a line, so a long
 * one is clipped mid-token, and a clipped line is a line the viewer cannot read.
 */
const prospectorExcerpt = [
  '// aurora-prospector v2',
  'const me = world.androids',
  '  .find((a) => a.id === androidId);',
  'const here = tileAt(me.position);',
  'const loose = total(here.scattered);',
  '',
  'if (loose > 0 && carried < 10) {',
  "  ({ type: 'android.collect' });",
  '} else {',
  "  ({ type: 'android.move', direction: 'east' });",
  '}',
].join('\n');

/** Fades the board up out of black. The first second and a half is almost nothing. */
const OpeningFade = (): React.ReactNode => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, at(1.9)], [1, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: '#000000', opacity, pointerEvents: 'none' }} />;
};

const ActOne = (): React.ReactNode => (
  <AbsoluteFill>
    <NovaBoard cues={actOneCues} recording={firstLight.recording} />
    <NovaFrame />
    <OpeningFade />

    <Sequence durationInFrames={at(6.8)} from={at(0.7)}>
      <CodePanel
        accent={factions.aurora.accent}
        glyph={factions.aurora.glyph}
        name="aurora-prospector"
        source={prospectorExcerpt}
        width={676}
      />
    </Sequence>

    <Sequence durationInFrames={at(4.6)} from={at(2.6)}>
      <Kicker eyebrow="Cycle 001 · surface" lines={['You will never', 'set foot here.']} />
    </Sequence>

    <Sequence durationInFrames={at(5.2)} from={at(8.2)}>
      <Kicker lines={['Your androids', 'go instead.']} />
    </Sequence>

    <Sequence durationInFrames={at(3.2)} from={at(12.2)}>
      <Telemetry
        accent={factions.aurora.accent}
        cargo="cargo · metal 8 · electronics 2"
        glyph={factions.aurora.glyph}
        meters={[
          { max: 100, name: 'Battery', value: 95 },
          { accent: colors.acid, max: 100, name: 'Hull', value: 99.4 },
        ]}
        subject="android-1"
        x={1_286}
        y={330}
      />
    </Sequence>

    <Sequence durationInFrames={at(4.6)} from={at(14.8)}>
      <Kicker eyebrow="Android action api" lines={['They only do', 'what you wrote.']} place="bottom-right" />
    </Sequence>

    <Sequence durationInFrames={at(3.8)} from={at(19.7)}>
      <Broadcast
        accent={factions.aurora.accent}
        content="pod field at 5,4 — metal confirmed. depot up at 5,5."
        glyph={factions.aurora.glyph}
        round={12}
        sender="android-1"
      />
    </Sequence>

    <Sequence durationInFrames={at(17.2)} from={at(6.4)}>
      <RoundTicker cues={actOneCues} frames={firstLight.frames} offset={6.4} />
    </Sequence>
  </AbsoluteFill>
);

export { ActOne, actOneCues };
