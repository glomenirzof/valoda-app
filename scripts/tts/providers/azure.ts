import type { Provider, SynthResult } from './types';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const azure: Provider = {
  id: 'azure',

  unavailable() {
    if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
      return 'нет AZURE_SPEECH_KEY / AZURE_SPEECH_REGION в .env';
    }
    return null;
  },

  async latvianVoices() {
    return [
      { voice: 'lv-LV-EveritaNeural', label: 'Azure Everita (жен.)' },
      { voice: 'lv-LV-NilsNeural', label: 'Azure Nils (муж.)' },
    ];
  },

  async synthesize(text, voice, rate, quality): Promise<SynthResult> {
    const region = process.env.AZURE_SPEECH_REGION!;
    const pct = Math.round((rate - 1) * 100);
    const prosody = pct === 0 ? escapeXml(text) : `<prosody rate="${pct}%">${escapeXml(text)}</prosody>`;
    const ssml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="lv-LV">` +
      `<voice name="${voice}">${prosody}</voice></speak>`;

    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': quality === 'hq' ? 'audio-48khz-192kbitrate-mono-mp3' : 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'valoda-app-tts',
      },
      body: ssml,
    });
    if (!res.ok) throw new Error(`Azure ${res.status}: ${await res.text()}`);
    return { mp3: Buffer.from(await res.arrayBuffer()), textChars: [...text].length, payloadChars: [...ssml].length };
  },
};
