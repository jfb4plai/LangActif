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

function best(levels: Level[]): Level {
  return levels.reduce((x, y) => (RANK[y] < RANK[x] ? y : x), 'faux' as Level);
}

function worst(a: Level, b: Level): Level {
  return RANK[a] >= RANK[b] ? a : b;
}

interface Evaluation {
  level: Level;
  /** Le nom est reconnu mais l'article est absent ou faux. */
  articleIssue: boolean;
}

/** Découpe « de fiets » en article + nom ; null si la forme n'a pas d'article. */
function splitArticle(text: string): { article: string; noun: string } | null {
  const space = text.indexOf(' ');
  if (space === -1) return null;
  const first = text.slice(0, space);
  const rest = text.slice(space + 1);
  return ARTICLES.includes(first.toLowerCase()) && rest !== '' ? { article: first, noun: rest } : null;
}

/** Néerlandais vers la langue cible : article et nom sont jugés séparément. */
function evaluateWithArticle(answer: string, expectedNoun: string, expectedArticle: string, tol: Tolerance): Evaluation {
  const parsed = splitArticle(answer);
  const answerArticle = parsed ? parsed.article : null;
  const noun = parsed ? parsed.noun : answer;

  const nounLevel = compare(noun, expectedNoun, tol);
  if (nounLevel === 'faux') return { level: 'faux', articleIssue: false };
  if (answerArticle === null || answerArticle.toLowerCase() !== expectedArticle) {
    return { level: 'faux', articleIssue: true };
  }
  const articleLevel: Level = answerArticle !== expectedArticle && !tol.casse ? 'presque' : 'juste';
  return { level: worst(nounLevel, articleLevel), articleIssue: false };
}

function evaluate(answer: string, word: Word, direction: Direction, tol: Tolerance): Evaluation {
  if (direction === 'fr_to_l' && word.article) {
    // Le mot principal et chaque synonyme (écrit avec son propre article) sont jugés pareil.
    const candidates: Evaluation[] = [evaluateWithArticle(answer, word.cible, word.article, tol)];
    for (const form of word.synonymesCible) {
      const own = splitArticle(form);
      candidates.push(
        own
          ? evaluateWithArticle(answer, own.noun, own.article.toLowerCase(), tol)
          : { level: compare(answer, form, tol), articleIssue: false },
      );
    }
    const level = best(candidates.map((c) => c.level));
    if (level !== 'faux') return { level, articleIssue: false };
    return { level, articleIssue: candidates.some((c) => c.articleIssue) };
  }
  return { level: best(acceptedForms(word, direction).map((f) => compare(answer, f, tol))), articleIssue: false };
}

/** Une forme d'un AUTRE mot de la liste est reconnue au moins au niveau demandé. */
function matchesOtherWord(
  answer: string,
  word: Word,
  listWords: Word[],
  direction: Direction,
  tol: Tolerance,
  exactOnly: boolean,
): boolean {
  for (const other of listWords) {
    if (other.id === word.id) continue;
    for (const form of acceptedForms(other, direction)) {
      const level = compare(answer, form, tol);
      if (exactOnly ? level === 'juste' : level !== 'faux') return true;
    }
  }
  return false;
}

export function judge(input: JudgeInput): JudgeResult {
  const { word, direction, listWords } = input;
  const tol = input.tolerance ?? defaultTolerance(direction);
  const expected = acceptedForms(word, direction)[0];
  const answer = clean(input.answer);

  if (answer === '') return { verdict: 'sans_reponse', errorType: 'sans_reponse', expected };

  const { level, articleIssue } = evaluate(answer, word, direction, tol);
  if (level === 'juste') return { verdict: 'juste', errorType: null, expected };

  // Un autre mot de la liste tapé exactement passe avant « presque » et avant l'article.
  if (matchesOtherWord(answer, word, listWords, direction, tol, true)) {
    return { verdict: 'faux', errorType: 'confusion_liste', expected };
  }
  if (articleIssue) return { verdict: 'faux', errorType: 'mauvais_article', expected };
  if (level === 'presque') return { verdict: 'presque', errorType: 'orthographe_proche', expected };
  if (matchesOtherWord(answer, word, listWords, direction, tol, false)) {
    return { verdict: 'faux', errorType: 'confusion_liste', expected };
  }
  return { verdict: 'faux', errorType: 'autre', expected };
}
