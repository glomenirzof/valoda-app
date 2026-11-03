import { GoogleAuth } from 'google-auth-library';
import type { Provider, SynthResult } from './types';

const API = 'https://texttospeech.googleapis.com/v1';
const PREFERRED = ['Laomedeia', 'Alnilam', 'Achird', 'Zubenelgenubi'];

async function call(path: string, init: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url = `${API}/${path}`;
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (key) {
    url += (url.includes('?') ? '&' : '?') + `key=${encodeURIComponent(key)}`;
  } else {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const token = await (await auth.getClient()).getAccessToken();
    headers.Authorization = `Bearer ${token.token}`;
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  return res.json();
}

export const google: Provider = {
  id: 'google',

  unavailable() {
    if (!process.env.GOOGLE_TTS_API_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return 'нет GOOGLE_TTS_API_KEY или GOOGLE_APPLICATION_CREDENTIALS в .env';
    }
    return null;
  },

  /**
   * Chirp 3: HD voices the user picked by ear in Google's demo; any that Google
   * doesn't list for lv-LV are skipped. Falls back to one female + one male.
   */
  async latvianVoices() {
    const { voices = [] } = await call('voices?languageCode=lv-LV');
    const chirp = voices.filter((v: any) => /Chirp3-HD/i.test(v.name));
    const label = (v: any) =>
      `Google Chirp 3 HD ${v.name.split('-').pop()} (${v.ssmlGender === 'FEMALE' ? 'жен.' : 'муж.'})`;

    const picked = PREFERRED.map((p) => chirp.find((v: any) => v.name.endsWith(`-${p}`))).filter(Boolean);
    if (picked.length) return picked.map((v: any) => ({ voice: v.name, label: label(v) }));

    const fallback = ['FEMALE', 'MALE'].map((g) => chirp.find((v: any) => v.ssmlGender === g)).filter(Boolean);
    if (!fallback.length) throw new Error(`Google не вернул голосов Chirp 3 HD для lv-LV (всего голосов: ${voices.length})`);
    return fallback.map((v: any) => ({ voice: v.name, label: label(v) }));
  },

  async synthesize(text, voice, rate, quality): Promise<SynthResult> {
    const body = JSON.stringify({
      input: { text },
      voice: { languageCode: 'lv-LV', name: voice },
      // Chirp 3: HD takes no SSML; speed goes through speakingRate (0.25–2.0)
      audioConfig: { audioEncoding: 'MP3', speakingRate: rate, ...(quality === 'hq' && { sampleRateHertz: 48000 }) },
    });
    const { audioContent } = await call('text:synthesize', { method: 'POST', body });
    return { mp3: Buffer.from(audioContent, 'base64'), textChars: [...text].length, payloadChars: [...body].length };
  },
};
