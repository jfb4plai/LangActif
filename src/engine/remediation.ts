import { DAY_MS, cardKey, type AnswerEvent, type Direction, type ErrorType } from './types';

export interface RemediationOptions {
  now: number;
  windowDays?: number;
  /** Nombre d'élèves en échec qui déclenche une proposition. */
  minStudents?: number;
  /** Part des élèves ayant travaillé la carte qui déclenche une proposition. */
  minShare?: number;
  /** Garde-fou pour la voie « part » : au moins ce nombre d'élèves en échec. */
  minStudentsForShare?: number;
}

export interface RemediationProposal {
  key: string;
  wordId: string;
  direction: Direction;
  missStudents: string[];
  workedCount: number;
  share: number;
  topError: ErrorType | null;
}

/**
 * Cartes à proposer pour une remédiation (le test blanc compte).
 * Un élève est « en échec » si sa dernière réponse dans la fenêtre n'est pas `juste`.
 * Le résultat est une PROPOSITION : un humain la valide ou la modifie.
 */
export function proposeRemediation(events: AnswerEvent[], o: RemediationOptions): RemediationProposal[] {
  const windowDays = o.windowDays ?? 14;
  const minStudents = o.minStudents ?? 3;
  const minShare = o.minShare ?? 0.3;
  const minStudentsForShare = o.minStudentsForShare ?? 2;
  const since = o.now - windowDays * DAY_MS;

  const latest = new Map<string, Map<string, AnswerEvent>>();
  const errors = new Map<string, Map<ErrorType, number>>();

  for (const ev of events) {
    if (ev.ts < since || ev.ts > o.now) continue;
    const key = cardKey(ev.wordId, ev.direction);

    let perStudent = latest.get(key);
    if (!perStudent) {
      perStudent = new Map();
      latest.set(key, perStudent);
    }
    const current = perStudent.get(ev.studentId);
    if (!current || ev.ts >= current.ts) perStudent.set(ev.studentId, ev);

    if (ev.errorType) {
      let counts = errors.get(key);
      if (!counts) {
        counts = new Map();
        errors.set(key, counts);
      }
      counts.set(ev.errorType, (counts.get(ev.errorType) ?? 0) + 1);
    }
  }

  const proposals: RemediationProposal[] = [];
  for (const [key, perStudent] of latest) {
    const workedCount = perStudent.size;
    const missStudents = [...perStudent.entries()].filter(([, e]) => e.verdict !== 'juste').map(([id]) => id);
    const share = workedCount === 0 ? 0 : missStudents.length / workedCount;
    const triggered =
      missStudents.length >= minStudents || (missStudents.length >= minStudentsForShare && share >= minShare);
    if (!triggered) continue;

    let topError: ErrorType | null = null;
    let topCount = 0;
    for (const [type, count] of errors.get(key) ?? []) {
      if (count > topCount) {
        topError = type;
        topCount = count;
      }
    }
    const sample = [...perStudent.values()][0];
    proposals.push({ key, wordId: sample.wordId, direction: sample.direction, missStudents, workedCount, share, topError });
  }

  proposals.sort((a, b) => b.missStudents.length - a.missStudents.length || b.share - a.share);
  return proposals;
}
