import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ControlResult } from '../core/progress';
import type { Acquaintance } from '../core/session';
import type { StoredCard, StoredLog } from '../core/srs';
import { DEFAULT_SETTINGS, type Lang, type Settings } from '../core/types';

interface ValodaDB extends DBSchema {
  settings: { key: string; value: Settings };
  cards: { key: string; value: StoredCard };
  logs: { key: number; value: StoredLog; indexes: { byCard: string } };
  /** v2: phrases met in a lesson but not yet passed to FSRS («знакомлюсь») */
  acquaint: { key: string; value: Acquaintance };
  /** v3: weekly control test results */
  control: { key: number; value: ControlResult };
}

let dbp: Promise<IDBPDatabase<ValodaDB>> | null = null;

export function db() {
  dbp ??= openDB<ValodaDB>('valoda', 3, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('settings');
        d.createObjectStore('cards', { keyPath: 'id' });
        d.createObjectStore('logs', { autoIncrement: true }).createIndex('byCard', 'cardId');
      }
      if (oldVersion < 2) d.createObjectStore('acquaint', { keyPath: 'id' });
      if (oldVersion < 3) d.createObjectStore('control', { keyPath: 'ts' });
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

/** A log without a card change: answers in the mini-ladder after a forgotten review (learning: true). */
export async function saveLog(log: StoredLog) {
  await (await db()).add('logs', log);
}

export async function loadAcquaint(lang: Lang): Promise<Acquaintance[]> {
  try {
    return (await (await db()).getAll('acquaint')).filter((a) => a.lang === lang);
  } catch {
    return [];
  }
}

export async function saveAcquaint(a: Acquaintance) {
  await (await db()).put('acquaint', a);
}

/** A phrase passed the last ladder stage: its FSRS card and first log are stored and it stops being «знакомлюсь». */
export async function graduate(card: StoredCard, log: StoredLog) {
  const tx = (await db()).transaction(['cards', 'logs', 'acquaint'], 'readwrite');
  await tx.objectStore('cards').put(card);
  await tx.objectStore('logs').add(log);
  await tx.objectStore('acquaint').delete(card.id);
  await tx.done;
}

export async function loadControl(lang: Lang): Promise<ControlResult[]> {
  try {
    return (await (await db()).getAll('control')).filter((r) => r.lang === lang).sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

export async function saveControl(r: ControlResult) {
  await (await db()).put('control', r);
}

/** Ask iOS not to evict IndexedDB under storage pressure (granted for home-screen apps). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
