import { Select as BaseSelect } from '@base-ui-components/react/select';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from './cn.ts';

type SelectOption<TValue> = {
  label: string;
  value: TValue;
};

type SelectProps<TValue extends string | number> = {
  label: string;
  onChange: (value: TValue) => void;
  options: SelectOption<TValue>[];
  value: TValue;
};

const Select = <TValue extends string | number>({
  label,
  onChange,
  options,
  value,
}: SelectProps<TValue>): React.ReactNode => (
  <BaseSelect.Root items={options} onValueChange={(next) => onChange(next as TValue)} value={value}>
    <BaseSelect.Trigger
      aria-label={label}
      className={cn(
        'btn h-7 gap-1.5 px-2 text-xs',
        'data-[popup-open]:border-system/60 data-[popup-open]:bg-panel-raised',
      )}
    >
      <BaseSelect.Value className="num" />
      <ChevronsUpDown className="size-3 text-ink-faint" />
    </BaseSelect.Trigger>
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={6}>
        <BaseSelect.Popup
          className={cn(
            'hud min-w-[var(--anchor-width)] p-1',
            'origin-[var(--transform-origin)] transition-[transform,opacity] duration-100',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
          )}
        >
          {options.map((option) => (
            <BaseSelect.Item
              className={cn(
                'num flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-dim',
                'data-[highlighted]:bg-panel-raised data-[highlighted]:text-ink',
                'data-[selected]:text-ink',
              )}
              key={String(option.value)}
              value={option.value}
            >
              {/* Fixed-size slot: the indicator only renders when selected, and
                  without a reserved space every other row shifts left. */}
              <span className="flex size-3 shrink-0 items-center justify-center">
                <BaseSelect.ItemIndicator>
                  <Check className="size-3 text-system" />
                </BaseSelect.ItemIndicator>
              </span>
              <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
            </BaseSelect.Item>
          ))}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  </BaseSelect.Root>
);

export type { SelectOption };
export { Select };
