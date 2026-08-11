import type { ThemeRegistration } from 'shiki';

/**
 * Syntax colours for code on the documentation pages.
 *
 * Deliberately the same assignments as the browser lab's editor theme in
 * `apps/ide/src/editor/monaco-theme.ts`, which in turn comes from the palette in
 * `packages/renderer/src/nova-palette.ts`. A reader who moves between the
 * rulebook and the lab should not feel they changed product: keywords are the
 * system cyan, numbers the energy amber, strings the acid green.
 *
 * Change a colour in the palette first, then mirror it here and in the editor.
 */
const novaCodeTheme: ThemeRegistration = {
  name: 'nova',
  type: 'dark',
  colors: {
    'editor.background': '#0b1220',
    'editor.foreground': '#e9eff8',
  },
  settings: [
    { settings: { background: '#0b1220', foreground: '#e9eff8' } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#5d6b81', fontStyle: 'italic' } },
    {
      scope: ['keyword', 'storage', 'storage.type', 'keyword.control', 'variable.language'],
      settings: { foreground: '#38bdf8' },
    },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#fbbf24' } },
    { scope: ['string', 'string.quoted', 'punctuation.definition.string'], settings: { foreground: '#a3e635' } },
    {
      scope: ['entity.name.type', 'support.type', 'support.class', 'entity.name.class'],
      settings: { foreground: '#7dd3fc' },
    },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#e9eff8' } },
    { scope: ['punctuation', 'meta.brace'], settings: { foreground: '#93a2b8' } },
    { scope: ['variable', 'variable.other', 'meta.object-literal.key'], settings: { foreground: '#e9eff8' } },
    { scope: ['invalid', 'invalid.illegal'], settings: { foreground: '#fb7185' } },
  ],
};

export { novaCodeTheme };
