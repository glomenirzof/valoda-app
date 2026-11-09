/**
 * Progress backup: everything the learner has done, in one JSON file with a format version, to keep in
 * Files / iCloud and to bring back on a new phone. The phrases themselves ship with the app and are not in it.
 */
import type { ControlResult } from '../core/progress';
import type { Acquaintance } from '../core/session';
import type { StoredCard, StoredLog } from '../core/srs';
import type { Settings } from '../core/types';

export const BACKUP_FORMAT = 1;
export const BACKUP_APP = 'valoda';

export interface BackupData {
  settings: Settings | null;
  cards: StoredCard[];
  logs: StoredLog[];
  acquaint: Acquaintance[];
  control: ControlResult[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  data: BackupData;
}

export class BackupError extends Error {}

/** Date fields of FSRS cards and logs: written as ISO strings, read back as dates. */
const DATE_KEYS = new Set(['due', 'last_review', 'review']);

export function makeBackup(data: BackupData, now = new Date()): string {
  const file: BackupFile = { app: BACKUP_APP, format: BACKUP_FORMAT, exportedAt: now.toISOString(), data };
  return JSON.stringify(file);
}

export function readBackup(text: string): BackupFile {
  let file: BackupFile;
  try {
    file = JSON.parse(text, (k, v) => (DATE_KEYS.has(k) && typeof v === 'string' ? new Date(v) : v));
  } catch {
    throw new BackupError('Это не файл копии Valoda: не читается как JSON');
  }
  if (file?.app !== BACKUP_APP) throw new BackupError('Это не файл копии Valoda');
  if (typeof file.format !== 'number' || file.format > BACKUP_FORMAT) {
    throw new BackupError('Копия сделана более новой версией приложения — обнови приложение');
  }
  const d = file.data;
  if (!d || !Array.isArray(d.cards) || !Array.isArray(d.logs) || !Array.isArray(d.acquaint) || !Array.isArray(d.control)) {
    throw new BackupError('Файл копии повреждён: не хватает данных');
  }
  for (const c of d.cards) {
    if (!c.id || !(c.fsrs?.due instanceof Date) || isNaN(c.fsrs.due.getTime())) throw new BackupError(`Файл копии повреждён: карточка ${c.id ?? '?'}`);
  }
  return file;
}

/** A short fingerprint of progress: changes after every answer, lesson or test. */
export const progressMark = (cards: StoredCard[], acquaint: Acquaintance[], control: ControlResult[]) =>
  `${cards.length}:${cards.reduce((n, c) => n + c.fsrs.reps, 0)}:${acquaint.length}:${control.length}`;

/** Offer a backup once a day at most, and only when progress changed since the last one. */
export const backupDue = (mark: string, last: { mark: string; offered: number } | undefined, now: number, hasProgress: boolean) =>
  hasProgress && mark !== last?.mark && now - (last?.offered ?? 0) >= 86400000;

export const backupName = (now = new Date()) => `valoda-${now.toISOString().slice(0, 10)}.json`;
