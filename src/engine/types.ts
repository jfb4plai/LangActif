export type Langue = 'en-GB' | 'nl-BE';
export type Direction = 'fr_to_l' | 'l_to_fr';
export type Article = 'de' | 'het';
export type Box = 1 | 2 | 3 | 4 | 5;

export interface Word {
  id: string;
  fr: string;
  cible: string;
  article: Article | null;
  synonymesFr: string[];
  synonymesCible: string[];
}

export type Mode =
  | 'flashcards'
  | 'qcm'
  | 'association'
  | 'taper'
  | 'roue_sans_leurres'
  | 'roue_avec_leurres'
  | 'arcade_tir'
  | 'arcade_defense';

export type Verdict = 'juste' | 'presque' | 'faux' | 'sans_reponse';

export type ErrorType =
  | 'orthographe_proche'
  | 'mauvais_article'
  | 'confusion_liste'
  | 'sans_reponse'
  | 'autre';

/** Une ligne du journal : une réponse d'un élève sur une carte. */
export interface AnswerEvent {
  id: string;
  studentId: string;
  wordId: string;
  direction: Direction;
  mode: Mode;
  verdict: Verdict;
  errorType: ErrorType | null;
  /** « Voir dans une phrase » utilisé : réponse juste avec aide. */
  aide: boolean;
  /** Test blanc : journalisé, sans effet sur les boîtes. */
  test: boolean;
  /** Horodatage en millisecondes (epoch). */
  ts: number;
  answerText?: string;
  latencyMs?: number;
  /** Bloc-jeux (liste, chapitre, regroupement ou remédiation) dans lequel la réponse a été donnée. */
  blocId?: string;
}

export interface CardState {
  key: string;
  wordId: string;
  direction: Direction;
  box: Box;
  dueAt: number;
  nbJuste: number;
  nbPresque: number;
  nbFaux: number;
  nbAide: number;
  lastAt: number;
}

export interface CardRef {
  wordId: string;
  direction: Direction;
}

export const DAY_MS = 86_400_000;

export function cardKey(wordId: string, direction: Direction): string {
  return `${wordId}:${direction}`;
}
