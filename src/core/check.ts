/** Typed-answer check: word by word, with the place of each mistake (root, ending or only a mark). */

export type MistakeKind = 'ok' | 'mark' | 'ending' | 'root' | 'missing';

export interface WordResult {
  /** expected word (normalized) */
  w: string;
  /** what was typed at this position (normalized), '' when missing */
  got: string;
  kind: MistakeKind;
  /** length of the correct beginning of `got` */
  p: number;
}

export interface CheckResult {
  verdict: 'ok' | 'almost' | 'bad';
  words: WordResult[];
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Latvian letters without their marks: ā → a, š → s. */
export const bare = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

export function checkAnswer(typed: string, target: string, accept: string[] = []): CheckResult {
  // An accepted variant written exactly counts as fully correct.
  if (accept.some((a) => normalize(a) === normalize(typed))) {
    return { verdict: 'ok', words: normalize(typed).split(' ').map((w) => ({ w, got: w, kind: 'ok', p: w.length })) };
  }
  const t = normalize(target).split(' ');
  const u = normalize(typed).split(' ').filter(Boolean);
  const words: WordResult[] = t.map((w, i) => {
    const got = u[i] ?? '';
    if (!got) return { w, got, kind: 'missing', p: 0 };
    if (got === w) return { w, got, kind: 'ok', p: w.length };
    if (bare(got) === bare(w)) return { w, got, kind: 'mark', p: 0 };
    let p = 0;
    while (p < got.length && p < w.length && got[p] === w[p]) p++;
    // Latvian endings are at most three letters (-iem, -ām, -ēm…): a match up to there is an ending mistake.
    const kind = p >= 2 && p >= w.length - 3 ? 'ending' : 'root';
    return { w, got, kind, p };
  });
  const sameLength = u.length === t.length;
  const verdict = sameLength && words.every((x) => x.kind === 'ok')
    ? 'ok'
    : sameLength && words.every((x) => x.kind === 'ok' || x.kind === 'mark')
      ? 'almost'
      : 'bad';
  return { verdict, words };
}

export const MISTAKE_RU: Record<Exclude<MistakeKind, 'ok'>, string> = {
  mark: 'нет долготы или знака',
  ending: 'ошибка в окончании',
  root: 'ошибка в корне',
  missing: 'пропущено слово',
};
