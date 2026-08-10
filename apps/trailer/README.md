# Project Nova — store trailer

An ~81 second 1080p trailer for the Steam page, rendered with
[Remotion](https://remotion.dev) against the **real** game renderer.

Nothing here is a mock-up. Both acts are Nova recordings — the same JSON
`nova play` opens — replayed through `@morten-olsen/nova-renderer` one
`advance` per output frame. Every number on screen is read out of the world
snapshot the board is showing at that moment, and the code in the code panel is
the code stored in the recording's `scripts`.

## Commands

Run from the repo root. **Build the workspace first** — the trailer resolves
`@morten-olsen/nova-game` and `@morten-olsen/nova-renderer` through their built
`dist`, the same as any other consumer:

```sh
pnpm build                 # required before any of the below
pnpm trailer:scenarios     # regenerate the recordings into examples/games
pnpm trailer:studio        # Remotion Studio, for scrubbing and retiming
pnpm trailer:render        # apps/trailer/out/nova-trailer.mp4
```

A single frame, which is much faster than a full render when judging a shot:

```sh
cd apps/trailer
pnpm exec remotion still src/nova-trailer.ts nova-trailer out/f1420.png --frame=1420
```

## Compositions

| Id                  | What it is                                                                   |
| ------------------- | ---------------------------------------------------------------------------- |
| `nova-trailer`      | The film. 1920×1080, 30fps, 2439 frames.                                     |
| `nova-board-check`  | Twelve seconds of board, no overlay — for judging the render itself.         |
| `nova-design-check` | Every overlay component at once over a real board, for judging the 2D layer. |

The two check compositions exist for the same reason the renderer has a
`--contact-sheet`: the failure modes that matter are collisions and
inconsistency between elements, which are invisible when you look at one of them
at a time.

## Structure

```
src/
  nova-trailer.ts          Remotion entry (registerRoot)
  trailer-root.tsx         composition registrations
  board/
    board.tsx              the renderer bridge: one advance per output frame
    board.cues.ts          the declarative shot-list vocabulary
    board.timeline.ts      recording -> one world per round
  overlay/                 the 2D layer: kicker, code panel, telemetry,
                           scoreboard, broadcast, round ticker, title, frame
  scenarios/               the recording generators (Node only)
  trailer/
    trailer.tsx            act assembly, the cut, the end card
    trailer.timing.ts      the film's clock
    trailer.act-one.tsx    act one's cues and overlays
    trailer.act-two.cues.ts   act two's shot list
    trailer.act-two.tsx    act two's overlays
```

`src/scenarios` is Node-only (it writes files) and is compiled by
`tsconfig.node.json`; everything else is browser code under
`tsconfig.app.json`. Browser modules import `@morten-olsen/nova-game/browser`,
never the root entry — that one pulls in the script runner, which imports
`node:vm`.

## How the board is driven

`NovaBoard` follows [`docs/PROGRAMMATIC-PLAYBACK.md`](../../docs/PROGRAMMATIC-PLAYBACK.md):
`autoPlay: false`, one `advance(1 / fps)` per frame, stepping forward from the
last frame it drew so animation state stays continuous.

Three consequences are worth knowing before you edit a shot:

- **There is no seek.** A frame is the result of the `advance` calls taken to
  reach it, so rendering frame 2000 alone replays 2000 frames. Stills late in
  the film are slow; this is inherent, not a bug.
- **Concurrency is 1**, set in `remotion.config.ts`. The simulation is
  sequential and cannot be farmed out to parallel tabs.
- **Scrubbing backwards rebuilds the renderer.** Easing has no inverse, so a
  backward seek throws the state away and replays the shot.

## Writing a shot

Shots are cue lists — data, not branches inside a component. `at` is seconds
from the start of the act, so an act can be retimed without touching the one
after it.

```ts
world(12.5, 6); //           cut to round 6 of the recording
camera(11.7, { distance: 5.6, duration: 2.2, position: { x: 5, y: 4 } });
cut(0, { distance: 8.4 }); // snap, no travel
select(20.2, { pieceId: 'android-3', position: { x: 8, y: 7 } });
rounds(6.6, 1, 5, 0.95); //  rounds 1..5, one every 0.95s
```

Two things that are easy to get wrong:

- A held world is not a still board. Energy pulses, the radar sweep, acid
  shimmer and dust all advance on `advance`, so the camera can tour a base for
  ten seconds on one round and the board stays alive. Most of the showcase
  passage in act two does exactly this.
- The reticle marks a **tile**. If the piece it is pointing at moves, re-issue
  `select` or the reticle stays behind.

## The recordings

`pnpm trailer:scenarios` writes two files into `examples/games` and replays each
one through `createBaseRuleset` as it goes. That replay is the point: a
choreographed event stream is only footage of this game if the game accepts it,
so an Android that walks off the map or deposits into something it does not own
fails during generation rather than producing a silently wrong render. The
generator then asserts the beats the shot lists cut to.

| Recording                  | Board | Rounds | What it is                                                                                    |
| -------------------------- | ----- | ------ | --------------------------------------------------------------------------------------------- |
| `trailer-first-light.json` | 12×9  | 0–19   | One Android, one charger, nothing revealed. Walk, collect, build a depot, bank it, broadcast. |
| `trailer-colony-race.json` | 16×12 | 46–66  | Two colonies. An acid death, a sabotaged scanner, and a colony module that completes.         |

Because the shot lists address rounds by index, **changing a recording moves the
beats**. The generator's assertions will still pass — they check the beats
happen, not when — so re-check the shot lists after editing a program. The
tables in `trailer.act-two.cues.ts` and the docblock in `trailer.act-one.tsx`
record which frame each beat lands on.

## Audio

The trailer renders silent. Steam trailers should not ship silent — add a track
and a few stings before publishing:

1. Put the file in `apps/trailer/public/` (Remotion serves that directory).
2. Add `<Audio src={staticFile('music.mp3')} />` inside `Trailer`.
3. Cut the music to the beats already in `trailer.timing.ts`: the dissolve at
   23.3s, the death at ~47s, the sabotage at ~54s, the module completing at
   ~66.5s, and the end card at 72.7s.

## Deliverable

Steam wants an MP4 no larger than 2GB; `remotion.config.ts` renders h264 at
CRF 16, which keeps the engraved grid and dust from turning to mush and lands
far inside that. Upload the 1080p master and let Steam transcode the smaller
sizes.
