import { useEffect } from 'react';

/**
 * Asks the browser to confirm before closing a tab with unsaved changes.
 *
 * Saving is explicit here, so a reflexive ⌘W is the one way an experiment can
 * be lost without the player doing anything they would recognise as discarding
 * it. Browsers show their own wording; the message is only a legacy hint.
 */
const useDirtyGuard = (isDirty: boolean): void => {
  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
};

export { useDirtyGuard };
