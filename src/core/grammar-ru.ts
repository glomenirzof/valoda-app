// Feature codes (from scripts/tezaurs/build_index.py) → Russian labels.

const SHORT: Record<string, string> = {
  NOM: 'им.', GEN: 'род.', DAT: 'дат.', ACC: 'вин.', LOC: 'мест.', VOC: 'зват.',
  SG: 'ед.', PL: 'мн.', M: 'м.р.', F: 'ж.р.',
  IND: 'изъяв.', IMP: 'повел.', INF: 'инф.', DEB: 'долж.', DEBQ: 'долж.-переск.', QUOT: 'переск.', COND: 'усл.', PTCP: 'прич.',
  PRS: 'наст.', PST: 'прош.', FUT: 'буд.', '1': '1 л.', '2': '2 л.', '3': '3 л.',
  DEF: 'опред.', INDEF: 'неопр.', CMP: 'сравн.', SUP: 'превосх.', PASS: 'страд.', REFL: 'возвр.', NEG: 'отриц.',
};

const LONG: Record<string, string> = {
  NOM: 'именительный падеж (кто? что?)',
  GEN: 'родительный падеж (кого? чего?)',
  DAT: 'дательный падеж (кому? чему?)',
  ACC: 'винительный падеж (кого? что?)',
  LOC: 'местный падеж (где? в чём?)',
  VOC: 'звательный падеж',
  SG: 'единственное число', PL: 'множественное число',
  M: 'мужской род', F: 'женский род',
  IND: 'изъявительное наклонение', IMP: 'повелительное наклонение', INF: 'инфинитив',
  DEB: 'долженствовательное наклонение', DEBQ: 'долженствовательно-пересказывательное', QUOT: 'пересказывательное наклонение',
  COND: 'условное наклонение', PTCP: 'причастие',
  PRS: 'настоящее время', PST: 'прошедшее время', FUT: 'будущее время',
  '1': '1-е лицо', '2': '2-е лицо', '3': '3-е лицо',
  DEF: 'определённая форма', INDEF: 'неопределённая форма',
  CMP: 'сравнительная степень', SUP: 'превосходная степень',
  PASS: 'страдательный залог', REFL: 'возвратная форма', NEG: 'с отрицанием (ne-)',
};

export const POS_RU: Record<string, string> = {
  NOUN: 'существительное', VERB: 'глагол', ADJ: 'прилагательное', ADV: 'наречие', PRON: 'местоимение',
  NUM: 'числительное', ADP: 'предлог', CCONJ: 'союз', PART: 'частица', INTJ: 'междометие', ABBR: 'сокращение', X: 'другое',
};

const parts = (feats: string) => (feats ? feats.split('.') : []);

export const featsShort = (feats: string) => parts(feats).map((p) => SHORT[p] ?? p).join(' ');
export const featsLong = (feats: string) => parts(feats).map((p) => LONG[p] ?? p);

export function paradigmRu(t: { pos: string; decl?: string; conj?: string }): string | null {
  if (t.decl && /^\d$/.test(t.decl)) return `${t.decl}-е склонение`;
  if (t.conj && /^\d$/.test(t.conj)) return `${t.conj}-е спряжение`;
  if (t.conj === 'Nekārtns') return 'неправильный глагол';
  return null;
}
