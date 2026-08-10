import { ScriptEditor } from '../editor/script-editor.tsx';
import { Group, Panel, ResizeHandle } from '../ui/resizable.tsx';
import type { SandboxResult } from '../sandbox/sandbox.ts';

import { LabToolbar } from './lab-toolbar.tsx';
import { RunConsole } from './run-console.tsx';
import { ScriptLibrary } from './script-library.tsx';
import type { UseScripts } from './use-scripts.ts';

type EditorColumnProps = {
  error: string | undefined;
  hasEdited: boolean;
  isRunning: boolean;
  library: UseScripts;
  onDraftChange: (value: string) => void;
  onOpenMatch: () => void;
  onRun: () => void;
  result: SandboxResult | undefined;
};

/**
 * The whole left side: toolbar, library, editor, and console.
 *
 * Every level carries an explicit height. A panel group sizes its children but
 * takes none of its own, so a group nested inside a panel collapses to nothing
 * unless it is told to fill — which is what leaves Monaco a few pixels tall.
 */
const EditorColumn = ({
  error,
  hasEdited,
  isRunning,
  library,
  onDraftChange,
  onOpenMatch,
  onRun,
  result,
}: EditorColumnProps): React.ReactNode => (
  <div className="flex h-full min-h-0 flex-col">
    <LabToolbar
      canRun={Boolean(library.activeId)}
      hasEdited={hasEdited}
      isDirty={library.isDirty}
      isRunning={isRunning}
      onOpenMatch={onOpenMatch}
      onRevert={library.onRevert}
      onRun={onRun}
      onSave={library.onSave}
    />
    <Group className="min-h-0 flex-1" orientation="horizontal">
      <Panel defaultSize="26" minSize="14">
        <ScriptLibrary
          activeId={library.activeId}
          isDirty={library.isDirty}
          onCreate={library.onCreate}
          onDelete={library.onDelete}
          onRename={library.onRename}
          onSelect={library.onSelect}
          scripts={library.scripts}
        />
      </Panel>
      <ResizeHandle />
      <Panel minSize="30">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            {library.isLoading ? null : (
              <ScriptEditor onChange={onDraftChange} onRun={onRun} onSave={library.onSave} value={library.draft} />
            )}
          </div>
          {/*
          A status strip, not a pane: it reports the last run in a line or two,
          so it sizes to its content and the editor takes everything else. It
          only scrolls when a run fails on many rounds at once.
        */}
          <div className="max-h-36 shrink-0 overflow-y-auto border-t border-hairline px-3 py-2">
            <RunConsole error={error} isRunning={isRunning} result={result} />
          </div>
        </div>
      </Panel>
    </Group>
  </div>
);

export { EditorColumn };
