# Project Nova examples

## Starter builder android

`examples/bots/starter-builder.js` is a small rulebook-aware starter android. It uses the script globals:

- `world` — the current world snapshot
- `androidId` — the android executing the script

The android demonstrates the current base ruleset by:

- collecting scattered earth-launched material
- building and finishing a depot
- collecting enough metal for an extra charger
- building and finishing that charger
- recharging when it returns to owned charger infrastructure

Recreate the committed sample recording with:

```sh
pnpm nova init --file examples/games/starter-builder-sample.json --width 6 --height 6
pnpm nova upload-script --file examples/games/starter-builder-sample.json --owner player-1 --name starter-builder --script examples/bots/starter-builder.js
pnpm nova launch-android --file examples/games/starter-builder-sample.json --owner player-1 --script-id script-1
pnpm nova run --file examples/games/starter-builder-sample.json --rounds 35
pnpm nova status --file examples/games/starter-builder-sample.json
```

The committed sample game has run 35 rounds on a 6x6 world.
