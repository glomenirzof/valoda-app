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
 *
 * A review answered «Не вспомнил» gets a mini-ladder in the same lesson: tiles (S2) 3 cards later, then the
 * full typed answer (S4) 3–5 cards after that. Only the first answer of the review goes to FSRS; the
 * mini-ladder is practice (`relearn: true`) and its answers are logged as learning only.
 */

export type Stage = 0 | 1 | 2 | 3 | 4;
export type Item =
  /** `relearn`: mini-ladder after a forgotten review; the phrase is already in FSRS */
  | { kind: 'stage'; id: string; stage: Stage; relearn?: true }
  | { kind: 'review'; id: string; mode: 'type' | 'say' };

/** Cards between the previous stage and stage N of the same phrase: [min, max]. */
export const LAG: Record<1 | 2 | 3 | 4, [number, number]> = { 1: [1, 2], 2: [2, 3], 3: [3, 4], 4: [4, 6] };
/** A failed stage comes back after this many cards. */
export const RETRY_LAG = 3;
/** Phrases already met in an earlier lesson resume here. */
export const RESUME_STAGE: Stage = 2;
/** Mini-ladder after a forgotten review: tiles RETRY_LAG cards later, then the full typed answer this many cards after. */
export const RELEARN_LAG: [number, number] = [3, 5];

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
  return { queue, shown: [], reached, graduated: [] };
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
  const base = { ...l, shown: [...l.shown, it] };
  if (it.relearn) return { lesson: { ...base, queue: relearnNext(rest, it, 'pass' in a && a.pass, rng) } };

  const reached = { ...l.reached };
  const lesson = { ...base, reached };
  if ('known' in a && a.known) {
    return { lesson: { ...lesson, queue: place(rest, { kind: 'stage', id: it.id, stage: 4 }, 1) } };
  }
  if ('pass' in a && a.pass) {
    reached[it.id] = Math.max(reached[it.id] ?? -1, it.stage);
    if (it.stage === 4) return { lesson: { ...lesson, queue: rest, graduated: [...l.graduated, it.id] }, graduated: it.id };
    const next = (it.stage + 1) as 1 | 2 | 3 | 4;
    return { lesson: { ...lesson, queue: place(rest, { kind: 'stage', id: it.id, stage: next }, pick(LAG[next], rng)) } };
  }
  // failed: the same stage again, or one lower for the typed stages
  const again = (it.stage >= 3 ? it.stage - 1 : it.stage) as Stage;
  return { lesson: { ...lesson, queue: place(rest, { kind: 'stage', id: it.id, stage: again }, RETRY_LAG) } };
}

/** Mini-ladder S2 → S4: a pass at S2 brings S4 3–5 cards later, a pass at S4 ends it; a failure goes back to S2. */
function relearnNext(rest: Item[], it: Extract<Item, { kind: 'stage' }>, pass: boolean, rng: Rng): Item[] {
  if (pass && it.stage === 4) return rest;
  if (pass) return place(rest, { kind: 'stage', id: it.id, stage: 4, relearn: true }, pick(RELEARN_LAG, rng));
  return place(rest, { kind: 'stage', id: it.id, stage: 2, relearn: true }, RETRY_LAG);
}

/**
 * Answer to the current review card. Only this answer goes to FSRS. A forgotten phrase gets the mini-ladder:
 * tiles 3 cards later (there is no immediate «say it again» — it would come a minute after seeing the answer).
 */
export function answerReview(l: Lesson, forgot: boolean): Step {
  const it = l.queue[0];
  if (!it || it.kind !== 'review') throw new Error('current card is not a review');
  let queue = l.queue.slice(1);
  if (forgot) queue = place(queue, { kind: 'stage', id: it.id, stage: 2, relearn: true }, RETRY_LAG);
  return { lesson: { ...l, queue, shown: [...l.shown, it] } };
}

/**
 * New phrases actually met in this lesson (answered at least once, or on screen now) that did not pass S4:
 * they stay «знакомлюсь» and resume at S2 next time. Phrases queued but never shown do not count.
 */
export function unfinished(l: Lesson): string[] {
  const isNew = (it: Item | undefined) => it?.kind === 'stage' && !it.relearn;
  const met = new Set(l.shown.filter(isNew).map((it) => it.id));
  const now = l.queue[0];
  if (now && isNew(now)) met.add(now.id);
  return [...met].filter((id) => !l.graduated.includes(id));
}
