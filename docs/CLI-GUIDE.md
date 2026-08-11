# Nova CLI Guide

Use the Nova CLI from the root of your Android factory. The CLI changes a game recording (`game.json`); every command that changes the game writes the updated recording back to disk.

## Start a simulation

Create a small fresh world:

```sh
npx nova create-game --file game.json --width 8 --height 8
```

`nova init --file game.json` is kept as a compatibility alias. Use `nova init` without `--file` only to create a new Android factory.

### Change the rules

Every number in the game is a rule, and `--rules` takes a JSON file holding any
subset of them. Everything left out keeps its default, so this is a complete
rules file:

```jsonc
// rules.json
{
  "android": { "cargoCapacity": 4 },
  "buildings": { "depot": { "cost": { "metal": 4 }, "ticks": 1 } },
}
```

```sh
npx nova create-game --file game.json --rules rules.json
```

The resolved rules are stored in `game.json`, so `run`, `status` and `play` all
continue and score the game under the same numbers, and an Android reads them at
run time from the `rules` global. `--width` and `--height` are the same two rules
on the command line, and win over a `world` block in the file when given.

See [the rules](RULEBOOK.md#18-rules) for the groups and what each covers.

## Upload and launch an Android

Upload a script under a player id. The command prints its script id.

```sh
npx nova upload-script --file game.json --owner player-1 --name starter-builder --script bot/starter-builder.ts
npx nova launch-android --file game.json --owner player-1 --script-id script-1
```

An upload creates a new version; an existing Android continues to use its original `scriptId`. Upload a new version and launch another Android to test it. The number of active Androids cannot exceed the owner's completed charger count.

`upload-script` compiles and bundles the file it is given, so an Android is written as a normal TypeScript project: point it at the entry file, and every module that entry imports is followed and folded into the script that is uploaded. The entry must default-export its turn function — that is the whole contract, and it does not change when the Android grows a second file. `npm run check` type-checks `bot/` without playing a game, and `docs/ANDROID-BUILDER-MANUAL.md` has the details.

## Run and inspect

Run one or more rounds, then inspect the resulting state:

```sh
npx nova run --file game.json --rounds 10
npx nova status --file game.json
npx nova play --file game.json
```

`play` starts a local replay server on a random port, opens the current recording in your browser, and keeps running until you press Ctrl+C. It bundles the replay interface with the Nova CLI, so no separate web app or file upload is needed.

Run short batches while developing. `status` reports active Androids, their location and battery, scripts, buildings, the event count, and a per-player colony-readiness score with its contributors. Readiness only counts completed infrastructure and material secured in completed buildings; exploration, scanners, radars, relay towers, loose material, scripts, and Androids have no direct score. The full event history and world recording are in `game.json`; it is useful evidence when diagnosing behavior, but it should not be edited by hand.

`play` shows the same live readiness ranking and breakdown for the selected replay frame, scored under the recording's own rules. See [the colony-readiness rules](RULEBOOK.md#16-colony-readiness-score) for the default point values.

## Play another player

`host` and `join` put one Android against another over a peer-to-peer
connection. One player hosts:

```sh
npx nova host --script bot/starter-builder.ts --rounds 20 --disclosure full
```

`host` prints an invite code and waits. The other player joins with it:

```sh
npx nova join YF4D4-MGZKE --script bot/starter-builder.ts
```

The code can be typed with or without the dash and in any case. Before anything
is sent, the joining player is shown the host's name, the round count, the world
size and the disclosure mode, and is asked to accept. Pass `--yes` to accept
without the prompt, and `--name` on either side to choose the name the other
player sees.

The host runs the simulation for both Androids, so both scripts execute on the
host's machine. Only host a match with someone you are willing to run code from.

Both players start with one Android and one initial charger, placed in opposite
corners. Each Android sees only what its own sight reaches, exactly as in a
single-player game.

A match is played under the host's rules, and the recording each player keeps
carries them, so a replay is scored as the match was. The board size is currently
the only rule the offer negotiates — `--rules` applies to `create-game`, not to
`host`.

### Disclosure

The host chooses what evidence both players keep when the match ends. Both
players are treated the same way; hosting is not an information advantage.

| `--disclosure` | What each player receives                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full`         | A replayable recording of the whole match: both Androids, every round, and every action either took. The other player's script source and their Androids' `memory` and `recording` are `[Redacted]`. |
| `recording`    | Only what that player's own Android wrote to its `recording` field, plus the final scores. No replay, and nothing about how the opponent played.                                                     |

`full` is the default and the right choice while learning: both players can
replay the match and watch what the other Android actually did, one round at a
time. What it did is disclosed; how it decided is not. A script is never handed
to an opponent, so a match cannot be used to harvest someone else's code. See
[visibility and information](RULEBOOK.md#14-visibility-and-information) for the
exact fields.

`recording` is the competitive mode, and it changes how an Android should be
written. What the Android chose to write down is the player's whole account of
the match, so a competitive Android should record deliberately. A rejected action
is discarded in full, including its `recording` write, so a failed turn leaves no
note behind.

Results are written to `match.json` under `full` and `match-recording.json`
under `recording`; use `--out` to choose the path. A match needs internet access
on both sides: Nova uses the public PeerJS signalling service to introduce the
two peers, after which the game data goes directly between them.

## A disciplined experiment

1. Create a new game or retain a known recording.
2. Change one behavior in a file in `bot/`.
3. Upload under a descriptive version name.
4. Launch it if capacity is available.
5. Run 5–20 rounds and inspect the result.
6. Keep the change only if the recording supports it.

To restart completely, replace the recording with `npx nova create-game --file game.json`. This does not change your bot files.

## Update the factory

Run `npx nova update` from the factory root to pin all Nova packages to the version of the CLI that ran the command, reinstall them, and refresh the files in `docs/`. A factory that predates TypeScript Androids also gets a `tsconfig.json`; an existing one is left as you tuned it, as are `bot/` and your `AGENTS.md`.

## Commands

```text
nova init [factory-folder]
nova create-game --file game.json [--width 16 --height 16] [--rules rules.json]
nova update
nova status --file game.json
nova upload-script --file game.json --owner player-1 --name name --script bot/file.ts
nova launch-android --file game.json --owner player-1 --script-id script-1
nova run --file game.json [--rounds 1]
nova play --file game.json
nova host --script bot/file.ts [--rounds 20] [--disclosure full|recording] [--width 16 --height 16] [--name alice] [--out match.json]
nova join <invite-code> --script bot/file.ts [--name bob] [--yes] [--out match.json]
```
