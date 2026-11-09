import type { CheckResult } from './check';
import type { Grade } from './srs';

const ORDER: Grade[] = ['again', 'hard', 'good', 'easy'];
export const worse = (a: Grade, b: Grade) => ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))];

const letterCount = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/**
 * Grade suggested for a typed review: by the checker, made worse by hints — opened letters (more than a third of
 * the phrase → Again) and the keyboard of the answer's letters (at best Hard). Null when only the learner can judge.
 */
export function suggestedGrade(o: { result: CheckResult | null; hints: number; keys?: boolean }, text: string): Grade | null {
  let g: Grade | null = o.result ? ({ ok: 'good', almost: 'hard', bad: 'again' } as const)[o.result.verdict] : null;
  if (o.hints) {
    const byHints: Grade = o.hints / letterCount(text) > 1 / 3 ? 'again' : 'hard';
    g = g ? worse(g, byHints) : byHints;
  }
  if (o.keys) g = g ? worse(g, 'hard') : 'hard';
  return g;
}
