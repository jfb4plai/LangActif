import { describe, expect, it } from 'vitest';
import { proposeRemediation } from './remediation';
import { DAY_MS, type AnswerEvent } from './types';

const NOW = 100 * DAY_MS;
let n = 0;

function ev(studentId: string, over: Partial<AnswerEvent> = {}): AnswerEvent {
  n += 1;
  return {
    id: `e${n}`,
    studentId,
    wordId: 'w1',
    direction: 'fr_to_l',
    mode: 'taper',
    verdict: 'faux',
    errorType: 'orthographe_proche',
    aide: false,
    test: false,
    ts: NOW - DAY_MS,
    ...over,
  };
}

const ok = (studentId: string, over: Partial<AnswerEvent> = {}) =>
  ev(studentId, { verdict: 'juste', errorType: null, ...over });

describe('proposeRemediation', () => {
  it('propose une carte ratée par 3 élèves', () => {
    const out = proposeRemediation([ev('a'), ev('b'), ev('c')], { now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('w1:fr_to_l');
    expect(out[0].missStudents.sort()).toEqual(['a', 'b', 'c']);
    expect(out[0].topError).toBe('orthographe_proche');
  });

  it('ne propose pas 2 échecs sur 10 élèves (20 %)', () => {
    const events = [ev('s1'), ev('s2'), ...['s3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'].map((s) => ok(s))];
    expect(proposeRemediation(events, { now: NOW })).toEqual([]);
  });

  it('propose 2 échecs sur 5 élèves (40 %)', () => {
    const events = [ev('s1'), ev('s2'), ok('s3'), ok('s4'), ok('s5')];
    expect(proposeRemediation(events, { now: NOW })).toHaveLength(1);
  });

  it('ne propose pas 1 échec sur 2 élèves (garde-fou)', () => {
    expect(proposeRemediation([ev('s1'), ok('s2')], { now: NOW })).toEqual([]);
  });

  it('compte la dernière réponse de l\'élève : un élève qui a réussi ensuite n\'est plus en échec', () => {
    // 10 élèves ont travaillé la carte ; c a échoué puis réussi.
    // Si l'échec ancien de c comptait, il y aurait 3 élèves en échec et une proposition.
    const events = [
      ev('a'),
      ev('b'),
      ev('c', { ts: NOW - 3 * DAY_MS }),
      ok('c', { ts: NOW - DAY_MS }),
      ...['s1', 's2', 's3', 's4', 's5', 's6', 's7'].map((s) => ok(s)),
    ];
    expect(proposeRemediation(events, { now: NOW })).toEqual([]);
  });

  it('ignore ce qui est hors de la fenêtre de 14 jours', () => {
    const old = NOW - 20 * DAY_MS;
    expect(proposeRemediation([ev('a', { ts: old }), ev('b', { ts: old }), ev('c', { ts: old })], { now: NOW })).toEqual([]);
  });

  it('prend en compte le test blanc', () => {
    const events = [ev('a', { test: true }), ev('b', { test: true }), ev('c', { test: true })];
    expect(proposeRemediation(events, { now: NOW })).toHaveLength(1);
  });

  it('sépare les deux sens et trie par nombre d\'élèves en échec', () => {
    const events = [
      ev('a'), ev('b'), ev('c'),
      ev('a', { wordId: 'w2', direction: 'l_to_fr' }),
      ev('b', { wordId: 'w2', direction: 'l_to_fr' }),
      ev('c', { wordId: 'w2', direction: 'l_to_fr' }),
      ev('d', { wordId: 'w2', direction: 'l_to_fr' }),
    ];
    const out = proposeRemediation(events, { now: NOW });
    expect(out.map((p) => p.key)).toEqual(['w2:l_to_fr', 'w1:fr_to_l']);
  });
});
