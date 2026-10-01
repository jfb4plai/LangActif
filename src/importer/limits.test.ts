import { describe, expect, it } from 'vitest';
import { MAX_COLS, MAX_FILE_BYTES, MAX_ROWS, MAX_SHEETS } from './limits';
import * as readXlsx from './readXlsx';

describe('limits', () => {
  it('fixe les limites de l\'import', () => {
    expect(MAX_FILE_BYTES).toBe(2_000_000);
    expect(MAX_SHEETS).toBe(40);
    expect(MAX_ROWS).toBe(1000);
    expect(MAX_COLS).toBe(20);
  });

  it('reste réexporté par readXlsx (compatibilité des tests existants)', () => {
    expect(readXlsx.MAX_FILE_BYTES).toBe(MAX_FILE_BYTES);
    expect(readXlsx.MAX_ROWS).toBe(MAX_ROWS);
  });
});
