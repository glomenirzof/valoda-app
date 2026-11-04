/**
 * The learning ladder of a new phrase inside one lesson, before it reaches FSRS
 * (research §2.2, §2.5, §3.3: easy recognition first, production a few cards later):
 *
 *   S0 meet it (listen, tap words) → S1 hear it, pick the Russian meaning of 3
 *   → S2 build it from tiles → S3 type it with the first letter of each word given → S4 type it in full.
 *
 * The lesson queue is planned on the fly: after every answer the next stage of that phrase is put a few
 * cards ahead (LAG), a failed stage comes back 3 cards later (S3/S4 drop one stage). Two cards of the same
 * phrase are never shown in a row while any other card is left. Passing S4 graduates the phrase into FSRS.
 */

export type Stage = 0 | 1 | 2 | 3 | 4;
export type Item =
  | { kind: 'stage'; id: string; stage: Stage }
  | { kind: 'review'; id: string; mode: 'type' | 'say' };

/** Cards between the previous stage and stage N of the same phrase: [min, max]. */
export const LAG: Record<1 | 2 | 3 | 4, [number, number]> = { 1: [1, 2], 2: [2, 3], 3: [3, 4], 4: [4, 6] };
/** A failed stage comes back after this many cards. */
export const RETRY_LAG = 3;
/** Phrases already met in an earlier lesson resume here. */
export const RESUME_STAGE: Stage = 2;

export interface LessonInput {
  /** due FSRS cards, in the order they should come */
  reviews: { id: string; mode: 'type' | 'say' }[];
  /** phrases met before but not yet in FSRS («знакомлюсь»): start at S2 */
  acquainted: string[];
  /** phrases never shown: start at S0 */
  fresh: string[];
}

export interface Lesson {
  queue: Item[];
  /** items already answered, in order */
  shown: Item[];
  /** highest stage passed per new phrase in this lesson (-1 = started, nothing passed yet) */
  reached: Record<string, number>;
  graduated: string[];
  /** reviews that already got their one extra try */
  retried: string[];
}

export type Rng = () => number;

const pick = ([min, max]: [number, number], rng: Rng) => min + Math.floor(rng() * (max - min + 1));
const sameId = (a: Item | undefined, id: string) => a?.id === id;

/** First cards: new phrases and reviews alternate, so stages of different phrases have something between them. */
export function startLesson(input: LessonInput): Lesson {
  const starts: Item[] = [
    ...input.acquainted.map((id) => ({ kind: 'stage', id, stage: RESUME_STAGE }) as Item),
    ...input.fresh.map((id) => ({ kind: 'stage', id, stage: 0 }) as Item),
  ];
  const reviews: Item[] = input.reviews.map((r) => ({ kind: 'review', id: r.id, mode: r.mode }));
  const queue: Item[] = [];
  while (starts.length || reviews.length) {
    const s = starts.shift();
    if (s) queue.push(s);
    const r = reviews.shift();
    if (r) queue.push(r);
  }
  const reached: Record<string, number> = {};
  for (const it of queue) if (it.kind === 'stage') reached[it.id] = it.stage === RESUME_STAGE && input.acquainted.includes(it.id) ? 1 : -1;
  return { queue, shown: [], reached, graduated: [], retried: [] };
}

export const current = (l: Lesson): Item | undefined => l.queue[0];
export const finished = (l: Lesson) => l.queue.length === 0;

/**
 * Puts `item` about `lag` cards ahead in `queue` (the card just answered is already removed).
 * Moves it later (or, at the end of the queue, earlier) when a neighbour is the same phrase;
 * index 0 would follow the card just shown, which is the same phrase, so it is used only if nothing else is left.
 */
export function place(queue: Item[], item: Item, lag: number): Item[] {
  const q = [...queue];
  const ok = (i: number) => i >= 1 && !sameId(q[i - 1], item.id) && !sameId(q[i], item.id);
  let at = Math.min(lag, q.length);
  if (!ok(at)) {
    let found = -1;
    for (let i = at + 1; i <= q.length && found < 0; i++) if (ok(i)) found = i;
    for (let i = at - 1; i >= 1 && found < 0; i--) if (ok(i)) found = i;
    at = found >= 0 ? found : q.length;
  }
  q.splice(at, 0, item);
  return q;
}

export type Answer =
  | { pass: true; known?: false }
  | { pass: false }
  /** «Уже знаю» on S0: straight to the full typed test */
  | { known: true };

export interface Step { lesson: Lesson; graduated?: string }

/** Answer to the current stage card. */
export function answerStage(l: Lesson, a: Answer, rng: Rng = Math.random): Step {
  const it = l.queue[0];
  if (!it || it.kind !== 'stage') throw new Error('current card is not a stage');
  const rest = l.queue.slice(1);
  const reached = { ...l.reached };
  const base = { ...l, shown: [...l.shown, it], reached };

  if ('known' in a && a.known) {
    return { lesson: { ...base, queue: place(rest, { kind: 'stage', id: it.id, stage: 4 }, 1) } };
  }
  if ('pass' in a && a.pass) {
    reached[it.id] = Math.max(reached[it.id] ?? -1, it.stage);
    if (it.stage === 4) return { lesson: { ...base, queue: rest, graduated: [...l.graduated, it.id] }, graduated: it.id };
    const next = (it.stage + 1) as 1 | 2 | 3 | 4;
    return { lesson: { ...base, queue: place(rest, { kind: 'stage', id: it.id, stage: next }, pick(LAG[next], rng)) } };
  }
  // failed: the same stage again, or one lower for the typed stages
  const again = (it.stage >= 3 ? it.stage - 1 : it.stage) as Stage;
  return { lesson: { ...base, queue: place(rest, { kind: 'stage', id: it.id, stage: again }, RETRY_LAG) } };
}

/** Answer to the current review card; a forgotten card gets one more try, said aloud, at the end. */
export function answerReview(l: Lesson, forgot: boolean): Step {
  const it = l.queue[0];
  if (!it || it.kind !== 'review') throw new Error('current card is not a review');
  let queue = l.queue.slice(1);
  let retried = l.retried;
  if (forgot && !retried.includes(it.id)) {
    queue = place(queue, { kind: 'review', id: it.id, mode: 'say' }, queue.length);
    retried = [...retried, it.id];
  }
  return { lesson: { ...l, queue, retried, shown: [...l.shown, it] } };
}

/**
 * New phrases actually met in this lesson (answered at least once, or on screen now) that did not pass S4:
 * they stay «знакомлюсь» and resume at S2 next time. Phrases queued but never shown do not count.
 */
export function unfinished(l: Lesson): string[] {
  const met = new Set(l.shown.filter((it) => it.kind === 'stage').map((it) => it.id));
  const now = l.queue[0];
  if (now?.kind === 'stage') met.add(now.id);
  return [...met].filter((id) => !l.graduated.includes(id));
}
