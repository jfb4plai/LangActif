import { cardKey, type CardRef, type CardState, type Direction } from './types';

/** Transforme des mots en cartes selon le sens de l'assignation. */
export function expandCards(words: Array<{ id: string }>, sens: Direction | 'both'): CardRef[] {
  const refs: CardRef[] = [];
  for (const w of words) {
    if (sens === 'fr_to_l' || sens === 'both') refs.push({ wordId: w.id, direction: 'fr_to_l' });
    if (sens === 'l_to_fr' || sens === 'both') refs.push({ wordId: w.id, direction: 'l_to_fr' });
  }
  return refs;
}

export interface PickOptions {
  cards: CardRef[];
  states: Map<string, CardState>;
  now: number;
  /** Nombre maximal de cartes jamais vues introduites dans la séance. */
  maxNew: number;
  maxTotal?: number;
}

/**
 * Cartes dues d'abord (boîte la plus basse, puis la plus ancienne),
 * puis jusqu'à `maxNew` cartes nouvelles dans l'ordre de la liste.
 */
export function pickSessionCards(o: PickOptions): CardRef[] {
  const due: Array<{ ref: CardRef; dueAt: number; box: number }> = [];
  const fresh: CardRef[] = [];
  const seen = new Set<string>();
  for (const ref of o.cards) {
    const k = cardKey(ref.wordId, ref.direction);
    if (seen.has(k)) continue;
    seen.add(k);
    const state = o.states.get(k);
    if (!state) fresh.push(ref);
    else if (state.dueAt <= o.now) due.push({ ref, dueAt: state.dueAt, box: state.box });
  }
  due.sort((a, b) => a.box - b.box || a.dueAt - b.dueAt);
  const picked = [...due.map((d) => d.ref), ...fresh.slice(0, Math.max(0, o.maxNew))];
  return o.maxTotal === undefined ? picked : picked.slice(0, Math.max(0, o.maxTotal));
}
