import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../src/core/check';
import { suggestedGrade } from '../src/core/grade';
import { graduationGrade } from '../src/core/srs';

const text = 'Es nezinu.';
const ok = checkAnswer('Es nezinu', text);

describe('keyboard of the answer letters counts as a hint', () => {
  it('a right answer typed on the phone keyboard is Good', () => {
    expect(suggestedGrade({ result: ok, hints: 0 }, text)).toBe('good');
  });

  it('the same answer typed on the letters keyboard is only Hard', () => {
    expect(suggestedGrade({ result: ok, hints: 0, keys: true }, text)).toBe('hard');
  });

  it('a wrong answer stays Again even with the letters keyboard', () => {
    expect(suggestedGrade({ result: checkAnswer('Es negribu', text), hints: 0, keys: true }, text)).toBe('again');
  });

  it('first FSRS grade on the ladder: the letters keyboard makes it Hard, not Good', () => {
    expect(graduationGrade({ verdict: 'ok', hints: 0 })).toBe('good');
    expect(graduationGrade({ verdict: 'ok', hints: 0 + 1 })).toBe('hard'); // keys add one hint in Session
  });

  it('many opened letters still mean Again', () => {
    expect(suggestedGrade({ result: ok, hints: 5 }, text)).toBe('again');
  });
});
