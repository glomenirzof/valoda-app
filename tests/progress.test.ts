import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import {
  canSay, controlDue, controlPercent, controlPick, CONTROL_SIZE, countLevels, forecast, lessonOfDay, levelMap, levelOf, weakSpots, weekOf,
} from '../src/core/progress';
import { newCard, review, type StoredCard } from '../src/core/srs';
import type { Phrase } from '../src/core/types';

const now = new Date('2026-11-07T10:00:00');
const card = (id: string, state: State, stability: number, due = now): StoredCard => {
  const c = newCard(id, 'lv', now);
  return { ...c, fsrs: { ...c.fsrs, state, stability, due } };
};

describe('levelOf', () => {
  it('climbs новая → знакомлюсь → запоминаю → помню → знаю', () => {
    expect(levelOf(undefined)).toBe('new');
    expect(levelOf(undefined, true)).toBe('meeting');
    expect(levelOf(card('a', State.Learning, 30))).toBe('learning');
    expect(levelOf(card('a', State.Relearning, 30))).toBe('learning');
    expect(levelOf(card('a', State.Review, 6.9))).toBe('learning');
    expect(levelOf(card('a', State.Review, 7))).toBe('remember');
    expect(levelOf(card('a', State.Review, 20.9))).toBe('remember');
    expect(levelOf(card('a', State.Review, 21))).toBe('know');
  });

  it('a phrase that just graduated from the ladder is «запоминаю»', () => {
    expect(levelOf(review(newCard('a', 'lv', now), 'good', now).card)).toBe('learning');
  });

  it('«могу сказать» counts помню and знаю', () => {
    expect(['new', 'meeting', 'learning', 'remember', 'know'].filter((l) => canSay(l as never))).toEqual(['remember', 'know']);
  });

  it('maps every phrase to a level', () => {
    const ps = ['a', 'b', 'c'].map((id) => ({ id, topic: 'me', tokens: [] }) as unknown as Phrase);
    const m = levelMap(ps, [card('a', State.Review, 25)], [{ id: 'b', lang: 'lv', started: 0, stage: 1 }]);
    expect(countLevels(m.values())).toEqual({ new: 1, meeting: 1, learning: 0, remember: 0, know: 1 });
  });
});

describe('weakSpots', () => {
  it('ranks words by hints and mistakes and explains their forms', () => {
    const p = {
      id: 'p', topic: 'me', tokens: [
        { s: 'Es', lemma: 'es', pos: 'PRON', feats: '1.NOM.SG', ru: 'я' },
        { s: 'nezinu', lemma: 'zināt', pos: 'VERB', feats: 'IND.PRS.1.SG.NEG', ru: 'знать' },
      ],
    } as unknown as Phrase;
    const cards: StoredCard[] = [{ ...card('p', State.Review, 3), weak: { zināt: 2, es: 1 } }, { ...card('q', State.Review, 3), weak: { zināt: 1 } }];
    const w = weakSpots(cards, [p]);
    expect(w.map((x) => [x.lemma, x.count])).toEqual([['zināt', 3], ['es', 1]]);
    expect(w[0].forms).toEqual([{ s: 'nezinu', what: '1-е лицо, ед. ч., настоящее время' }]);
    expect(w[0].ru).toBe('знать');
  });
});

describe('forecast', () => {
  it('counts reviews due by the end of tomorrow and within a week', () => {
    const at = (h: number) => new Date(now.getTime() + h * 3600000);
    const cards = [card('a', State.Review, 1, at(-1)), card('b', State.Review, 1, at(20)), card('c', State.Review, 1, at(24 * 5)), card('d', State.Review, 1, at(24 * 10))];
    expect(forecast(cards, now)).toEqual({ tomorrow: 2, week: 3 });
  });
});

describe('lessonOfDay', () => {
  it('splits the daily limit into lessons of five', () => {
    expect(lessonOfDay(10, 0)).toEqual({ n: 1, total: 2, done: 0 });
    expect(lessonOfDay(10, 5)).toEqual({ n: 2, total: 2, done: 1 });
    expect(lessonOfDay(10, 10)).toEqual({ n: 2, total: 2, done: 2 });
    expect(lessonOfDay(12, 0).total).toBe(3);
    expect(lessonOfDay(5, 0).total).toBe(1);
  });
});

describe('control test', () => {
  const day = 86400000;
  it('is offered once a week when enough phrases are held', () => {
    expect(controlDue([], 4, now)).toBe(false);
    expect(controlDue([], 5, now)).toBe(true);
    const r = { ts: now.getTime() - 6 * day, lang: 'lv' as const, total: 20, correct: 15, almost: 2 };
    expect(controlDue([r], 30, now)).toBe(false);
    expect(controlDue([{ ...r, ts: now.getTime() - 7 * day }], 30, now)).toBe(true);
    expect(controlPercent(r)).toBe(75);
  });

  it('picks at most 20 distinct phrases', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `p${i}`);
    const pick = controlPick(ids);
    expect(pick).toHaveLength(CONTROL_SIZE);
    expect(new Set(pick).size).toBe(CONTROL_SIZE);
    expect(controlPick(ids.slice(0, 7))).toHaveLength(7);
  });

  it('groups results by the Monday of their week', () => {
    expect(new Date(weekOf(new Date('2026-11-07T10:00:00').getTime())).getDate()).toBe(2);
    expect(weekOf(new Date('2026-11-02T08:00:00').getTime())).toBe(weekOf(new Date('2026-11-08T22:00:00').getTime()));
  });
});
