/**
 * Order of new phrases by the i+1 rule (research §2.5): every phrase brings at most one lemma the learner
 * has not met yet. Runs after build_phrases.py (it rewrites phrases.json) as part of npm run content:build
 * and npm run content:check.
 *
 *   npx tsx scripts/content/order.ts lv
 *
 * Only phrases that may be trained (status «ок» from content:check, or checked by the tutor) get an `order`;
 * the app takes new phrases in that order. The order is greedy (scripts/content/order-core.ts): the most
 * frequent phrase with ≤ 1 new lemma; the first 15 are survival phrases of 1–2 words. When no such phrase is
 * left, the shortest one with the fewest new lemmas is taken and listed in content/<lang>/order-report.txt.
 * With --check (the last step of npm run content:check) any phrase that brings more than one new lemma in
 * the final order fails the run (exit code 1): add a phrase that introduces one of its words first (a bridge),
 * then run npm run content:check again. npm run content:build only writes the order and the report.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { orderPhrases, SURVIVAL, violations, type OrderPhrase } from './order-core';

const lang = process.argv[2] ?? 'lv';
const file = `public/data/${lang}/phrases.json`;

interface Phrase extends OrderPhrase { status: string; auto: string; order?: number }

const data = JSON.parse(readFileSync(file, 'utf8')) as { phrases: Phrase[] };
const trainable = (p: Phrase) => p.status === 'tutor' || p.auto === 'ok';

const placed = orderPhrases(data.phrases.filter(trainable));
const rank = new Map(placed.map((x, i) => [x.p.id, i + 1]));
for (const p of data.phrases) {
  const n = rank.get(p.id);
  if (n) p.order = n;
  else delete p.order;
}
writeFileSync(file, JSON.stringify(data, null, 1), 'utf8');

const bad = violations(placed.map((x) => x.p));
const report = [
  `Порядок новых фраз (i+1): ${placed.length} фраз к обучению; нарушений: ${bad.length}`,
  `Первые ${SURVIVAL} — фразы из 1–2 слов; дальше самая частотная фраза с ≤1 новой леммой.`,
  '',
  'НАРУШЕНИЯ (нет фразы с ≤1 новой леммой — взята самая короткая; нужна фраза-мостик с одним из этих слов):',
  ...bad.map((x) => `  №${rank.get(x.p.id)} ${x.p.id} «${x.p.text}» — новые: ${x.fresh.join(', ')}`),
  '',
  'ПОРЯДОК:',
  ...placed.map((x, i) => `${String(i + 1).padStart(4)} ${x.forced ? '!' : ' '} ${x.p.id} «${x.p.text}»${x.fresh.length ? ` + ${x.fresh.join(', ')}` : ''}`),
];
writeFileSync(`content/${lang}/order-report.txt`, report.join('\n'), 'utf8');
console.log(report.slice(0, 4 + bad.length).join('\n'));
process.exit(bad.length && process.argv.includes('--check') ? 1 : 0);
