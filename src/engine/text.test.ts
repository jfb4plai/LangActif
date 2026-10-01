import { describe, expect, it } from 'vitest';
import { clean, damerau, foldKey, maxTypos, stripAccents } from './text';

describe('clean', () => {
  it('supprime les espaces en trop', () => {
    expect(clean('  de   fiets ')).toBe('de fiets');
  });
});

describe('stripAccents', () => {
  it('retire les accents', () => {
    expect(stripAccents('vélo')).toBe('velo');
    expect(stripAccents('Ëïç')).toBe('Eic');
  });
});

describe('foldKey', () => {
  it('ignore casse, accents et espaces', () => {
    expect(foldKey('  Vélo ')).toBe('velo');
  });
});

describe('damerau', () => {
  it('compte une transposition pour 1', () => {
    expect(damerau('fiets', 'fiest')).toBe(1);
  });
  it('compte une substitution pour 1', () => {
    expect(damerau('huis', 'huys')).toBe(1);
  });
  it('gère les chaînes vides', () => {
    expect(damerau('abc', '')).toBe(3);
    expect(damerau('', 'abc')).toBe(3);
  });
  it('retrouve la distance classique', () => {
    expect(damerau('kitten', 'sitting')).toBe(3);
  });
  it('vaut 0 pour deux chaînes identiques', () => {
    expect(damerau('straat', 'straat')).toBe(0);
  });
});

describe('maxTypos', () => {
  it('tolère 0, 1 ou 2 fautes selon la longueur', () => {
    expect(maxTypos(3)).toBe(0);
    expect(maxTypos(4)).toBe(1);
    expect(maxTypos(8)).toBe(1);
    expect(maxTypos(9)).toBe(2);
  });
});
