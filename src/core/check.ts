/** Typed-answer check: word by word, with the place of each mistake (root, ending or only a mark). */

import { featsLong } from './grammar-ru';
import type { Token } from './types';

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
  /** typed words past the end of the phrase */
  extra: string[];
}

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Latvian letters without their marks: ā → a, š → s. */
export const bare = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

export function checkAnswer(typed: string, target: string, accept: string[] = []): CheckResult {
  // An accepted variant written exactly counts as fully correct.
  if (accept.some((a) => normalize(a) === normalize(typed))) {
    return { verdict: 'ok', words: normalize(typed).split(' ').map((w) => ({ w, got: w, kind: 'ok', p: w.length })), extra: [] };
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
  const extra = u.slice(t.length);
  const sameLength = u.length === t.length;
  const verdict = sameLength && words.every((x) => x.kind === 'ok')
    ? 'ok'
    : sameLength && words.every((x) => x.kind === 'ok' || x.kind === 'mark')
      ? 'almost'
      : 'bad';
  return { verdict, words, extra };
}

export const MISTAKE_RU: Record<Exclude<MistakeKind, 'ok'>, string> = {
  mark: 'нет долготы или знака',
  ending: 'ошибка в окончании',
  root: 'ошибка в корне',
  missing: 'пропущено слово',
};

/* ---------- explanations: one concrete line per wrong word ---------- */

export interface Explanation {
  /** word index in the phrase, -1 for extra words */
  i: number;
  kind: Exclude<MistakeKind, 'ok'> | 'extra';
  text: string;
}

const has = (t: Token, f: string) => t.feats.split('.').includes(f);
const CASES = ['NOM', 'GEN', 'DAT', 'ACC', 'LOC', 'VOC'];
const label = (f: string) => featsLong(f)[0];
const num = (t: Token) => (has(t, 'PL') ? 'мн. ч.' : has(t, 'SG') ? 'ед. ч.' : '');
const join = (...xs: string[]) => xs.filter(Boolean).join(', ');

/** The grammatical form the word needs, in a few words: «1-е лицо, ед. ч., настоящее время», «местный падеж (где? в чём?), ед. ч.». */
export function formRu(t: Token): string {
  if (t.pos === 'VERB') {
    if (has(t, 'INF')) return 'инфинитив (неопределённая форма)';
    if (has(t, 'DEB')) return 'долженствовательное наклонение (jā-)';
    const person = ['1', '2', '3'].find((f) => has(t, f));
    const tense = ['PRS', 'PST', 'FUT'].find((f) => has(t, f));
    const mood = has(t, 'IMP') ? label('IMP') : has(t, 'COND') ? label('COND') : '';
    return join(mood, person ? label(person) : '', num(t), tense && !mood ? label(tense) : '');
  }
  const c = CASES.find((f) => has(t, f));
  return join(c ? label(c) : '', num(t), has(t, 'DEF') ? label('DEF') : '');
}

/** What in the phrase asks for this form: the subject pronoun for a verb, the preposition for a case. */
function cue(tokens: Token[], i: number): string | null {
  const t = tokens[i];
  if (t.pos === 'VERB') {
    const person = ['1', '2', '3'].find((f) => has(t, f));
    if (!person || has(t, 'IMP')) return null;
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      const s = tokens[j];
      if (s.pos === 'PRON' && has(s, 'NOM') && has(s, person)) return `после ${s.s.toLowerCase()} — ${join(label(person), has(t, 'PL') ? 'мн. ч.' : '')}`;
    }
    return null;
  }
  const c = CASES.find((f) => has(t, f));
  if (!c) return null;
  // a preposition up to two words back (an adjective or pronoun can stand between)
  for (let j = i - 1; j >= 0 && j >= i - 2; j--) {
    const s = tokens[j];
    if (s.pos === 'ADP') return `после ${s.s.toLowerCase()} — ${join(label(c), num(t))}`;
    if (!['ADJ', 'PRON', 'NUM'].includes(s.pos)) break;
  }
  return null;
}

const MACRON = new Set(['ā', 'ē', 'ī', 'ū']);

/** Marked letters of `w` that were typed plain: «долгота ā», «знак š». */
function marksMissed(got: string, w: string): { text: string; inEnding: boolean } {
  const need: string[] = [];
  let inEnding = false;
  [...w].forEach((ch, k) => {
    if ([...got][k] !== ch && bare(ch) !== ch) {
      need.push(ch);
      if (k >= [...w].length - 3) inEnding = true;
    }
  });
  const long = [...new Set(need.filter((c) => MACRON.has(c)))];
  const sign = [...new Set(need.filter((c) => !MACRON.has(c)))];
  const extra = [...new Set([...got].filter((ch, k) => ch !== [...w][k] && bare(ch) !== ch))];
  const text = join(
    long.length ? `нужна долгота ${long.join(', ')}` : '',
    sign.length ? `нужен знак ${sign.join(', ')}` : '',
    extra.length ? `лишний знак ${extra.join(', ')}` : '',
  );
  return { text: text || 'проверь знаки', inEnding };
}

/**
 * One line per wrong word, using the phrase tokens (lemma, features) when they line up with the words.
 * `key.trap` is a known wrong form of the key word (esmu for ir): typed, it is a form mistake, not another word.
 */
export function explain(r: CheckResult, tokens: Token[], key?: { i: number; trap: string }): Explanation[] {
  const aligned = tokens.length === r.words.length;
  const out: Explanation[] = [];
  r.words.forEach((x, i) => {
    if (x.kind === 'ok') return;
    const t = aligned ? tokens[i] : undefined;
    const meaning = t?.ru ? ` (${t.ru})` : '';
    if (x.kind === 'missing') {
      out.push({ i, kind: 'missing', text: `пропущено: ${x.w}${meaning}` });
    } else if (x.kind === 'root' && t && key?.i === i && normalize(key.trap) === x.got) {
      out.push({ i, kind: 'ending', text: `${x.got} → ${x.w}: другая форма того же слова (${t.lemma}) — ${cue(tokens, i) ?? formRu(t)}` });
    } else if (x.kind === 'root') {
      out.push({ i, kind: 'root', text: `${x.got}: другое слово — ожидалось ${x.w}${meaning}` });
    } else if (x.kind === 'ending') {
      const why = t ? cue(tokens, i) ?? formRu(t) : '';
      out.push({ i, kind: 'ending', text: `${x.got} → ${x.w}: ${why || 'другое окончание'}` });
    } else {
      const m = marksMissed(x.got, x.w);
      const why = t && m.inEnding ? cue(tokens, i) ?? formRu(t) : '';
      out.push({ i, kind: 'mark', text: `${x.got} → ${x.w}: ${join(m.text)}${why ? ` — ${why}` : ''}` });
    }
  });
  if (r.extra.length) out.push({ i: -1, kind: 'extra', text: `лишнее: ${r.extra.join(' ')}` });
  return out;
}

/** The key word's own rule is worth showing only when that word was wrong. */
export const keyWrong = (r: CheckResult, key?: { i: number }) => !!key && r.words[key.i]?.kind !== 'ok';

/**
 * Word-by-word analysis helps only when part of the answer is right. A one-word phrase, or an answer where no
 * word is even close («es: другое слово, nezinu: другое слово…»), gets the whole right answer instead.
 */
export function wholeAnswer(r: CheckResult, tokens: Token[]): boolean {
  if (r.verdict === 'ok') return false;
  if (tokens.length <= 1 || r.words.length <= 1) return true;
  return r.words.every((w) => w.kind === 'root' || w.kind === 'missing');
}
