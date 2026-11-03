/**
 * Read the tutor's filled-in sheet back into content/<lang>/review.json.
 *   npm run content:import -- review/lv-proverka-2026-11-03.xlsx [lang]
 * Then rebuild: `npm run content:build`. «Верно» → status tutor (enters training);
 * «Исправить» → corrected text is kept but stays unverified until lemmas are updated
 * in phrases.src.json and the dictionary check passes again; «Убрать» → dropped.
 */
import ExcelJS from 'exceljs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [file, lang = 'lv'] = process.argv.slice(2);
if (!file) throw new Error('Укажи путь к таблице: npm run content:import -- review/<файл>.xlsx');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.getWorksheet('Проверка');
if (!ws) throw new Error('В файле нет листа «Проверка»');

const col: Record<string, number> = {};
ws.getRow(1).eachCell((c, i) => (col[String(c.value)] = i));
const text = (row: ExcelJS.Row, name: string) => String(row.getCell(col[name]).value ?? '').trim();

const path = `content/${lang}/review.json`;
const review: Record<string, any> = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
const counts = { ok: 0, fix: 0, drop: 0, empty: 0 };

ws.eachRow((row, n) => {
  if (n === 1) return;
  const id = text(row, 'ID');
  const decision = text(row, 'Решение').toLowerCase();
  if (!id) return;
  const status = decision.startsWith('верно') ? 'ok' : decision.startsWith('испр') ? 'fix' : decision.startsWith('убр') ? 'drop' : null;
  if (!status) return void counts.empty++;
  counts[status as 'ok' | 'fix' | 'drop']++;
  review[id] = {
    status,
    ...(text(row, 'Исправленный латышский') && { lv: text(row, 'Исправленный латышский') }),
    ...(text(row, 'Исправленный русский') && { ru: text(row, 'Исправленный русский') }),
    ...(text(row, 'Комментарий') && { comment: text(row, 'Комментарий') }),
    at: new Date().toISOString().slice(0, 10),
  };
});

writeFileSync(path, JSON.stringify(review, null, 2) + '\n');
console.log(`Верно: ${counts.ok}, Исправить: ${counts.fix}, Убрать: ${counts.drop}, без решения: ${counts.empty} → ${path}`);
