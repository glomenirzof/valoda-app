import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  finished, levelOf, MAX_Q, MIN_Q, nextQuestion, placementResult, posterior, questionPool, type Answer, type PlacementData, type Question,
} from '../src/core/placement';
import type { Phrase } from '../src/core/types';

const phrases = (JSON.parse(readFileSync('public/data/lv/phrases.json', 'utf8')) as { phrases: Phrase[] }).phrases;
const data = JSON.parse(readFileSync('public/data/lv/placement.json', 'utf8')) as PlacementData;
const pool = questionPool(phrases, data);

/** A learner who knows exactly the words up to rank `vocab`; `guesser` says «знаю» to everything. */
function run(vocab: number, guesser = false, seed = 1) {
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const answers: Answer[] = [];
  for (let q: Question | null; (q = nextQuestion(answers, pool, rng)); ) {
    const right = q.kind === 'fake' ? !guesser : q.kind === 'yesno' && guesser ? true : q.d <= Math.log(vocab);
    answers.push({ q, right });
  }
  return answers;
}

describe('question pool', () => {
  it('has typed phrases, typed words, endings, real «знаю» words and invented words', () => {
    const kinds = new Set(pool.map((q) => q.kind));
    expect([...kinds].sort()).toEqual(['ending', 'fake', 'phrase', 'word', 'yesno']);
    expect(pool.filter((q) => q.kind === 'ending').length).toBeGreaterThan(20);
    expect(pool.filter((q) => q.kind === 'fake').length).toBeGreaterThanOrEqual(10);
  });
});

describe('adaptive test', () => {
  it('asks 15–25 questions', () => {
    for (const v of [30, 300, 1200, 6000]) {
      const n = run(v).length;
      expect(n).toBeGreaterThanOrEqual(MIN_Q);
      expect(n).toBeLessThanOrEqual(MAX_Q);
    }
  });

  it('goes harder after right answers and easier after mistakes', () => {
    const first = nextQuestion([], pool, () => 0)!;
    const harder = nextQuestion([{ q: first, right: true }], pool, () => 0)!;
    const easier = nextQuestion([{ q: first, right: false }], pool, () => 0)!;
    expect(posterior([{ q: first, right: true }]).mean).toBeGreaterThan(posterior([{ q: first, right: false }]).mean);
    expect(harder.d).toBeGreaterThan(easier.d);
  });

  it('finds the level of learners with a known vocabulary', () => {
    expect(placementResult(run(15), phrases).level).toBe('A0');
    expect(placementResult(run(300), phrases).level).toBe('A1');
    expect(placementResult(run(4000), phrases).level).toBe('B2');
    const mid = placementResult(run(300), phrases);
    expect(mid.vocab).toBeGreaterThan(150);
    expect(mid.vocab).toBeLessThan(600);
  });

  it('mixes in invented words and stops trusting «знаю» after one is claimed', () => {
    const honest = run(300);
    expect(honest.filter((a) => a.q.kind === 'fake').length).toBeGreaterThanOrEqual(2);
    const guess = run(300, true);
    const r = placementResult(guess, phrases);
    expect(r.guessed).toBeGreaterThan(0);
    // «знаю» to everything does not lift the estimate far above the typed answers
    expect(r.vocab).toBeLessThan(placementResult(honest, phrases).vocab * 2);
  });

  it('stops once the estimate is tight', () => {
    expect(finished(run(300))).toBe(true);
  });
});

describe('result', () => {
  it('a beginner starts from the first phrase with nothing marked as known', () => {
    const r = placementResult(run(15), phrases);
    expect(r.pos).toBeLessThan(10);
    expect(r.remaining).toBeGreaterThan(r.total - 10);
  });

  it('marks as known the phrases well below the estimate, wherever they are in the order', () => {
    const r = placementResult(run(600), phrases);
    const byId = new Map(phrases.map((p) => [p.id, p]));
    expect(r.known.length).toBeGreaterThan(20);
    // every known phrase is easier than the estimated vocabulary
    expect(r.known.every((id) => (byId.get(id)!.freqRank ?? 20) <= r.vocab)).toBe(true);
    // and the first phrases of the order are almost all known
    const first = phrases.filter((p) => p.order && p.order <= r.pos);
    expect(first.filter((p) => r.known.includes(p.id)).length).toBeGreaterThanOrEqual(Math.floor(first.length * 0.9));
    expect(r.remaining).toBe(r.total - r.known.length);
  });

  it('says honestly when the base ends before the learner’s level', () => {
    const r = placementResult(run(6000), phrases);
    expect(r.beyondBase).toBe(true);
    expect(r.fewLeft).toBe(true);
    expect(placementResult(run(300), phrases).fewLeft).toBe(false);
  });

  it('maps vocabulary to rough CEFR levels', () => {
    expect([50, 300, 1000, 2000, 5000].map(levelOf)).toEqual(['A0', 'A1', 'A2', 'B1', 'B2']);
  });
});

describe('placedCards', () => {
  it('turns known phrases into Good reviews, skips phrases already learned, spreads them over days', async () => {
    const { placedCards, PLACED_PER_DAY } = await import('../src/core/placement');
    const now = new Date('2026-11-10T10:00:00');
    const ids = Array.from({ length: 40 }, (_, i) => `p${i}`);
    const out = placedCards(ids, new Set(['p0', 'p1']), 'lv', now);
    expect(out).toHaveLength(38);
    expect(out.every((x) => x.log.grade === 'good' && x.log.mode === 'placement')).toBe(true);
    const days = out.map((x) => Math.floor((x.card.fsrs.due.getTime() - now.getTime()) / 86400000));
    expect(Math.min(...days)).toBeGreaterThanOrEqual(1);
    const perDay = new Map<number, number>();
    days.forEach((d) => perDay.set(d, (perDay.get(d) ?? 0) + 1));
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(PLACED_PER_DAY);
  });
});
