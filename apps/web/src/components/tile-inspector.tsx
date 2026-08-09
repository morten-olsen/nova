import type { World } from '@morten-olsen/nova-game/browser';

type TileInspectorProps = {
  position: { x: number; y: number } | null;
  world: World;
};

type TileContentsProps = {
  position: { x: number; y: number };
  world: World;
};

const formatMaterials = (materials: Record<string, number | undefined> | undefined): string[] => {
  return Object.entries(materials ?? {})
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([name, amount]) => `${amount} ${name}`);
};

const TileInfrastructure = ({ position, world }: TileContentsProps): React.ReactNode => {
  const buildings = world.buildings.filter(
    (building) => building.position.x === position.x && building.position.y === position.y,
  );
  return (
    <section className="mt-5 border-t border-slate-800 pt-4">
      <h3 className="command-label text-slate-500">Infrastructure</h3>
      {buildings.length ? (
        <ul className="mt-2 space-y-2 text-sm text-slate-200">
          {buildings.map((building) => (
            <li key={building.id} className="border-l-2 border-cyan-500/60 bg-slate-950/60 px-3 py-2">
              <span className="font-medium text-slate-100">{building.type}</span>
              <span className="ml-2 text-xs text-slate-400">{building.ownerId}</span>
              {building.remainingConstruction.ticks > 0 ? (
                <span className="ml-2 text-xs text-amber-300">
                  {building.remainingConstruction.ticks} ticks remaining
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No infrastructure.</p>
      )}
    </section>
  );
};

const TileAndroids = ({ position, world }: TileContentsProps): React.ReactNode => {
  const androids = world.androids.filter(
    (android) => android.position.x === position.x && android.position.y === position.y,
  );
  return (
    <section className="mt-5 border-t border-slate-800 pt-4">
      <h3 className="command-label text-slate-500">Androids</h3>
      {androids.length ? (
        <ul className="mt-2 space-y-2 text-sm text-slate-200">
          {androids.map((android) => (
            <li key={android.id} className="border-l-2 border-cyan-500/60 bg-slate-950/60 px-3 py-2">
              <span className="font-medium text-slate-100">{android.id}</span>
              <span className="ml-2 text-xs text-slate-400">{android.ownerId}</span>
              <span className="ml-2 text-xs text-cyan-200">{Math.round(android.battery)} battery</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No androids present.</p>
      )}
    </section>
  );
};

const TileStatus = ({ position, world }: TileContentsProps): React.ReactNode => {
  const tile = world.tiles.find(
    (candidate) => candidate.position.x === position.x && candidate.position.y === position.y,
  );
  const scattered = formatMaterials(tile?.scattered);
  const composition = formatMaterials(tile?.composition);
  return (
    <section className="mt-5 border-t border-slate-800 pt-4">
      <h3 className="command-label text-slate-500">Tile status</h3>
      <p className="mt-2 text-sm text-slate-300">
        Ground: {composition.length ? composition.join(', ') : 'stable terrain'}
      </p>
      <p className="mt-2 text-sm text-slate-300">Loose materials: {scattered.length ? scattered.join(', ') : 'none'}</p>
    </section>
  );
};

const TileInspector = ({ position, world }: TileInspectorProps): React.ReactNode => {
  if (!position) {
    return (
      <aside className="command-panel p-4 text-sm text-slate-400">
        <p className="command-label text-slate-500">Tile inspector</p>
        <p className="mt-3">
          Select a tile on the board to inspect its infrastructure, androids, resources, and hazards.
        </p>
      </aside>
    );
  }
  const pieces =
    world.buildings.filter((building) => building.position.x === position.x && building.position.y === position.y)
      .length +
    world.androids.filter((android) => android.position.x === position.x && android.position.y === position.y).length;
  const contents = { position, world };
  return (
    <aside className="command-panel border-cyan-400/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="command-label text-cyan-300">Tile inspector</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-100">
            {position.x}, {position.y}
          </h2>
        </div>
        <span className="border border-slate-700 px-2 py-1 font-mono text-xs text-slate-300">{pieces} pieces</span>
      </div>
      <TileInfrastructure {...contents} />
      <TileAndroids {...contents} />
      <TileStatus {...contents} />
    </aside>
  );
};

export { TileInspector };
