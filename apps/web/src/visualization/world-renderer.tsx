import type { World } from '@morten-olsen/nova-game/browser';
import { createTabletopRenderer, type TabletopRenderer, type TileClickEvent } from '@morten-olsen/nova-renderer';
import { useEffect, useRef } from 'react';

type WorldRendererProps = {
  className?: string;
  onTileClick?: (event: TileClickEvent) => void;
  world: World;
};

const WorldRenderer = ({ className = 'h-125', onTileClick, world }: WorldRendererProps): React.ReactNode => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<TabletopRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const renderer = createTabletopRenderer(host, { onTileClick });
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onTileClick]);

  useEffect(() => {
    rendererRef.current?.setWorld(world);
  }, [world]);

  return <div ref={hostRef} className={`${className} w-full overflow-hidden border border-slate-700`} />;
};

export { WorldRenderer };
