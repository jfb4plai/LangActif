import type { Langue } from '../engine/types';

const LABELS: Record<Langue, string> = {
  'nl-BE': 'Néerlandais (Belgique)',
  'en-GB': 'Anglais (Royaume-Uni)',
};

export function langueLabel(langue: Langue): string {
  return LABELS[langue];
}
