import { useRef, useState } from 'react';
import { ZodError } from 'zod';

import type { Recording } from '../game/recording.ts';
import { parseRecording } from '../game/recording.ts';

type RecordingLoaderProps = {
  onLoad: (recording: Recording, name: string) => void;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(', ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const RecordingLoader = ({ onLoad }: RecordingLoaderProps): React.ReactNode => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File): Promise<void> => {
    try {
      const content = await file.text();
      onLoad(parseRecording(content), file.name);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Load recording</h2>
          <p className="mt-1 text-sm text-slate-400">Upload a Project Nova JSON game file to scrub event by event.</p>
        </div>
        <button
          className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          Choose JSON
        </button>
      </div>
      <input
        ref={inputRef}
        accept="application/json,.json"
        className="hidden"
        type="file"
        onChange={(event) => {
          const [file] = event.currentTarget.files ?? [];
          if (file) {
            void handleFile(file);
          }
        }}
      />
      {error ? <p className="mt-4 rounded-xl bg-red-950/50 p-3 text-sm text-red-200">{error}</p> : null}
    </section>
  );
};

export { RecordingLoader };
