import { describe, expect, it } from 'vitest';
import { checkFileBeforeRead } from './readXlsxInWorker';

describe('checkFileBeforeRead', () => {
  it('accepte un .xlsx de taille raisonnable', () => {
    expect(checkFileBeforeRead({ name: 'chapitre4.xlsx', size: 50_000 })).toBeNull();
    expect(checkFileBeforeRead({ name: 'CHAPITRE4.XLSX', size: 50_000 })).toBeNull();
  });
  it('refuse les autres formats', () => {
    expect(checkFileBeforeRead({ name: 'chapitre4.xls', size: 1000 })).toContain('.xlsx');
    expect(checkFileBeforeRead({ name: 'chapitre4.csv', size: 1000 })).toContain('.xlsx');
  });
  it('refuse un fichier vide ou trop gros', () => {
    expect(checkFileBeforeRead({ name: 'a.xlsx', size: 0 })).toContain('vide');
    expect(checkFileBeforeRead({ name: 'a.xlsx', size: 2_000_001 })).toContain('volumineux');
  });
});
