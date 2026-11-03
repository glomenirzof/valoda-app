import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { StoredCard, StoredLog } from '../core/srs';
import { DEFAULT_SETTINGS, type Lang, type Settings } from '../core/types';

interface ValodaDB extends DBSchema {
  settings: { key: string; value: Settings };
  cards: { key: string; value: StoredCard };
  logs: { key: number; value: StoredLog; indexes: { byCard: string } };
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

export async function loadCards(lang: Lang): Promise<StoredCard[]> {
  try {
    return (await (await db()).getAll('cards')).filter((c) => c.lang === lang);
  } catch {
    return [];
  }
}

/** Saves the card and its review log in one transaction, so they never disagree. */
export async function saveReview(card: StoredCard, log?: StoredLog) {
  const tx = (await db()).transaction(['cards', 'logs'], 'readwrite');
  await tx.objectStore('cards').put(card);
  if (log) await tx.objectStore('logs').add(log);
  await tx.done;
}

/** Ask iOS not to evict IndexedDB under storage pressure (granted for home-screen apps). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
