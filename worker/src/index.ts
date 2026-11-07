/**
 * Valoda voice check: a small Cloudflare Worker between the app and OpenAI speech recognition.
 *
 *   POST /transcribe   body: the recorded audio (audio/mp4 from Safari, audio/webm from Chrome)
 *                      → { text, left }   text = what was heard, left = requests left today
 *
 * - The OpenAI key lives only here, as a Worker secret (OPENAI_API_KEY); the app never sees it.
 * - Only the app's own origin may call it (ALLOWED_ORIGINS). A browser cannot fake Origin; a script outside a
 *   browser can, so the daily limit (DAILY_LIMIT, counted in KV) is what caps the spend in the worst case.
 * - Honest check: the recogniser gets only the audio and the language. The expected phrase is never sent
 *   (no `prompt`), so it cannot nudge the transcript towards the right answer.
 */

/** The bits of Workers KV this Worker uses. */
export interface Counter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  OPENAI_API_KEY: string;
  /** comma-separated origins, e.g. "https://glomenirzof.github.io" */
  ALLOWED_ORIGINS: string;
  /** requests per UTC day */
  DAILY_LIMIT: string;
  USAGE: Counter;
}

export const MODEL = 'gpt-4o-mini-transcribe';
export const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';
/** one spoken phrase is a few seconds: ~50–150 KB; anything far larger is not a phrase */
export const MAX_BYTES = 1_000_000;

const EXT: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export async function handle(req: Request, env: Env, upstream: typeof fetch = fetch, now = new Date()): Promise<Response> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return json({ error: 'forbidden' }, 403);
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST' || new URL(req.url).pathname !== '/transcribe') return json({ error: 'not found' }, 404, cors);

  const type = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return json({ error: 'unsupported audio type' }, 415, cors);
  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_BYTES) return json({ error: 'bad size' }, 413, cors);

  const limit = Number(env.DAILY_LIMIT) || 0;
  const key = `count:${now.toISOString().slice(0, 10)}`;
  const used = Number((await env.USAGE.get(key)) ?? 0);
  if (used >= limit) return json({ error: 'daily limit', left: 0 }, 429, cors);
  await env.USAGE.put(key, String(used + 1), { expirationTtl: 3 * 86400 });

  const form = new FormData();
  form.append('file', new Blob([audio], { type }), `speech.${ext}`);
  form.append('model', MODEL);
  form.append('language', 'lv');
  form.append('response_format', 'json');
  // no `prompt`: the expected phrase is never sent

  let r: Response;
  try {
    r = await upstream(OPENAI_URL, { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form });
  } catch {
    return json({ error: 'upstream unreachable' }, 502, cors);
  }
  if (!r.ok) return json({ error: 'upstream', status: r.status }, 502, cors);
  const out = (await r.json()) as { text?: string };
  return json({ text: out.text ?? '', left: limit - used - 1 }, 200, cors);
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
