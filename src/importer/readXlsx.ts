import ExcelJS from 'exceljs';
import type { RawRow, RawSheet, RawWorkbook } from './chapter';

/** Valeur de cellule en texte : nombres, texte riche, formules et liens inclus. */
function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const o = value as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((r) => r.text).join('');
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return '';
  }
  return String(value);
}

/** Lit un .xlsx vers une structure neutre ; la validation est faite par `parseChapter`. */
export async function readWorkbook(data: ArrayBuffer): Promise<RawWorkbook> {
  const wb = new ExcelJS.Workbook();
  // les types d'exceljs déclarent un `Buffer` maison ; au runtime Buffer et ArrayBuffer fonctionnent
  await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const meta: Record<string, string> = {};
  const metaSheet = wb.getWorksheet('Méta');
  metaSheet?.eachRow((row) => {
    const key = text(row.getCell(1).value).trim().toLowerCase();
    if (key) meta[key] = text(row.getCell(2).value).trim();
  });

  const lists: RawSheet[] = [];
  wb.eachSheet((ws) => {
    if (ws.name === 'Méta') return;
    let header: string[] = [];
    const rows: RawRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(text(row.getCell(c).value).trim());
      if (n === 1) header = cells.map((h) => h.toLowerCase());
      else rows.push({ n, cells });
    });
    lists.push({ name: ws.name, header, rows });
  });

  return { hasMeta: metaSheet !== undefined, meta, lists };
}
