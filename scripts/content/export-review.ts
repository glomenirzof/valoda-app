/**
 * Export unverified phrases to an .xlsx sheet for the tutor.
 *   npm run content:export            → review/lv-proverka-YYYY-MM-DD.xlsx
 * The tutor fills «Решение» (Верно / Исправить / Убрать) and, if needed,
 * corrected Latvian / Russian. Read back with `npm run content:import -- <file>`.
 */
import ExcelJS from 'exceljs';
import { mkdirSync, readFileSync } from 'node:fs';
import { featsShort } from '../../src/core/grammar-ru';

interface Token { s: string; lemma: string; feats: string; ru: string }
interface Phrase { id: string; topic: string; text: string; ru: string; tokens: Token[]; status: string }

const lang = process.argv[2] ?? 'lv';
const { phrases } = JSON.parse(readFileSync(`public/data/${lang}/phrases.json`, 'utf8')) as { phrases: Phrase[] };
const todo = phrases.filter((p) => p.status !== 'tutor').sort((a, b) => a.id.localeCompare(b.id));

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Проверка', { views: [{ state: 'frozen', ySplit: 1 }] });
ws.columns = [
  { header: '№', key: 'n', width: 5 },
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Тема', key: 'topic', width: 10 },
  { header: 'Латышский', key: 'lv', width: 38 },
  { header: 'Русский', key: 'ru', width: 34 },
  { header: 'Разбор слов (форма — лемма — грамматика)', key: 'parse', width: 52 },
  { header: 'Решение', key: 'decision', width: 13 },
  { header: 'Исправленный латышский', key: 'lv_fix', width: 34 },
  { header: 'Исправленный русский', key: 'ru_fix', width: 30 },
  { header: 'Комментарий', key: 'comment', width: 30 },
];

todo.forEach((p, i) => {
  const parse = p.tokens
    .map((t) => `${t.s} — ${t.lemma}${t.feats ? ` (${featsShort(t.feats)})` : ''}: ${t.ru}`)
    .join('\n');
  const row = ws.addRow({ n: i + 1, id: p.id, topic: p.topic, lv: p.text, ru: p.ru, parse });
  row.alignment = { vertical: 'top', wrapText: true };
  row.getCell('decision').dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: ['"Верно,Исправить,Убрать"'],
  };
  for (const key of ['decision', 'lv_fix', 'ru_fix', 'comment']) {
    row.getCell(key).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7D6' } };
  }
});

const header = ws.getRow(1);
header.font = { bold: true };
header.alignment = { vertical: 'middle', wrapText: true };
ws.getCell('D1').note = 'Фразы написаны ИИ и проверены по словарю Tēzaurs (формы слов существуют), но не носителем.';

const help = wb.addWorksheet('Как заполнять');
help.getColumn(1).width = 100;
[
  'Пожалуйста, проверьте каждую фразу: правильна ли она и звучит ли естественно.',
  '«Решение»: Верно — фраза правильная; Исправить — впишите правильный вариант в жёлтые колонки; Убрать — фраза не нужна.',
  'Колонка «Разбор» показывает форму каждого слова (падеж, число, время) — её тоже стоит проверить.',
  'Комментарий — по желанию (например, «так говорят только в разговорной речи»).',
].forEach((t) => help.addRow([t]).alignment = { wrapText: true });

mkdirSync('review', { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const file = `review/${lang}-proverka-${date}.xlsx`;
await wb.xlsx.writeFile(file);
console.log(`${todo.length} непроверенных фраз → ${file}`);
