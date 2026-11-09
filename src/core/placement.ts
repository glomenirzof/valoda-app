/**
 * Adaptive placement test. The learner's level is estimated as a vocabulary size V (how many of the most
 * frequent words they know), on a log scale θ = ln V. Every question has a difficulty on the same scale:
 * the corpus frequency rank of its word (a phrase: of its rarest word, plus a little for grammar).
 *
 * After each answer a posterior over θ is updated with a logistic model P(right) = 1 / (1 + e^(−a(θ − d)));
 * the next question is the unasked one closest to the current estimate, so right answers make the test
 * harder and mistakes make it easier. It stops after 15 questions once the estimate is tight, at 25 at most.
 *
 * Question kinds: a phrase RU → LV typed, a word RU → LV typed, an ending (preposition + case, typed),
 * «знаю / не знаю» for real words from frequency bands past the phrase base, and invented words: saying
 * «знаю» to one of those is guessing, and then the «знаю» answers stop counting.
 */
import { newCard, review, type StoredCard, type StoredLog } from './srs';
import type { Lang, Phrase } from './types';

export interface PlacementData {
  /** corpus frequency rank of every word used in the phrases */
  lemmaRank: Record<string, number>;
  /** real words for «знаю / не знаю», with their rank */
  words: { w: string; rank: number }[];
  /** invented words that look Latvian */
  fakes: string[];
}

export type Question =
  | { kind: 'phrase'; key: string; d: number; id: string }
  | { kind: 'word'; key: string; d: number; id: string; lemma: string; ru: string }
  | { kind: 'ending'; key: string; d: number; id: string; i: number }
  | { kind: 'yesno'; key: string; d: number; word: string }
  | { kind: 'fake'; key: string; d: number; word: string };

export interface Answer { q: Question; right: boolean }

export const MIN_Q = 15;
export const MAX_Q = 25;
/** stop once the estimate is within about ±40 % of the vocabulary size */
export const SD_STOP = 0.35;
/** slope of the response curve: one e-fold of vocabulary takes a word from 50 % to 88 % known */
export const SLOPE = 2;
/** «знаю» is self-reported: it counts half as much as a typed answer */
const YESNO_WEIGHT = 0.5;
/** questions at these positions are invented words */
const FAKE_AT = [4, 10, 16];
/** order of typed and «знаю» questions */
const CYCLE: Question['kind'][] = ['phrase', 'word', 'ending', 'phrase', 'yesno', 'word'];

const GRID = Array.from({ length: 121 }, (_, i) => Math.log(10) + (i / 120) * (Math.log(15000) - Math.log(10)));
const ln = Math.log;
const rankOf = (r: number | null | undefined) => Math.max(r ?? 20, 20);

/** All questions the base and the placement data allow. */
export function questionPool(phrases: Phrase[], data: PlacementData): Question[] {
  const pool: Question[] = [];
  const seenLemma = new Set<string>();
  for (const p of phrases) {
    if (!p.order) continue;
    // a phrase needs its rarest word plus some grammar: longer phrases are a little harder
    pool.push({ kind: 'phrase', key: `p:${p.id}`, id: p.id, d: ln(rankOf(p.freqRank)) + 0.15 * (p.tokens.length - 1) });
    p.tokens.forEach((t, i) => {
      const lemma = t.lemma.toLowerCase();
      const r = data.lemmaRank[lemma];
      if (r && t.ru && ['NOUN', 'VERB', 'ADJ', 'ADV'].includes(t.pos) && !seenLemma.has(lemma)) {
        seenLemma.add(lemma);
        pool.push({ kind: 'word', key: `w:${lemma}`, id: p.id, lemma: t.lemma, ru: t.ru.split(';')[0].trim(), d: ln(rankOf(r)) });
      }
      const prev = p.tokens[i - 1];
      if (prev?.pos === 'ADP' && t.pos === 'NOUN' && t.s.toLowerCase() !== t.lemma.toLowerCase() && r) {
        // choosing the case after a preposition is grammar on top of knowing the word
        pool.push({ kind: 'ending', key: `e:${p.id}:${i}`, id: p.id, i, d: ln(rankOf(r)) + 0.5 });
      }
    });
  }
  for (const w of data.words) pool.push({ kind: 'yesno', key: `y:${w.w}`, word: w.w, d: ln(w.rank) });
  for (const f of data.fakes) pool.push({ kind: 'fake', key: `f:${f}`, word: f, d: 0 });
  return pool;
}

const pRight = (theta: number, d: number) => 1 / (1 + Math.exp(-SLOPE * (theta - d)));

/** «знаю» to an invented word: then no «знаю» answer can be trusted. */
export const falseAlarms = (answers: Answer[]) => answers.filter((a) => a.q.kind === 'fake' && a.right === false).length;

/** Posterior over the grid: a gentle prior around a beginner's vocabulary, then every answer. */
export function posterior(answers: Answer[]) {
  const trustYes = falseAlarms(answers) === 0;
  const logp = GRID.map((t) => -((t - ln(150)) ** 2) / (2 * 1.6 ** 2));
  for (const a of answers) {
    if (a.q.kind === 'fake') continue;
    const w = a.q.kind === 'yesno' ? (trustYes ? YESNO_WEIGHT : 0) : 1;
    if (!w) continue;
    GRID.forEach((t, i) => {
      const p = pRight(t, a.q.d);
      logp[i] += w * Math.log(a.right ? p : 1 - p);
    });
  }
  const m = Math.max(...logp);
  const p = logp.map((x) => Math.exp(x - m));
  const z = p.reduce((s, x) => s + x, 0);
  const mean = GRID.reduce((s, t, i) => s + t * p[i], 0) / z;
  const sd = Math.sqrt(GRID.reduce((s, t, i) => s + (t - mean) ** 2 * p[i], 0) / z);
  return { mean, sd };
}

