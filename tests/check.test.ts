import { describe, expect, it } from 'vitest';
import { checkAnswer, explain, formRu, keyWrong } from '../src/core/check';
import type { Token } from '../src/core/types';

const kinds = (typed: string, target: string) => checkAnswer(typed, target).words.map((w) => w.kind);

describe('checkAnswer', () => {
  it('accepts the exact phrase regardless of case and punctuation', () => {
    expect(checkAnswer('mēs ejam uz veikalu', 'Mēs ejam uz veikalu.').verdict).toBe('ok');
  });

  it('marks a missing long vowel as a mark mistake, verdict almost', () => {
    const r = checkAnswer('Mes ejam uz veikalu', 'Mēs ejam uz veikalu.');
    expect(r.verdict).toBe('almost');
    expect(r.words[0].kind).toBe('mark');
  });

  it('separates ending mistakes from root mistakes', () => {
    expect(kinds('Mēs ejam uz veikals', 'Mēs ejam uz veikalu.')[3]).toBe('ending');
    expect(kinds('Mēs ejam uz bodi', 'Mēs ejam uz veikalu.')[3]).toBe('root');
    expect(kinds('Es dzīvoju Rīga', 'Es dzīvoju Rīgā.')[2]).toBe('mark');
  });

  it('reports missing words and fails the verdict', () => {
    const r = checkAnswer('Mēs ejam', 'Mēs ejam uz veikalu.');
    expect(r.verdict).toBe('bad');
    expect(r.words.slice(2).map((w) => w.kind)).toEqual(['missing', 'missing']);
  });

  it('collects extra words and fails the verdict', () => {
    const r = checkAnswer('Es nezinu tagad', 'Es nezinu.');
    expect(r.verdict).toBe('bad');
    expect(r.extra).toEqual(['tagad']);
  });

  it('takes accepted variants as correct', () => {
    expect(checkAnswer('Labdien', 'Labdien!', ['labdien']).verdict).toBe('ok');
  });
});

const tok = (s: string, lemma: string, pos: string, feats: string, ru: string): Token => ({ s, lemma, pos, feats, ru });
const ES_NEZINU = [tok('Es', 'es', 'PRON', '1.NOM.SG', 'я'), tok('nezinu', 'zināt', 'VERB', 'IND.PRS.1.SG.NEG', 'знать')];
const UZ_DARBU = [
  tok('Es', 'es', 'PRON', '1.NOM.SG', 'я'),
  tok('eju', 'iet', 'VERB', 'IND.PRS.1.SG', 'идти'),
  tok('uz', 'uz', 'ADP', '', 'на'),
  tok('darbu', 'darbs', 'NOUN', 'ACC.SG', 'работа'),
];
const RIGA = [tok('Es', 'es', 'PRON', '1.NOM.SG', 'я'), tok('dzīvoju', 'dzīvot', 'VERB', 'IND.PRS.1.SG', 'жить'), tok('Rīgā', 'Rīga', 'NOUN', 'LOC.SG.F', 'Рига')];
const lines = (typed: string, target: string, tokens: Token[]) => explain(checkAnswer(typed, target), tokens).map((e) => e.text);

describe('explain', () => {
  it('names the subject that asks for the verb person', () => {
    expect(lines('Es nezina', 'Es nezinu.', ES_NEZINU)).toEqual(['nezina → nezinu: после es — 1-е лицо']);
  });

  it('names the preposition that asks for the case', () => {
    expect(lines('Es eju uz darba', 'Es eju uz darbu.', UZ_DARBU)).toEqual(['darba → darbu: после uz — винительный падеж (кого? что?), ед. ч.']);
  });

  it('falls back to the needed form when nothing in the phrase points to it', () => {
    const t = [tok('Paldies', 'paldies', 'INTJ', '', 'спасибо'), tok('draugam', 'draugs', 'NOUN', 'DAT.SG', 'друг')];
    expect(lines('Paldies draugs', 'Paldies draugam.', t)).toEqual(['draugs → draugam: дательный падеж (кому? чему?), ед. ч.']);
  });

  it('calls a wrong root another word and gives the expected one with its meaning', () => {
    expect(lines('Es negribu', 'Es nezinu.', ES_NEZINU)).toEqual(['negribu: другое слово — ожидалось nezinu (знать)']);
  });

  it('treats the known wrong form of the key word as a form mistake, not another word', () => {
    const t = [tok('Kas', 'kas', 'PRON', 'NOM', 'что'), tok('tas', 'tas', 'PRON', '3.NOM.SG.M', 'это'), tok('ir', 'būt', 'VERB', 'IND.PRS.3.SG', 'быть')];
    const r = checkAnswer('Kas tas esmu', 'Kas tas ir?');
    expect(explain(r, t, { i: 2, trap: 'esmu' }).map((e) => e.text)).toEqual(['esmu → ir: другая форма того же слова (būt) — после tas — 3-е лицо']);
    expect(explain(r, t).map((e) => e.text)).toEqual(['esmu: другое слово — ожидалось ir (быть)']);
  });

  it('lists the missing marks, with the reason when they are in the ending', () => {
    expect(lines('Es dzivoju Riga', 'Es dzīvoju Rīgā.', RIGA)).toEqual([
      'dzivoju → dzīvoju: нужна долгота ī',
      'riga → rīgā: нужна долгота ī, ā — местный падеж (где? в чём?), ед. ч.',
    ]);
  });

  it('reports missing and extra words', () => {
    expect(lines('Es', 'Es nezinu.', ES_NEZINU)).toEqual(['пропущено: nezinu (знать)']);
    expect(lines('Es nezinu tagad', 'Es nezinu.', ES_NEZINU)).toEqual(['лишнее: tagad']);
  });

  it('says nothing for a correct answer', () => {
    expect(lines('es nezinu', 'Es nezinu.', ES_NEZINU)).toEqual([]);
  });

  it('describes verb and noun forms in Russian', () => {
    expect(formRu(ES_NEZINU[1])).toBe('1-е лицо, ед. ч., настоящее время');
    expect(formRu(tok('ej', 'iet', 'VERB', 'IMP.2.SG', 'идти'))).toBe('повелительное наклонение, 2-е лицо, ед. ч.');
    expect(formRu(tok('strādāt', 'strādāt', 'VERB', 'INF', 'работать'))).toBe('инфинитив (неопределённая форма)');
    expect(formRu(RIGA[2])).toBe('местный падеж (где? в чём?), ед. ч.');
  });
});

describe('keyWrong', () => {
  const key = { i: 1 };
  it('is true only when the key word itself was wrong', () => {
    expect(keyWrong(checkAnswer('Es nezina', 'Es nezinu.'), key)).toBe(true);
    expect(keyWrong(checkAnswer('Mes nezinu', 'Es nezinu.'), key)).toBe(false);
    expect(keyWrong(checkAnswer('Es nezinu', 'Es nezinu.'), undefined)).toBe(false);
  });
});
