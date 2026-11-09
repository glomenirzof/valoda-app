import type { PlacementData } from '../core/placement';
import type { Lang, PhraseFile } from '../core/types';

const cache = new Map<Lang, Promise<PhraseFile>>();

/** Phrase data ships with the app and is precached by the service worker. */
export function loadPhrases(lang: Lang): Promise<PhraseFile> {
  if (!cache.has(lang)) {
    cache.set(
      lang,
      fetch(`${import.meta.env.BASE_URL}data/${lang}/phrases.json`).then((r) => {
        if (!r.ok) throw new Error(`phrases.json: ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(lang)!;
}

/** Data for the placement test (scripts/content/build_placement.py). */
export const loadPlacement = (lang: Lang): Promise<PlacementData> =>
  fetch(`${import.meta.env.BASE_URL}data/${lang}/placement.json`).then((r) => {
    if (!r.ok) throw new Error(`placement.json: ${r.status}`);
    return r.json();
  });