export const finished = (answers: Answer[]) =>
  answers.length >= MAX_Q || (answers.length >= MIN_Q && posterior(answers).sd < SD_STOP);

/** The next question: the kind due at this step, the unasked one closest to the current estimate. */
export function nextQuestion(answers: Answer[], pool: Question[], rng: () => number = Math.random): Question | null {
  if (finished(answers)) return null;
  const asked = new Set(answers.map((a) => a.q.key));
  const n = answers.length;
  const left = pool.filter((q) => !asked.has(q.key));
  if (FAKE_AT.includes(n)) {
    const fakes = left.filter((q) => q.kind === 'fake');
    if (fakes.length) return fakes[Math.floor(rng() * fakes.length)];
  }
  const target = posterior(answers).mean;
  const typedSoFar = answers.filter((a) => a.q.kind !== 'fake').length;
  const order = [CYCLE[typedSoFar % CYCLE.length], ...CYCLE];
  for (const kind of order) {
    const xs = left.filter((q) => q.kind === kind).sort((a, b) => Math.abs(a.d - target) - Math.abs(b.d - target));
    if (!xs.length) continue;
    // a little variety among equally fitting questions
    const near = xs.filter((q) => Math.abs(q.d - target) - Math.abs(xs[0].d - target) < 0.15).slice(0, 3);
    return near[Math.floor(rng() * near.length)];
  }
  return null;
}

/* ---------- result ---------- */

export type Cefr = 'A0' | 'A1' | 'A2' | 'B1' | 'B2';

/** Rough vocabulary sizes for the levels (research on frequency-band tests: A1 ≈ few hundred words, B2 ≈ 3000+). */
export const levelOf = (vocab: number): Cefr => (vocab < 100 ? 'A0' : vocab < 800 ? 'A1' : vocab < 1600 ? 'A2' : vocab < 3000 ? 'B1' : 'B2');

export interface PlacementResult {
  level: Cefr;
  /** estimated vocabulary, words */
  vocab: number;
  /** how sure: the range of the estimate */
  range: [number, number];
  /** position in the phrase order up to which the learner knows almost every phrase (≥ 90 %) */
  pos: number;
  /** phrases treated as known (anywhere in the order), to go to FSRS as a Good review */
  known: string[];
  /** new phrases the base still has for this learner */
  remaining: number;
  total: number;
  /** said «знаю» to invented words */
  guessed: number;
  /** the level is above what the phrase base covers */
  beyondBase: boolean;
  /** fewer than FEW_LEFT new phrases are left for this learner */
  fewLeft: boolean;
}

/** fewer new phrases than this for the learner's level: say so */
export const FEW_LEFT = 150;

/** ln-units below the cautious estimate a phrase must be to count as known: P(right) ≈ 2/3 there */
export const KNOWN_MARGIN = 0.35;

export function placementResult(answers: Answer[], phrases: Phrase[]): PlacementResult {
  const { mean, sd } = posterior(answers);
  // «точно знаю»: even at the cautious end of the estimate (mean − sd) the phrase is right 2 times out of 3
  const sure = mean - sd - KNOWN_MARGIN;
  const ordered = phrases.filter((p) => p.order).sort((a, b) => a.order! - b.order!);
  const d = (p: Phrase) => ln(rankOf(p.freqRank)) + 0.15 * (p.tokens.length - 1);
  const isKnown = ordered.map((p) => d(p) <= sure);
  // the furthest point in the order up to which at least 90 % of the phrases are known
  let pos = 0, k = 0;
  isKnown.forEach((yes, i) => {
    if (yes) k++;
    if (k / (i + 1) >= 0.9) pos = i + 1;
  });
  if (k === 0) pos = 0;
  const known = ordered.filter((_, i) => isKnown[i]).map((p) => p.id);
  const vocab = Math.round(Math.exp(mean));
  // what the base covers: 90 % of its phrases are at most this hard
  const ds = ordered.map(d).sort((x, y) => x - y);
  const baseTop = ds[Math.floor(ds.length * 0.9)] ?? 0;
  return {
    level: levelOf(vocab),
    vocab,
    range: [Math.round(Math.exp(mean - sd)), Math.round(Math.exp(mean + sd))],
    pos,
    known,
    remaining: ordered.length - known.length,
    total: ordered.length,
    guessed: falseAlarms(answers),
    beyondBase: mean > baseTop,
    fewLeft: ordered.length - known.length < FEW_LEFT,
  };
}

/** Known phrases come back as reviews spread over the days, at most this many a day. */
export const PLACED_PER_DAY = 15;

/**
 * Phrases the test showed as known go straight into FSRS as a review graded Good, so the app still checks
 * them later. Phrases already being learned (cards or «знакомлюсь») are left as they are. Their first
 * reviews are spread so that no more than PLACED_PER_DAY come due on one day, easiest first.
 */
export function placedCards(known: string[], skip: Set<string>, lang: Lang, now: Date): { card: StoredCard; log: StoredLog }[] {
  const DAY = 86400000;
  return known
    .filter((id) => !skip.has(id))
    .map((id, i) => {
      const { card, log } = review(newCard(id, lang, now), 'good', now);
      const due = new Date(card.fsrs.due.getTime() + Math.floor(i / PLACED_PER_DAY) * DAY);
      return {
        card: { ...card, fsrs: { ...card.fsrs, due }, lastMode: 'type' as const, placed: true as const },
        log: { cardId: id, ts: now.getTime(), grade: 'good' as const, mode: 'placement' as const, hints: 0, log },
      };
    });
}
