import { parseRecording, type GameRecording } from '@morten-olsen/nova-game';

type EmbeddedRecording = {
  name: string;
  recording: GameRecording;
};

const gameScriptType = 'application/vnd.project-nova.game+json';

const loadEmbeddedRecording = (): EmbeddedRecording => {
  const element = document.querySelector<HTMLScriptElement>(`script[type="${gameScriptType}"]`);
  if (!element) {
    throw new Error('No game recording was supplied. Run `nova play --file game.json` to open a replay.');
  }

  return {
    name: element.dataset.name ?? 'game.json',
    recording: parseRecording(element.textContent ?? ''),
  };
};

export { gameScriptType, loadEmbeddedRecording };
export type { EmbeddedRecording };
