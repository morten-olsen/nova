import type { Android, Building, MaterialBundle, Tile, World } from '@morten-olsen/nova-game';
import { getFaction } from '@morten-olsen/nova-renderer';

import { findTile, type ResolvedSelection, type Selection } from '../replay/selection.js';

type InspectorProps = {
  onSelect: (selection: Selection | undefined) => void;
  selection: ResolvedSelection | undefined;
  world: World;
};

const materialLabels: Record<string, string> = {
  metal: 'Metal',
  electronics: 'Electronics',
  polymer: 'Polymer',
  ore: 'Ore',
  water: 'Water',
  acidCanister: 'Acid canisters',
};

const compositionTone: Record<string, string> = {
  ore: 'text-ore',
  acid: 'text-acid',
  water: 'text-system',
  radiation: 'text-violet-300',
};

const listAmounts = (bundle: Partial<MaterialBundle> | undefined): [string, number][] =>
  Object.entries(bundle ?? {}).filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0);

const Header = ({
  accent,
  glyph,
  onClose,
  subtitle,
  title,
}: {
  accent?: string;
  glyph?: string;
  onClose: () => void;
  subtitle: string;
  title: string;
}): React.ReactNode => (
  <div className="flex items-start gap-2.5">
    {glyph ? (
      <span aria-hidden className="mt-1 text-xs leading-none" style={{ color: accent }}>
        {glyph}
      </span>
    ) : null}
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
      <p className="num mt-0.5 text-[0.7rem] text-ink-faint">{subtitle}</p>
    </div>
    <button
      aria-label="Clear selection"
      className="btn size-6 shrink-0 !rounded-md !border-hairline text-ink-faint"
      type="button"
      onClick={onClose}
    >
      <svg aria-hidden className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </button>
  </div>
);

const Meter = ({ label, tone, value }: { label: string; tone: string; value: number }): React.ReactNode => (
  <div>
    <div className="flex items-baseline justify-between gap-2">
      <span className="label !tracking-wide">{label}</span>
      <span className="num text-xs text-ink-dim">{Math.round(value)}</span>
    </div>
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-hairline">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  </div>
);

