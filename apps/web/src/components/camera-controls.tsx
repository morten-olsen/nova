type CameraControlsProps = {
  onFrameBoard: () => void;
  onFocusSelection: (() => void) | undefined;
  onZoom: (factor: number) => void;
};

const zoomStep = 1.35;

const IconButton = ({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}): React.ReactNode => (
  <button aria-label={label} className="btn size-8" disabled={disabled} title={label} type="button" onClick={onClick}>
    {children}
  </button>
);

/**
 * Camera cluster. Deliberately explicit rather than scroll-only: these are the
 * same moves the capture API exposes, so a shot can be framed by hand first.
 */
const CameraControls = ({ onFrameBoard, onFocusSelection, onZoom }: CameraControlsProps): React.ReactNode => (
  <div className="hud flex flex-col gap-1 p-1.5">
    <IconButton label="Zoom in" onClick={() => onZoom(1 / zoomStep)}>
      <svg aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </IconButton>
    <IconButton label="Zoom out" onClick={() => onZoom(zoomStep)}>
      <svg aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M5 12h14" strokeLinecap="round" />
      </svg>
    </IconButton>
    <IconButton disabled={!onFocusSelection} label="Focus selection" onClick={() => onFocusSelection?.()}>
      <svg aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
      </svg>
    </IconButton>
    <IconButton label="Frame whole board" onClick={onFrameBoard}>
      <svg aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IconButton>
  </div>
);

export { CameraControls };
