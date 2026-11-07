/**
 * Voice check of a «Скажи» card: what the recogniser heard is compared with the phrase by the same rules as
 * typing (check.ts). Recognition hears long vowels and marks unreliably, so a mistake only in a mark is not
 * a wrong answer: it counts as said right, with a soft «проверь произношение».
 */
import { checkAnswer, type CheckResult } from './check';
import type { Grade } from './srs';
import type { Phrase } from './types';

export interface VoiceVerdict {
  /** ok — said right; marks — right except long vowels or marks (soft note); ending — only endings wrong; bad */
  kind: 'ok' | 'marks' | 'ending' | 'bad';
  grade: Exclude<Grade, 'easy'>;
  result: CheckResult;
  /** word indices that count as weak: wrong endings */
  weak: number[];
}

export function judgeSpeech(heard: string, p: Pick<Phrase, 'text' | 'accept'>, hints = 0): VoiceVerdict {
  const result = checkAnswer(heard, p.text, p.accept);
  const wrong = result.words.map((w, i) => ({ w, i })).filter((x) => x.w.kind !== 'ok');
  // letters opened before speaking: «said right» is still only Hard, as everywhere
  const okGrade = hints ? 'hard' : 'good';
  if (result.verdict === 'ok') return { kind: 'ok', grade: okGrade, result, weak: [] };
  if (result.verdict === 'almost') return { kind: 'marks', grade: okGrade, result, weak: [] };
  const sameLength = result.extra.length === 0;
  if (sameLength && wrong.every((x) => x.w.kind === 'ending' || x.w.kind === 'mark')) {
    return { kind: 'ending', grade: 'hard', result, weak: wrong.filter((x) => x.w.kind === 'ending').map((x) => x.i) };
  }
  return { kind: 'bad', grade: 'again', result, weak: wrong.filter((x) => x.w.kind === 'ending').map((x) => x.i) };
}

/** Recording format: Safari (iPhone) records audio/mp4, Chrome and Firefox audio/webm. */
export function pickMime(isSupported: (t: string) => boolean): string | undefined {
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(isSupported);
}

/** A press shorter than this is a tap, not speech. */
export const MIN_SPEECH_MS = 400;
/** Recording stops by itself after this long. */
export const MAX_SPEECH_MS = 15000;
