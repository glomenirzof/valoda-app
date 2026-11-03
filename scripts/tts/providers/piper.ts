import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import type { Provider, SynthResult } from './types';

const run = promisify(execFile);
const VOICE_DIR = resolve('data-cache/piper');

// The venv must live on an ASCII-only path: piper's bundled espeak-ng can't
// open its data dir under non-Latin paths such as "E:\вайбкодинг\...".
const python = () => process.env.PIPER_PYTHON || join(homedir(), '.venvs/valoda-tts/Scripts/python.exe');
const model = (voice: string) => join(VOICE_DIR, `${voice}.onnx`);

export const piper: Provider = {
  id: 'piper',

  unavailable() {
    if (!existsSync(python())) return `нет Python с piper-tts (${python()})`;
    if (!existsSync(model('lv_LV-aivars-medium'))) return 'нет голоса lv_LV-aivars-medium в data-cache/piper';
    if (!ffmpegPath) return 'нет ffmpeg-static';
    return null;
  },

  async latvianVoices() {
    return [{ voice: 'lv_LV-aivars-medium', label: 'Piper aivars (муж., офлайн)' }];
  },

  async synthesize(text, voice, rate): Promise<SynthResult> {
    const dir = mkdtempSync(join(tmpdir(), 'piper-'));
    try {
      const wav = join(dir, 'out.wav');
      const mp3 = join(dir, 'out.mp3');
      // Piper slows speech by stretching phonemes: length-scale = 1 / rate
      await run(python(), ['-m', 'piper', '-m', model(voice), '-f', wav, '--length-scale', String(1 / rate), '--', text], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      });
      await run(ffmpegPath!, ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', mp3]);
      return { mp3: readFileSync(mp3), textChars: [...text].length, payloadChars: [...text].length };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
};
