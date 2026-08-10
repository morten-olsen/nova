import { useEffect } from 'react';

const baseFrameDuration = 900;

type UsePlaybackOptions = {
  isPlaying: boolean;
  maxFrame: number;
  setFrameIndex: (update: (current: number) => number) => void;
  setIsPlaying: (playing: boolean) => void;
  speed: number;
};

/** Advances the timeline while playing, stopping at the last frame. */
const usePlayback = ({ isPlaying, maxFrame, setFrameIndex, setIsPlaying, speed }: UsePlaybackOptions): void => {
  useEffect(() => {
    if (!isPlaying || maxFrame === 0) {
      return;
    }
    const timer = setInterval(() => {
      setFrameIndex((current) => {
        if (current >= maxFrame) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, baseFrameDuration / speed);
    return () => clearInterval(timer);
  }, [isPlaying, maxFrame, setFrameIndex, setIsPlaying, speed]);
};

export { usePlayback };
