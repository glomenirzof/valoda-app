/**
 * Ad-hoc corpus lookups for reviewing doubtful phrases: how often natives use a wording, with one example.
 *   npx tsx scripts/content/corpus-query.ts "ir mājās" "to ņemšu" …
 */
export {};

const CORPUS = 'LVK2022';
const cql = (ws: string[]) => ws.map((w) => `[lc="${w.toLowerCase()}"]`).join('');

for (const phrase of process.argv.slice(2)) {
  const ws = phrase.match(/\p{L}+|,/gu) ?? [];
  const url = `https://nosketch.korpuss.lv/bonito/run.cgi/view?corpname=${CORPUS}&q=${encodeURIComponent('q' + cql(ws))}&format=json&pagesize=1`;
  const j = await (await fetch(url)).json();
  const l = j.Lines?.[0];
  const ex = l ? [l.Left, l.Kwic, l.Right].map((p: { str: string }[]) => p.map((x) => x.str).join(' ')).join(' ').replace(/\s+/g, ' ').trim() : '';
  console.log(`${phrase} → ${j.concsize ?? 0}${ex ? `  «…${ex.slice(0, 140)}…»` : ''}`);
  await new Promise((r) => setTimeout(r, 300));
}
