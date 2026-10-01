import { MODE_CAP } from './modes';
import { DAY_MS, cardKey, type AnswerEvent, type Box, type CardState } from './types';

/** Intervalle avant revoir, par boîte. Boîte 1 : 0 jour (redue tout de suite). */
export const INTERVAL_DAYS: Record<Box, number> = { 1: 0, 2: 2, 3: 4, 4: 7, 5: 14 };

/** Un mot est « maîtrisé » à partir de cette boîte. */
export const MASTERED_FROM: Box = 4;

export function isMastered(state: CardState | undefined): boolean {
  return state !== undefined && state.box >= MASTERED_FROM;
}

/**
 * Applique une réponse à l'état d'une carte. Pure : ne modifie pas `prev`.
 * Une réponse de test blanc n'a aucun effet.
 */
export function applyAnswer(prev: CardState | undefined, ev: AnswerEvent): CardState | undefined {
  if (ev.test) return prev;

  const s: CardState = prev
    ? { ...prev }
    : {
        key: cardKey(ev.wordId, ev.direction),
        wordId: ev.wordId,
        direction: ev.direction,
        box: 1,
        dueAt: ev.ts,
        nbJuste: 0,
        nbPresque: 0,
        nbFaux: 0,
        nbAide: 0,
        lastAt: ev.ts,
      };
  s.lastAt = ev.ts;

  switch (ev.verdict) {
    case 'juste':
      if (ev.aide) {
        s.nbAide += 1;
      } else {
        s.nbJuste += 1;
        const cap = MODE_CAP[ev.mode];
        s.box = Math.max(s.box, Math.min(s.box + 1, cap)) as Box;
        s.dueAt = ev.ts + INTERVAL_DAYS[s.box] * DAY_MS;
      }
      break;
    case 'presque':
      s.nbPresque += 1;
      s.dueAt = ev.ts;
      break;
    case 'faux':
    case 'sans_reponse':
      s.nbFaux += 1;
      s.box = 1;
      s.dueAt = ev.ts;
      break;
  }
  return s;
}
