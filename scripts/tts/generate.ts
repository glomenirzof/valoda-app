/**
 * Voices every phrase and every word (form as written + dictionary form) with the
 * chosen voice and writes public/audio/<lang>/<hash>.mp3 plus public/data/<lang>/audio.json.
 *
 *   npm run tts:generate            # lv, Azure Everita, 48 kHz / 192 kbit/s
 *   npm run tts:generate -- --dry   # only count what would be synthesized
 *
 * File names are a hash of voice + quality + text, so unchanged texts are never
 * re-synthesized (and never billed again); files no longer used are removed.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { providers, type ProviderId, type Quality } from './providers';

const LANG = 'lv';
const VOICE: { provider: ProviderId; voice: string; quality: Quality } = { provider: 'azure', voice: 'lv-LV-EveritaNeural', quality: 'hq' };
// Azure F0 allows about 20 requests per minute; stay just under it.
const PAUSE_MS = 3200;

const dry = process.argv.includes('--dry');
const outDir = `public/audio/${LANG}`;
const indexPath = `public/data/${LANG}/audio.json`;

interface Token { s: string; lemma: string }
interface Phrase { id: string; text: string; tokens: Token[]; status: string; auto?: string }
// Only phrases that may be trained are voiced: checked by the tutor or passed by npm run content:check.
const phrases = (JSON.parse(readFileSync(`public/data/${LANG}/phrases.json`, 'utf8')) as { phrases: Phrase[] }).phrases
  .filter((p) => p.status === 'tutor' || p.auto === 'ok');

// Proper nouns keep their capital (Rīga, Rīgā); other words are voiced in lower case.
const wordKey = (form: string, lemma: string) => (/^\p{Lu}/u.test(lemma) ? form : form.toLowerCase());

const words = new Set<string>();
for (const p of phrases) for (const t of p.tokens) words.add(wordKey(t.s, t.lemma)).add(t.lemma);

const fileFor = (text: string) =>
  `${createHash('sha1').update(`${VOICE.provider}|${VOICE.voice}|${VOICE.quality}|${text}`).digest('hex').slice(0, 16)}.mp3`;

const items = [...phrases.map((p) => p.text), ...words];
const todo = [...new Set(items)].filter((t) => !existsSync(join(outDir, fileFor(t))));
const chars = todo.reduce((n, t) => n + [...t].length, 0);
console.log(`фраз: ${phrases.length}, слов: ${words.size}, уже есть: ${new Set(items).size - todo.length}, озвучить: ${todo.length} (${chars} симв.)`);
if (dry) process.exit(0);

const provider = providers[VOICE.provider];
const why = provider.unavailable();
if (why && todo.length) throw new Error(`${VOICE.provider}: ${why}`);

mkdirSync(outDir, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let billed = 0;
for (const [n, text] of todo.entries()) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await provider.synthesize(text, VOICE.voice, 1, VOICE.quality);
      writeFileSync(join(outDir, fileFor(text)), r.mp3);
      billed += r.textChars;
      break;
    } catch (e) {
      // 429 = rate limit on the free tier: wait and retry
      if (attempt < 6 && /\b429\b/.test(String(e))) {
        await sleep(15000 * attempt);
        continue;
      }
      throw e;
    }
  }
  if ((n + 1) % 25 === 0 || n + 1 === todo.length) console.log(`  ${n + 1}/${todo.length}`);
  await sleep(PAUSE_MS);
}

const index = {
  voice: `${VOICE.provider} ${VOICE.voice} ${VOICE.quality}`,
  phrases: Object.fromEntries(phrases.map((p) => [p.id, fileFor(p.text)])),
  words: Object.fromEntries([...words].sort().map((w) => [w, fileFor(w)])),
};
writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n');

const used = new Set([...Object.values(index.phrases), ...Object.values(index.words)]);
const stale = readdirSync(outDir).filter((f) => f.endsWith('.mp3') && !used.has(f));
for (const f of stale) rmSync(join(outDir, f));
console.log(`готово: ${indexPath}; новых символов: ${billed}; удалено старых файлов: ${stale.length}`);
