import type { Lang, Token } from '../core/types';

/** public/data/<lang>/audio.json, written by scripts/tts/generate.ts */
interface AudioIndex { phrases: Record<string, string>; words: Record<string, string> }

const indexes = new Map<Lang, Promise<AudioIndex | null>>();
let current: HTMLAudioElement | null = null;

function index(lang: Lang) {
  if (!indexes.has(lang)) {
    indexes.set(
      lang,
      fetch(`${import.meta.env.BASE_URL}data/${lang}/audio.json`)
        .then((r) => (r.ok ? (r.json() as Promise<AudioIndex>) : null))
        .catch(() => null),
    );
  }
  return indexes.get(lang)!;
}

async function playFile(lang: Lang, file: string | undefined, rate: number) {
  if (!file) return false;
  current?.pause();
  current = new Audio(`${import.meta.env.BASE_URL}audio/${lang}/${file}`);
  // Slow playback keeps the pitch, so one recording serves both speeds.
  current.playbackRate = rate;
  try {
    await current.play();
    return true;
  } catch {
    return false;
  }
}

export const playPhrase = async (lang: Lang, id: string, rate = 1) => playFile(lang, (await index(lang))?.phrases[id], rate);

/** Proper nouns keep their capital (Rīga), other words are recorded in lower case — same rule as the generator. */
export const wordKey = (t: Pick<Token, 's' | 'lemma'>) => (/^\p{Lu}/u.test(t.lemma) ? t.s : t.s.toLowerCase());

export const playWord = async (lang: Lang, text: string) => playFile(lang, (await index(lang))?.words[text], 1);

export const hasAudio = async (lang: Lang) => !!(await index(lang));
