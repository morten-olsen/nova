import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip';

import { cn } from './cn.ts';

type TooltipProps = {
  children: React.ReactNode;
  /** Right-aligned hint, for the keyboard shortcut. */
  shortcut?: string;
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

/**
 * Icon-only controls carry the toolbar, so every one of them needs a name.
 * `label` also becomes the accessible name, so the two cannot drift apart.
 */
const Tooltip = ({ children, label, shortcut, side = 'bottom' }: TooltipProps): React.ReactNode => (
  <BaseTooltip.Root>
    <BaseTooltip.Trigger aria-label={label} render={(props) => <span {...props}>{children}</span>} />
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={8}>
        <BaseTooltip.Popup
          className={cn(
            'hud flex items-center gap-2 px-2 py-1 text-xs text-ink',
            'origin-[var(--transform-origin)] transition-[transform,opacity] duration-100',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
          )}
        >
          {label}
          {shortcut ? <kbd className="num text-[0.6875rem] text-ink-faint">{shortcut}</kbd> : null}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  </BaseTooltip.Root>
);

const TooltipProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  // Once one tooltip has opened, the rest follow without their own delay.
  <BaseTooltip.Provider delay={400} closeDelay={80}>
    {children}
  </BaseTooltip.Provider>
);

export { Tooltip, TooltipProvider };
