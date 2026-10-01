import { describe, expect, it } from 'vitest';
import { formatIssue } from './formatIssue';
import { langueLabel } from './labels';

describe('formatIssue', () => {
  it('indique feuille, ligne et colonne', () => {
    expect(formatIssue({ sheet: 'Liste 4.1', row: 3, column: 'article', message: 'Article absent ou invalide' }))
      .toBe('Feuille « Liste 4.1 », ligne 3, colonne « article » : Article absent ou invalide');
  });
  it('omet la ligne et la colonne quand elles sont inconnues', () => {
    expect(formatIssue({ sheet: 'Méta', row: null, column: null, message: 'Aucune feuille de liste dans le classeur' }))
      .toBe('Feuille « Méta » : Aucune feuille de liste dans le classeur');
  });
  it('omet seulement la colonne si elle manque', () => {
    expect(formatIssue({ sheet: 'L', row: 5, column: null, message: 'x' })).toBe('Feuille « L », ligne 5 : x');
  });
});

describe('langueLabel', () => {
  it('donne un libellé lisible', () => {
    expect(langueLabel('nl-BE')).toBe('Néerlandais (Belgique)');
    expect(langueLabel('en-GB')).toBe('Anglais (Royaume-Uni)');
  });
});
