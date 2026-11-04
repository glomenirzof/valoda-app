/** Quick health check of every source content:check uses; prints HTTP status only (never keys). */
import 'dotenv/config';

const t0 = Date.now();
const show = async (name: string, f: () => Promise<Response>) => {
  const s = Date.now();
  try {
    const r = await f();
    console.log(`${name}: ${r.status} (${Date.now() - s} ms)`);
  } catch (e) {
    console.log(`${name}: ${String(e).slice(0, 100)}`);
  }
};
const q = encodeURIComponent('q[lc="es"][lc="dzīvoju"][lc="rīgā"]');
await show('korpuss.lv', () => fetch(`https://nosketch.korpuss.lv/bonito/run.cgi/view?corpname=LVK2022&q=${q}&format=json&pagesize=1`));
await show('tatoeba', () => fetch('https://tatoeba.org/en/api_v0/search?from=lav&query=dz%C4%ABvoju'));
await show('google', () => fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=lv&tl=ru&dt=t&q=Labdien'));
const key = process.env.AZURE_TRANSLATOR_KEY;
console.log(`microsoft key: ${key ? 'есть' : 'нет'}, region: ${process.env.AZURE_TRANSLATOR_REGION ?? '(не задан)'}`);
if (key) {
  await show('microsoft', () =>
    fetch('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=lv&to=ru', {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Ocp-Apim-Subscription-Region': process.env.AZURE_TRANSLATOR_REGION ?? 'northeurope', 'Content-Type': 'application/json' },
      body: JSON.stringify([{ Text: 'Es dzīvoju Rīgā.' }]),
    }),
  );
}
console.log(`всего ${Date.now() - t0} ms`);
