/**
 * The film's clock.
 *
 * Shot timings are written in seconds throughout — a shot list is read and argued
 * about in seconds, not frames — and converted here at the single point where
 * frames are actually needed. Each act's cue list is timed from the start of its
 * own act, so an act can be lengthened without retiming the one after it.
 */
const fps = 30;

/** Seconds to frames, for Remotion sequence bounds. */
const at = (value: number): number => Math.round(value * fps);

/** Act one: round 0, one Android, a board nobody has looked at. */
const actOneSeconds = 24;

/** Act two: round 46, two colony programmes and the bet that decides it. */
const actTwoSeconds = 58;

/**
 * The two acts are different boards, so the cut between them is a real cut. A
 * short overlap lets act two's first dark frames come up underneath act one's
 * last wide rather than flashing the page background between two WebGL contexts.
 */
const crossfadeSeconds = 0.7;

const actOneStart = 0;
const actTwoStart = actOneSeconds - crossfadeSeconds;
const totalSeconds = actTwoStart + actTwoSeconds;

export { actOneSeconds, actOneStart, actTwoSeconds, actTwoStart, at, crossfadeSeconds, fps, totalSeconds };
