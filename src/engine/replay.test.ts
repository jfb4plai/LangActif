import { describe, expect, it } from 'vitest';
import { replayEvents } from './replay';
import type { AnswerEvent } from './types';

const T0 = 1_000_000_000_000;

function ev(over: Partial<AnswerEvent>): AnswerEvent {
  return {
    id: 'e',
    studentId: 's1',
    wordId: 'w1',
    direction: 'fr_to_l',
    mode: 'taper',
    verdict: 'juste',
    errorType: null,
    aide: false,
    test: false,
    ts: T0,
    ...over,
  };
}

const serialize = (m: ReturnType<typeof replayEvents>) =>
  JSON.stringify([...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));

const journal: AnswerEvent[] = [
  ev({ id: 'a', mode: 'qcm', ts: T0 + 1000 }),
  ev({ id: 'b', mode: 'taper', ts: T0 + 2000 }),
  ev({ id: 'c', mode: 'taper', ts: T0 + 3000 }),
  ev({ id: 'd', wordId: 'w2', verdict: 'faux', ts: T0 + 2500 }),
];

describe('replayEvents', () => {
  it('reconstruit l\'état de chaque carte', () => {
    const cards = replayEvents(journal);
    expect(cards.get('w1:fr_to_l')!.box).toBe(4); // qcm: 2, taper: 3, taper: 4
    expect(cards.get('w2:fr_to_l')!.box).toBe(1);
  });

  it('donne le même état quel que soit l\'ordre d\'arrivée', () => {
    const shuffled = [journal[2], journal[3], journal[0], journal[1]];
    expect(serialize(replayEvents(shuffled))).toBe(serialize(replayEvents(journal)));
  });

  it('ignore les doublons d\'identifiant', () => {
    const doubled = [...journal, journal[1], journal[2]];
    expect(serialize(replayEvents(doubled))).toBe(serialize(replayEvents(journal)));
  });

  it('départage deux appareils par l\'horodatage', () => {
    const cards = replayEvents([
      ev({ id: 'phone', verdict: 'faux', ts: T0 + 5000 }),
      ev({ id: 'pc', mode: 'taper', ts: T0 + 1000 }),
    ]);
    expect(cards.get('w1:fr_to_l')!.box).toBe(1);
  });

  it('suit séparément chaque sens', () => {
    const cards = replayEvents([
      ev({ id: 'x', direction: 'fr_to_l' }),
      ev({ id: 'y', direction: 'l_to_fr', verdict: 'faux' }),
    ]);
    expect(cards.get('w1:fr_to_l')!.box).toBe(2);
    expect(cards.get('w1:l_to_fr')!.box).toBe(1);
  });

  it('ignore le test blanc', () => {
    const cards = replayEvents([ev({ id: 't', test: true })]);
    expect(cards.size).toBe(0);
  });
});
