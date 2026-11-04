/**
 * Naturalness check for every phrase, using real sources only:
 *   - korpuss.lv (NoSketch Engine, corpus LVK2022): the exact phrase, else every word pair of it
 *   - Tatoeba: the exact sentence written by people
 *   - back-translation to Russian by two independent engines: Google and Microsoft (Azure Translator)
 *   - checks for typical AI mistakes (negation with «nav» + genitive, …)
 *
 *   npm run content:check            # Tēzaurs build → this check → build again with statuses
 *   npx tsx scripts/content/check.ts lv --force   # re-check everything, ignoring the cache
 *
 * Results go to content/<lang>/auto-check.json, keyed by phrase id and tied to the exact text: a changed
 * phrase is checked again automatically. Manual decisions on «сомнительно» cases live in
 * content/<lang>/check-notes.json and are shown next to the evidence, never instead of it.
 *
 * Status rules (nothing is "ok" without evidence):
 *   ok        corpus or Tatoeba has the phrase or all its word pairs, both translators agree with our Russian,
 *             no AI-mistake flag, and no note overrides it
 *   doubtful  anything missing or disagreeing; the reasons are listed
 *   drop      only by a note in check-notes.json
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const lang = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'lv';
const force = process.argv.includes('--force');
// Google's free endpoint rate-limits: by default it is asked slowly, in a second pass, only for missing translations
const skipGoogle = process.argv.includes('--no-google');
const CORPUS = 'LVK2022';
const CORPUS_API = 'https://nosketch.korpuss.lv/bonito/run.cgi/view';
const PAIR_MIN = 3; // a word pair seen at least this often counts as an attested construction

interface Token { s: string; lemma: string; pos: string; feats: string }
interface Phrase { id: string; text: string; ru: string; tokens: Token[] }
type Status = 'ok' | 'doubtful' | 'drop';
interface Result {
  text: string;
  hash: string;
  status: Status;
  reasons: string[];
  corpus: { exact: number; exactUrl: string; pairs: { pair: string; hits: number; url: string }[]; example?: string };
  tatoeba: { id: number; text: string }[];
  mt: { google?: string; microsoft?: string; agree: { google?: boolean; microsoft?: boolean } };
  flags: string[];
  note?: { status: Status; reason: string; suggestion?: string };
  checkedAt: string;
}
interface Note { status: Status; reason: string; suggestion?: string }

const outPath = `content/${lang}/auto-check.json`;
const notesPath = `content/${lang}/check-notes.json`;
const { phrases } = JSON.parse(readFileSync(`public/data/${lang}/phrases.json`, 'utf8')) as { phrases: Phrase[] };
const prev: Record<string, Result> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};
const notes: Record<string, Note> = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, 'utf8')) : {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hashOf = (p: Phrase) => createHash('sha1').update(`${p.text}|${p.ru}`).digest('hex').slice(0, 12);
const words = (s: string) => s.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];

async function getJson(url: string, init?: RequestInit, tries = 5): Promise<any> {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw e;
      // rate limits (429) need a real pause, not a quick retry
      await sleep(/429/.test(String(e)) ? 20000 * i : 2000 * i);
    }
  }
}

/** A source that stays unreachable is recorded as missing evidence, never as a pass. */
async function orMissing<T>(f: () => Promise<T>): Promise<T | undefined> {
  try {
    return await f();
  } catch (e) {
    console.log(`    источник не ответил: ${String(e).slice(0, 120)}`);
    return undefined;
  }
}

/* ---------- korpuss.lv ---------- */

const cql = (ws: string[]) => ws.map((w) => `[lc="${w.toLowerCase().replace(/"/g, '')}"]`).join('');
const corpusUrl = (ws: string[]) =>
  `https://nosketch.korpuss.lv/#concordance?corpname=${CORPUS}&tab=advanced&queryselector=cql&cql=${encodeURIComponent(cql(ws))}`;

async function corpusHits(ws: string[]): Promise<{ hits: number; example?: string }> {
  const q = encodeURIComponent(`q${cql(ws)}`);
  const j = await getJson(`${CORPUS_API}?corpname=${CORPUS}&q=${q}&format=json&pagesize=1`);
  await sleep(300);
  const line = j.Lines?.[0];
  const example = line
    ? [line.Left, line.Kwic, line.Right].map((part: { str: string }[]) => part.map((x) => x.str).join(' ')).join(' ').replace(/\s+/g, ' ').trim()
    : undefined;
  return { hits: Number(j.concsize ?? 0), example };
}

