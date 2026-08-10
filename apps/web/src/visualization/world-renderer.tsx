import type { World } from '@morten-olsen/nova-game/browser';
import {
  createTabletopRenderer,
  type TabletopRenderer,
  type TabletopSelection,
  type TileClickEvent,
} from '@morten-olsen/nova-renderer';
import { useEffect, useRef } from 'react';

type WorldRendererProps = {
  className?: string;
  /** Decided from the whole recording, not the current frame. */
  fogOfWar: boolean;
  onTileClick?: (event: TileClickEvent) => void;
  /** Receives the live renderer so callers can drive the camera. */
  onReady?: (renderer: TabletopRenderer | null) => void;
  selection: TabletopSelection;
  world: World;
};

const WorldRenderer = ({
  className = 'h-125',
  fogOfWar,
  onReady,
  onTileClick,
  selection,
  world,
}: WorldRendererProps): React.ReactNode => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<TabletopRenderer | null>(null);
  // Held in refs so changing a handler never tears down the WebGL context.
  const tileClickRef = useRef(onTileClick);
  const readyRef = useRef(onReady);

  useEffect(() => {
    tileClickRef.current = onTileClick;
    readyRef.current = onReady;
  }, [onReady, onTileClick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }
    const renderer = createTabletopRenderer(host, {
      fogOfWar,
      onTileClick: (event) => tileClickRef.current?.(event),
    });
    rendererRef.current = renderer;
    readyRef.current?.(renderer);
    return () => {
      readyRef.current?.(null);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [fogOfWar]);

  useEffect(() => {
    rendererRef.current?.setWorld(world);
  }, [world]);

  useEffect(() => {
    rendererRef.current?.setSelection(selection);
  }, [selection]);

  return <div ref={hostRef} className={`${className} w-full overflow-hidden`} />;
};

export { WorldRenderer };
