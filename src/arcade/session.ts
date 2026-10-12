import {
  acceptedForms,
  expandCards,
  pickSessionCards,
  type AnswerEvent,
  type CardRef,
  type CardState,
  type Direction,
  type Word,
} from '../engine';

/** Texte affiché pour la forme principale d'un mot dans un sens donné (avec l'article en néerlandais). */
export function answerText(word: Word, direction: Direction): string {
  return acceptedForms(word, direction)[0];
}

/** Texte affiché comme consigne (le mot à traduire). */
export function promptText(word: Word, direction: Direction): string {
  return answerText(word, direction === 'fr_to_l' ? 'l_to_fr' : 'fr_to_l');
}

export interface ArcadeOption {
  wordId: string;
  text: string;
  correct: boolean;
}

export interface Wave {
  ref: CardRef;
  word: Word;
  prompt: string;
  options: ArcadeOption[];
  startedAt: number;
}

export type WaveOutcome = 'clean' | 'dirty' | 'missed';

interface Entry {
  ref: CardRef;
  word: Word;
  rounds: number;
  failedOnce: boolean;
}

export interface ArcadeConfig {
  /** Mots du chapitre ou de la liste (au moins 3, formes d'affichage distinctes). */
  words: Word[];
  direction: Direction;
  /** Nombre de cartes de la séance. */
  count: number;
  studentId: string;
  blocId?: string;
  /** États Leitner déjà connus (vide pour un essai enseignant). */
  states?: Map<string, CardState>;
  now?: () => number;
  rng?: () => number;
  newId?: () => string;
}

export interface SessionSummary {
  total: number;
  first: Word[];
  retry: Word[];
  review: Word[];
  score: number;
}

export const MIN_WORDS = 3;
const MAX_ROUNDS = 2;

function shuffle<T>(a: T[], rng: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Séance de tir : la logique pure (aucun dessin, aucun minuteur).
 * Elle produit des AnswerEvent compatibles avec le moteur Leitner (mode `arcade_tir`).
 * Une carte est maîtrisée dans la séance si elle est réussie sans erreur ; sinon elle revient
 * une fois, puis part dans « à retravailler ».
 */
export class ArcadeSession {
  readonly total: number;
  score = 0;
  combo = 0;
  removed = 0;
  private queue: Entry[];
  private readonly byId: Map<string, Word>;
  private readonly first: Word[] = [];
  private readonly retry: Word[] = [];
  private readonly review: Word[] = [];
  private wave: Wave | null = null;
  private waveWrong = false;
  private readonly now: () => number;
  private readonly rng: () => number;
  private readonly newId: () => string;

  constructor(private readonly cfg: ArcadeConfig) {
    this.now = cfg.now ?? Date.now;
    this.rng = cfg.rng ?? Math.random;
    this.newId = cfg.newId ?? (() => crypto.randomUUID());
    this.byId = new Map(cfg.words.map((w) => [w.id, w]));
    const cards = pickSessionCards({
      cards: expandCards(cfg.words, cfg.direction),
      states: cfg.states ?? new Map(),
      now: this.now(),
      maxNew: cfg.count,
      maxTotal: cfg.count,
    });
    this.queue = shuffle(cards, this.rng).map((ref) => ({
      ref,
      word: this.byId.get(ref.wordId)!,
      rounds: 0,
      failedOnce: false,
    }));
    this.total = this.queue.length;
  }

  get finished(): boolean {
    return this.queue.length === 0;
  }

  get currentWave(): Wave | null {
    return this.wave;
  }

  /** Prépare la vague suivante ; null quand la séance est terminée. */
  nextWave(): Wave | null {
    if (this.finished) {
      this.wave = null;
      return null;
    }
    const entry = this.queue[0];
    const dir = this.cfg.direction;
    const target = answerText(entry.word, dir);
    const forbidden = new Set(acceptedForms(entry.word, dir).map((f) => f.toLowerCase()));
    const pool = this.cfg.words.filter((w) => {
      if (w.id === entry.word.id) return false;
      const forms = acceptedForms(w, dir).map((f) => f.toLowerCase());
      return !forms.some((f) => forbidden.has(f));
    });
    const distractors = shuffle(pool, this.rng).slice(0, 2);
    const options: ArcadeOption[] = shuffle(
      [
        { wordId: entry.word.id, text: target, correct: true },
        ...distractors.map((w) => ({ wordId: w.id, text: answerText(w, dir), correct: false })),
      ],
      this.rng,
    );
    this.waveWrong = false;
    this.wave = { ref: entry.ref, word: entry.word, prompt: promptText(entry.word, dir), options, startedAt: this.now() };
    return this.wave;
  }

  private event(verdict: AnswerEvent['verdict'], extra: Partial<AnswerEvent> = {}): AnswerEvent {
    const w = this.wave!;
    return {
      id: this.newId(),
      studentId: this.cfg.studentId,
      wordId: w.word.id,
      direction: this.cfg.direction,
      mode: 'arcade_tir',
      verdict,
      errorType: null,
      aide: false,
      test: false,
      ts: this.now(),
      latencyMs: this.now() - w.startedAt,
      blocId: this.cfg.blocId,
      ...extra,
    };
  }

  /** Tir sur une carte qui n'est pas la bonne : journalisé « faux », la série retombe, la vague continue. */
  wrongShot(option: ArcadeOption): AnswerEvent {
    this.waveWrong = true;
    this.combo = 0;
    return this.event('faux', { errorType: 'confusion_liste', answerText: option.text });
  }

  /**
   * Fin de vague. `clean` : bonne carte du premier coup. `dirty` : bonne carte après une erreur
   * (journalisé « juste avec aide » : ni montée ni retour). `missed` : la bonne carte est passée.
   */
  finishWave(outcome: WaveOutcome): AnswerEvent {
    const entry = this.queue.shift()!;
    let ev: AnswerEvent;
    if (outcome === 'clean') {
      ev = this.event('juste');
      this.combo += 1;
      this.score += 10 * Math.min(this.combo, 5);
      this.removed += 1;
      (entry.failedOnce ? this.retry : this.first).push(entry.word);
    } else {
      ev = outcome === 'dirty' ? this.event('juste', { aide: true }) : this.event('sans_reponse', { errorType: 'sans_reponse' });
      this.combo = 0;
      entry.failedOnce = true;
      entry.rounds += 1;
      if (entry.rounds >= MAX_ROUNDS) {
        this.removed += 1;
        this.review.push(entry.word);
      } else {
        this.queue.splice(Math.min(2, this.queue.length), 0, entry);
      }
    }
    this.wave = null;
    return ev;
  }

  get hadWrongShot(): boolean {
    return this.waveWrong;
  }

  summary(): SessionSummary {
    return { total: this.total, first: this.first, retry: this.retry, review: this.review, score: this.score };
  }
}