/* ---------- Tatoeba ---------- */

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();

async function tatoeba(text: string): Promise<{ id: number; text: string }[]> {
  const j = await getJson(`https://tatoeba.org/en/api_v0/search?from=lav&query=${encodeURIComponent(words(text).join(' '))}`);
  await sleep(500);
  return (j.results ?? []).filter((r: any) => norm(r.text) === norm(text)).map((r: any) => ({ id: r.id, text: r.text }));
}

/* ---------- machine translation ---------- */

async function google(text: string): Promise<string> {
  const j = await getJson(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=ru&dt=t&q=${encodeURIComponent(text)}`);
  await sleep(4000);
  return (j[0] as [string][]).map((x) => x[0]).join('');
}

async function microsoftBatch(texts: string[]): Promise<string[] | null> {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key) return null;
  const out: string[] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const j = await getJson(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${lang}&to=ru`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': process.env.AZURE_TRANSLATOR_REGION ?? 'northeurope',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(texts.slice(i, i + 50).map((Text) => ({ Text }))),
    });
    out.push(...j.map((x: any) => x.translations[0].text));
  }
  return out;
}

/** Same meaning, roughly: share of word stems (first 5 letters) the two Russian sentences have in common. */
function agrees(a: string, b: string): boolean {
  const stems = (s: string) => new Set(norm(s).split(' ').filter(Boolean).map((w) => w.slice(0, 5)));
  const x = stems(a), y = stems(b);
  const common = [...x].filter((w) => y.has(w)).length;
  return common / Math.max(x.size, y.size, 1) >= 0.5;
}

/* ---------- typical AI mistakes ---------- */

function aiFlags(p: Phrase): string[] {
  const flags: string[] = [];
  p.tokens.forEach((t, i) => {
    const next = p.tokens[i + 1];
    // "nav" (būt + negation) takes the genitive: nav laika, nav problēmu
    if (t.lemma === 'būt' && t.feats.includes('NEG') && next?.pos === 'NOUN' && !next.feats.includes('GEN')) {
      flags.push(`отрицание: после «${t.s}» нужен родительный падеж, а «${next.s}» не в родительном`);
    }
  });
  return flags;
}

/* ---------- run ---------- */

const todo = phrases.filter((p) => force || prev[p.id]?.hash !== hashOf(p));
console.log(`фраз: ${phrases.length}, проверить: ${todo.length}${process.env.AZURE_TRANSLATOR_KEY ? '' : ' (нет AZURE_TRANSLATOR_KEY — второй переводчик пропущен)'}`);

const ms = todo.length ? await microsoftBatch(todo.map((p) => p.text)) : null;
const results: Record<string, Result> = {};
for (const p of phrases) if (!todo.includes(p) && prev[p.id]) results[p.id] = prev[p.id];

for (const [n, p] of todo.entries()) {
  const ws = words(p.text);
  const exact = (await orMissing(() => corpusHits(ws))) ?? { hits: 0 };
  const pairs: Result['corpus']['pairs'] = [];
  if (!exact.hits && ws.length > 1) {
    for (let i = 0; i + 1 < ws.length; i++) {
      const pair = [ws[i], ws[i + 1]];
      pairs.push({ pair: pair.join(' '), hits: (await orMissing(() => corpusHits(pair)))?.hits ?? 0, url: corpusUrl(pair) });
    }
  }
  const tatoe = (await orMissing(() => tatoeba(p.text))) ?? [];
  const m = ms?.[n];
  const r: Result = {
    text: p.text,
    hash: hashOf(p),
    status: 'doubtful',
    reasons: [],
    corpus: { exact: exact.hits, exactUrl: corpusUrl(ws), pairs, example: exact.example },
    tatoeba: tatoe,
    mt: { google: prev[p.id]?.text === p.text ? prev[p.id]?.mt.google : undefined, microsoft: m, agree: { microsoft: m === undefined ? undefined : agrees(m, p.ru) } },
    flags: aiFlags(p),
    checkedAt: new Date().toISOString(),
  };
  results[p.id] = r;
  // saved after every phrase: an interrupted run resumes where it stopped
  writeFileSync(outPath, JSON.stringify({ ...prev, ...results }, null, 1) + '\n');
  if ((n + 1) % 10 === 0 || n + 1 === todo.length) console.log(`  ${n + 1}/${todo.length}`);
}

