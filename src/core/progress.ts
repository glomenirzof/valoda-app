/**
 * What the learner can see of their progress: the level of every phrase, weak spots, the review forecast
 * and the weekly control test (research §2.8: honest measures, no XP, leagues or lives).
 */
import { State } from 'ts-fsrs';
import { formRu } from './check';
import { MAX_NEW_PER_SESSION, type Acquaintance } from './session';
import type { StoredCard } from './srs';
import type { Phrase } from './types';

/** новая → знакомлюсь (in the lesson ladder) → запоминаю (FSRS learning) → помню (≥ 7 days) → знаю (≥ 21 days) */
export type Level = 'new' | 'meeting' | 'learning' | 'remember' | 'know';
export const LEVELS: Level[] = ['new', 'meeting', 'learning', 'remember', 'know'];
export const LEVEL_RU: Record<Level, string> = {
  new: 'новая',
  meeting: 'знакомлюсь',
  learning: 'запоминаю',
  remember: 'помню',
  know: 'знаю',
};
export const REMEMBER_DAYS = 7;
export const KNOW_DAYS = 21;

export function levelOf(card: StoredCard | undefined, meeting = false): Level {
  if (card && card.fsrs.state !== State.New) {
    const c = card.fsrs;
    if (c.state === State.Learning || c.state === State.Relearning) return 'learning';
    if (c.stability >= KNOW_DAYS) return 'know';
    if (c.stability >= REMEMBER_DAYS) return 'remember';
    return 'learning';
  }
  return meeting ? 'meeting' : 'new';
}

/** «Могу сказать»: phrases held for a week or longer. */
export const canSay = (l: Level) => l === 'remember' || l === 'know';

export function levelMap(phrases: Phrase[], cards: StoredCard[], acquainted: Acquaintance[]) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const meet = new Set(acquainted.map((a) => a.id));
  return new Map(phrases.map((p) => [p.id, levelOf(byId.get(p.id), meet.has(p.id))]));
}

export function countLevels(levels: Iterable<Level>): Record<Level, number> {
  const n = { new: 0, meeting: 0, learning: 0, remember: 0, know: 0 };
  for (const l of levels) n[l]++;
  return n;
}

/** Per topic: how many phrases, and how many at each level. */
export function topicLevels(phrases: Phrase[], levels: Map<string, Level>) {
  const out = new Map<string, Record<Level, number>>();
  for (const p of phrases) {
    const t = out.get(p.topic) ?? countLevels([]);
    t[levels.get(p.id) ?? 'new']++;
    out.set(p.topic, t);
  }
  return out;
}

export interface WeakSpot {
  lemma: string;
  /** how often hints or mistakes hit this word */
  count: number;
  ru: string;
  /** forms of the word met in the phrases, with what each form is */
  forms: { s: string; what: string }[];
}

/** Top words that needed hints or had mistakes (card.weak), with the forms they take in the phrases. */
export function weakSpots(cards: StoredCard[], phrases: Phrase[], n = 5): WeakSpot[] {
  const total = new Map<string, number>();
  for (const c of cards) for (const [l, k] of Object.entries(c.weak)) total.set(l, (total.get(l) ?? 0) + k);
  return [...total.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([lemma, count]) => {
      const toks = phrases.flatMap((p) => p.tokens).filter((t) => t.lemma === lemma);
      const forms = new Map<string, string>();
      for (const t of toks) if (!forms.has(t.s.toLowerCase())) forms.set(t.s.toLowerCase(), formRu(t));
      return { lemma, count, ru: toks[0]?.ru ?? '', forms: [...forms.entries()].slice(0, 3).map(([s, what]) => ({ s, what })) };
    });
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86400000;

/** Reviews coming due: by the end of tomorrow and within the next 7 days (cards already due count too). */
export function forecast(cards: StoredCard[], now: Date) {
  const tomorrowEnd = startOfDay(now) + 2 * DAY;
  const weekEnd = startOfDay(now) + 8 * DAY;
  const due = cards.filter((c) => c.fsrs.state !== State.New).map((c) => c.fsrs.due.getTime());
  return { tomorrow: due.filter((t) => t < tomorrowEnd).length, week: due.filter((t) => t < weekEnd).length };
}

/** «Урок 1 из 2 на сегодня»: the daily new-phrase limit split into lessons of five. */
export function lessonOfDay(newPerDay: number, introducedToday: number) {
  const total = Math.max(1, Math.ceil(newPerDay / MAX_NEW_PER_SESSION));
  const done = Math.min(total, Math.floor(introducedToday / MAX_NEW_PER_SESSION));
  return { n: Math.min(done + 1, total), total, done };
}

/* ---------- weekly control test ---------- */

export const CONTROL_SIZE = 20;
/** fewer phrases than this at «помню»/«знаю» and the test would say little */
export const CONTROL_MIN = 5;
export const CONTROL_EVERY_DAYS = 7;

export interface ControlResult {
  /** when it was taken (ms), also the key */
  ts: number;
  lang: Phrase['lang'];
  total: number;
  correct: number;
  /** written right except long vowels or marks */
  almost: number;
}

export const controlPercent = (r: ControlResult) => (r.total ? Math.round((r.correct / r.total) * 100) : 0);

/** The test is offered when a week has passed since the last one and enough phrases are held. */
export function controlDue(results: ControlResult[], held: number, now: Date) {
  if (held < CONTROL_MIN) return false;
  const last = Math.max(0, ...results.map((r) => r.ts));
  return now.getTime() - last >= CONTROL_EVERY_DAYS * DAY;
}

/** 20 random phrases at «помню»/«знаю». */
export function controlPick(ids: string[], rng: () => number = Math.random) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, CONTROL_SIZE);
}

/** Monday of the week (local), for the weekly chart. */
export const weekOf = (ts: number) => {
  const d = new Date(ts);
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
};
