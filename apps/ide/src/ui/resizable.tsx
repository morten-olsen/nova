import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from './cn.ts';

type ResizeHandleProps = {
  className?: string;
  /** Matches the parent group. Drives which way the grip and hit area run. */
  orientation?: 'horizontal' | 'vertical';
};

/**
 * Drag handle between two panes.
 *
 * Three things at once: a visible hairline so the layout reads as panels rather
 * than as one drifting page, a hit area several times wider than that line
 * because a 1px target is miserable to grab, and a grip that only appears on
 * hover so the seam stays quiet while you are reading code.
 *
 * Orientation is passed rather than inherited: v4 exposes only `data-separator`
 * and `data-disabled`, so there is no direction attribute to select on.
 */
const ResizeHandle = ({ className, orientation = 'horizontal' }: ResizeHandleProps): React.ReactNode => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <Separator
      className={cn(
        'group relative flex shrink-0 items-center justify-center outline-none',
        isHorizontal ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
        className,
      )}
    >
      {/* The seam itself. Always visible, brightening as you approach it. */}
      <span
        aria-hidden
        className={cn(
          'absolute bg-hairline transition-colors',
          'group-hover:bg-system/60 group-focus-visible:bg-system/60 group-active:bg-system/80',
          isHorizontal ? 'inset-y-0 w-px' : 'inset-x-0 h-px',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'absolute z-10 grid place-items-center rounded-sm border border-hairline-bright bg-panel-raised',
          'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100',
          isHorizontal ? 'h-6 w-3' : 'h-3 w-6',
        )}
      >
        <GripVertical className={cn('size-3 text-ink-dim', !isHorizontal && 'rotate-90')} />
      </span>
    </Separator>
  );
};

export { Group, Panel, ResizeHandle };
