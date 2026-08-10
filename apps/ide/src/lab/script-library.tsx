import { FileCode2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { ScriptRecord } from '../storage/script-store.ts';
import { Button } from '../ui/button.tsx';
import { cn } from '../ui/cn.ts';
import { Tooltip } from '../ui/tooltip.tsx';

type ScriptRowProps = {
  isActive: boolean;
  isDirty: boolean;
  onDelete: () => void;
  onRename: (name: string) => void;
  onSelect: () => void;
  script: ScriptRecord;
};

const ScriptRow = ({ isActive, isDirty, onDelete, onRename, onSelect, script }: ScriptRowProps): React.ReactNode => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li>
        <input
          autoFocus
          className="w-full rounded-md border border-system/50 bg-panel-raised px-2 py-1.5 text-sm outline-none"
          defaultValue={script.name}
          onBlur={(event) => {
            onRename(event.target.value.trim() || script.name);
            setIsEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setIsEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className="group relative flex items-center">
      <button
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pl-2 text-left text-sm transition-[padding,background-color,color]',
          // Room for the row actions is only reserved once they are showing.
          // Reserving it always truncated ordinary names to "Starter and…".
          'pr-2 group-focus-within:pr-14 group-hover:pr-14',
          isActive ? 'bg-panel-raised text-ink' : 'text-ink-dim hover:bg-panel-raised/60 hover:text-ink',
        )}
        onClick={onSelect}
        onDoubleClick={() => setIsEditing(true)}
        type="button"
      >
        <FileCode2 className={cn('size-3.5 shrink-0', isActive ? 'text-system' : 'text-ink-faint')} />
        <span className="truncate">{script.name}</span>
        {isActive && isDirty ? (
          <span aria-label="Unsaved changes" className="size-1.5 shrink-0 rounded-full bg-energy" role="img" />
        ) : null}
      </button>
      {/* Absolutely positioned so revealing them never reflows the name. */}
      <span className="absolute right-1 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Tooltip label="Rename">
          <Button onClick={() => setIsEditing(true)} size="icon-sm" variant="ghost">
            <Pencil />
          </Button>
        </Tooltip>
        <Tooltip label="Delete">
          <Button onClick={onDelete} size="icon-sm" variant="danger">
            <Trash2 />
          </Button>
        </Tooltip>
      </span>
    </li>
  );
};

type ScriptLibraryProps = {
  activeId: string | undefined;
  isDirty: boolean;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onSelect: (id: string) => void;
  scripts: ScriptRecord[];
};

const ScriptLibrary = ({
  activeId,
  isDirty,
  onCreate,
  onDelete,
  onRename,
  onSelect,
  scripts,
}: ScriptLibraryProps): React.ReactNode => (
  <div className="flex h-full min-h-0 flex-col gap-2 p-2">
    <div className="flex items-center justify-between pl-2">
      <p className="label">Library</p>
      <Tooltip label="New android">
        <Button onClick={onCreate} size="icon" variant="ghost">
          <Plus />
        </Button>
      </Tooltip>
    </div>
    <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
      {scripts.map((script) => (
        <ScriptRow
          isActive={script.id === activeId}
          isDirty={isDirty}
          key={script.id}
          onDelete={() => onDelete(script.id)}
          onRename={(name) => onRename(script.id, name)}
          onSelect={() => onSelect(script.id)}
          script={script}
        />
      ))}
    </ul>
  </div>
);

export { ScriptLibrary };
