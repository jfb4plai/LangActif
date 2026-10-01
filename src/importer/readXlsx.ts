import ExcelJS from 'exceljs';
import type { RawRow, RawSheet, RawWorkbook } from './chapter';
import { MAX_COLS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS } from './limits';

export { MAX_COLS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS };

/** Clé comparable : sans accents, minuscules, sans espaces autour. */
export function normalizeKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Valeur de cellule en texte : nombres, texte riche, formules et liens inclus (récursif). */
export function cellText(value: ExcelJS.CellValue | unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text?: string }>).map((r) => r.text ?? '').join('');
    if (o.error !== undefined) return '';
    if (o.text !== undefined) return cellText(o.text);
    if (o.result !== undefined) return cellText(o.result);
    return '';
  }
  return String(value);
}

/** Lit un .xlsx vers une structure neutre ; la validation est faite par `parseChapter`. */
export async function readWorkbook(data: ArrayBuffer): Promise<RawWorkbook> {
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('Fichier trop volumineux (maximum 2 Mo)');
  const wb = new ExcelJS.Workbook();
  // les types d'exceljs déclarent un `Buffer` maison ; au runtime Buffer et ArrayBuffer fonctionnent
  await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);
  if (wb.worksheets.length > MAX_SHEETS) throw new Error('Trop de feuilles (maximum 40)');

  const visible = wb.worksheets.filter((ws) => ws.state === 'visible');
  const metaSheet = visible.find((ws) => normalizeKey(ws.name) === 'meta');
  const meta: Record<string, string> = {};
  metaSheet?.eachRow((row) => {
    const key = normalizeKey(cellText(row.getCell(1).value));
    if (key) meta[key] = cellText(row.getCell(2).value).trim();
  });

  const lists: RawSheet[] = [];
  for (const ws of visible) {
    if (ws === metaSheet) continue;
    if (ws.rowCount > MAX_ROWS + 1) throw new Error(`Feuille « ${ws.name} » : plus de 1000 lignes`);
    const width = Math.min(ws.columnCount, MAX_COLS);
    let header: string[] = [];
    const rows: RawRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells: string[] = [];
      for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value).trim());
      if (n === 1) header = cells.map(normalizeKey);
      else rows.push({ n, cells });
    });
    lists.push({ name: ws.name, header, rows });
  }

  return { hasMeta: metaSheet !== undefined, meta, lists };
}