// Fill translations that are missing in cached results (a key added later, or Google throttled last time).
const needMs = phrases.filter((p) => results[p.id] && results[p.id].mt.microsoft === undefined);
if (needMs.length && process.env.AZURE_TRANSLATOR_KEY) {
  const out = await microsoftBatch(needMs.map((p) => p.text));
  needMs.forEach((p, i) => {
    results[p.id].mt.microsoft = out?.[i];
    results[p.id].mt.agree.microsoft = out?.[i] === undefined ? undefined : agrees(out[i], p.ru);
  });
  console.log(`Microsoft: дополнено ${needMs.length}`);
}
const needGoogle = skipGoogle ? [] : phrases.filter((p) => results[p.id] && results[p.id].mt.google === undefined);
let googleDown = 0;
for (const [n, p] of needGoogle.entries()) {
  const g = googleDown >= 3 ? undefined : await orMissing(() => google(p.text));
  // three refusals in a row: stop asking this run, the rest stays "no Google" and is retried next run
  googleDown = g === undefined ? googleDown + 1 : 0;
  results[p.id].mt.google = g;
  results[p.id].mt.agree.google = g === undefined ? undefined : agrees(g, p.ru);
  if (g !== undefined) writeFileSync(outPath, JSON.stringify({ ...prev, ...results }, null, 1) + '\n');
  if ((n + 1) % 10 === 0) console.log(`  Google ${n + 1}/${needGoogle.length}`);
}
if (needGoogle.length) console.log(`Google: получено ${needGoogle.filter((p) => results[p.id].mt.google !== undefined).length} из ${needGoogle.length}`);

// Status from the evidence; a manual note may only decide what the evidence leaves open.
for (const p of phrases) {
  const r = results[p.id];
  if (!r) continue;
  const reasons: string[] = [];
  const attested = r.corpus.exact > 0 || r.tatoeba.length > 0 || (r.corpus.pairs.length > 0 && r.corpus.pairs.every((x) => x.hits >= PAIR_MIN));
  if (!attested) {
    const weak = r.corpus.pairs.filter((x) => x.hits < PAIR_MIN).map((x) => `«${x.pair}» (${x.hits})`);
    reasons.push(weak.length ? `в корпусе не нашлось фразы, редкие сочетания: ${weak.join(', ')}` : 'в корпусе и Tatoeba фраза не найдена');
  }
  if (r.mt.google === undefined) reasons.push('Google не ответил — нет перевода для сверки');
  if (r.mt.agree.google === false) reasons.push(`Google переводит иначе: «${r.mt.google}»`);
  if (r.mt.microsoft === undefined) reasons.push('нет второго переводчика (Microsoft)');
  else if (r.mt.agree.microsoft === false) reasons.push(`Microsoft переводит иначе: «${r.mt.microsoft}»`);
  reasons.push(...r.flags);
  r.reasons = reasons;
  r.status = reasons.length ? 'doubtful' : 'ok';
  r.note = notes[p.id];
  if (r.note?.status === 'drop' || r.note?.status === 'doubtful') r.status = r.note.status;
  // A note can clear a translation mismatch the stem metric got wrong (a synonym), never missing evidence.
  else if (r.note?.status === 'ok') {
    const onlyWording = attested && r.mt.microsoft !== undefined && !r.flags.length;
    r.status = onlyWording ? 'ok' : 'doubtful';
    if (!onlyWording) r.reasons.push('пометка «ок» не принята: нет источника или второго переводчика');
  }
}

writeFileSync(outPath, JSON.stringify(results, null, 1) + '\n');
const count = (s: Status) => Object.values(results).filter((r) => r.status === s).length;
console.log(`итог: ок ${count('ok')}, сомнительно ${count('doubtful')}, убрать ${count('drop')} → ${outPath}`);
