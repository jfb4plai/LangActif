import { describe, expect, it } from 'vitest';
import { parseChapter, type RawSheet, type RawWorkbook } from './chapter';

function sheet(name: string, header: string[], rows: string[][]): RawSheet {
  return { name, header, rows: rows.map((cells, i) => ({ n: i + 2, cells })) };
}

function book(over: Partial<RawWorkbook> = {}): RawWorkbook {
  return {
    hasMeta: true,
    meta: { langue: 'nl-BE', niveau: 'A1', titre: 'Le vélo et la ville', numero: '4' },
    lists: [
      sheet('Liste 4.1', ['fr', 'cible', 'article', 'synonymes_fr', 'phrase_cible', 'phrase_fr'], [
        ['vélo', 'fiets', 'de', 'bicyclette', 'Ik ga met de fiets naar school.', 'Je vais à l\'école à vélo.'],
        ['maison', 'huis', 'het', '', '', ''],
      ]),
    ],
    ...over,
  };
}

describe('parseChapter, cas valide', () => {
  it('analyse un chapitre néerlandais', () => {
    const r = parseChapter(book());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.langue).toBe('nl-BE');
    expect(r.chapter.numero).toBe('4');
    const [fiets, huis] = r.chapter.lists[0].words;
    expect(fiets).toEqual({
      fr: 'vélo',
      cible: 'fiets',
      article: 'de',
      synonymesFr: ['bicyclette'],
      synonymesCible: [],
      phraseCible: 'Ik ga met de fiets naar school.',
      phraseFr: 'Je vais à l\'école à vélo.',
      audioUrl: null,
    });
    expect(huis.phraseCible).toBeNull();
  });

  it('accepte « - » comme absence d\'article et sépare les synonymes par « ; »', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article', 'synonymes_cible'], [['courir', 'lopen', '-', 'rennen; hardlopen']])],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.lists[0].words[0].article).toBeNull();
    expect(r.chapter.lists[0].words[0].synonymesCible).toEqual(['rennen', 'hardlopen']);
  });

  it('accepte l\'anglais sans colonne article', () => {
    const r = parseChapter(book({
      meta: { langue: 'en-GB', niveau: 'A1', titre: 'Town', numero: '1' },
      lists: [sheet('L', ['fr', 'cible'], [['chaise', 'chair']])],
    }));
    expect(r.ok).toBe(true);
  });

  it('ignore les lignes entièrement vides', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['', '', ''], ['maison', 'huis', 'het']])],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chapter.lists[0].words).toHaveLength(2);
  });
});

describe('parseChapter, erreurs', () => {
  const issuesOf = (b: RawWorkbook) => {
    const r = parseChapter(b);
    if (r.ok) throw new Error('succès inattendu');
    return r.issues;
  };

  it('signale l\'absence de la feuille Méta', () => {
    const issues = issuesOf(book({ hasMeta: false, meta: {} }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Méta');
  });

  it('signale les champs Méta manquants et une langue inconnue', () => {
    const issues = issuesOf(book({ meta: { langue: 'de-DE', niveau: '', titre: 'X', numero: '1' } }));
    expect(issues.map((i) => i.column)).toEqual(expect.arrayContaining(['langue', 'niveau']));
    expect(issues.find((i) => i.column === 'langue')!.message).toContain('de-DE');
  });

  it('signale une feuille sans liste', () => {
    expect(issuesOf(book({ lists: [] }))[0].message).toContain('Aucune');
  });

  it('signale un article absent ou invalide en néerlandais, avec le numéro de ligne', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['maison', 'huis', ''], ['rue', 'straat', 'la']])],
    }));
    expect(issues.map((i) => [i.row, i.column])).toEqual([[3, 'article'], [4, 'article']]);
  });

  it('signale la colonne article manquante en néerlandais', () => {
    const issues = issuesOf(book({ lists: [sheet('L', ['fr', 'cible'], [['vélo', 'fiets']])] }));
    expect(issues[0].column).toBe('article');
  });

  it('refuse un article en anglais', () => {
    const issues = issuesOf(book({
      meta: { langue: 'en-GB', niveau: 'A1', titre: 'Town', numero: '1' },
      lists: [sheet('L', ['fr', 'cible', 'article'], [['chaise', 'chair', 'de']])],
    }));
    expect(issues[0].message).toContain('anglais');
  });

  it('signale fr ou cible manquant', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['', 'fiets', 'de'], ['maison', '', 'het']])],
    }));
    expect(issues.map((i) => [i.row, i.column])).toEqual([[2, 'fr'], [3, 'cible']]);
  });

  it('signale les doublons dans une liste', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['Vélo', 'rijwiel', 'het']])],
    }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Doublon');
    expect(issues[0].row).toBe(3);
  });

  it('exige la phrase et sa traduction ensemble', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article', 'phrase_cible', 'phrase_fr'], [['vélo', 'fiets', 'de', 'Ik fiets.', '']])],
    }));
    expect(issues[0].column).toBe('phrase_fr');
  });

  it('signale une liste vide', () => {
    expect(issuesOf(book({ lists: [sheet('Vide', ['fr', 'cible', 'article'], [])] }))[0].message).toContain('vide');
  });

  it('signale les colonnes obligatoires absentes', () => {
    const issues = issuesOf(book({ lists: [sheet('L', ['mot'], [['x']])] }));
    expect(issues.map((i) => i.column)).toEqual(expect.arrayContaining(['fr', 'cible']));
  });
});
