import type { Box, Mode } from './types';

/**
 * Boîte maximale atteignable par un mode (spec 5.3).
 * Hypothèse pédagogique : reconnaître est plus facile que produire,
 * donc seule une production réussie fait monter au-delà de la boîte 3.
 */
export const MODE_CAP: Record<Mode, Box> = {
  flashcards: 3,
  qcm: 3,
  association: 3,
  arcade_tir: 3,
  roue_sans_leurres: 3,
  roue_avec_leurres: 4,
  taper: 5,
  arcade_defense: 5,
};
