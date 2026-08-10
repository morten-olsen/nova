import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

type ScriptRecord = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * A point-in-time copy of a script.
 *
 * Kept because tuning a bot is guess-and-check: the run that scored well is
 * often three edits ago, and without history that version is simply gone.
 */
type ScriptRevision = {
  id: string;
  scriptId: string;
  content: string;
  savedAt: number;
};

type LabSchema = DBSchema & {
  scripts: {
    key: string;
    value: ScriptRecord;
    indexes: { 'by-updated': number };
  };
  revisions: {
    key: string;
    value: ScriptRevision;
    indexes: { 'by-script': string };
  };
};

const databaseName = 'nova-android-lab';

let connection: Promise<IDBPDatabase<LabSchema>> | undefined;

const connect = (): Promise<IDBPDatabase<LabSchema>> => {
  connection ??= openDB<LabSchema>(databaseName, 1, {
    upgrade: (db) => {
      const scripts = db.createObjectStore('scripts', { keyPath: 'id' });
      scripts.createIndex('by-updated', 'updatedAt');
      const revisions = db.createObjectStore('revisions', { keyPath: 'id' });
      revisions.createIndex('by-script', 'scriptId');
    },
  });
  return connection;
};

const createId = (): string => crypto.randomUUID();

const listScripts = async (): Promise<ScriptRecord[]> => {
  const db = await connect();
  const scripts = await db.getAllFromIndex('scripts', 'by-updated');
  return scripts.reverse();
};

const getScript = async (id: string): Promise<ScriptRecord | undefined> => {
  const db = await connect();
  return db.get('scripts', id);
};

/**
 * Creates the seed script only if the library is empty.
 *
 * Counting and inserting happen inside one readwrite transaction because the
 * check-then-create pattern is a race: StrictMode invokes the bootstrap effect
 * twice, both reads resolved before either wrote, and the library opened with
 * two identical starter scripts. IndexedDB serialises transactions, so doing
 * both halves inside one closes the window for good — including across tabs.
 */
const seedIfEmpty = async (name: string, content: string): Promise<void> => {
  const db = await connect();
  const tx = db.transaction('scripts', 'readwrite');
  const store = tx.objectStore('scripts');
  if ((await store.count()) === 0) {
    const now = Date.now();
    await store.put({ id: createId(), name, content, createdAt: now, updatedAt: now });
  }
  await tx.done;
};

const createScript = async (name: string, content: string): Promise<ScriptRecord> => {
  const db = await connect();
  const now = Date.now();
  const script: ScriptRecord = { id: createId(), name, content, createdAt: now, updatedAt: now };
  await db.put('scripts', script);
  return script;
};

/** Writes the working copy. Pair with {@link saveRevision} to also checkpoint it. */
const updateScript = async (id: string, changes: Partial<Pick<ScriptRecord, 'name' | 'content'>>): Promise<void> => {
  const db = await connect();
  const existing = await db.get('scripts', id);
  if (!existing) {
    return;
  }
  await db.put('scripts', { ...existing, ...changes, updatedAt: Date.now() });
};

const deleteScript = async (id: string): Promise<void> => {
  const db = await connect();
  const tx = db.transaction(['scripts', 'revisions'], 'readwrite');
  const revisions = await tx.objectStore('revisions').index('by-script').getAllKeys(id);
  await Promise.all([
    tx.objectStore('scripts').delete(id),
    ...revisions.map((key) => tx.objectStore('revisions').delete(key)),
    tx.done,
  ]);
};

const saveRevision = async (scriptId: string, content: string): Promise<void> => {
  const db = await connect();
  const latest = await listRevisions(scriptId);
  // Saving without having changed anything is not a checkpoint worth keeping.
  if (latest[0]?.content === content) {
    return;
  }
  await db.put('revisions', { id: createId(), scriptId, content, savedAt: Date.now() });
};

const listRevisions = async (scriptId: string): Promise<ScriptRevision[]> => {
  const db = await connect();
  const revisions = await db.getAllFromIndex('revisions', 'by-script', scriptId);
  return revisions.sort((a, b) => b.savedAt - a.savedAt);
};

export type { ScriptRecord, ScriptRevision };
export { createScript, deleteScript, getScript, listRevisions, listScripts, saveRevision, seedIfEmpty, updateScript };
