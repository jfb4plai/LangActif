import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseChapter } from './chapter';
import { readWorkbook } from './readXlsx';

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
