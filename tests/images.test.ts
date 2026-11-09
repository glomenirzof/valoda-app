import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ImagesData } from '../src/data/images';
import type { Phrase } from '../src/core/types';

const data = JSON.parse(readFileSync('public/data/lv/images.json', 'utf8')) as ImagesData;
const phrases = (JSON.parse(readFileSync('public/data/lv/phrases.json', 'utf8')) as { phrases: Phrase[] }).phrases;
const byId = new Map(phrases.map((p) => [p.id, p]));
const OPEN = /^(CC0|Public domain|PD|CC BY(-SA)? \d\.\d|Apache License)/i;

describe('phrase pictures', () => {
  it('every picture has its file (WebP, at most 50 KB), an author, an open licence and a Commons source', () => {
    for (const img of Object.values(data.images)) {
      const f = `public/images/lv/${img.file}`;
      expect(existsSync(f), f).toBe(true);
      expect(img.file.endsWith('.webp')).toBe(true);
      expect(statSync(f).size).toBeLessThanOrEqual(50_000);
      expect(img.author.length).toBeGreaterThan(0);
      expect(img.license, img.title).toMatch(OPEN);
      expect(img.source).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it('only trainable phrases with the pictured word get a picture', () => {
    for (const [id, x] of Object.entries(data.phrases)) {
      const p = byId.get(id)!;
      expect(p.order, id).toBeTruthy();
      expect(data.images[x.image], id).toBeTruthy();
      expect(p.tokens.some((t) => t.lemma === x.lemma), `${p.text} / ${x.lemma}`).toBe(true);
    }
  });

  it('a picture never stands in for the Russian of a negated phrase', () => {
    for (const [id, x] of Object.entries(data.phrases)) {
      if (!x.cue) continue;
      const p = byId.get(id)!;
      expect(p.tokens.some((t) => t.feats.split('.').includes('NEG')), p.text).toBe(false);
    }
  });

  it('idioms where the pictured word means something else stay without a picture', () => {
    const texts = new Set(Object.keys(data.phrases).map((id) => byId.get(id)!.text));
    for (const t of ['Kā tev iet?', 'Kā jums iet?', 'Man iet labi.', 'Kāds transports iet uz centru?']) expect(texts.has(t), t).toBe(false);
  });

  it('abstract words get no picture', () => {
    const lemmas = new Set(Object.values(data.phrases).map((x) => x.lemma));
    for (const l of ['laiks', 'problēma', 'vajadzēt', 'domāt', 'minūte', 'tomēr']) expect(lemmas.has(l), l).toBe(false);
  });
});
