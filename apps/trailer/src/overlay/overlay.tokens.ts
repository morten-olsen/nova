import { novaFactions, novaPalette } from '@morten-olsen/nova-renderer';

/**
 * The trailer's type and colour language.
 *
 * Deliberately the game's own: the palette comes from the renderer rather than a
 * copy, and the type rules are the ones in `docs/visual-design.md` — sans for
 * prose, tabular mono for numbers, micro uppercase used sparingly. A trailer
 * that invents its own look sells a product the buyer will not recognise when
 * they open it.
 */
const colors = {
  ...novaPalette,
  hairline: '#1f2b40',
  hairlineBright: '#2c3c58',
  ink: '#e9eff8',
  inkDim: '#93a2b8',
  inkFaint: '#5d6b81',
  panel: '#0b1220',
} as const;

/**
 * No webfonts: the render runs in a headless browser with no network, and a
 * missing font silently becomes Times. This is the platform stack the game's own
 * UI uses, with explicit macOS/Linux fallbacks.
 */
const fonts = {
  mono: "'SF Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, 'DejaVu Sans Mono', Consolas, monospace",
  sans: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'DejaVu Sans', Arial, sans-serif",
} as const;

/** Faction chrome by seat order, so the trailer and the scoreboard agree. */
const factions = {
  aurora: novaFactions[0] ?? { accent: colors.system, glyph: '◆', name: 'cyan' },
  borealis: novaFactions[1] ?? { accent: '#e879f9', glyph: '●', name: 'fuchsia' },
} as const;

/** Micro uppercase label. Panel titles and units only. */
const label = {
  color: colors.inkFaint,
  fontFamily: fonts.sans,
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
} as const;

/** Numeric data. Tabular so digits do not shift as values change. */
const numeric = {
  fontFamily: fonts.mono,
  fontFeatureSettings: "'tnum'",
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Translucent, hairline-bordered, blurred: the game's HUD floating over the board. */
const hud = {
  backdropFilter: 'blur(18px) saturate(1.25)',
  background: 'color-mix(in oklab, #0b1220 78%, transparent)',
  border: `1px solid ${colors.hairline}`,
  borderRadius: 12,
  boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.05), 0 1.5rem 3.5rem rgb(0 0 0 / 0.6)',
} as const;

/** Trailer-card easing: fast out of the gate, long settle. */
const cardEasing = [0.16, 1, 0.3, 1] as const;

export { cardEasing, colors, factions, fonts, hud, label, numeric };
