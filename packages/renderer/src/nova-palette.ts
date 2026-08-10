import type { World } from '@morten-olsen/nova-game';

/**
 * The single source of truth for Project Nova's colour language. The renderer
 * reads these as three.js colours and the web UI mirrors them as CSS custom
 * properties, so a piece on the board and its row in the scoreboard can never
 * disagree about who owns what.
 */
const novaPalette = {
  /** Page and deep-space background. */
  void: '#050816',
  /** Unrevealed ground: cold, flat, and deliberately joyless. */
  fog: '#070b18',
  /** Neutral terrain and panel base. */
  board: '#1f2937',
  /** Plinths, seams, inactive hardware. */
  structureDark: '#334155',
  /** Exposed panels and readable edges. */
  structureLight: '#94a3b8',
  /** Chargers and active processing. */
  energy: '#fbbf24',
  /** Acid and cleanup systems. */
  acid: '#a3e635',
  /** Ore and extraction. */
  ore: '#fb923c',
  /** Danger, damage, and invalid actions. */
  warning: '#fb7185',
  /** System/UI accent. Never used to identify a player. */
  system: '#38bdf8',
} as const;

/**
 * Regolith ramp, sampled low-to-high by the terrain noise. Deliberately
 * desaturated and slightly cool so the warm ceramic pieces read against it —
 * the previous tan was close enough to the hulls to flatten both.
 */
const novaTerrain = {
  shadow: '#2a2018',
  low: '#4a3a2c',
  mid: '#7d6449',
  high: '#a58a68',
  /** Cool violet-grey mineral streaks that break up the ochre. */
  mineral: '#454055',
  /** Engraved tile grid, cool against the warm ground. */
  grid: '#7c8ca8',
} as const;

type NovaFaction = {
  /** Owner accent, applied to the `FactionAccent` material and UI chrome. */
  accent: string;
  /**
   * Paired with the accent everywhere it appears. Colour alone must never carry
   * ownership, per the visual design rules.
   */
  glyph: string;
  name: string;
};

/**
 * Hues are spaced to stay clear of the semantic colours above — nothing here
 * sits near acid lime, ore orange, energy amber, or warning coral, so a faction
 * accent can never be mistaken for a hazard read.
 */
const novaFactions: readonly NovaFaction[] = [
  { accent: '#38bdf8', glyph: '◆', name: 'cyan' },
  { accent: '#e879f9', glyph: '●', name: 'fuchsia' },
  { accent: '#34d399', glyph: '▲', name: 'emerald' },
  { accent: '#818cf8', glyph: '■', name: 'indigo' },
  { accent: '#f472b6', glyph: '◇', name: 'pink' },
  { accent: '#2dd4bf', glyph: '▼', name: 'teal' },
];

const hashOwnerId = (ownerId: string): number => {
  let value = 0;
  for (const character of ownerId) {
    value = (value * 31 + character.charCodeAt(0)) >>> 0;
  }
  return value;
};

/**
 * Prefer the player's seat order so factions read left-to-right in the same
 * order the scoreboard lists them, and fall back to a stable hash for worlds
 * recorded before `players` existed.
 */
const getFactionIndex = (world: World, ownerId: string): number => {
  const seat = world.players?.findIndex((player) => player.id === ownerId) ?? -1;
  const index = seat >= 0 ? seat : hashOwnerId(ownerId);
  return index % novaFactions.length;
};

const getFaction = (world: World, ownerId: string): NovaFaction => {
  const faction = novaFactions[getFactionIndex(world, ownerId)];
  if (!faction) {
    throw new Error('Nova faction palette is empty');
  }
  return faction;
};

/** Converts a `#rrggbb` token into the numeric form three.js expects. */
const toColorValue = (hex: string): number => Number.parseInt(hex.slice(1), 16);

/** Material-specific signal colour for a loose cache, by what it holds. */
const getMaterialAccent = (materials: Record<string, number | undefined>): string => {
  if ((materials.acidCanister ?? 0) > 0) {
    return novaPalette.acid;
  }
  if ((materials.electronics ?? 0) > 0) {
    return novaPalette.system;
  }
  if ((materials.ore ?? 0) > 0) {
    return novaPalette.ore;
  }
  if ((materials.polymer ?? 0) > 0) {
    return novaFactions[1]?.accent ?? novaPalette.structureLight;
  }
  return novaPalette.structureLight;
};

export type { NovaFaction };
export { getFaction, getFactionIndex, getMaterialAccent, novaFactions, novaPalette, novaTerrain, toColorValue };
