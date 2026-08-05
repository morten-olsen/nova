# Project: Nova

**Use coding agents to program the machines that will decide humanity’s next home.**

Humanity has found a new planet: resource-rich, unexplored, and hostile to human life. The colony fleet is coming, but humans cannot land until the world has been prepared.

So we send androids first.

In **Project: Nova**, you do not click units around a map. You design autonomous android behavior with the help of coding agents, launch those androids into a simulated world, and study what they actually did. Your machines begin as scavengers, but the game is not just about picking up loose metal. Over time they must build and maintain infrastructure, exploit natural resources, clean hazards, coordinate logistics, broadcast information, pressure rivals, and prepare a colony claim strong enough for humanity to accept.

You are not expected to hand-write a perfect, complex android brain from scratch.

You are expected to work like a strategist-engineer: describe intent, ask a coding agent to help implement behavior, run the simulation, inspect failures, and guide the next version.

## The pitch

Project: Nova is a programming strategy game about evolving autonomous systems.

Early androids might only know how to:

- scout nearby terrain
- collect scattered earth-launched material
- avoid obvious hazards
- return to charge
- build a first depot or charger

But a serious colony program needs much more. As the simulation develops, androids need increasingly strategic reasoning:

- Where should the first real base be established?
- Which chargers are critical to android capacity?
- When should a depot become a logistics hub?
- Which natural resource deposits justify extractors and processors?
- Should acid be cleaned, avoided, exploited, or used as a defensive boundary?
- When should an android salvage an enemy building instead of expanding your own base?
- What information is safe to broadcast publicly?
- When does helping another player stop a leader become a betrayal risk?
- How do you keep infrastructure useful after the local scavenging phase is over?

The game starts with scavenging. It grows into infrastructure planning, resource economics, environmental preparation, communication strategy, sabotage, and colony positioning.

## Not a hand-coding contest

Project: Nova is intentionally built for a world where players use coding agents.

You can write androids by hand if you want, but that is not the expected path for complex play. The intended workflow is closer to:

1. Decide what strategic behavior you want.
2. Ask a coding agent to help implement or revise the android script.
3. Run the game.
4. Inspect the replay, events, messages, and world state.
5. Identify where the behavior failed.
6. Ask for a better version.

The challenge is not typing every branch manually. The challenge is asking for the right behavior, recognizing bad assumptions, and improving strategy through simulation evidence.

A coding agent can help write the android. It cannot decide what kind of colony program you are trying to build.

## The core loop

1. Write or generate an android script.
2. Upload it as a script version.
3. Launch androids using charger capacity.
4. Run the simulation.
5. Inspect what happened.
6. Improve the script and deploy the next version.

A tiny android script looks like this:

```js
/* global androidId, world */
(() => {
  const android = world.androids.find((candidate) => candidate.id === androidId);

  if (!android) {
    return { type: 'android.wait' };
  }

  return { type: 'android.move', direction: 'east' };
})();
```

That script is not impressive. That is the point. Your first android may be dumb. Then it becomes a scavenger. Then a builder. Then a logistician. Then a hazard-cleanup specialist. Then part of a multi-android colony program that can respond to rivals.

## Evolving gameplay

Project: Nova is designed around phases that blend into each other.

### 1. Scavenge and survive

At the start, androids search for scattered material launched from Earth. They need enough metal and components to bootstrap infrastructure while avoiding acid, radiation, dead ends, and battery failure.

### 2. Build capacity

Chargers increase android capacity. More chargers mean more active androids, but chargers are also strategic targets. Losing non-initial chargers reduces future launch capacity, so placement and protection matter.

### 3. Organize logistics

Depots, cargo limits, travel time, and charging needs turn simple collection into a logistics problem. Androids must decide where to store resources, when to return, and how to keep construction supplied.

### 4. Exploit the planet

Scattered material is only the opening economy. Natural tile composition such as ore, water, and acid requires extractors, processors, and specialized infrastructure. A strong player transitions from scavenging to production.

### 5. Prepare the environment

The planet is hostile. Acid damages androids, but acid processing plants allow androids to clean adjacent tiles and store acid as processed material. Environmental preparation is part of making the planet suitable for humans.

### 6. Communicate, cooperate, and deceive

Broadcasts are public. Androids can use messages for coordination, warnings, claims, negotiation, or deception. There are no formal alliances. Cooperation is possible, but never guaranteed by the rules.

### 7. Disrupt or defend

Players compete for one colony claim. Androids can salvage infrastructure, pressure rivals, deny resources, and interfere with expansion. Conflict is not just combat; it is logistics disruption, map pressure, and strategic timing.

### 8. Claim the future

The long-term goal is to prepare the best colony site before the human fleet arrives: infrastructure, resources, explored territory, environmental cleanup, and resilience against interference.

## What androids can do today

The current local ruleset already supports a playable automation loop:

- explore a randomized tile world
- collect scattered earth-launched material
- carry limited cargo
- build chargers, depots, extractors, processors, scanners, acid processing plants, and colony modules
- use chargers to increase android capacity and restore battery
- extract natural resources from tile composition
- process ore into metal
- broadcast public messages
- salvage buildings, including hostile infrastructure
- take damage from acid and radiation
- clean adjacent acid tiles after building an acid processing plant

The full player-facing rules live in [`RULEBOOK.md`](./RULEBOOK.md).

## Try it locally

Install dependencies, then generate and run a sample game:

```sh
pnpm install
pnpm nova init --file game.json --width 6 --height 6
pnpm nova upload-script --file game.json --owner player-1 --name starter-builder --script examples/bots/starter-builder.js
pnpm nova launch-android --file game.json --owner player-1 --script-id script-1
pnpm nova run --file game.json --rounds 35
pnpm nova status --file game.json
```

There is also a committed sample recording:

```sh
examples/games/starter-builder-sample.json
```

Launch the visualizer:

```sh
pnpm dev:web
```

Then upload a generated or sample recording and scrub through the event history.

## Project status

Project: Nova is early, local-first, and actively evolving.

Current pieces:

- TypeScript simulation engine
- event-based game recordings
- CLI for creating, running, and inspecting games
- example android scripts
- sample recordings
- browser visualizer for replay inspection
- evolving player rulebook

Not yet implemented:

- final colony-readiness scoring
- fleet-arrival endgame
- restricted competitive fog-of-war
- richer multiplayer flow
- direct combat and defensive systems

## Long-term vision

The destination is a shared programming strategy game where multiple players deploy autonomous androids to the same hostile planet.

The winner will not simply be the player with the most units or the fastest scavenger. It will be the player whose android program best transforms a hostile world into a viable human foothold: infrastructure, logistics, resource production, exploration, environmental cleanup, public signaling, sabotage resistance, and timely pressure against rivals.

Build the machines. Run the world. Study the failures. Ask your coding agent for better behavior. Launch again.
