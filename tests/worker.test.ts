import { describe, expect, it } from 'vitest';
import { handle, MAX_BYTES, MODEL, OPENAI_URL, type Counter, type Env } from '../worker/src/index';

const APP = 'https://glomenirzof.github.io';

function kv(start: Record<string, string> = {}): Counter & { data: Record<string, string> } {
  const data = { ...start };
  return { data, get: async (k) => data[k] ?? null, put: async (k, v) => void (data[k] = v) };
}
const env = (usage = kv(), limit = '3'): Env => ({ OPENAI_API_KEY: 'sk-test', ALLOWED_ORIGINS: APP, DAILY_LIMIT: limit, USAGE: usage });
const post = (body: BodyInit = new Uint8Array(2000), headers: Record<string, string> = {}) =>
  new Request('https://valoda-voice.example.workers.dev/transcribe', {
    method: 'POST',
    body,
    headers: { Origin: APP, 'Content-Type': 'audio/mp4', ...headers },
  });

/** Fake OpenAI: remembers the request and answers with a transcript. */
function openai(text = 'Es nezinu.', status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ text }), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('voice worker', () => {
  it('transcribes the audio and returns the text with the requests left today', async () => {
    const o = openai();
    const r = await handle(post(), env(), o.fn);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: 'Es nezinu.', left: 2 });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    expect(o.calls[0].url).toBe(OPENAI_URL);
    expect((o.calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('sends only the audio, model and language — never the expected phrase as a prompt', async () => {
    const o = openai();
    await handle(post(), env(), o.fn);
    const form = o.calls[0].init.body as FormData;
    expect([...form.keys()].sort()).toEqual(['file', 'language', 'model', 'response_format']);
    expect(form.get('model')).toBe(MODEL);
    expect(form.get('language')).toBe('lv');
    expect(form.has('prompt')).toBe(false);
    expect((form.get('file') as File).name).toBe('speech.m4a');
  });

  it('answers only the app origin', async () => {
    const o = openai();
    expect((await handle(post(undefined, { Origin: 'https://evil.example' }), env(), o.fn)).status).toBe(403);
    const noOrigin = new Request('https://x.workers.dev/transcribe', { method: 'POST', body: new Uint8Array(10), headers: { 'Content-Type': 'audio/mp4' } });
    expect((await handle(noOrigin, env(), o.fn)).status).toBe(403);
    expect(o.calls).toHaveLength(0);
  });

  it('answers the CORS preflight', async () => {
    const r = await handle(new Request('https://x.workers.dev/transcribe', { method: 'OPTIONS', headers: { Origin: APP } }), env());
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('stops at the daily limit and starts again the next UTC day', async () => {
    const usage = kv();
    const o = openai();
    const day = new Date('2026-11-07T10:00:00Z');
    for (let i = 0; i < 3; i++) expect((await handle(post(), env(usage), o.fn, day)).status).toBe(200);
    const over = await handle(post(), env(usage), o.fn, day);
    expect(over.status).toBe(429);
    expect(o.calls).toHaveLength(3);
    expect((await handle(post(), env(usage), o.fn, new Date('2026-11-08T00:01:00Z'))).status).toBe(200);
  });

  it('rejects other audio types, empty and oversized bodies', async () => {
    const o = openai();
    expect((await handle(post(undefined, { 'Content-Type': 'text/plain' }), env(), o.fn)).status).toBe(415);
    expect((await handle(post(new Uint8Array(0)), env(), o.fn)).status).toBe(413);
    expect((await handle(post(new Uint8Array(MAX_BYTES + 1)), env(), o.fn)).status).toBe(413);
    expect((await handle(post(undefined, { 'Content-Type': 'audio/webm;codecs=opus' }), env(), o.fn)).status).toBe(200);
  });

  it('reports a recogniser failure as 502', async () => {
    expect((await handle(post(), env(), openai('', 500).fn)).status).toBe(502);
  });
});
