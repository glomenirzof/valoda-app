import { describe, expect, it } from 'vitest';
import { skipStage, startLesson } from '../src/core/ladder';
import { isShort, tileDistractors, tileText } from '../src/core/tiles';
import type { Phrase, Token } from '../src/core/types';

const tok = (s: string, lemma: string, pos = 'NOUN'): Token => ({ s, lemma, pos, feats: '', ru: '' });
const ph = (id: string, topic: string, ...tokens: Token[]): Phrase =>
  ({ id, topic, text: tokens.map((t) => t.s).join(' '), ru: '', tokens, accept: [] }) as unknown as Phrase;

const labdien = ph('p1', 'polite', tok('Labdien', 'labdien', 'INTJ'));
const seen = [
  ph('p2', 'polite', tok('Labrīt', 'labrīt', 'INTJ')),
  ph('p3', 'polite', tok('Labvakar', 'labvakar', 'INTJ')),
  ph('p4', 'shop', tok('Kur', 'kur', 'ADV'), tok('ir', 'būt', 'VERB'), tok('maize', 'maize')),
  ph('p5', 'polite', tok('Liels', 'liels', 'ADJ'), tok('paldies', 'paldies', 'INTJ')),
];

describe('extra tiles for short phrases', () => {
  it('short means one or two words', () => {
    expect(isShort(labdien)).toBe(true);
    expect(isShort(seen[2])).toBe(false);
  });

  it('picks 2–3 alike words from phrases already seen, look and topic first', () => {
    const d = tileDistractors(labdien, seen);
    expect(d.length).toBeGreaterThanOrEqual(2);
    expect(d.length).toBeLessThanOrEqual(3);
    expect(d.slice(0, 2).sort()).toEqual(['labrīt', 'labvakar']);
  });

  it('never offers another form of a word of the phrase (no ending traps)', () => {
    const maize = ph('p6', 'shop', tok('Maizi', 'maize'), tok('lūdzu', 'lūdzu', 'INTJ'));
    const d = tileDistractors(maize, [...seen, ph('p7', 'shop', tok('Maizes', 'maize'), tok('nav', 'būt', 'VERB'))]);
    expect(d.some((w) => w.startsWith('maiz'))).toBe(false);
  });

  it('gives nothing when no phrase has been seen yet', () => {
    expect(tileDistractors(labdien, [])).toEqual([]);
  });

  it('shows tiles in lower case except proper nouns', () => {
    expect(tileText('Labdien', 'labdien')).toBe('labdien');
    expect(tileText('Rīgā', 'Rīga')).toBe('Rīgā');
  });
});

describe('skipping tiles', () => {
  it('turns the current S2 into S3 in place', () => {
    const l = startLesson({ reviews: [], acquainted: ['a'], fresh: [] });
    expect(l.queue[0]).toMatchObject({ id: 'a', stage: 2 });
    expect(skipStage(l).queue[0]).toEqual({ kind: 'stage', id: 'a', stage: 3 });
  });

  it('in the mini-ladder of a forgotten review S2 becomes S4', () => {
    const l = { queue: [{ kind: 'stage' as const, id: 'r', stage: 2 as const, relearn: true as const }], shown: [], reached: {}, graduated: [] };
    expect(skipStage(l).queue[0]).toEqual({ kind: 'stage', id: 'r', stage: 4, relearn: true });
  });

  it('leaves other cards alone', () => {
    const l = startLesson({ reviews: [], acquainted: [], fresh: ['f'] });
    expect(skipStage(l)).toBe(l);
  });
});
