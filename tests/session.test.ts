import { describe, expect, it } from 'vitest';
import { BACKLOG_PAUSE, buildQueue, plan } from '../src/core/session';
import { newCard, review } from '../src/core/srs';
import { DEFAULT_SETTINGS, type Phrase } from '../src/core/types';

const phrase = (n: number, status: Phrase['status'] = 'tutor'): Phrase => ({
  id: `lv-${n}`, lang: 'lv', topic: 'me', text: `Teksts ${n}.`, ru: `Текст ${n}.`, tokens: [], accept: [],
  audio: null, image: null, freqRank: n, status, source: 'llm', check: { tezaurs: 'ok', edition: 'x' },
});
const now = new Date('2026-11-04T10:00:00');
const S = { ...DEFAULT_SETTINGS, newPerDay: 10 };

describe('buildQueue', () => {
  it('shows each new phrase as intro, tiles and a later typed recall', () => {
    const q = buildQueue([1, 2, 3, 4].map((n) => phrase(n)), [], S, now);
    expect(q.filter((s) => s.kind === 'intro').map((s) => s.id)).toEqual(['lv-1', 'lv-2', 'lv-3']);
    for (const id of ['lv-1', 'lv-2', 'lv-3']) {
      const kinds = q.filter((s) => s.id === id).map((s) => s.kind);
      expect(kinds).toEqual(['intro', 'tiles', 'type']);
      // recall is never right after the tiles of the same phrase
      const t = q.findIndex((s) => s.id === id && s.kind === 'tiles');
      expect(q[t + 1]?.id === id).toBe(false);
    }
  });

  it('skips unverified phrases unless allowed', () => {
    const ps = [phrase(1, 'unverified'), phrase(2)];
    expect(buildQueue(ps, [], S, now).filter((s) => s.kind === 'intro').map((s) => s.id)).toEqual(['lv-2']);
    expect(buildQueue(ps, [], { ...S, allowUnverified: true }, now).filter((s) => s.kind === 'intro')).toHaveLength(2);
  });

  it('counts phrases introduced today against the daily limit', () => {
    const cards = Array.from({ length: 10 }, (_, i) => newCard(`lv-${100 + i}`, 'lv', now));
    expect(buildQueue([phrase(1)], cards, S, now)).toEqual([]);
  });

  it('pauses new phrases when the review backlog is large', () => {
    const past = new Date('2026-10-01T10:00:00');
    const cards = Array.from({ length: BACKLOG_PAUSE }, (_, i) => review(newCard(`lv-${100 + i}`, 'lv', past), 'good', past).card);
    const p = plan([phrase(1)], cards, S, now);
    expect(p.paused).toBe(true);
    expect(p.newLeft).toBe(0);
  });
});
