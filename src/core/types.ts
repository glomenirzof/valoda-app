export type Lang = 'lv' | 'en' | 'de';

export interface Token {
  /** surface form as written in the phrase */
  s: string;
  lemma: string;
  pos: string;
  /** feature codes, e.g. "LOC.SG" — see src/core/grammar-ru.ts */
  feats: string;
  /** other grammatical readings Tēzaurs allows for this form */
  alt?: string[];
  decl?: string;
  conj?: string;
  gender?: 'M' | 'F';
  ru: string;
}

export type PhraseStatus = 'unverified' | 'tutor';
/** result of npm run content:check (sources + two translators); only 'ok' goes into training */
export type AutoStatus = 'ok' | 'doubtful' | 'unchecked';

export interface Phrase {
  id: string;
  lang: Lang;
  topic: string;
  text: string;
  ru: string;
  tokens: Token[];
  accept: string[];
  /** the word whose ending the phrase trains, a wrong-ending trap for tiles, and one-line reasons */
  key?: { i: number; trap: string; why: string; trapWhy: string };
  audio: string | null;
  image: string | null;
  freqRank: number | null;
  status: PhraseStatus;
  auto: AutoStatus;
  source: 'llm' | 'tutor' | 'life' | 'tatoeba';
  check: { tezaurs: 'ok'; edition: string };
}

export interface PhraseFile {
  lang: Lang;
  edition: string;
  phrases: Phrase[];
}

export interface Settings {
  lang: Lang;
  newPerDay: number;
  /** null until the user picks one: then the system theme is used */
  theme: 'light' | 'dark' | null;
  accent: Accent;
  font: FontPair;
}

export type Accent = 'terra' | 'amber';
export type FontPair = 'A' | 'B' | 'C';

export const DEFAULT_SETTINGS: Settings = { lang: 'lv', newPerDay: 10, theme: null, accent: 'terra', font: 'B' };

export const TOPIC_RU: Record<string, string> = {
  polite: 'Вежливость',
  me: 'О себе',
  understand: 'Понимание',
  shop: 'Магазин и кафе',
  city: 'Город и транспорт',
  time: 'Время',
  gym: 'Зал',
  health: 'Здоровье',
  home: 'Дом',
  weather: 'Погода',
  work: 'Работа',
  likes: 'Желания и вопросы',
};
