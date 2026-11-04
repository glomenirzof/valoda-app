import { describe, expect, it } from 'vitest';
import {
  answerReview,
  answerStage,
  current,
  finished,
  LAG,
  place,
  RETRY_LAG,
  startLesson,
  unfinished,
  type Item,
  type Lesson,
  type LessonInput,
} from '../src/core/ladder';

/** Deterministic random numbers so lags are reproducible. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

/** Plays a whole lesson; `fail` decides which shown cards are answered wrong. */
function play(input: LessonInput, rng = seq(0.3, 0.8, 0.1, 0.6), fail: (it: Item, n: number) => boolean = () => false) {
  let l: Lesson = startLesson(input);
  const shown: Item[] = [];
  const graduated: string[] = [];
  for (let n = 0; !finished(l) && n < 500; n++) {
    const it = current(l)!;
    shown.push(it);
    const bad = fail(it, n);
    const step = it.kind === 'stage' ? answerStage(l, bad ? { pass: false } : { pass: true }, rng) : answerReview(l, bad);
    if (step.graduated) graduated.push(step.graduated);
    l = step.lesson;
  }
  return { shown, graduated, lesson: l };
}

const positions = (shown: Item[], id: string) =>
  shown.map((it, i) => ({ it, i })).filter((x) => x.it.id === id && x.it.kind === 'stage');

describe('startLesson', () => {
  it('alternates new phrases with reviews and starts met phrases at S2', () => {
    const l = startLesson({ reviews: [{ id: 'r1', mode: 'type' }, { id: 'r2', mode: 'say' }], acquainted: ['a'], fresh: ['f1', 'f2'] });
    expect(l.queue.map((x) => `${x.id}:${x.kind === 'stage' ? 'S' + x.stage : x.mode}`)).toEqual(['a:S2', 'r1:type', 'f1:S0', 'r2:say', 'f2:S0']);
  });
});

describe('ladder with enough other cards', () => {
  const input: LessonInput = {
    reviews: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, mode: 'type' as const })),
    acquainted: [],
    fresh: ['p1', 'p2', 'p3', 'p4', 'p5'],
  };

  it('takes every new phrase through S0…S4 in order and graduates it', () => {
    const { shown, graduated } = play(input);
    for (const id of input.fresh) {
      expect(positions(shown, id).map((x) => (x.it as Extract<Item, { kind: 'stage' }>).stage)).toEqual([0, 1, 2, 3, 4]);
    }
    expect(graduated.sort()).toEqual([...input.fresh].sort());
  });

  it('keeps the planned gap between stages of one phrase (shorter only when the queue runs out)', () => {
    for (const rng of [seq(0), seq(0.999), seq(0.3, 0.8, 0.1, 0.6)]) {
      let l = startLesson(input);
      const shown: Item[] = [];
      // for every stage: how many other cards were waiting when it was scheduled
      const waiting = new Map<string, number>();
      while (!finished(l)) {
        const it = current(l)!;
        shown.push(it);
        if (it.kind === 'stage') {
          l = answerStage(l, { pass: true }, rng).lesson;
          if (it.stage < 4) waiting.set(`${it.id}:${it.stage + 1}`, l.queue.length - 1);
        } else l = answerReview(l, false).lesson;
      }
      for (const id of input.fresh) {
        const ps = positions(shown, id);
        for (let k = 1; k < ps.length; k++) {
          const gap = ps[k].i - ps[k - 1].i - 1;
          const [min] = LAG[k as 1 | 2 | 3 | 4];
          expect(gap).toBeGreaterThanOrEqual(Math.min(min, waiting.get(`${id}:${k}`)!));
          expect(gap).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('never shows two cards of the same phrase in a row', () => {
    const { shown } = play(input, seq(0.5));
    for (let i = 1; i < shown.length; i++) expect(shown[i].id).not.toBe(shown[i - 1].id);
  });
});

describe('ladder with few other cards', () => {
  it('interleaves stages of different new phrases instead of repeating one phrase', () => {
    const { shown, graduated } = play({ reviews: [], acquainted: [], fresh: ['a', 'b', 'c'] }, seq(0.5));
    expect(graduated.sort()).toEqual(['a', 'b', 'c']);
    // a repeat is acceptable only when no card of another phrase is left at all
    for (let i = 1; i < shown.length; i++) {
      if (shown[i].id === shown[i - 1].id) {
        expect(shown.slice(i).every((x) => x.id === shown[i].id)).toBe(true);
      }
    }
  });
});

describe('failures', () => {
  const input: LessonInput = { reviews: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, mode: 'type' as const })), acquainted: [], fresh: ['p'] };
  const stageOf = (it: Item) => (it.kind === 'stage' ? it.stage : -1);

  it('repeats a failed S1 or S2 three cards later', () => {
    let failed = false;
    const { shown } = play(input, seq(0), (it) => {
      if (!failed && it.id === 'p' && stageOf(it) === 1) return (failed = true);
      return false;
    });
    const ps = positions(shown, 'p');
    const firstS1 = ps.find((x) => stageOf(x.it) === 1)!;
    const again = ps.filter((x) => stageOf(x.it) === 1)[1];
    expect(again.i - firstS1.i - 1).toBe(RETRY_LAG);
  });

  it('drops one stage after a failed S3 or S4', () => {
    for (const stage of [3, 4]) {
      let failed = false;
      const { shown, graduated } = play(input, seq(0), (it) => {
        if (!failed && it.id === 'p' && stageOf(it) === stage) return (failed = true);
        return false;
      });
      const stages = positions(shown, 'p').map((x) => stageOf(x.it));
      const at = stages.indexOf(stage as 3 | 4);
      expect(stages[at + 1]).toBe(stage - 1);
      expect(graduated).toEqual(['p']);
    }
  });

  it('a forgotten review comes back once, said aloud', () => {
    const { shown } = play({ reviews: [{ id: 'r', mode: 'type' }, { id: 'q', mode: 'type' }], acquainted: [], fresh: [] }, seq(0), (it) => it.id === 'r');
    expect(shown.filter((x) => x.id === 'r').map((x) => (x.kind === 'review' ? x.mode : ''))).toEqual(['type', 'say']);
  });
});

describe('«Уже знаю» and unfinished phrases', () => {
  it('goes straight to S4 after one other card', () => {
    let l = startLesson({ reviews: [{ id: 'r1', mode: 'type' }, { id: 'r2', mode: 'type' }], acquainted: [], fresh: ['p'] });
    l = answerStage(l, { known: true }).lesson;
    expect(l.queue.map((x) => `${x.id}:${x.kind === 'stage' ? 'S' + x.stage : 'R'}`)).toEqual(['r1:R', 'p:S4', 'r2:R']);
  });

  it('reports only phrases actually shown and not passed as still being met', () => {
    let l = startLesson({ reviews: [], acquainted: [], fresh: ['p', 'q', 'r'] });
    l = answerStage(l, { pass: true }, seq(0)).lesson; // p S0 passed, q S0 on screen, r never shown
    expect(unfinished(l).sort()).toEqual(['p', 'q']);
  });
});

describe('place', () => {
  const s = (id: string, stage = 0): Item => ({ kind: 'stage', id, stage: stage as 0 });

  it('moves an item past a neighbour of the same phrase', () => {
    const q = place([s('x'), s('p'), s('y')], s('p', 2), 1);
    expect(q.map((x) => x.id)).toEqual(['x', 'p', 'y', 'p']);
  });

  it('never puts an item first while other cards exist', () => {
    expect(place([s('x')], s('p'), 0).map((x) => x.id)).toEqual(['x', 'p']);
  });
});
