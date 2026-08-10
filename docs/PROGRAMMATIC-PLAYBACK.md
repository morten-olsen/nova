# Driving the Nova player programmatically

This is the reference for controlling the tabletop renderer from code rather than
from the viewer UI — recording demo videos with Remotion, generating stills, or
building a custom player. Everything here is exported from
`@morten-olsen/nova-renderer`.

The interactive viewer in `apps/web` uses the same API; nothing below is a
capture-only side path.

## Contents

- [Creating a renderer](#creating-a-renderer)
- [Feeding it world state](#feeding-it-world-state)
- [Frame-accurate stepping](#frame-accurate-stepping)
- [Camera control](#camera-control)
- [Selection and highlighting](#selection-and-highlighting)
- [Determinism](#determinism)
- [Worked Remotion example](#worked-remotion-example)

## Creating a renderer

```ts
import { createTabletopRenderer } from '@morten-olsen/nova-renderer';

const renderer = createTabletopRenderer(hostElement, {
  autoPlay: false,
  fogOfWar: true,
  particleSeed: 1234,
});
```

| Option         | Default | Purpose                                                                               |
| -------------- | ------- | ------------------------------------------------------------------------------------- |
| `autoPlay`     | `true`  | Run an internal `requestAnimationFrame` loop. **Set `false` for capture.**            |
| `fogOfWar`     | —       | Whether this recording uses fog. See [the fog caveat](#the-fog-flag-is-not-optional). |
| `particleSeed` | fixed   | Seed for particle motion. Change only if you want different dust.                     |
| `onTileClick`  | —       | Board click callback. Not needed for capture.                                         |

The renderer sizes itself to the host element and observes it for resizes, so
give the host explicit dimensions before creating it.

Call `renderer.dispose()` when finished; it releases the WebGL context.

### The fog flag is not optional

`fogOfWar` must be decided from the **whole recording**, not from the frame you
are about to render. Tiles are revealed at round end, so the opening frame of a
real game has nothing revealed — and a renderer left to infer fog per frame
cannot tell that apart from a recording that predates fog. Get it wrong and fog
switches off exactly when the board should be fully dark.

```ts
const fogOfWar = frames.some((frame) => frame.world.tiles.some((tile) => (tile.revealedBy?.length ?? 0) > 0));
```

Note also that visibility is **current line of sight, not permanent discovery**:
ground goes dark again once nothing of that player's is in range. Fog reveal and
re-fog animate per tile, so give them time to settle (see below).

## Feeding it world state

```ts
renderer.setWorld(world);
```

`setWorld` is the only state input. Call it whenever the world changes; the
renderer diffs against what it is showing and animates the difference — pieces
that appeared drop in, pieces that vanished sink out, pieces that moved travel to
their new tile.

To build the per-round worlds from a recording, replay its events through the
ruleset:

```ts
import { createBaseRuleset } from '@morten-olsen/nova-game';

const ruleset = createBaseRuleset();
let world = structuredClone(recording.initialWorld);
const frames = [world];

for (const event of recording.events) {
  world = ruleset.applyEvents(world, [event]);
  if (event.type === 'game.round-end') {
    frames.push(world);
  }
}
```

The first call to `setWorld` also frames the camera to the board.

## Frame-accurate stepping

With `autoPlay: false` the renderer draws one frame at creation and then only
when you ask:

```ts
renderer.advance(1 / 30); // step 1/30s of animation and render exactly one frame
```

`advance` steps **everything** — piece motion, fog reveal, hazard shimmer,
particles, camera moves — and renders once. Call it once per output frame.

Two consequences worth planning around:

1. **Animations need wall-clock time to settle.** A piece takes ~0.42s to land, a
   camera move defaults to 0.9s, and fog eases over roughly a second. If you call
   `setWorld` and immediately grab one frame, you capture the animation's first
   instant. Step for as long as you want the transition to read:

   ```ts
   renderer.setWorld(frames[roundIndex]);
   for (let frame = 0; frame < fps * 1.5; frame += 1) {
     renderer.advance(1 / fps);
     await capture();
   }
   ```

2. **The delta is a duration, not a timestamp.** Pass `1 / fps`, not an absolute
   time. Negative or oversized deltas are clamped, because every easing is of the
   form `1 - exp(-k * delta)` and a negative delta would invert it.

There is no absolute seek. The simulation is stateful — piece positions ease
toward targets, fog eases per tile — so a frame is a function of the steps taken
to reach it, not of a clock value. Render sequentially within a shot.

## Camera control

```ts
renderer.moveCamera({ position: { x: 5, y: 3 }, distance: 6, duration: 1.2 });
renderer.resetCamera(0.8);
```

| Method                | Purpose                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `moveCamera(move)`    | Ease to centre a tile and/or change zoom.                                   |
| `resetCamera(secs?)`  | Ease back to framing the whole board.                                       |
| `getCameraDistance()` | Current distance to the target, in tile units.                              |
| `getCameraFraming()`  | `{ boardDistance, minimumDistance, maximumDistance }` for building zoom UI. |

`CameraMove` fields, all optional:

- `position` — tile to centre on. Omitted keeps the current centre, so you can
  zoom without panning.
- `distance` — distance from the target in tile units; smaller is closer. Clamped
  to the framing limits. Omitted keeps the current zoom, so you can pan without
  zooming.
- `duration` — seconds to ease over, default `0.9`. `0` snaps immediately.

Moves ease in and out, and advance on the same delta as everything else, so a
stepped render traces exactly the path live playback would. The camera looks at
the board from a fixed three-quarter angle — orbit is deliberately disabled, since
pieces have a designed front — so `moveCamera` changes _where_ and _how close_,
never the angle.

A move in flight owns the camera; once it completes, panning and scroll-zoom work
normally again.

### Composing a shot

```ts
// Establish on the whole board, then push in on the colony.
renderer.resetCamera(0);
await step(fps * 1.0);
renderer.moveCamera({ position: colony.position, distance: 5, duration: 2.0 });
await step(fps * 2.0);
```

Zoom by a factor rather than an absolute distance when you want to feel relative:

```ts
renderer.moveCamera({ distance: renderer.getCameraDistance() / 1.35, duration: 0.35 });
```

## Selection and highlighting

```ts
renderer.setSelection({ position: { x: 5, y: 3 }, pieceId: android.id });
renderer.setSelection({}); // clear
```

`position` places the on-board reticle; `pieceId` raises that piece slightly.
Both are optional and independent — highlight a tile without picking a piece, or
call attention to a piece by passing both. Useful for pointing at what a video's
narration is describing.

## Determinism

Given the same sequence of calls, two renders produce the same frames:

- particle motion uses a seeded PRNG, not `Math.random`
- terrain, rock scatter, and dust are generated from coherent noise seeded by
  board coordinates
- all animation advances on the deltas you pass in, never on wall-clock time

So a shot re-rendered later — or a chunk rendered on another machine — matches, as
long as the call sequence matches. Chunked renders that each start from a fresh
renderer will differ in mid-flight animation state at the chunk boundary; render a
continuous shot in one pass, or start chunks at moments where nothing is moving.

## Worked Remotion example

```tsx
import { createTabletopRenderer, type TabletopRenderer } from '@morten-olsen/nova-renderer';
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { useEffect, useRef } from 'react';

export const NovaBoard = ({ frames, fogOfWar }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TabletopRenderer | null>(null);
  const lastFrame = useRef(-1);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const renderer = createTabletopRenderer(host, { autoPlay: false, fogOfWar });
    renderer.setWorld(frames[0]);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [fogOfWar, frames]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) {
      return;
    }
    const handle = delayRender();
    // Step from wherever we were to this frame, so animation state is continuous.
    for (let at = lastFrame.current + 1; at <= frame; at += 1) {
      const round = Math.floor(at / (fps * 2));
      if (round !== Math.floor((at - 1) / (fps * 2))) {
        renderer.setWorld(frames[Math.min(round, frames.length - 1)]);
      }
      renderer.advance(1 / fps);
    }
    lastFrame.current = frame;
    continueRender(handle);
  }, [fps, frame, frames]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
};
```

Points to note:

- `autoPlay: false`, and one `advance(1 / fps)` per video frame.
- Stepping catches up from the last rendered frame, so animation state stays
  continuous even if Remotion skips ahead.
- One renderer per composition instance; dispose it on unmount.
- Use Remotion's concurrency of 1 per browser tab for a shot, since the
  simulation is sequential.

## Related documents

- [`visual-design.md`](./visual-design.md) — the visual language, motion rules,
  and what the board is meant to communicate.
- [`RULEBOOK.md`](./RULEBOOK.md) — game rules, including how visibility works.
- [`CLI-GUIDE.md`](./CLI-GUIDE.md) — `nova play` and recording files.
