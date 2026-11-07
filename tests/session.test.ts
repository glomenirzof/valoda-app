import { describe, expect, it } from 'vitest';
import { BACKLOG_PAUSE, lessonInput, MAX_NEW_PER_SESSION, plan, reviewMode, TYPE_BELOW_STABILITY, type Acquaintance } from '../src/core/session';
import type { StoredCard } from '../src/core/srs';
import { FSRS_PARAMS, graduationGrade, newCard, review } from '../src/core/srs';
import { DEFAULT_SETTINGS, type Phrase } from '../src/core/types';

const phrase = (n: number, status: Phrase['status'] = 'tutor', auto: Phrase['auto'] = 'unchecked'): Phrase => ({
  id: `lv-${n}`, lang: 'lv', topic: 'me', text: `Teksts ${n}.`, ru: `Текст ${n}.`, tokens: [], accept: [],
  audio: null, image: null, freqRank: n, status, auto, source: 'llm', check: { tezaurs: 'ok', edition: 'x' },
});
const now = new Date('2026-11-04T10:00:00');
const S = { ...DEFAULT_SETTINGS, newPerDay: 10 };
const meet = (n: number, started = now.getTime()): Acquaintance => ({ id: `lv-${n}`, lang: 'lv', started, stage: 1 });

describe('lessonInput', () => {
  it('takes up to five new phrases', () => {
    const i = lessonInput(Array.from({ length: 20 }, (_, k) => phrase(k + 1)), [], S, now);
    expect(i.fresh).toHaveLength(MAX_NEW_PER_SESSION);
    expect(i.fresh[0]).toBe('lv-1');
  });

  it('trains only phrases checked by the tutor or passed by the automatic check', () => {
    const ps = [phrase(1, 'unverified', 'doubtful'), phrase(2), phrase(3, 'unverified', 'ok'), phrase(4, 'unverified')];
    expect(lessonInput(ps, [], S, now).fresh).toEqual(['lv-2', 'lv-3']);
  });

  it('resumes «знакомлюсь» phrases first and fills the rest with fresh ones', () => {
    const ps = Array.from({ length: 10 }, (_, k) => phrase(k + 1));
    const i = lessonInput(ps, [], S, now, [meet(7), meet(8)]);
    expect(i.acquainted).toEqual(['lv-7', 'lv-8']);
    expect(i.fresh).toEqual(['lv-1', 'lv-2', 'lv-3']);
  });

  it('counts phrases started today against the daily limit, graduated or not', () => {
    const cards = Array.from({ length: 6 }, (_, k) => newCard(`lv-${100 + k}`, 'lv', now));
    const meeting = [meet(200), meet(201), meet(202), meet(203)];
    const ps = [phrase(1), phrase(2)];
    expect(plan(ps, cards, S, now, meeting).newLeft).toBe(0);
    expect(lessonInput(ps, cards, S, now, meeting).fresh).toEqual([]);
  });

  it('pauses new phrases when the review backlog is large', () => {
    const past = new Date('2026-10-01T10:00:00');
    const cards = Array.from({ length: BACKLOG_PAUSE }, (_, k) => review(newCard(`lv-${100 + k}`, 'lv', past), 'good', past).card);
    const p = plan([phrase(1)], cards, S, now);
    expect(p.paused).toBe(true);
    expect(lessonInput([phrase(1)], cards, S, now, [meet(1)]).acquainted).toEqual([]);
  });
});

describe('FSRS after the ladder', () => {
  it('uses learning steps 10m, 1d and relearning 10m', () => {
    expect([...FSRS_PARAMS.learning_steps]).toEqual(['10m', '1d']);
    expect([...FSRS_PARAMS.relearning_steps]).toEqual(['10m']);
  });

  it('grades the first review Good when typed clean, Hard with hints or missing marks, never Easy', () => {
    expect(graduationGrade({ verdict: 'ok', hints: 0 })).toBe('good');
    expect(graduationGrade({ verdict: 'ok', hints: 2 })).toBe('hard');
    expect(graduationGrade({ verdict: 'almost', hints: 0 })).toBe('hard');
  });

  it('a Good first grade schedules the next review a day later (second learning step)', () => {
    const { card } = review(newCard('lv-1', 'lv', now), 'good', now);
    const hours = (card.fsrs.due.getTime() - now.getTime()) / 3600000;
    expect(hours).toBeGreaterThanOrEqual(23);
    expect(hours).toBeLessThanOrEqual(26);
  });
});

describe('review card type', () => {
  const withStability = (stability: number, lastMode?: 'type' | 'say'): StoredCard => {
    const c = newCard('lv-1', 'lv', now);
    return { ...c, lastMode, fsrs: { ...c.fsrs, stability } };
  };

  it('is typed while stability is under 3 days, whatever came before', () => {
    expect(reviewMode(withStability(0.5))).toBe('type');
    expect(reviewMode(withStability(TYPE_BELOW_STABILITY - 0.01, 'type'))).toBe('type');
    expect(reviewMode(withStability(2, 'say'))).toBe('type');
  });

  it('alternates typing and saying once the phrase is stable', () => {
    expect(reviewMode(withStability(3, 'type'))).toBe('say');
    expect(reviewMode(withStability(10, 'say'))).toBe('type');
    expect(reviewMode(withStability(10))).toBe('say'); // graduated by typing, so say it next
  });

  it('lessonInput uses it for due cards', () => {
    const past = new Date('2026-10-01T10:00:00');
    const fragile = review(newCard('lv-1', 'lv', past), 'good', past).card;
    const stable = { ...review(newCard('lv-2', 'lv', past), 'good', past).card, lastMode: 'type' as const };
    stable.fsrs = { ...stable.fsrs, stability: 12 };
    const i = lessonInput([phrase(1), phrase(2)], [fragile, stable], S, now);
    expect(Object.fromEntries(i.reviews.map((r) => [r.id, r.mode]))).toEqual({ 'lv-1': 'type', 'lv-2': 'say' });
  });
});

describe('new phrase order', () => {
  it('takes new phrases by their i+1 order, not by file position', () => {
    const ps = [{ ...phrase(1), order: 3 }, { ...phrase(2), order: 1 }, { ...phrase(3), order: 2 }, phrase(4)];
    expect(lessonInput(ps, [], S, now).fresh).toEqual(['lv-2', 'lv-3', 'lv-1', 'lv-4']);
  });
});
