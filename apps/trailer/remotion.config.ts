import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
// Steam wants a high-bitrate 1080p master; the board is full of fine engraved
// grid lines and dust that a default bitrate turns to mush.
Config.setCrf(16);

/**
 * The board simulation is sequential: a frame is a function of the `advance`
 * calls taken to reach it, not of a clock value, so frames cannot be farmed out
 * to parallel tabs. One tab, in order.
 */
Config.setConcurrency(1);

/**
 * The renderer is real WebGL with shadow maps and a bloom pass. `angle` gets
 * hardware acceleration through Metal/D3D; swap to `swangle` on a machine with
 * no usable GPU (CI containers), at a large cost in render time.
 */
Config.setChromiumOpenGlRenderer('angle');

// GLB loads and the first board paint happen inside delayRender, and a cold
// asset cache on a busy machine can exceed the 30s default.
Config.setDelayRenderTimeoutInMilliseconds(120_000);
