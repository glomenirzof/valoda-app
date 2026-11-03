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
