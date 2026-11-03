import { createEmptyCard, fsrs, Rating, State, type Card, type ReviewLog } from 'ts-fsrs';
import type { Lang } from './types';

// FSRS-6 via ts-fsrs 5.4.2 (pinned). Target retention 90 %; fuzz spreads due dates of cards learned together.
const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true });

export type Grade = 'again' | 'hard' | 'good' | 'easy';
const RATING = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy } as const;

export interface StoredCard {
  /** phrase id */
  id: string;
  lang: Lang;
  fsrs: Card;
  /** when the phrase was first shown (ms) */
  introduced: number;
  /** lemmas that needed hints or had mistakes, with counts: input for ending drills later */
  weak: Record<string, number>;
}

export interface StoredLog {
  cardId: string;
  ts: number;
  grade: Grade;
  /** which card type produced the grade */
  mode: 'type' | 'say' | 'known';
  hints: number;
  log: ReviewLog;
}

export const newCard = (id: string, lang: Lang, now: Date): StoredCard => ({
  id,
  lang,
  fsrs: createEmptyCard(now),
  introduced: now.getTime(),
  weak: {},
});

export function review(c: StoredCard, g: Grade, now: Date): { card: StoredCard; log: ReviewLog } {
  const { card, log } = scheduler.next(c.fsrs, now, RATING[g]);
  return { card: { ...c, fsrs: card }, log };
}

export const isDue = (c: StoredCard, now: Date) => c.fsrs.state !== State.New && c.fsrs.due.getTime() <= now.getTime();

/** "через 10 мин", "завтра", "через 4 дня", "12 ноября" */
export function whenRu(due: Date, now: Date): string {
  const min = Math.round((due.getTime() - now.getTime()) / 60000);
  if (min <= 1) return 'через минуту';
  if (min < 60) return `через ${min} мин`;
  if (min < 60 * 20) return `через ${Math.round(min / 60)} ч`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(due) - day(now)) / 86400000);
  if (days <= 1) return 'завтра';
  if (days < 5) return `через ${days} дня`;
  if (days < 8) return `через ${days} дней`;
  return due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
