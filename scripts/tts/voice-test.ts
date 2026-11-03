/**
 * Blind voice comparison: synthesizes the test phrases with every available
 * provider and builds public/voice-test/ (static page + anonymised mp3 files).
 *
 *   npm run tts:voicetest              # all providers that have keys
 *   npm run tts:voicetest -- --only=piper,azure
 *
 * Synth results are cached in tts-out/voice-test/, so re-running after adding
 * keys to .env only calls the new providers (and only those are billed).
 */
import 'dotenv/config';
import { randomBytes, randomInt } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { providers, type ProviderId, type Quality, type VoiceSpec } from './providers';

interface TestPhrase { id: string; text: string; ru: string; focus: string }
interface CacheEntry { file: string; textChars: number; payloadChars: number }

/**
 * Variants per provider. Round 1 compared speeds; round 2 compares audio quality
 * (the app slows playback itself, so slow files are no longer generated).
 * Piper was rejected in round 1 and runs only with --only=piper.
 */
const VARIANTS: Record<ProviderId, { rate: number; quality: Quality }[]> = {
  // round 3: Azure HQ only, as the reference against Google Chirp 3 HD
  azure: [{ rate: 1, quality: 'hq' }],
  google: [{ rate: 1, quality: 'hq' }],
  piper: [{ rate: 1, quality: 'std' }],
};
const DEFAULT_PROVIDERS: ProviderId[] = ['azure', 'google'];
const QUALITY_LABEL: Record<Quality, string> = { std: '24 кГц / 48 кбит/с', hq: '48 кГц / 192 кбит/с' };

/** USD per 1M characters, for the estimate only — confirm on the vendor pricing pages. */
const PRICE_PER_M: Record<ProviderId, { usd: number; note: string }> = {
  azure: { usd: 15, note: 'Neural, по сторонним агрегаторам; бесплатно 0.5 млн симв./мес (F0)' },
  google: { usd: 30, note: 'Chirp 3: HD, по таблице цен Google; бесплатный лимит не подтверждён' },
  piper: { usd: 0, note: 'локально' },
};

const CACHE_DIR = 'tts-out/voice-test';
const CACHE_INDEX = join(CACHE_DIR, 'index.json');
const OUT_DIR = 'public/voice-test';

const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',') ?? DEFAULT_PROVIDERS) as ProviderId[];
const phrases: TestPhrase[] = JSON.parse(readFileSync('content/lv/voice-test.json', 'utf8'));

mkdirSync(CACHE_DIR, { recursive: true });
const cache: Record<string, CacheEntry> = existsSync(CACHE_INDEX) ? JSON.parse(readFileSync(CACHE_INDEX, 'utf8')) : {};
// std keeps the round-1 key format so already generated files are reused
const cacheKey = (v: VoiceSpec, p: TestPhrase) =>
  `${v.provider}|${v.voice}|${v.rate}${v.quality === 'std' ? '' : `|${v.quality}`}|${p.text}`;

// 1. Collect voices from providers that can run
const specs: VoiceSpec[] = [];
for (const p of Object.values(providers)) {
  if (!only.includes(p.id)) continue;
  const why = p.unavailable();
  if (why) {
    console.log(`– ${p.id}: пропущен (${why})`);
    continue;
  }
  try {
    for (const v of await p.latvianVoices()) {
      for (const { rate, quality } of VARIANTS[p.id]) {
        const speed = rate === 1 ? '' : `, медленно ×${rate}`;
        specs.push({ provider: p.id, voice: v.voice, rate, quality, label: `${v.label}${speed}, ${QUALITY_LABEL[quality]}` });
      }
    }
  } catch (e) {
    console.log(`– ${p.id}: ошибка списка голосов — ${(e as Error).message}`);
  }
}

// 2. Synthesize what is not cached yet
const spentNow: Record<string, number> = {};
for (const v of specs) {
  for (const ph of phrases) {
    const key = cacheKey(v, ph);
    if (cache[key] && existsSync(join(CACHE_DIR, cache[key].file))) continue;
    const r = await providers[v.provider].synthesize(ph.text, v.voice, v.rate, v.quality);
    const file = `${v.provider}-${randomBytes(4).toString('hex')}.mp3`;
    writeFileSync(join(CACHE_DIR, file), r.mp3);
    cache[key] = { file, textChars: r.textChars, payloadChars: r.payloadChars };
    spentNow[v.provider] = (spentNow[v.provider] ?? 0) + r.textChars;
    process.stdout.write('.');
  }
}
writeFileSync(CACHE_INDEX, JSON.stringify(cache, null, 2));
console.log('');

// 3. Build the blind page: neutral file names, letters shuffled per phrase
rmSync(join(OUT_DIR, 'a'), { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'a'), { recursive: true });
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const page = phrases.map((ph) => {
  const variants = specs
    .filter((v) => cache[cacheKey(v, ph)])
    .map((v) => ({ v, sort: randomInt(1e9) }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ v }, i) => {
      const name = `${randomBytes(6).toString('hex')}.mp3`;
      copyFileSync(join(CACHE_DIR, cache[cacheKey(v, ph)].file), join(OUT_DIR, 'a', name));
      return { letter: letters[i], src: `a/${name}`, label: v.label };
    });
  return { id: ph.id, text: ph.text, ru: ph.ru, focus: ph.focus, variants };
});
writeFileSync(join(OUT_DIR, 'data.json'), JSON.stringify({ built: new Date().toISOString(), phrases: page }, null, 1));

// 4. Usage report: characters per voice/provider and estimate for 150 phrases × 2 voices
const totals: Record<string, { text: number; payload: number }> = {};
for (const [key, e] of Object.entries(cache)) {
  const prov = key.split('|')[0];
  totals[prov] ??= { text: 0, payload: 0 };
  totals[prov].text += e.textChars;
  totals[prov].payload += e.payloadChars;
}
const avgLen = phrases.reduce((s, p) => s + [...p.text].length, 0) / phrases.length;
const est = Math.round(150 * avgLen * 2);

console.log(`\nВариантов на странице: ${page[0]?.variants.length ?? 0} на фразу, фраз: ${page.length}`);
console.log('\nСимволы, отправленные в сервисы (весь тест, включая прошлые запуски):');
for (const [prov, t] of Object.entries(totals)) {
  const extra = prov === 'azure' ? `, с SSML-разметкой ${t.payload}` : '';
  console.log(`  ${prov}: ${t.text} симв. текста${extra}${spentNow[prov] ? ` (в этом запуске: ${spentNow[prov]})` : ''}`);
}
console.log(`\nОценка для 150 фраз × 2 голоса (средняя длина ${avgLen.toFixed(1)} симв.) ≈ ${est} символов:`);
for (const [prov, p] of Object.entries(PRICE_PER_M)) {
  console.log(`  ${prov}: ≈ $${((est / 1e6) * p.usd).toFixed(3)}  (${p.usd ? `$${p.usd}/1 млн` : 'бесплатно'}; ${p.note})`);
}
console.log(`\nСтраница: ${OUT_DIR}/index.html`);
