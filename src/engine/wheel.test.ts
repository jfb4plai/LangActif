import { describe, expect, it } from 'vitest';
import { buildWheel, countWellPlaced, createSeededRng, isWheelEligible } from './wheel';

const sorted = (a: string[]) => [...a].sort().join('');

describe('createSeededRng', () => {
  it('est déterministe', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('buildWheel', () => {
  it('contient exactement les lettres du mot sans leurres', () => {
    const w = buildWheel('fiets', 0, 'nl-BE', createSeededRng(1));
    expect(sorted(w)).toBe(sorted(['F', 'I', 'E', 'T', 'S']));
  });

  it('ajoute des leurres absents du mot', () => {
    const w = buildWheel('fiets', 2, 'nl-BE', createSeededRng(1));
    expect(w).toHaveLength(7);
    const letters = new Set('FIETS'.split(''));
    expect(w.filter((l) => !letters.has(l))).toHaveLength(2);
  });

  it('propose des lettres accentuées françaises parmi les leurres', () => {
    const leurres = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      for (const l of buildWheel('vélo', 3, 'fr', createSeededRng(seed))) {
        if (!'VÉLO'.includes(l)) leurres.add(l);
      }
    }
    expect([...leurres].some((l) => 'ÈÊÀÂÔÛÙÇÎÏË'.includes(l))).toBe(true);
  });

  it('met le mot en majuscules', () => {
    expect(sorted(buildWheel('vélo', 0, 'fr', createSeededRng(3)))).toBe(sorted(['V', 'É', 'L', 'O']));
  });
});

describe('isWheelEligible', () => {
  it('accepte un mot simple', () => {
    expect(isWheelEligible('fiets')).toEqual({ ok: true });
  });
  it('refuse une expression', () => {
    expect(isWheelEligible('to look for')).toEqual({ ok: false, reason: 'expression' });
    expect(isWheelEligible('rendez-vous')).toEqual({ ok: false, reason: 'expression' });
  });
  it('refuse un mot trop long', () => {
    expect(isWheelEligible('verantwoordelijkheid')).toEqual({ ok: false, reason: 'trop_long' });
  });
  it('refuse un mot vide ou avec des chiffres', () => {
    expect(isWheelEligible('  ')).toEqual({ ok: false, reason: 'vide' });
    expect(isWheelEligible('b2b')).toEqual({ ok: false, reason: 'caracteres' });
  });
});

describe('countWellPlaced', () => {
  it('compte les lettres à la bonne place sans dire lesquelles', () => {
    expect(countWellPlaced('chiar', 'chair')).toBe(3);
    expect(countWellPlaced('CHAIR', 'chair')).toBe(5);
  });
  it('gère des longueurs différentes', () => {
    expect(countWellPlaced('ch', 'chair')).toBe(2);
  });
});
