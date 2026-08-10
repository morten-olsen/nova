import { createTimeline, usesFogOfWar, type TimelineFrame } from '@morten-olsen/nova-game';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

import { BoardPanel } from '../lab/board-panel.tsx';
import { EditorColumn } from '../lab/editor-column.tsx';
import { useDirtyGuard } from '../lab/use-dirty-guard.ts';
import { useLabShortcuts } from '../lab/use-lab-shortcuts.ts';
import { useSandboxRun } from '../lab/use-sandbox-run.ts';
import { useScripts } from '../lab/use-scripts.ts';
import { MatchDialog } from '../match/match-dialog.tsx';
import { useMatch } from '../match/use-match.ts';
import { Group, Panel, ResizeHandle } from '../ui/resizable.tsx';
import { TooltipProvider } from '../ui/tooltip.tsx';

const Lab = (): React.ReactNode => {
  const library = useScripts();
  const match = useMatch();
  const [isMatchOpen, setIsMatchOpen] = useState(false);
  const [size, setSize] = useState(12);
  const [rounds, setRounds] = useState(24);
  const [hasEdited, setHasEdited] = useState(false);
  const sandbox = useSandboxRun({ rounds, size });

  useDirtyGuard(library.isDirty);

  const frames = useMemo<TimelineFrame[]>(
    () => (sandbox.recording ? createTimeline(sandbox.recording) : []),
    [sandbox.recording],
  );
  const fogOfWar = useMemo(() => usesFogOfWar(frames), [frames]);

  const onLoadMatchReplay = useCallback(() => {
    if (match.result?.game) {
      sandbox.showRecording(match.result.game);
      setIsMatchOpen(false);
      match.cancel();
    }
  }, [match, sandbox]);

  const onDraftChange = useCallback(
    (value: string) => {
      setHasEdited(true);
      library.onDraftChange(value);
    },
    [library],
  );

  const onRun = useCallback(() => sandbox.onRun(library.draft), [library.draft, sandbox]);

  useLabShortcuts({ onRun, onSave: library.onSave });

  return (
    <TooltipProvider>
      <main className="h-dvh w-dvw overflow-hidden">
        <Group className="h-full" orientation="horizontal">
          <Panel defaultSize="46" minSize="26">
            <EditorColumn
              error={sandbox.error}
              hasEdited={hasEdited}
              isRunning={sandbox.isRunning}
              library={library}
              onDraftChange={onDraftChange}
              onOpenMatch={() => setIsMatchOpen(true)}
              onRun={onRun}
              result={sandbox.result}
            />
          </Panel>

          <ResizeHandle />

          <Panel minSize="24">
            <BoardPanel
              fogOfWar={fogOfWar}
              frames={frames}
              onRoundsChange={setRounds}
              onSizeChange={setSize}
              rounds={rounds}
              runId={sandbox.runId}
              size={size}
            />
          </Panel>
        </Group>
        <MatchDialog
          match={match}
          onClose={() => setIsMatchOpen(false)}
          onLoadReplay={onLoadMatchReplay}
          open={isMatchOpen}
          script={library.draft}
          scriptName={library.scripts.find((entry) => entry.id === library.activeId)?.name ?? 'android'}
        />
      </main>
    </TooltipProvider>
  );
};

const Route = createFileRoute('/')({ component: Lab });

export { Route };
