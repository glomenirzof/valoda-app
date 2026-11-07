import { describe, expect, it } from 'vitest';
import { lemmasOf, orderPhrases, SURVIVAL, violations, type OrderPhrase } from '../scripts/content/order-core';

let n = 0;
const ph = (text: string, lemmas: string, freqRank: number | null = 100): OrderPhrase => ({
  id: `p${String(++n).padStart(3, '0')}`,
  text,
  freqRank,
  tokens: lemmas.split(' ').map((lemma) => ({ lemma })),
});

describe('orderPhrases', () => {
  it('never brings more than one new lemma when a fitting phrase exists, and prefers frequent ones', () => {
    const ps = [ph('Kas tas ir?', 'kas tas būt', 5), ph('Tas.', 'tas', 50), ph('Kas?', 'kas', 900), ph('Tas ir.', 'tas būt', 10)];
    const order = orderPhrases(ps).map((x) => x.p.text);
    // survival steps take short phrases first, so «Kas?» comes before the three-word phrase
    expect(order).toEqual(['Tas.', 'Tas ir.', 'Kas?', 'Kas tas ir?']);
    expect(violations(orderPhrases(ps).map((x) => x.p))).toEqual([]);
  });

  it('starts with survival phrases of one or two words', () => {
    const long = ph('Es gribu kafiju.', 'es gribēt kafija', 1);
    const short = Array.from({ length: SURVIVAL }, (_, i) => ph(`W${i}`, `w${i}`, 500));
    const order = orderPhrases([long, ph('Es.', 'es', 600), ph('Es gribu.', 'es gribēt', 700), ...short]);
    expect(order.slice(0, SURVIVAL).every((x) => x.p.tokens.length <= 2)).toBe(true);
  });

  it('takes the shortest phrase with the fewest new lemmas when stuck, and marks it', () => {
    const ps = [ph('Nāc šeit!', 'nākt šeit'), ph('Kas tas ir?', 'kas tas būt'), ph('Šeit tas ir.', 'šeit tas būt')];
    const order = orderPhrases(ps);
    expect(order[0]).toMatchObject({ forced: true, fresh: ['nākt', 'šeit'] });
    expect(violations(order.map((x) => x.p)).map((v) => v.p.text)).toContain('Nāc šeit!');
  });

  it('places a later batch into the common order by the same rule', () => {
    const base = [ph('Jā, protams.', 'jā protams', 1)];
    const batch = [ph('Protams!', 'protams', 3)];
    const order = orderPhrases([...base, ...batch]).map((x) => x.p.text);
    expect(order).toEqual(['Protams!', 'Jā, protams.']);
    expect(violations(orderPhrases([...base, ...batch]).map((x) => x.p))).toEqual([]);
  });
});

describe('violations', () => {
  it('counts phrases that bring two or more unknown lemmas in the given order', () => {
    const v = violations([ph('Kas tas ir?', 'kas tas būt'), ph('Tas ir.', 'tas būt')]);
    expect(v).toHaveLength(1);
    expect(v[0].fresh).toEqual(['kas', 'tas', 'būt']);
  });

  it('treats Tēzaurs feminine pronoun lexemes as the same word', () => {
    const tava = { id: 'x', text: 'Tava izvēle.', freqRank: 1, tokens: [{ lemma: 'tava', pos: 'PRON' }, { lemma: 'izvēle', pos: 'NOUN' }] };
    expect(lemmasOf(tava)).toEqual(['tavs', 'izvēle']);
    expect(violations([ph('Tavs.', 'tavs'), tava])).toEqual([]);
  });
});
