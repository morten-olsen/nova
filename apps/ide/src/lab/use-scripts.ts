import { useCallback, useEffect, useState } from 'react';

import {
  createScript,
  deleteScript,
  listScripts,
  seedIfEmpty,
  updateScript,
  type ScriptRecord,
} from '../storage/script-store.ts';

import { starterScript } from './starter-script.ts';
import { useOpenDraft } from './use-open-draft.ts';

type UseScripts = {
  activeId: string | undefined;
  draft: string;
  /** True once the draft differs from what is stored. */
  isDirty: boolean;
  isLoading: boolean;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onDraftChange: (value: string) => void;
  onRename: (id: string, name: string) => void;
  onRevert: () => void;
  onSave: () => void;
  onSelect: (id: string) => void;
  scripts: ScriptRecord[];
};

type BootstrapOptions = {
  open: (script?: ScriptRecord) => void;
  refresh: () => Promise<ScriptRecord[]>;
};

/**
 * Loads the library on first mount, seeding a starter script when the store is
 * empty — an empty editor with no way to know what an action looks like is a
 * poor first screen.
 */
const useBootstrap = ({ open, refresh }: BootstrapOptions): boolean => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async (): Promise<void> => {
      await seedIfEmpty('Starter android', starterScript);
      open((await refresh())[0]);
      setIsLoading(false);
    };
    void load();
  }, [open, refresh]);

  return isLoading;
};

/**
 * Guards the two actions that replace the open draft.
 *
 * Switching or creating is the one place unsaved work can vanish without the
 * player doing anything they would recognise as discarding it.
 */
const confirmDiscard = (isDirty: boolean): boolean =>
  !isDirty || window.confirm('Discard unsaved changes to this script?');

/** Owns the script library and the working copy of whichever script is open. */
const useScripts = (): UseScripts => {
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);

  const refresh = useCallback(async (): Promise<ScriptRecord[]> => {
    const stored = await listScripts();
    setScripts(stored);
    return stored;
  }, []);

  const { activeId, draft, isDirty, onRevert, onSave, open, setDraft } = useOpenDraft(refresh);
  const isLoading = useBootstrap({ open, refresh });

  const onSelect = useCallback(
    (id: string) => {
      const next = scripts.find((script) => script.id === id);
      if (!next || next.id === activeId || !confirmDiscard(isDirty)) {
        return;
      }
      open(next);
    },
    [activeId, isDirty, open, scripts],
  );

  const onCreate = useCallback(() => {
    if (!confirmDiscard(isDirty)) {
      return;
    }
    void (async () => {
      const created = await createScript(`Android ${scripts.length + 1}`, starterScript);
      await refresh();
      open(created);
    })();
  }, [isDirty, open, refresh, scripts.length]);

  const onDelete = useCallback(
    (id: string) => {
      void (async () => {
        await deleteScript(id);
        const remaining = await refresh();
        if (id === activeId) {
          open(remaining[0]);
        }
      })();
    },
    [activeId, open, refresh],
  );

  const onRename = useCallback(
    (id: string, name: string) => {
      void updateScript(id, { name }).then(refresh);
    },
    [refresh],
  );

  return {
    activeId,
    draft,
    isDirty,
    isLoading,
    onCreate,
    onDelete,
    onDraftChange: setDraft,
    onRename,
    onRevert,
    onSave,
    onSelect,
    scripts,
  };
};

export type { UseScripts };
export { useScripts };
