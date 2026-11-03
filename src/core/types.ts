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

export interface Phrase {
  id: string;
  lang: Lang;
  topic: string;
  text: string;
  ru: string;
  tokens: Token[];
  accept: string[];
  audio: string | null;
  image: string | null;
  freqRank: number | null;
  status: PhraseStatus;
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
  /** let unverified phrases into Speak / Silent training (marked) */
  allowUnverified: boolean;
  newPerDay: number;
}

export const DEFAULT_SETTINGS: Settings = { lang: 'lv', allowUnverified: false, newPerDay: 10 };

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
