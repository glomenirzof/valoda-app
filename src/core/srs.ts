import { createEmptyCard, fsrs, Rating, State, type Card, type ReviewLog } from 'ts-fsrs';
import type { Lang } from './types';

// FSRS-6 via ts-fsrs 5.4.2 (pinned). Target retention 90 %; fuzz spreads due dates of cards learned together.
// Learning steps 10 min and 1 day, relearning 10 min (research §3.4): a phrase that graduated from the
// lesson ladder comes back in the next micro-session and again the next day before long intervals start.
export const FSRS_PARAMS = {
  request_retention: 0.9,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['10m', '1d'] as const,
  relearning_steps: ['10m'] as const,
};
const scheduler = fsrs({ ...FSRS_PARAMS, learning_steps: [...FSRS_PARAMS.learning_steps], relearning_steps: [...FSRS_PARAMS.relearning_steps] });

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
  /** card type of the last FSRS review: stable phrases alternate typing and saying */
  lastMode?: 'type' | 'say';
  /** known by the placement test: never shown as new, so it does not count against a day's new phrases */
  placed?: true;
}

export interface StoredLog {
  cardId: string;
  ts: number;
  grade: Grade;
  /** which card type produced the grade; 'ladder' = the first grade, when a new phrase passes S4; 'tiles' = relearning; 'placement' = known by the placement test */
  mode: 'type' | 'say' | 'known' | 'ladder' | 'tiles' | 'placement';
  hints: number;
  /** FSRS log; absent for learning answers */
  log?: ReviewLog;
  /** practice inside a lesson (mini-ladder after a forgotten review): not written to FSRS */
  learning?: true;
}

export const newCard = (id: string, lang: Lang, now: Date, introduced = now.getTime()): StoredCard => ({
  id,
  lang,
  fsrs: createEmptyCard(now),
  introduced,
  weak: {},
});

/** First FSRS grade of a phrase that passed the ladder: Good when typed clean, Hard with hints or missing marks. Never Easy. */
export const graduationGrade = (o: { verdict: 'ok' | 'almost' | 'bad'; hints: number }): Grade =>
  o.verdict === 'ok' && o.hints === 0 ? 'good' : 'hard';

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
