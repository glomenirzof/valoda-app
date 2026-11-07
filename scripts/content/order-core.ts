/**
 * Order of new phrases by the i+1 rule: every phrase brings at most one lemma the learner has not met yet.
 * Pure functions, shared by scripts/content/order.ts and the tests.
 */

export interface OrderPhrase {
  id: string;
  text: string;
  tokens: { lemma: string; pos?: string }[];
  /** corpus rank of the rarest content word; null = only function words and interjections (very common) */
  freqRank: number | null;
}

/** The first phrases are survival phrases of one or two words (Paldies, Lūdzu, Jā, Es nezinu…). */
export const SURVIVAL = 15;
export const SURVIVAL_WORDS = 2;
export const MAX_NEW = 1;

/**
 * Tēzaurs keeps some feminine pronoun and adjective forms as lexemes of their own (tava, mana, tā…); for the
 * learner they are the same word as the masculine one, so they do not count as a new word.
 */
const SAME_WORD: Record<string, string> = {
  'mana/PRON': 'mans', 'tava/PRON': 'tavs', 'tāda/PRON': 'tāds', 'kāda/PRON': 'kāds', 'daža/PRON': 'dažs',
  'tā/PRON': 'tas', 'visa/PRON': 'viss', 'galvenā/ADJ': 'galvenais',
};
const word = (t: { lemma: string; pos?: string }) => {
  const l = t.lemma.toLowerCase();
  return SAME_WORD[`${l}/${t.pos}`] ?? l;
};
export const lemmasOf = (p: OrderPhrase) => [...new Set(p.tokens.map(word))];
const freq = (p: OrderPhrase) => p.freqRank ?? 0;
const words = (p: OrderPhrase) => p.tokens.length;

export interface Placed<P> {
  p: P;
  /** lemmas this phrase introduces */
  fresh: string[];
  /** no phrase with ≤ 1 new lemma was left: the shortest one with the fewest new lemmas was taken */
  forced: boolean;
}

const best = <P,>(xs: P[], ...keys: ((x: P) => number | string)[]) =>
  [...xs].sort((a, b) => {
    for (const k of keys) {
      const x = k(a), y = k(b);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  })[0];

/**
 * Greedy order: at each step the most frequent phrase that brings ≤ 1 new lemma (the first 15 steps prefer
 * phrases of 1–2 words); when none is left, the shortest phrase with the fewest new lemmas, marked forced.
 */
export function orderPhrases<P extends OrderPhrase>(phrases: P[]): Placed<P>[] {
  const pool = [...phrases];
  const known = new Set<string>();
  const out: Placed<P>[] = [];
  const newOf = (p: P) => lemmasOf(p).filter((l) => !known.has(l));
  while (pool.length) {
    const short = out.length < SURVIVAL ? pool.filter((p) => words(p) <= SURVIVAL_WORDS) : [];
    const fits = (xs: P[]) => xs.filter((p) => newOf(p).length <= MAX_NEW);
    const good = fits(short).length ? fits(short) : fits(pool);
    let pick: P;
    let forced = false;
    if (good.length) {
      pick = best(good, freq, words, (p) => p.id);
    } else {
      pick = best(short.length ? short : pool, (p) => newOf(p).length, words, freq, (p) => p.id);
      forced = true;
    }
    const fresh = newOf(pick);
    fresh.forEach((l) => known.add(l));
    out.push({ p: pick, fresh, forced });
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

/** Phrases that bring more than one new lemma when shown in this order. */
export function violations<P extends OrderPhrase>(ordered: P[]): { p: P; fresh: string[] }[] {
  const known = new Set<string>();
  const bad: { p: P; fresh: string[] }[] = [];
  for (const p of ordered) {
    const fresh = lemmasOf(p).filter((l) => !known.has(l));
    if (fresh.length > MAX_NEW) bad.push({ p, fresh });
    fresh.forEach((l) => known.add(l));
  }
  return bad;
}
