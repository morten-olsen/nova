import { useEffect, useRef } from 'react';

type LabShortcuts = {
  onRun: () => void;
  onSave: () => void;
};

/**
 * ⌘⏎ and ⌘S at the window level, so they still fire when focus is on the
 * library or the board rather than inside the editor.
 *
 * ⌘S in particular must be intercepted everywhere: unhandled, the browser
 * offers to save the page, which is a confusing answer to "how do I save?".
 */
const useLabShortcuts = ({ onRun, onSave }: LabShortcuts): void => {
  const handlers = useRef({ onRun, onSave });

  useEffect(() => {
    handlers.current = { onRun, onSave };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handlers.current.onRun();
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlers.current.onSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Bound once; the refs above keep the handlers current.
  }, []);
};

export { useLabShortcuts };
