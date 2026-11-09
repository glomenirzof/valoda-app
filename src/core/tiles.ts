/**
 * Tiles for short phrases. Building «Labdien!» from one tile teaches nothing, so phrases of one or two words get
 * 2–3 extra tiles: words from phrases the learner has already seen that look alike (same first letter, similar
 * length) or come from the same topic. Never another form of a word of the phrase — that would be an ending
 * trap, which is not what this stage trains. With fewer than two such words the tiles stage is skipped.
 */
import type { Phrase } from './types';

export const SHORT_PHRASE = 2;
export const MIN_DISTRACTORS = 2;
export const MAX_DISTRACTORS = 3;

export const isShort = (p: Phrase) => p.tokens.length <= SHORT_PHRASE;

/** Proper nouns keep their capital; everything else is shown in lower case so the capital does not give the first word away. */
export const tileText = (s: string, lemma: string) => (/^\p{Lu}/u.test(lemma) ? s : s.toLowerCase());

export function tileDistractors(p: Phrase, seen: Phrase[], n = MAX_DISTRACTORS): string[] {
  const ownLemmas = new Set(p.tokens.map((t) => t.lemma.toLowerCase()));
  const ownWords = new Set(p.tokens.map((t) => t.s.toLowerCase()));
  const firsts = new Set(p.tokens.map((t) => t.s[0].toLowerCase()));
  const lengths = p.tokens.map((t) => t.s.length);
  const pos = new Set(p.tokens.map((t) => t.pos));
  const best = new Map<string, number>();
  for (const q of seen) {
    if (q.id === p.id) continue;
    for (const t of q.tokens) {
      const w = tileText(t.s, t.lemma);
      if (ownLemmas.has(t.lemma.toLowerCase()) || ownWords.has(w.toLowerCase()) || w.length < 2) continue;
      const score =
        (q.topic === p.topic ? 2 : 0) +
        (firsts.has(w[0].toLowerCase()) ? 2 : 0) +
        (lengths.some((l) => Math.abs(l - w.length) <= 2) ? 1 : 0) +
        (pos.has(t.pos) ? 1 : 0);
      if (score > (best.get(w) ?? -1)) best.set(w, score);
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([w]) => w);
}
