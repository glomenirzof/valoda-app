import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Settings } from '../core/types';

interface ValodaDB extends DBSchema {
  settings: { key: string; value: Settings };
  // cards and logs are filled from step 4 (FSRS); created now to avoid a migration
  cards: { key: string; value: { id: string } & Record<string, unknown> };
  logs: { key: number; value: { cardId: string; ts: number } & Record<string, unknown>; indexes: { byCard: string } };
}

let dbp: Promise<IDBPDatabase<ValodaDB>> | null = null;

export function db() {
  dbp ??= openDB<ValodaDB>('valoda', 1, {
    upgrade(d) {
      d.createObjectStore('settings');
      d.createObjectStore('cards', { keyPath: 'id' });
      d.createObjectStore('logs', { autoIncrement: true }).createIndex('byCard', 'cardId');
    },
  });
  return dbp;
}

export async function loadSettings(): Promise<Settings> {
  try {
    return { ...DEFAULT_SETTINGS, ...((await (await db()).get('settings', 'main')) ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings) {
  await (await db()).put('settings', s, 'main');
}

/** Ask iOS not to evict IndexedDB under storage pressure (granted for home-screen apps). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
