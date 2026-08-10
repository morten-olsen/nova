# Nova CLI Guide

Use the Nova CLI from the root of your Android factory. The CLI changes a game recording (`game.json`); every command that changes the game writes the updated recording back to disk.

## Start a simulation

Create a small fresh world:

```sh
npx nova create-game --file game.json --width 8 --height 8
```

`nova init --file game.json` is kept as a compatibility alias. Use `nova init` without `--file` only to create a new Android factory.

## Upload and launch an Android

Upload a script under a player id. The command prints its script id.

```sh
npx nova upload-script --file game.json --owner player-1 --name starter-builder --script bot/starter-builder.js
npx nova launch-android --file game.json --owner player-1 --script-id script-1
```

An upload creates a new version; an existing Android continues to use its original `scriptId`. Upload a new version and launch another Android to test it. The number of active Androids cannot exceed the owner's completed charger count.

## Run and inspect

Run one or more rounds, then inspect the resulting state:

```sh
npx nova run --file game.json --rounds 10
npx nova status --file game.json
```

Run short batches while developing. `status` reports active Androids, their location and battery, scripts, buildings, and the event count. The full event history and world recording are in `game.json`; it is useful evidence when diagnosing behavior, but it should not be edited by hand.

## A disciplined experiment

1. Create a new game or retain a known recording.
2. Change one behavior in a file in `bot/`.
3. Upload under a descriptive version name.
4. Launch it if capacity is available.
5. Run 5–20 rounds and inspect the result.
6. Keep the change only if the recording supports it.

To restart completely, replace the recording with `npx nova create-game --file game.json`. This does not change your bot files.

## Update the factory

Run `npx nova update` from the factory root to pin all Nova packages to the version of the CLI that ran the command, reinstall them, and refresh the files in `docs/`. It intentionally leaves `bot/` and your `AGENTS.md` unchanged.

## Commands

```text
nova init [factory-folder]
nova create-game --file game.json [--width 16 --height 16]
nova update
nova status --file game.json
nova upload-script --file game.json --owner player-1 --name name --script bot/file.js
nova launch-android --file game.json --owner player-1 --script-id script-1
nova run --file game.json [--rounds 1]
```
