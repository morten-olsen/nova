import { useCallback, useState } from 'react';

import { saveRevision, updateScript, type ScriptRecord } from '../storage/script-store.ts';

type OpenDraft = {
  activeId: string | undefined;
  draft: string;
  isDirty: boolean;
  onRevert: () => void;
  onSave: () => void;
  /** Passing nothing closes the editor, which is what deleting the last script does. */
  open: (script?: ScriptRecord) => void;
  setDraft: (value: string) => void;
};

/**
 * The working copy of whichever script is open, and the stored content it is
 * compared against.
 *
 * Saving is explicit. The point of the lab is to change something, run it, and
 * decide afterwards whether it was an improvement — autosaving would commit the
 * experiment before the player has seen the result, and quietly overwrite the
 * version that was working.
 */
const useOpenDraft = (refresh: () => Promise<ScriptRecord[]>): OpenDraft => {
  const [activeId, setActiveId] = useState<string>();
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');

  const open = useCallback((script?: ScriptRecord) => {
    setActiveId(script?.id);
    setDraft(script?.content ?? '');
    setSaved(script?.content ?? '');
  }, []);

  const onSave = useCallback(() => {
    if (!activeId || draft === saved) {
      return;
    }
    void (async () => {
      await updateScript(activeId, { content: draft });
      // Every save is a checkpoint worth returning to; a run is not.
      await saveRevision(activeId, draft);
      setSaved(draft);
      await refresh();
    })();
  }, [activeId, draft, refresh, saved]);

  const onRevert = useCallback(() => setDraft(saved), [saved]);

  return { activeId, draft, isDirty: draft !== saved, onRevert, onSave, open, setDraft };
};

export type { OpenDraft };
export { useOpenDraft };
