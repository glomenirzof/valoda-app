import type { Lang, Token } from '../core/types';

/** public/data/<lang>/audio.json, written by scripts/tts/generate.ts */
interface AudioIndex { phrases: Record<string, string>; words: Record<string, string> }

const indexes = new Map<Lang, Promise<AudioIndex | null>>();

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

/*
 * One audio element for the whole app. iOS Safari lets a page play sound only after a play() started inside a
 * user gesture; the element unlocked that way (unlockAudio on «Начать») can then play later clips by itself.
 */
let el: HTMLAudioElement | null = null;
let soundOn = true;
/** bumps on every new clip, so a pending second play (playPhraseTwice) is dropped when something else starts */
let gen = 0;

const player = () => (el ??= new Audio());

/** Sound setting (off in the gym or on transport): nothing plays at all. */
export function setSound(on: boolean) {
  soundOn = on;
  if (!on) el?.pause();
}
export const soundEnabled = () => soundOn;

/** 50 ms of silence as a WAV file, to unlock the player inside a tap without making a sound. */
function silence() {
  const rate = 8000, n = 400, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Call synchronously in a tap handler (the «Начать» button) before any automatic playback. */
export function unlockAudio() {
  if (!soundOn) return;
  const a = player();
  if (a.dataset.unlocked) return;
  a.src = silence();
  a.play().then(() => (a.dataset.unlocked = '1')).catch(() => {});
}

async function playFile(lang: Lang, file: string | undefined, rate: number) {
  const my = ++gen;
  if (!file || !soundOn) return false;
  const a = player();
  a.pause();
  a.src = `${import.meta.env.BASE_URL}audio/${lang}/${file}`;
  // Slow playback keeps the pitch, so one recording serves both speeds; iOS resets playbackRate on a new src.
  a.defaultPlaybackRate = rate;
  a.playbackRate = rate;
  try {
    await a.play();
    return my === gen;
  } catch {
    return false;
  }
}

export const playPhrase = async (lang: Lang, id: string, rate = 1) => playFile(lang, (await index(lang))?.phrases[id], rate);

/** First meeting with a phrase: normal speed, then once more at 0.75 — unless something else starts playing. */
export async function playPhraseTwice(lang: Lang, id: string) {
  if (!(await playPhrase(lang, id, 1))) return;
  const my = gen;
  // ends normally, or is paused because another clip started (then gen has moved on)
  await new Promise<void>((done) => {
    const a = player();
    const stop = () => {
      a.removeEventListener('ended', stop);
      a.removeEventListener('pause', stop);
      done();
    };
    a.addEventListener('ended', stop);
    a.addEventListener('pause', stop);
  });
  await new Promise((r) => setTimeout(r, 450));
  if (my === gen) await playPhrase(lang, id, 0.75);
}

/** Proper nouns keep their capital (Rīga), other words are recorded in lower case — same rule as the generator. */
export const wordKey = (t: Pick<Token, 's' | 'lemma'>) => (/^\p{Lu}/u.test(t.lemma) ? t.s : t.s.toLowerCase());

export const playWord = async (lang: Lang, text: string) => playFile(lang, (await index(lang))?.words[text], 1);

export const hasAudio = async (lang: Lang) => !!(await index(lang));
