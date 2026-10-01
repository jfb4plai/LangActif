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

  it('bloque un couple identique (casse ignorée) dans une liste', () => {
    const issues = issuesOf(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'fiets', 'de'], ['Vélo', 'Fiets', 'de']])],
    }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Doublon dans la liste : « Vélo » / « Fiets »');
    expect(issues[0].column).toBe('fr');
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

describe('parseChapter, article, séparateurs, langue', () => {
  it('rejette une cible néerlandaise qui commence par un article', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['vélo', 'de fiets', 'de']])],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toContainEqual({
      sheet: 'L', row: 2, column: 'cible',
      message: 'Le mot « de fiets » commence par un article : mettre l\'article dans la colonne « article »',
    });
  });

  it('ne s\'applique pas à l\'anglais (article dans la cible)', () => {
    const r = parseChapter(book({
      meta: { langue: 'en-GB', niveau: 'A1', titre: 'T', numero: '1' },
      lists: [sheet('L', ['fr', 'cible'], [['le thé', 'the tea']])],
    }));
    expect(r.ok).toBe(true);
  });

  it('signale une virgule dans les synonymes', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article', 'synonymes_cible', 'synonymes_fr'], [['vélo', 'fiets', 'de', 'rijwiel, velo', 'a, b']])],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const msg = 'Séparateur « , » dans les synonymes : utiliser « ; »';
    expect(r.issues).toContainEqual({ sheet: 'L', row: 2, column: 'synonymes_cible', message: msg });
    expect(r.issues).toContainEqual({ sheet: 'L', row: 2, column: 'synonymes_fr', message: msg });
  });

  it('accepte « ; » dans les synonymes', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article', 'synonymes_cible'], [['vélo', 'fiets', 'de', 'het rijwiel; de velo']])],
    }));
    expect(r.ok).toBe(true);
  });

  it('accepte la langue sans tenir compte de la casse et stocke la valeur canonique', () => {
    const a = parseChapter(book({ meta: { langue: 'NL-BE', niveau: 'A1', titre: 'T', numero: '1' } }));
    expect(a.ok && a.chapter.langue).toBe('nl-BE');
    const b = parseChapter(book({
      meta: { langue: 'en-gb', niveau: 'A1', titre: 'T', numero: '1' },
      lists: [sheet('L', ['fr', 'cible'], [['chaise', 'chair']])],
    }));
    expect(b.ok && b.chapter.langue).toBe('en-GB');
  });
});

describe('parseChapter, article des synonymes néerlandais', () => {
  const hdr = ['fr', 'cible', 'article', 'synonymes_cible'];
  it('accepte un synonyme avec son article', () => {
    const r = parseChapter(book({ lists: [sheet('L', hdr, [['vélo', 'fiets', 'de', 'het rijwiel']])] }));
    expect(r.ok).toBe(true);
  });
  it('signale un synonyme sans article quand le mot a un article', () => {
    const r = parseChapter(book({ lists: [sheet('L', hdr, [['vélo', 'fiets', 'de', 'het rijwiel; bike']])] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toEqual([{
      sheet: 'L', row: 2, column: 'synonymes_cible',
      message: 'Le synonyme « bike » doit commencer par son article (de ou het)',
    }]);
  });
  it('signale un synonyme réduit à un article seul', () => {
    const r = parseChapter(book({ lists: [sheet('L', hdr, [['vélo', 'fiets', 'de', 'het']])] }));
    expect(r.ok).toBe(false);
  });
  it('accepte un verbe sans article avec un synonyme nu', () => {
    const r = parseChapter(book({ lists: [sheet('L', hdr, [['courir', 'lopen', '-', 'rennen']])] }));
    expect(r.ok).toBe(true);
  });
  it('ne concerne pas l anglais', () => {
    const r = parseChapter(book({
      meta: { langue: 'en-GB', niveau: 'A1', titre: 'T', numero: '1' },
      lists: [sheet('L', ['fr', 'cible', 'synonymes_cible'], [['chaise', 'chair', 'seat']])],
    }));
    expect(r.ok).toBe(true);
  });
});

describe('parseChapter, homonymes et avertissements', () => {
  it('un fr répété avec une autre cible donne un avertissement, pas une erreur', () => {
    const r = parseChapter(book({
      lists: [sheet('Liste 4.1', ['fr', 'cible', 'article', 'synonymes_cible'], [['vélo', 'fiets', 'de', ''], ['Vélo', 'rijwiel', 'het', '']])],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([{
      sheet: 'Liste 4.1', row: 3, column: 'fr',
      message: '« Vélo » apparaît plusieurs fois avec des traductions différentes (homonymie voulue ?)',
    }]);
  });

  it('banc / banque vers « bank » : avertissement sur la cible, ligne 3', () => {
    const r = parseChapter(book({
      lists: [sheet('L', ['fr', 'cible', 'article'], [['banc', 'bank', 'de'], ['banque', 'bank', 'de']])],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.warnings).toEqual([{
      sheet: 'L', row: 3, column: 'cible',
      message: '« bank » apparaît plusieurs fois avec des mots français différents (homonymie voulue ?)',
    }]);
  });

  it('un classeur valide sans répétition donne warnings vide', () => {
    const r = parseChapter(book());
    expect(r.ok && r.warnings).toEqual([]);
  });
});
