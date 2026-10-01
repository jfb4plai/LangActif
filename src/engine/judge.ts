import { clean, damerau, foldKey, maxTypos, stripAccents } from './text';
import type { Direction, ErrorType, Verdict, Word } from './types';

export interface Tolerance {
  /** true : les différences d'accents sont ignorées. */
  accents: boolean;
  /** true : les différences de majuscules sont ignorées. */
  casse: boolean;
}

export function defaultTolerance(direction: Direction): Tolerance {
  return direction === 'l_to_fr' ? { accents: true, casse: true } : { accents: false, casse: false };
}

export interface JudgeInput {
  word: Word;
  direction: Direction;
  answer: string;
  /** Les autres mots de la liste, pour détecter une confusion. */
  listWords: Word[];
  tolerance?: Tolerance;
}

export interface JudgeResult {
  verdict: Verdict;
  errorType: ErrorType | null;
  expected: string;
}

type Level = 'juste' | 'presque' | 'faux';
const RANK: Record<Level, number> = { juste: 0, presque: 1, faux: 2 };
const ARTICLES = ['de', 'het'];

/** Formes acceptées ; la première est celle qu'on affiche comme bonne réponse. */
export function acceptedForms(word: Word, direction: Direction): string[] {
  if (direction === 'l_to_fr') return [word.fr, ...word.synonymesFr];
  const primary = word.article ? `${word.article} ${word.cible}` : word.cible;
  return [primary, ...word.synonymesCible];
}

function tolKey(s: string, tol: Tolerance): string {
  let k = clean(s);
  if (tol.casse) k = k.toLowerCase();
  if (tol.accents) k = stripAccents(k);
  return k;
}

function compare(answer: string, form: string, tol: Tolerance): Level {
  if (tolKey(answer, tol) === tolKey(form, tol)) return 'juste';
  const a = foldKey(answer);
  const f = foldKey(form);
  if (a === f) return 'presque';
  return damerau(a, f) <= maxTypos(f.length) ? 'presque' : 'faux';
}

function hasArticleProblem(answer: string, word: Word, tol: Tolerance): boolean {
  const [first, ...rest] = answer.split(' ');
  if (ARTICLES.includes(first.toLowerCase()) && rest.length > 0) {
    return first.toLowerCase() !== word.article && compare(rest.join(' '), word.cible, tol) !== 'faux';
  }
  // article manquant : le nom est reconnu sans article
  return compare(answer, word.cible, tol) !== 'faux';
}

function matchesOtherWord(answer: string, word: Word, listWords: Word[], direction: Direction, tol: Tolerance): boolean {
  for (const other of listWords) {
    if (other.id === word.id) continue;
    for (const form of acceptedForms(other, direction)) {
      if (compare(answer, form, tol) !== 'faux') return true;
    }
  }
  return false;
}

export function judge(input: JudgeInput): JudgeResult {
  const { word, direction, listWords } = input;
  const tol = input.tolerance ?? defaultTolerance(direction);
  const forms = acceptedForms(word, direction);
  const expected = forms[0];
  const answer = clean(input.answer);

  if (answer === '') return { verdict: 'sans_reponse', errorType: 'sans_reponse', expected };

  let best: Level = 'faux';
  for (const form of forms) {
    const level = compare(answer, form, tol);
    if (RANK[level] < RANK[best]) best = level;
  }
  if (best === 'juste') return { verdict: 'juste', errorType: null, expected };
  if (best === 'presque') return { verdict: 'presque', errorType: 'orthographe_proche', expected };

  if (direction === 'fr_to_l' && word.article && hasArticleProblem(answer, word, tol)) {
    return { verdict: 'faux', errorType: 'mauvais_article', expected };
  }
  if (matchesOtherWord(answer, word, listWords, direction, tol)) {
    return { verdict: 'faux', errorType: 'confusion_liste', expected };
  }
  return { verdict: 'faux', errorType: 'autre', expected };
}