const AmountList = ({ items, empty }: { empty: string; items: [string, number][] }): React.ReactNode =>
  items.length ? (
    <ul className="space-y-1">
      {items.map(([key, amount]) => (
        <li key={key} className="flex items-baseline justify-between gap-3 text-xs">
          <span className={compositionTone[key] ?? 'text-ink-dim'}>{materialLabels[key] ?? key}</span>
          <span className="num text-ink">{amount}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-xs text-ink-faint">{empty}</p>
  );

const Section = ({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode => (
  <section className="mt-3 border-t border-hairline pt-2.5">
    <h3 className="label mb-1.5">{title}</h3>
    {children}
  </section>
);

const EntityChip = ({
  accent,
  detail,
  glyph,
  name,
  onSelect,
}: {
  accent: string;
  detail: string;
  glyph: string;
  name: string;
  onSelect: () => void;
}): React.ReactNode => (
  <li>
    <button
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
      type="button"
      onClick={onSelect}
    >
      <span aria-hidden className="text-[0.6rem] leading-none" style={{ color: accent }}>
        {glyph}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-ink">{name}</span>
      <span className="num shrink-0 text-[0.7rem] text-ink-faint">{detail}</span>
    </button>
  </li>
);

const AndroidDetail = ({ android, world }: { android: Android; world: World }): React.ReactNode => {
  const cargo = listAmounts(android.cargo);
  return (
    <>
      <Section title="Status">
        <div className="space-y-2">
          <Meter label="Battery" tone={android.battery < 25 ? 'bg-warning' : 'bg-energy'} value={android.battery} />
          <Meter label="Health" tone="bg-system" value={android.health} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span className={`size-1.5 rounded-full ${android.active ? 'bg-acid' : 'bg-ink-faint'}`} />
          <span className={android.active ? 'text-acid' : 'text-ink-faint'}>
            {android.active ? 'Active' : 'Deactivated'}
          </span>
        </p>
      </Section>
      <Section title="Cargo">
        <AmountList empty="Empty." items={cargo} />
      </Section>
      <Section title="Program">
        <p className="num text-xs break-all text-ink-dim">
          {world.scripts.find((script) => script.id === android.scriptId)?.name ?? android.scriptId}
        </p>
      </Section>
    </>
  );
};

const BuildingDetail = ({ building }: { building: Building }): React.ReactNode => {
  const storage = listAmounts(building.storage);
  const remaining = building.remainingConstruction.ticks;
  return (
    <>
      <Section title="Status">
        <Meter label="Integrity" tone={building.health < 40 ? 'bg-warning' : 'bg-system'} value={building.health} />
        {remaining > 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-energy">
            <span className="size-1.5 animate-pulse rounded-full bg-energy" />
            Under construction · <span className="num">{remaining}</span> ticks remaining
          </p>
        ) : (
          <p className="mt-2 text-xs text-acid">Operational</p>
        )}
        {building.initial ? <p className="mt-1 text-xs text-ink-faint">Starting structure</p> : null}
      </Section>
      {remaining > 0 ? (
        <Section title="Outstanding materials">
          <AmountList empty="All materials delivered." items={listAmounts(building.remainingConstruction.resources)} />
        </Section>
      ) : null}
      <Section title="Storage">
        <AmountList empty="Nothing stored." items={storage} />
      </Section>
    </>
  );
};

const TileDetail = ({
  onSelect,
  tile,
  world,
}: {
  onSelect: (selection: Selection) => void;
  tile: Tile | undefined;
  world: World;
}): React.ReactNode => {
  const position = tile?.position;
  const androids = world.androids.filter(
    (android) => android.position.x === position?.x && android.position.y === position?.y,
  );
  const buildings = world.buildings.filter(
    (building) => building.position.x === position?.x && building.position.y === position?.y,
  );
  return (
    <>
      <Section title="Ground">
        <AmountList empty="Stable terrain." items={listAmounts(tile?.composition)} />
      </Section>
      <Section title="Loose material">
        <AmountList empty="None." items={listAmounts(tile?.scattered)} />
      </Section>
      <Section title={`Structures · ${buildings.length}`}>
        {buildings.length ? (
          <ul className="-mx-1">
            {buildings.map((building) => {
              const faction = getFaction(world, building.ownerId);
              return (
                <EntityChip
                  key={building.id}
                  accent={faction.accent}
                  detail={building.remainingConstruction.ticks > 0 ? 'building' : 'ready'}
                  glyph={faction.glyph}
                  name={building.type}
                  onSelect={() => onSelect({ id: building.id, kind: 'building' })}
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">No infrastructure.</p>
        )}
      </Section>
      <Section title={`Androids · ${androids.length}`}>
        {androids.length ? (
          <ul className="-mx-1">
            {androids.map((android) => {
              const faction = getFaction(world, android.ownerId);
              return (
                <EntityChip
                  key={android.id}
                  accent={faction.accent}
                  detail={`${Math.round(android.battery)}%`}
                  glyph={faction.glyph}
                  name={android.id}
                  onSelect={() => onSelect({ id: android.id, kind: 'android' })}
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">None present.</p>
        )}
      </Section>
    </>
  );
};

const getOwnerId = (selection: ResolvedSelection): string | undefined => {
  if (selection.kind === 'android') {
    return selection.android.ownerId;
  }
  return selection.kind === 'building' ? selection.building.ownerId : undefined;
};

const getTitle = (selection: ResolvedSelection, coordinates: string): string => {
  if (selection.kind === 'android') {
    return 'Android';
  }
  return selection.kind === 'building' ? selection.building.type.replaceAll('-', ' ') : `Tile ${coordinates}`;
};

const Inspector = ({ onSelect, selection, world }: InspectorProps): React.ReactNode => {
  if (!selection) {
    return (
      <aside className="hud w-72 p-3">
        <h2 className="label">Inspector</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-dim">
          Click a tile to inspect its ground and hazards, or click an android or structure to open its details.
        </p>
      </aside>
    );
  }

  const coordinates = `${selection.position.x}, ${selection.position.y}`;
  const owner = getOwnerId(selection);
  const faction = owner ? getFaction(world, owner) : undefined;
  const ownerName = world.players?.find((player) => player.id === owner)?.name ?? owner;
  const backToTile = (): void => onSelect({ kind: 'tile', position: selection.position });

  return (
    <aside className="hud rise flex w-72 flex-col p-3">
      <Header
        accent={faction?.accent}
        glyph={faction?.glyph}
        subtitle={selection.kind === 'tile' ? `Tile ${coordinates}` : `${ownerName} · ${coordinates}`}
        title={getTitle(selection, coordinates)}
        onClose={() => onSelect(undefined)}
      />
      <div className="mt-1 max-h-[min(26rem,45vh)] overflow-y-auto pr-0.5">
        {selection.kind === 'android' ? <AndroidDetail android={selection.android} world={world} /> : null}
        {selection.kind === 'building' ? <BuildingDetail building={selection.building} /> : null}
        {selection.kind === 'tile' ? (
          <TileDetail onSelect={onSelect} tile={findTile(world, selection.position)} world={world} />
        ) : null}
      </div>
      {selection.kind !== 'tile' ? (
        <button className="btn mt-2.5 w-full py-1.5 text-xs" type="button" onClick={backToTile}>
          Inspect tile {coordinates}
        </button>
      ) : null}
    </aside>
  );
};

export { Inspector };
