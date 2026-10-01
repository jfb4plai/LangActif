import { applyAnswer } from './leitner';
import { cardKey, type AnswerEvent, type CardState } from './types';

/**
 * Recalcule l'état des cartes d'UN élève depuis son journal.
 * Doublons ignorés (par `id`), ordre d'arrivée sans effet (tri par `ts`, puis `id`).
 */
export function replayEvents(events: AnswerEvent[]): Map<string, CardState> {
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  unique.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const cards = new Map<string, CardState>();
  for (const ev of unique) {
    const key = cardKey(ev.wordId, ev.direction);
    const next = applyAnswer(cards.get(key), ev);
    if (next) cards.set(key, next);
  }
  return cards;
}
