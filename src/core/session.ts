import type { LessonInput } from './ladder';
import { isDue, type StoredCard } from './srs';
import type { Phrase, Settings } from './types';

/**
 * One lesson: a few new phrases climbing the learning ladder (src/core/ladder.ts) and the FSRS reviews
 * that are due. New phrases enter FSRS only when they pass the last stage; until then they are
 * «знакомлюсь» (Acquaintance) and resume at S2 in the next lesson.
 */

export const MAX_NEW_PER_SESSION = 5;
export const MAX_REVIEWS_PER_SESSION = 10;
/** With this many reviews waiting, new phrases pause until the backlog shrinks. */
export const BACKLOG_PAUSE = 30;

/** A phrase met in a lesson but not yet passed to FSRS. */
export interface Acquaintance {
  id: string;
  lang: Phrase['lang'];
  /** when it was first shown (ms): counts against that day's new-phrase limit */
  started: number;
  /** highest stage passed so far */
  stage: number;
}

/** Only phrases checked by the tutor or passed by content:check go into training. */
export const isTrainable = (p: Phrase) => p.status === 'tutor' || p.auto === 'ok';
export const trainable = (phrases: Phrase[], _s?: Settings) => phrases.filter(isTrainable);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function plan(phrases: Phrase[], cards: StoredCard[], s: Settings, now: Date, acquainted: Acquaintance[] = []) {
  const inFsrs = new Set(cards.map((c) => c.id));
  const meeting = new Set(acquainted.map((a) => a.id));
  const due = cards.filter((c) => isDue(c, now)).sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
  // a phrase counts against the day it was first shown, whether it already graduated or not
  const introducedToday =
    cards.filter((c) => c.introduced >= startOfDay(now)).length + acquainted.filter((a) => a.started >= startOfDay(now)).length;
  const paused = due.length >= BACKLOG_PAUSE;
  const newLeft = paused ? 0 : Math.max(0, s.newPerDay - introducedToday);
  // phrases.json is sorted by frequency, so the most useful phrases come first
  const fresh = trainable(phrases, s).filter((p) => !inFsrs.has(p.id) && !meeting.has(p.id));
  const resume = acquainted.filter((a) => !inFsrs.has(a.id) && phrases.some((p) => p.id === a.id && isTrainable(p)));
  const next = cards.filter((c) => !isDue(c, now) && c.fsrs.due.getTime() > now.getTime())
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())[0]?.fsrs.due ?? null;
  return { due, newLeft, paused, fresh, resume, introducedToday, next };
}

/** Below this stability (days) a review is typed: the phrase is still fragile and typing checks every ending. */
export const TYPE_BELOW_STABILITY = 3;

/** Card type of a review: typed while stability < 3 days, then typing and saying aloud take turns. */
export const reviewMode = (c: StoredCard): 'type' | 'say' =>
  c.fsrs.stability < TYPE_BELOW_STABILITY ? 'type' : c.lastMode === 'say' ? 'type' : 'say';

/** What the next lesson contains: due reviews, «знакомлюсь» phrases first, then fresh ones (≤ 5 new in all). */
export function lessonInput(phrases: Phrase[], cards: StoredCard[], s: Settings, now: Date, acquainted: Acquaintance[] = []): LessonInput {
  const { due, newLeft, paused, fresh, resume } = plan(phrases, cards, s, now, acquainted);
  const known = new Set(phrases.map((p) => p.id));
  const reviews = due
    .filter((c) => known.has(c.id))
    .slice(0, MAX_REVIEWS_PER_SESSION)
    .map((c) => ({ id: c.id, mode: reviewMode(c) }));
  // phrases already met are finished first; they were counted on the day they started
  const again = paused ? [] : resume.slice(0, MAX_NEW_PER_SESSION).map((a) => a.id);
  const fill = Math.min(newLeft, MAX_NEW_PER_SESSION - again.length);
  return { reviews, acquainted: again, fresh: fresh.slice(0, Math.max(0, fill)).map((p) => p.id) };
}

export const lessonSize = (i: LessonInput) => i.reviews.length + i.acquainted.length + i.fresh.length;
