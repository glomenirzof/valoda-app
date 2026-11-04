import { isDue, type StoredCard } from './srs';
import type { Phrase, Settings } from './types';

/**
 * One session = 1–3 minutes: a few new phrases and the reviews that are due.
 *
 * Path of a new phrase inside one session (design variant 5):
 *   intro (listen, tap words) → tiles (build it, one wrong-ending trap) → … other cards … → type (recall, write it)
 * Reviews alternate between typing and saying aloud.
 */
export type StepKind = 'intro' | 'tiles' | 'type' | 'say';
export interface Step { kind: StepKind; id: string }

export const MAX_NEW_PER_SESSION = 3;
export const MAX_REVIEWS_PER_SESSION = 10;
/** With this many reviews waiting, new phrases pause until the backlog shrinks. */
export const BACKLOG_PAUSE = 30;

/** Only phrases checked by the tutor or passed by content:check go into training. */
export const isTrainable = (p: Phrase) => p.status === 'tutor' || p.auto === 'ok';
export const trainable = (phrases: Phrase[], _s?: Settings) => phrases.filter(isTrainable);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function plan(phrases: Phrase[], cards: StoredCard[], s: Settings, now: Date) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const due = cards.filter((c) => isDue(c, now)).sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
  const introducedToday = cards.filter((c) => c.introduced >= startOfDay(now)).length;
  const paused = due.length >= BACKLOG_PAUSE;
  const newLeft = paused ? 0 : Math.max(0, s.newPerDay - introducedToday);
  // phrases.json is sorted by frequency, so the most useful phrases come first
  const fresh = trainable(phrases, s).filter((p) => !byId.has(p.id));
  const next = cards.filter((c) => !isDue(c, now) && c.fsrs.due.getTime() > now.getTime())
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())[0]?.fsrs.due ?? null;
  return { due, newLeft, paused, fresh, introducedToday, next };
}

export function buildQueue(phrases: Phrase[], cards: StoredCard[], s: Settings, now: Date): Step[] {
  const { due, newLeft, fresh } = plan(phrases, cards, s, now);
  const known = new Set(phrases.map((p) => p.id));
  const reviews: Step[] = due
    .filter((c) => known.has(c.id))
    .slice(0, MAX_REVIEWS_PER_SESSION)
    .map((c) => ({ kind: c.fsrs.reps % 2 ? 'say' : 'type', id: c.id }));
  const news = fresh.slice(0, Math.min(newLeft, MAX_NEW_PER_SESSION));

  // Each new phrase: intro + tiles now, its recall two cards later, reviews fill the gaps.
  const queue: Step[] = [];
  const pending: Step[] = [];
  for (const p of news) {
    queue.push({ kind: 'intro', id: p.id }, { kind: 'tiles', id: p.id });
    const r = reviews.shift();
    if (r) queue.push(r);
    const recall = pending.shift();
    if (recall) queue.push(recall);
    pending.push({ kind: 'type', id: p.id });
  }
  while (reviews.length || pending.length) {
    const r = reviews.shift();
    if (r) queue.push(r);
    const recall = pending.shift();
    if (recall) queue.push(recall);
  }
  return queue;
}
