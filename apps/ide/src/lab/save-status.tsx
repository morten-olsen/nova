import { Check, PencilLine } from 'lucide-react';

type SaveStatusProps = {
  isDirty: boolean;
  /** Suppresses the badge until the script has actually been touched. */
  hasEdited: boolean;
};

/**
 * States the save model out loud.
 *
 * Nothing is written until you ask for it, so the editor has to say when it is
 * holding changes — otherwise the only way to find out is to lose them.
 */
const SaveStatus = ({ hasEdited, isDirty }: SaveStatusProps): React.ReactNode => {
  if (!hasEdited) {
    return null;
  }

  return (
    <span aria-live="polite" className="flex items-center gap-1.5 text-[0.6875rem]">
      {isDirty ? (
        <>
          <PencilLine className="size-3 text-energy" />
          <span className="text-energy">Unsaved</span>
        </>
      ) : (
        <>
          <Check className="size-3 text-acid" />
          <span className="text-ink-faint">Saved</span>
        </>
      )}
    </span>
  );
};

export { SaveStatus };
