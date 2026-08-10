import type * as monaco from 'monaco-editor';

/**
 * Editor colours drawn from the same tokens as the board and the HUD, so the
 * code panel reads as part of the game rather than an embedded IDE.
 */
const novaEditorTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'e9eff8', background: '0b1220' },
    { token: 'comment', foreground: '5d6b81', fontStyle: 'italic' },
    { token: 'keyword', foreground: '38bdf8' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'string', foreground: 'a3e635' },
    { token: 'type', foreground: '7dd3fc' },
    { token: 'delimiter', foreground: '93a2b8' },
    { token: 'identifier', foreground: 'e9eff8' },
  ],
  colors: {
    'editor.background': '#0b1220',
    'editor.foreground': '#e9eff8',
    'editorLineNumber.foreground': '#31405a',
    'editorLineNumber.activeForeground': '#93a2b8',
    'editorCursor.foreground': '#38bdf8',
    'editor.selectionBackground': '#1f3550',
    'editor.lineHighlightBackground': '#131d3055',
    'editorIndentGuide.background1': '#1f2b40',
    'editorIndentGuide.activeBackground1': '#2c3c58',
    'editorWidget.background': '#131d30',
    'editorWidget.border': '#1f2b40',
    'editorSuggestWidget.selectedBackground': '#1f3550',
    'editorError.foreground': '#fb7185',
    'editorWarning.foreground': '#fbbf24',
    'scrollbarSlider.background': '#1f2b4088',
  },
};

export { novaEditorTheme };
