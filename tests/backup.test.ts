import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, backupDue, BackupError, makeBackup, progressMark, readBackup, type BackupData } from '../src/data/backup';
import { newCard, review } from '../src/core/srs';
import { DEFAULT_SETTINGS } from '../src/core/types';

const now = new Date('2026-11-10T10:00:00Z');
const { card, log } = review(newCard('lv-1', 'lv', now), 'good', now);
const data: BackupData = {
  settings: { ...DEFAULT_SETTINGS, onboarded: true },
  cards: [card],
  logs: [{ cardId: 'lv-1', ts: now.getTime(), grade: 'good', mode: 'ladder', hints: 0, log }],
  acquaint: [{ id: 'lv-2', lang: 'lv', started: now.getTime(), stage: 1 }],
  control: [{ ts: now.getTime(), lang: 'lv', total: 20, correct: 15, almost: 2 }],
};

describe('backup file', () => {
  it('round-trips progress, with FSRS dates back as dates', () => {
    const back = readBackup(makeBackup(data, now));
    expect(back.format).toBe(BACKUP_FORMAT);
    expect(back.exportedAt).toBe(now.toISOString());
    expect(back.data.cards[0].fsrs.due).toBeInstanceOf(Date);
    expect(back.data.cards[0].fsrs.due.getTime()).toBe(card.fsrs.due.getTime());
    expect(back.data.logs[0].log!.review).toBeInstanceOf(Date);
    expect(back.data).toEqual(data);
  });

  it('refuses other files, newer formats and damaged copies', () => {
    expect(() => readBackup('not json')).toThrow(BackupError);
    expect(() => readBackup(JSON.stringify({ app: 'other', format: 1, data })) ).toThrow(/не файл копии/);
    expect(() => readBackup(JSON.stringify({ app: 'valoda', format: BACKUP_FORMAT + 1, data }))).toThrow(/новой версией/);
    expect(() => readBackup(JSON.stringify({ app: 'valoda', format: 1, data: { cards: [] } }))).toThrow(/повреждён/);
  });
});

describe('daily backup offer', () => {
  const day = 86400000;
  it('offers once a day at most, only when progress changed', () => {
    const mark = progressMark(data.cards, data.acquaint, data.control);
    expect(backupDue(mark, undefined, now.getTime(), true)).toBe(true);
    expect(backupDue(mark, undefined, now.getTime(), false)).toBe(false); // nothing learned yet
    expect(backupDue(mark, { mark, offered: 0 }, now.getTime(), true)).toBe(false); // unchanged
    expect(backupDue('changed', { mark, offered: now.getTime() - day / 2 }, now.getTime(), true)).toBe(false); // too soon
    expect(backupDue('changed', { mark, offered: now.getTime() - day }, now.getTime(), true)).toBe(true);
  });

  it('the progress mark changes after an answer', () => {
    const before = progressMark(data.cards, data.acquaint, data.control);
    const after = progressMark([review(card, 'good', new Date(now.getTime() + 2 * 86400000)).card], data.acquaint, data.control);
    expect(after).not.toBe(before);
  });
});
