import { describe, expect, it } from 'vitest';
import { MODE_CAP } from './modes';

describe('MODE_CAP', () => {
  it('plafonne la reconnaissance à la boîte 3', () => {
    for (const m of ['flashcards', 'qcm', 'association', 'arcade_tir', 'roue_sans_leurres'] as const) {
      expect(MODE_CAP[m]).toBe(3);
    }
  });
  it('plafonne la roue avec leurres à la boîte 4', () => {
    expect(MODE_CAP.roue_avec_leurres).toBe(4);
  });
  it('laisse la production monter à la boîte 5', () => {
    expect(MODE_CAP.taper).toBe(5);
    expect(MODE_CAP.arcade_defense).toBe(5);
  });
});
