"""Generate a deterministic later-stage Project Nova recording for the tabletop renderer."""

from __future__ import annotations

import json
from pathlib import Path

WIDTH = 14
HEIGHT = 12
OUTPUT = Path(__file__).with_name("later-stage-tabletop-sample.json")


def materials(**values: int) -> dict[str, int]:
    return values


def tile(x: int, y: int) -> dict:
    composition = {
        "ore": 2 + (x * 3 + y) % 4 if (x + y) % 3 == 0 else 0,
        "water": 1 + (x + y) % 3 if (x * 2 + y) % 7 == 0 else 0,
        "acid": 1 + (x + y) % 2 if (x * 5 + y) % 11 == 0 else 0,
        "radiation": 1 if (x * 7 + y * 3) % 19 == 0 else 0,
    }
    scattered: dict[str, int] = {"metal": 0}
    if (x * 5 + y * 7) % 13 == 0:
        scattered = materials(metal=2 + (x + y) % 3, electronics=(x + y) % 2, polymer=1 + x % 2)
    if (x, y) == (5, 5):
        scattered = materials(ore=5, metal=2)
    if (x, y) == (3, 8):
        scattered = materials(acidCanister=3, polymer=1)
    if (x, y) == (10, 3):
        scattered = materials(electronics=3, metal=1)
    return {"position": {"x": x, "y": y}, "composition": composition, "scattered": scattered}


def building(
    identifier: int,
    owner: str,
    kind: str,
    x: int,
    y: int,
    *,
    initial: bool = False,
    ticks: int = 0,
    storage: dict[str, int] | None = None,
) -> dict:
    result = {
        "id": f"building-{identifier}",
        "ownerId": owner,
        "type": kind,
        "position": {"x": x, "y": y},
        "health": 100,
        "initial": initial,
        "remainingConstruction": {"ticks": ticks, "resources": {}},
    }
    if storage is not None:
        result["storage"] = storage
    return result


def android(identifier: int, owner: str, x: int, y: int, battery: int) -> dict:
    return {
        "id": f"android-{identifier}",
        "ownerId": owner,
        "scriptId": f"script-{1 if owner == 'player-aurora' else 2}",
        "position": {"x": x, "y": y},
        "battery": battery,
        "health": 92,
        "active": True,
        "cargo": materials(metal=1, electronics=0, polymer=0),
    }


def main() -> None:
    player_one = "player-aurora"
    player_two = "player-borealis"
    buildings = [
        building(1, player_one, "charger", 2, 2, initial=True),
        building(2, player_one, "depot", 4, 2, storage=materials(metal=18, electronics=5, polymer=4, ore=6)),
        building(3, player_one, "charger", 5, 3),
        building(4, player_one, "scanner", 6, 2),
        building(5, player_one, "extractor", 6, 4, storage=materials(ore=8, water=2)),
        building(6, player_one, "processor", 7, 4, storage=materials(ore=5, metal=4)),
        building(7, player_one, "acid-processing-plant", 3, 7, storage=materials(acidCanister=5)),
        building(8, player_one, "relay-tower", 9, 3),
        building(9, player_one, "colony-module", 8, 7, ticks=4),
        building(10, player_two, "charger", 11, 9, initial=True),
        building(11, player_two, "depot", 9, 9, storage=materials(metal=12, electronics=4, polymer=2)),
        building(12, player_two, "charger", 10, 7),
        building(13, player_two, "extractor", 10, 5, storage=materials(ore=7, water=1)),
        building(14, player_two, "processor", 11, 5, storage=materials(ore=3, metal=5)),
    ]
    initial_world = {
        "scripts": [
            {"id": "script-1", "ownerId": player_one, "name": "aurora-logistics", "content": "({ type: 'android.wait' })"},
            {"id": "script-2", "ownerId": player_two, "name": "borealis-miner", "content": "({ type: 'android.wait' })"},
        ],
        "tiles": [tile(x, y) for y in range(HEIGHT) for x in range(WIDTH)],
        "androids": [
            android(1, player_one, 4, 2, 85),
            android(2, player_one, 5, 5, 63),
            android(3, player_one, 8, 6, 72),
            android(4, player_two, 9, 9, 76),
            android(5, player_two, 10, 3, 58),
            android(6, player_two, 11, 5, 89),
        ],
        "buildings": buildings,
        "players": [{"id": player_one, "name": "Aurora Combine"}, {"id": player_two, "name": "Borealis Works"}],
        "messages": [
            {
                "id": "message-1",
                "ownerId": player_one,
                "senderAndroidId": "android-3",
                "position": {"x": 8, "y": 6},
                "content": "Colony module construction entering final phase.",
                "round": 82,
            },
            {
                "id": "message-2",
                "ownerId": player_two,
                "senderAndroidId": "android-5",
                "position": {"x": 10, "y": 3},
                "content": "Electronics cache located near the northern relay.",
                "round": 82,
            },
        ],
        "round": 82,
    }
    events = [
        {"type": "game.round-start"},
        {"type": "android.move", "androidId": "android-1", "direction": "east"},
        {"type": "android.move", "androidId": "android-2", "direction": "north"},
        {"type": "android.move", "androidId": "android-3", "direction": "east"},
        {"type": "android.move", "androidId": "android-4", "direction": "north"},
        {"type": "android.move", "androidId": "android-5", "direction": "west"},
        {"type": "android.move", "androidId": "android-6", "direction": "south"},
        {"type": "game.round-end"},
        {"type": "game.round-start"},
        {"type": "android.move", "androidId": "android-1", "direction": "south"},
        {"type": "android.move", "androidId": "android-2", "direction": "east"},
        {"type": "android.move", "androidId": "android-3", "direction": "north"},
        {"type": "android.move", "androidId": "android-4", "direction": "west"},
        {"type": "android.move", "androidId": "android-5", "direction": "south"},
        {"type": "android.move", "androidId": "android-6", "direction": "west"},
        {"type": "game.round-end"},
    ]
    recording = {"version": 1, "initialWorld": initial_world, "events": events}
    OUTPUT.write_text(json.dumps(recording, indent=2) + "\n")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
