import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../src/core/check';

const kinds = (typed: string, target: string) => checkAnswer(typed, target).words.map((w) => w.kind);

describe('checkAnswer', () => {
  it('accepts the exact phrase regardless of case and punctuation', () => {
    expect(checkAnswer('mēs ejam uz veikalu', 'Mēs ejam uz veikalu.').verdict).toBe('ok');
  });

  it('marks a missing long vowel as a mark mistake, verdict almost', () => {
    const r = checkAnswer('Mes ejam uz veikalu', 'Mēs ejam uz veikalu.');
    expect(r.verdict).toBe('almost');
    expect(r.words[0].kind).toBe('mark');
  });

  it('separates ending mistakes from root mistakes', () => {
    expect(kinds('Mēs ejam uz veikals', 'Mēs ejam uz veikalu.')[3]).toBe('ending');
    expect(kinds('Mēs ejam uz bodi', 'Mēs ejam uz veikalu.')[3]).toBe('root');
    expect(kinds('Es dzīvoju Rīga', 'Es dzīvoju Rīgā.')[2]).toBe('mark');
  });

  it('reports missing words and fails the verdict', () => {
    const r = checkAnswer('Mēs ejam', 'Mēs ejam uz veikalu.');
    expect(r.verdict).toBe('bad');
    expect(r.words.slice(2).map((w) => w.kind)).toEqual(['missing', 'missing']);
  });

  it('takes accepted variants as correct', () => {
    expect(checkAnswer('Labdien', 'Labdien!', ['labdien']).verdict).toBe('ok');
  });
});
