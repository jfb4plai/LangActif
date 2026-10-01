import { describe, expect, it } from 'vitest';
import { acceptedForms, defaultTolerance, judge, type JudgeInput } from './judge';
import type { Word } from './types';

const fiets: Word = { id: 'w1', fr: 'vélo', cible: 'fiets', article: 'de', synonymesFr: ['bicyclette'], synonymesCible: [] };
const huis: Word = { id: 'w2', fr: 'maison', cible: 'huis', article: 'het', synonymesFr: [], synonymesCible: [] };
const straat: Word = { id: 'w3', fr: 'rue', cible: 'straat', article: 'de', synonymesFr: [], synonymesCible: [] };
const chair: Word = { id: 'e1', fr: 'chaise', cible: 'chair', article: null, synonymesFr: [], synonymesCible: [] };
const list = [fiets, huis, straat];

function j(word: Word, direction: JudgeInput['direction'], answer: string, extra: Partial<JudgeInput> = {}) {
  return judge({ word, direction, answer, listWords: list, ...extra });
}

describe('acceptedForms', () => {
  it('ajoute l\'article en néerlandais vers la langue cible', () => {
    expect(acceptedForms(fiets, 'fr_to_l')).toEqual(['de fiets']);
  });
  it('liste les synonymes français vers le français', () => {
    expect(acceptedForms(fiets, 'l_to_fr')).toEqual(['vélo', 'bicyclette']);
  });
});

describe('defaultTolerance', () => {
  it('est souple vers le français et stricte vers la langue cible', () => {
    expect(defaultTolerance('l_to_fr')).toEqual({ accents: true, casse: true });
    expect(defaultTolerance('fr_to_l')).toEqual({ accents: false, casse: false });
  });
});

describe('judge, français vers langue cible', () => {
  it('juste', () => {
    expect(j(fiets, 'fr_to_l', 'de fiets')).toEqual({ verdict: 'juste', errorType: null, expected: 'de fiets' });
  });
  it('presque quand seule la casse diffère (strict)', () => {
    const r = j(fiets, 'fr_to_l', 'De Fiets');
    expect(r.verdict).toBe('presque');
    expect(r.errorType).toBe('orthographe_proche');
  });
  it('presque pour une transposition de lettres', () => {
    expect(j(fiets, 'fr_to_l', 'de fiest').verdict).toBe('presque');
  });
  it('faux avec mauvais_article quand l\'article manque', () => {
    const r = j(fiets, 'fr_to_l', 'fiets');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('mauvais_article');
  });
  it('faux avec mauvais_article quand l\'article est inversé', () => {
    expect(j(fiets, 'fr_to_l', 'het fiets').errorType).toBe('mauvais_article');
    expect(j(huis, 'fr_to_l', 'de huis').errorType).toBe('mauvais_article');
  });
  it('faux avec confusion_liste quand on donne un autre mot de la liste', () => {
    const r = j(fiets, 'fr_to_l', 'de straat');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('confusion_liste');
  });
  it('sans_reponse quand la réponse est vide', () => {
    expect(j(fiets, 'fr_to_l', '').verdict).toBe('sans_reponse');
    expect(j(fiets, 'fr_to_l', '   ').errorType).toBe('sans_reponse');
  });
  it('faux autre pour un mot sans rapport', () => {
    const r = j(fiets, 'fr_to_l', 'banaan');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('autre');
  });
});

describe('judge, langue cible vers français', () => {
  it('tolère accents et casse par défaut', () => {
    expect(j(fiets, 'l_to_fr', 'velo').verdict).toBe('juste');
    expect(j(fiets, 'l_to_fr', 'VÉLO').verdict).toBe('juste');
  });
  it('accepte un synonyme', () => {
    expect(j(fiets, 'l_to_fr', 'Bicyclette').verdict).toBe('juste');
  });
  it('signale une confusion avec un autre mot de la liste', () => {
    expect(j(fiets, 'l_to_fr', 'maison').errorType).toBe('confusion_liste');
  });
  it('ne tolère aucune faute sur un mot de 3 lettres ou moins', () => {
    const r = j(straat, 'l_to_fr', 'rus');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('autre');
  });
  it('devient stricte si on le demande', () => {
    expect(j(fiets, 'l_to_fr', 'velo', { tolerance: { accents: false, casse: false } }).verdict).toBe('presque');
  });
});

describe('judge, anglais (sans article)', () => {
  const only = [chair];
  it('juste', () => {
    expect(judge({ word: chair, direction: 'fr_to_l', answer: 'chair', listWords: only }).verdict).toBe('juste');
  });
  it('presque pour une transposition', () => {
    expect(judge({ word: chair, direction: 'fr_to_l', answer: 'chiar', listWords: only }).verdict).toBe('presque');
  });
});

describe('judge, article néerlandais jamais « presque »', () => {
  const meisje: Word = { id: 'w4', fr: 'fille', cible: 'meisje', article: 'het', synonymesFr: [], synonymesCible: [] };
  it('faux + mauvais_article pour « het straat » (de straat)', () => {
    const r = j(straat, 'fr_to_l', 'het straat');
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('mauvais_article');
  });
  it('faux + mauvais_article pour « de meisje » (het meisje)', () => {
    const r = judge({ word: meisje, direction: 'fr_to_l', answer: 'de meisje', listWords: [...list, meisje] });
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('mauvais_article');
  });
  it('presque quand seule la majuscule de l\'article diffère (strict)', () => {
    const r = j(fiets, 'fr_to_l', 'De fiets');
    expect(r.verdict).toBe('presque');
    expect(r.errorType).toBe('orthographe_proche');
  });
  it('presque pour une faute dans le nom avec le bon article', () => {
    expect(j(fiets, 'fr_to_l', 'de fiest').verdict).toBe('presque');
  });
});

describe('judge, confusion avant « presque »', () => {
  it('anglais : un autre mot de la liste tapé juste donne confusion_liste', () => {
    const horse: Word = { id: 'e2', fr: 'cheval', cible: 'horse', article: null, synonymesFr: [], synonymesCible: [] };
    const house: Word = { id: 'e3', fr: 'maison', cible: 'house', article: null, synonymesFr: [], synonymesCible: [] };
    const r = judge({ word: horse, direction: 'fr_to_l', answer: 'house', listWords: [horse, house] });
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('confusion_liste');
  });
  it('vers le français : pain / main', () => {
    const pain: Word = { id: 'f1', fr: 'pain', cible: 'brood', article: 'het', synonymesFr: [], synonymesCible: [] };
    const main: Word = { id: 'f2', fr: 'main', cible: 'hand', article: 'de', synonymesFr: [], synonymesCible: [] };
    const r = judge({ word: pain, direction: 'l_to_fr', answer: 'main', listWords: [pain, main] });
    expect(r.verdict).toBe('faux');
    expect(r.errorType).toBe('confusion_liste');
  });
});
