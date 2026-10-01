import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseChapter } from './chapter';
import { cellText, MAX_FILE_BYTES, normalizeKey, readWorkbook } from './readXlsx';

async function buildFile(withMeta = true): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  if (withMeta) {
    const meta = wb.addWorksheet('Méta');
    meta.addRow(['langue', 'nl-BE']);
    meta.addRow(['niveau', 'A1']);
    meta.addRow(['titre', 'Le vélo et la ville']);
    meta.addRow(['numero', 4]);
    meta.addRow(['auteur', 'JF']);
  }
  const l1 = wb.addWorksheet('Liste 4.1');
  l1.addRow(['fr', 'cible', 'article', 'synonymes_fr']);
  l1.addRow(['vélo', 'fiets', 'de', 'bicyclette']);
  l1.addRow([]);
  l1.addRow(['maison', 'huis', 'het']);
  const l2 = wb.addWorksheet('Liste 4.2');
  l2.addRow(['FR', 'Cible', 'Article']);
  l2.addRow(['rue', 'straat', 'de']);
  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}

describe('readWorkbook', () => {
  it('lit la feuille Méta et les listes avec les numéros de ligne Excel', async () => {
    const raw = await readWorkbook(await buildFile());
    expect(raw.hasMeta).toBe(true);
    expect(raw.meta).toMatchObject({ langue: 'nl-BE', niveau: 'A1', numero: '4', auteur: 'JF' });
    expect(raw.lists.map((l) => l.name)).toEqual(['Liste 4.1', 'Liste 4.2']);
    expect(raw.lists[0].header.slice(0, 3)).toEqual(['fr', 'cible', 'article']);
    expect(raw.lists[0].rows.map((r) => r.n)).toEqual([2, 4]);
    expect(raw.lists[0].rows[0].cells.slice(0, 4)).toEqual(['vélo', 'fiets', 'de', 'bicyclette']);
  });

  it('met les en-têtes en minuscules', async () => {
    const raw = await readWorkbook(await buildFile());
    expect(raw.lists[1].header.slice(0, 3)).toEqual(['fr', 'cible', 'article']);
  });

  it('signale l\'absence de feuille Méta', async () => {
    const raw = await readWorkbook(await buildFile(false));
    expect(raw.hasMeta).toBe(false);
  });

  it('produit un chapitre valide de bout en bout', async () => {
    const r = parseChapter(await readWorkbook(await buildFile()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.lists).toHaveLength(2);
    expect(r.chapter.lists[0].words.map((w) => w.cible)).toEqual(['fiets', 'huis']);
  });
});

const lit = (v: unknown) => v as unknown as ExcelJS.CellValue;

describe('cellText', () => {
  it('gère erreurs, liens à texte riche et formules numériques', () => {
    expect(cellText(lit({ formula: 'A1/0', result: { error: '#DIV/0!' } }))).toBe('');
    expect(cellText(lit({ text: { richText: [{ text: 'vé' }, { text: 'lo' }] }, hyperlink: 'http://x' }))).toBe('vélo');
    expect(cellText(lit({ formula: 'A1+1', result: 12 }))).toBe('12');
    expect(cellText(lit({ error: '#N/A' }))).toBe('');
    expect(cellText(null)).toBe('');
    expect(cellText('a')).toBe('a');
    expect(cellText(3)).toBe('3');
    expect(cellText(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('normalizeKey', () => {
  it('retire accents (NFC et NFD), casse et espaces', () => {
    expect(normalizeKey(' Numéro ')).toBe('numero');
    expect(normalizeKey('Méta')).toBe('meta');
  });
});

describe('readWorkbook, limites et robustesse', () => {
  it('rejette un fichier trop volumineux sans le parser', async () => {
    const big = new ArrayBuffer(MAX_FILE_BYTES + 1000000);
    await expect(readWorkbook(big)).rejects.toThrow('volumineux');
  });

  it('ignore les colonnes au-delà de 20 (cellule isolée en XFD)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('L');
    ws.addRow(['fr', 'cible']);
    for (let i = 0; i < 200; i++) ws.addRow([`m${i}`, `w${i}`]);
    ws.getCell('XFD1').value = 'x';
    const raw = await readWorkbook((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
    expect(raw.lists[0].rows.length).toBe(200);
    for (const r of raw.lists[0].rows) expect(r.cells.length).toBeLessThanOrEqual(20);
  });

  it('rejette une feuille de plus de 1000 lignes', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Longue');
    ws.addRow(['fr', 'cible']);
    for (let i = 0; i < 1001; i++) ws.addRow(['a', 'b']);
    await expect(readWorkbook((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer)).rejects.toThrow('plus de 1000 lignes');
  });

  it('ignore les feuilles masquées', async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet('L1');
    a.addRow(['fr', 'cible']);
    a.addRow(['a', 'b']);
    const h = wb.addWorksheet('Aide');
    h.addRow(['x']);
    h.state = 'hidden';
    const raw = await readWorkbook((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
    expect(raw.lists.map((l) => l.name)).toEqual(['L1']);
  });

  it('normalise la feuille Méta, ses clés et les en-têtes', async () => {
    const wb = new ExcelJS.Workbook();
    const m = wb.addWorksheet('Meta');
    m.addRow(['Numéro', 4]);
    const l = wb.addWorksheet('L');
    l.addRow(['FR', ' Cible ', 'Article', 'Synonymes_FR']);
    const raw = await readWorkbook((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
    expect(raw.hasMeta).toBe(true);
    expect(raw.meta.numero).toBe('4');
    expect(raw.lists[0].header.slice(0, 4)).toEqual(['fr', 'cible', 'article', 'synonymes_fr']);
  });

  it('reconnaît une feuille Méta nommée en NFD', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Méta').addRow(['langue', 'nl-BE']);
    wb.addWorksheet('L').addRow(['fr', 'cible']);
    const raw = await readWorkbook((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);
    expect(raw.hasMeta).toBe(true);
    expect(raw.lists.map((x) => x.name)).toEqual(['L']);
  });
});
