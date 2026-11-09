import { backupName, makeBackup, readBackup, type BackupFile } from './backup';
import { dumpAll, restoreAll } from './db';

/**
 * Saves a backup file: through the share sheet where the browser can share files (iPhone: «Сохранить в Файлы»,
 * iCloud Drive), otherwise as a download.
 */
export async function saveBackupFile(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const text = makeBackup(await dumpAll());
  const file = new File([text], backupName(), { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Valoda — копия прогресса' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

/** Reads a backup file chosen by the learner; throws BackupError with a message to show. */
export async function openBackupFile(f: File): Promise<BackupFile> {
  return readBackup(await f.text());
}

export const restoreBackup = (b: BackupFile) => restoreAll(b.data);
