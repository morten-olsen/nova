import { Loader2, Play, Save, Swords, Undo2 } from 'lucide-react';

import { Button } from '../ui/button.tsx';
import { Tooltip } from '../ui/tooltip.tsx';

import { SaveStatus } from './save-status.tsx';

type LabToolbarProps = {
  canRun: boolean;
  hasEdited: boolean;
  isDirty: boolean;
  isRunning: boolean;
  onOpenMatch: () => void;
  onRevert: () => void;
  onRun: () => void;
  onSave: () => void;
};

const LabToolbar = ({
  canRun,
  hasEdited,
  isDirty,
  isRunning,
  onOpenMatch,
  onRevert,
  onRun,
  onSave,
}: LabToolbarProps): React.ReactNode => (
  <header className="flex items-center gap-3 border-b border-hairline px-3 py-2">
    <span aria-hidden className="text-sm text-system">
      ◆
    </span>
    <h1 className="text-sm font-semibold tracking-tight">Android Lab</h1>
    <div className="ml-auto flex items-center gap-2">
      <SaveStatus hasEdited={hasEdited} isDirty={isDirty} />
      {isDirty ? (
        <Tooltip label="Discard changes">
          <Button onClick={onRevert} size="icon" variant="ghost">
            <Undo2 />
          </Button>
        </Tooltip>
      ) : null}
      <Tooltip label="Play another player">
        <Button disabled={!canRun} onClick={onOpenMatch} size="icon" variant="ghost">
          <Swords />
        </Button>
      </Tooltip>
      <Tooltip label="Save script" shortcut="⌘S">
        <Button disabled={!isDirty} onClick={onSave} size="icon">
          <Save />
        </Button>
      </Tooltip>
      <Tooltip label="Run against a fresh map" shortcut="⌘⏎">
        <Button disabled={isRunning || !canRun} onClick={onRun} variant="primary">
          {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
          {isRunning ? 'Running' : 'Run'}
        </Button>
      </Tooltip>
    </div>
  </header>
);

export { LabToolbar };
