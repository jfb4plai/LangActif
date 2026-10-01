import type { Langue } from './types';

/** Générateur pseudo-aléatoire graine (mulberry32), pour des tests déterministes. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const POOLS: Record<Langue | 'fr', string[]> = {
  'en-GB': AZ.split(''),
  'nl-BE': (AZ + 'ËÏ').split(''),
  fr: (AZ + 'ÉÈÊËÀÂÔÛÙÇÎÏ').split(''),
};

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Lettres mélangées de la roue : celles du mot, plus `leurres` lettres absentes du mot. */
export function buildWheel(word: string, leurres: number, langue: Langue | 'fr', rng: () => number = Math.random): string[] {
  const letters = word.toUpperCase().split('');
  if (leurres > 0) {
    const inWord = new Set(letters);
    const available = POOLS[langue].filter((l) => !inWord.has(l));
    for (let i = 0; i < leurres && available.length > 0; i++) {
      const idx = Math.floor(rng() * available.length);
      letters.push(available[idx]);
      available.splice(idx, 1);
    }
  }
  return shuffle(letters, rng);
}

export type WheelEligibility = { ok: true } | { ok: false; reason: 'vide' | 'expression' | 'trop_long' | 'caracteres' };

export const WHEEL_MAX_LETTERS = 10;

/** Seuls les mots simples d'au plus 10 lettres vont dans la roue. */
export function isWheelEligible(word: string): WheelEligibility {
  const w = word.trim();
  if (w === '') return { ok: false, reason: 'vide' };
  if (/[\s-]/.test(w)) return { ok: false, reason: 'expression' };
  if (!/^\p{L}+$/u.test(w)) return { ok: false, reason: 'caracteres' };
  if (w.length > WHEEL_MAX_LETTERS) return { ok: false, reason: 'trop_long' };
  return { ok: true };
}

/** Retour qualifié : nombre de lettres à la bonne place, sans dire lesquelles. */
export function countWellPlaced(attempt: string, target: string): number {
  const a = attempt.toUpperCase();
  const t = target.toUpperCase();
  let count = 0;
  for (let i = 0; i < Math.min(a.length, t.length); i++) if (a[i] === t[i]) count++;
  return count;
}
