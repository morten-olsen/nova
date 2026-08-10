import type { editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';

import { getScriptModel, setupMonaco } from './monaco-setup.ts';

type ScriptEditorProps = {
  onChange: (value: string) => void;
  /** Run the script. Wired to Cmd/Ctrl+Enter, the shortcut this loop lives on. */
  onRun: () => void;
  /** Wired to Cmd/Ctrl+S, which must also stop the browser's Save Page dialog. */
  onSave: () => void;
  value: string;
};

const ScriptEditor = ({ onChange, onRun, onSave, value }: ScriptEditorProps): React.ReactNode => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  // Held in refs so remounting the editor is never needed just to see a fresh
  // closure — Monaco keeps the handler it was given at creation. Synced in an
  // effect rather than during render, which React forbids.
  const onRunRef = useRef(onRun);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onRunRef.current = onRun;
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const monaco = setupMonaco();
    const instance = monaco.editor.create(container, {
      model: getScriptModel(value),
      theme: 'nova',
      automaticLayout: true,
      fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.6,
      minimap: { enabled: false },
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: 'line',
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
    });
    editorRef.current = instance;

    const changed = instance.onDidChangeModelContent(() => onChangeRef.current(instance.getValue()));
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current());

    return () => {
      changed.dispose();
      // The editor goes; the model stays. Disposing a model the TypeScript
      // worker still holds an in-flight request for is what produces
      // "Could not find source file: 'inmemory://model/N'" — StrictMode
      // mounts twice, and the second mount raced the first one's teardown.
      instance.dispose();
      editorRef.current = null;
    };
    // Created once. `value` is seeded here and afterwards synchronised below,
    // because recreating the editor on every keystroke would lose the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only writes back when the two genuinely differ, which is the case when a
  // different script is opened — not when the user is typing.
  useEffect(() => {
    const instance = editorRef.current;
    if (instance && instance.getValue() !== value) {
      instance.setValue(value);
    }
  }, [value]);

  return <div className="h-full w-full" ref={containerRef} />;
};

export { ScriptEditor };
