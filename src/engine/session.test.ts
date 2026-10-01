import { describe, expect, it } from 'vitest';
import { expandCards, pickSessionCards } from './session';
import { DAY_MS, type CardRef, type CardState } from './types';

const NOW = 1_000_000_000_000;

function st(wordId: string, box: CardState['box'], dueAt: number): CardState {
  return {
    key: `${wordId}:fr_to_l`,
    wordId,
    direction: 'fr_to_l',
    box,
    dueAt,
    nbJuste: 0,
    nbPresque: 0,
    nbFaux: 0,
    nbAide: 0,
    lastAt: NOW,
  };
}

const ref = (wordId: string): CardRef => ({ wordId, direction: 'fr_to_l' });

describe('expandCards', () => {
  const words = [{ id: 'w1' }, { id: 'w2' }];
  it('un seul sens', () => {
    expect(expandCards(words, 'fr_to_l')).toEqual([
      { wordId: 'w1', direction: 'fr_to_l' },
      { wordId: 'w2', direction: 'fr_to_l' },
    ]);
  });
  it('les deux sens (mixte)', () => {
    expect(expandCards(words, 'both')).toHaveLength(4);
    expect(expandCards(words, 'both')[1]).toEqual({ wordId: 'w1', direction: 'l_to_fr' });
  });
});

describe('pickSessionCards', () => {
  it('met les cartes dues d\'abord (boîte basse en premier) puis quelques nouvelles', () => {
    const states = new Map<string, CardState>([
      ['w1:fr_to_l', st('w1', 3, NOW - DAY_MS)],
      ['w2:fr_to_l', st('w2', 2, NOW - 2 * DAY_MS)],
      ['w3:fr_to_l', st('w3', 2, NOW + DAY_MS)], // pas encore due
    ]);
    const picked = pickSessionCards({
      cards: [ref('w1'), ref('w2'), ref('w3'), ref('w4'), ref('w5')],
      states,
      now: NOW,
      maxNew: 1,
    });
    expect(picked.map((c) => c.wordId)).toEqual(['w2', 'w1', 'w4']);
  });

  it('limite le total', () => {
    const picked = pickSessionCards({
      cards: [ref('a'), ref('b'), ref('c'), ref('d')],
      states: new Map(),
      now: NOW,
      maxNew: 10,
      maxTotal: 2,
    });
    expect(picked).toHaveLength(2);
  });

  it('ne propose pas une carte maîtrisée non due', () => {
    const states = new Map<string, CardState>([['w1:fr_to_l', st('w1', 5, NOW + 10 * DAY_MS)]]);
    expect(pickSessionCards({ cards: [ref('w1')], states, now: NOW, maxNew: 5 })).toEqual([]);
  });
  it('ne renvoie pas deux fois une carte présente deux fois', () => {
    const out = pickSessionCards({ cards: [ref('a'), ref('b'), ref('a')], states: new Map(), now: NOW, maxNew: 10 });
    expect(out).toEqual([ref('a'), ref('b')]);
  });

  it('traite un maxNew négatif comme 0', () => {
    const out = pickSessionCards({ cards: [ref('a'), ref('b'), ref('c'), ref('d'), ref('e')], states: new Map(), now: NOW, maxNew: -2 });
    expect(out).toEqual([]);
  });

  it('traite un maxTotal négatif comme 0', () => {
    const out = pickSessionCards({ cards: [ref('a'), ref('b')], states: new Map(), now: NOW, maxNew: 5, maxTotal: -1 });
    expect(out).toEqual([]);
  });
});
