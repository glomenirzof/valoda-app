/**
 * Hold-to-talk recording (MediaRecorder) and recognition through the voice Worker (worker/README.md).
 * The microphone is released right after each recording: on iPhone an open microphone sends playback to the
 * quiet earpiece, and the sample phrase plays right after the check.
 */
import { VOICE_URL } from '../config';
import { MAX_SPEECH_MS, MIN_SPEECH_MS, pickMime } from '../core/voice';

export type VoiceError = 'no-mic' | 'denied' | 'short' | 'offline' | 'limit' | 'failed';

export const VOICE_ERROR_RU: Record<VoiceError, string> = {
  'no-mic': 'Микрофон недоступен',
  denied: 'Нет доступа к микрофону — разреши его в настройках Safari',
  short: 'Зажми кнопку и говори, пока держишь',
  offline: 'Нет интернета — оцени себя сам',
  limit: 'Лимит голосовых проверок на сегодня исчерпан — оцени себя сам',
  failed: 'Не получилось распознать — оцени себя сам',
};

export class VoiceFailure extends Error {
  constructor(public reason: VoiceError) {
    super(reason);
  }
}

/** Voice check is offered when the Worker is set up and the browser can record. */
export const voiceSupported = () =>
  !!VOICE_URL && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!pickMime((t) => MediaRecorder.isTypeSupported(t));

export class Recorder {
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private started = 0;
  private timer = 0;
  private ready: Promise<void> | null = null;

  /** Starts recording; called on press. The first time it asks for the microphone. */
  start() {
    this.chunks = [];
    this.started = Date.now();
    this.ready = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new VoiceFailure('no-mic');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (e) {
        throw new VoiceFailure((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'no-mic');
      }
      const mimeType = pickMime((t) => MediaRecorder.isTypeSupported(t));
      this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.rec.start();
      this.timer = window.setTimeout(() => this.rec?.state === 'recording' && this.rec.stop(), MAX_SPEECH_MS);
    })();
    return this.ready;
  }

  /** Stops on release and returns the audio. */
  async stop(): Promise<Blob> {
    const held = Date.now() - this.started;
    try {
      await this.ready;
    } finally {
      clearTimeout(this.timer);
    }
    const rec = this.rec!;
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    if (rec.state === 'recording') rec.stop();
    else if (rec.state === 'inactive') queueMicrotask(() => rec.onstop?.(new Event('stop')));
    await done;
    this.release();
    // a permission prompt during the press, or a quick tap: nothing worth sending
    if (held < MIN_SPEECH_MS || !this.chunks.length) throw new VoiceFailure('short');
    return new Blob(this.chunks, { type: (rec.mimeType || this.chunks[0].type).split(';')[0] });
  }

  release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}

/** Sends the audio to the Worker; returns what was heard. */
export async function transcribe(audio: Blob): Promise<string> {
  if (!navigator.onLine) throw new VoiceFailure('offline');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(`${VOICE_URL.replace(/\/$/, '')}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': audio.type || 'audio/mp4' },
      body: audio,
      signal: ctl.signal,
    });
    if (r.status === 429) throw new VoiceFailure('limit');
    if (!r.ok) throw new VoiceFailure('failed');
    const { text } = (await r.json()) as { text?: string };
    if (!text?.trim()) throw new VoiceFailure('failed');
    return text;
  } catch (e) {
    throw e instanceof VoiceFailure ? e : new VoiceFailure(navigator.onLine ? 'failed' : 'offline');
  } finally {
    clearTimeout(timer);
  }
}
