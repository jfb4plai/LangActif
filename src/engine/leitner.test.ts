import { describe, expect, it } from 'vitest';
import { applyAnswer, INTERVAL_DAYS, isMastered } from './leitner';
import { DAY_MS, type AnswerEvent, type CardState } from './types';

const T0 = 1_000_000_000_000;

function ev(over: Partial<AnswerEvent> = {}): AnswerEvent {
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

function state(box: CardState['box'], over: Partial<CardState> = {}): CardState {
  return {
    key: 'w1:fr_to_l',
    wordId: 'w1',
    direction: 'fr_to_l',
    box,
    dueAt: T0,
    nbJuste: 0,
    nbPresque: 0,
    nbFaux: 0,
    nbAide: 0,
    lastAt: T0,
    ...over,
  };
}

describe('INTERVAL_DAYS', () => {
  it('suit le calendrier du spec', () => {
    expect(INTERVAL_DAYS).toEqual({ 1: 0, 2: 2, 3: 4, 4: 7, 5: 14 });
  });
});

describe('applyAnswer', () => {
  it('crée une carte et la fait monter en boîte 2 sur une première bonne réponse', () => {
    const s = applyAnswer(undefined, ev({ mode: 'qcm' }))!;
    expect(s.box).toBe(2);
    expect(s.dueAt).toBe(T0 + 2 * DAY_MS);
    expect(s.nbJuste).toBe(1);
    expect(s.key).toBe('w1:fr_to_l');
  });

  it('crée une carte en boîte 1 sur une première erreur', () => {
    const s = applyAnswer(undefined, ev({ verdict: 'faux' }))!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0);
    expect(s.nbFaux).toBe(1);
  });

  it('respecte le plafond de la reconnaissance', () => {
    const s = applyAnswer(state(3), ev({ mode: 'qcm' }))!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(T0 + 4 * DAY_MS);
  });

  it('fait monter par une production', () => {
    expect(applyAnswer(state(3), ev({ mode: 'taper' }))!.box).toBe(4);
    expect(applyAnswer(state(4), ev({ mode: 'taper' }))!.box).toBe(5);
    expect(applyAnswer(state(5), ev({ mode: 'taper' }))!.box).toBe(5);
  });

  it('plafonne la roue avec leurres à la boîte 4', () => {
    expect(applyAnswer(state(4), ev({ mode: 'roue_avec_leurres' }))!.box).toBe(4);
    expect(applyAnswer(state(3), ev({ mode: 'roue_avec_leurres' }))!.box).toBe(4);
  });

  it('ne fait jamais descendre une carte sur une bonne réponse', () => {
    expect(applyAnswer(state(5), ev({ mode: 'qcm' }))!.box).toBe(5);
  });

  it('renvoie en boîte 1 sur une erreur', () => {
    const s = applyAnswer(state(5), ev({ verdict: 'faux' }))!;
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(T0);
  });

  it('traite « sans réponse » comme une erreur', () => {
    expect(applyAnswer(state(4), ev({ verdict: 'sans_reponse' }))!.box).toBe(1);
  });

  it('laisse la boîte inchangée sur un « presque » et redemande tout de suite', () => {
    const s = applyAnswer(state(3, { dueAt: T0 - DAY_MS }), ev({ verdict: 'presque' }))!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(T0);
    expect(s.nbPresque).toBe(1);
  });

  it('ne change ni la boîte ni l\'échéance sur une réponse juste avec aide', () => {
    const before = state(3, { dueAt: T0 - 5 });
    const s = applyAnswer(before, ev({ aide: true }))!;
    expect(s.box).toBe(3);
    expect(s.dueAt).toBe(T0 - 5);
    expect(s.nbJuste).toBe(0);
    expect(s.nbAide).toBe(1);
  });

  it('ignore les réponses de test blanc', () => {
    const before = state(3);
    expect(applyAnswer(before, ev({ test: true, verdict: 'faux' }))).toBe(before);
    expect(applyAnswer(undefined, ev({ test: true }))).toBeUndefined();
  });

  it('ne modifie pas l\'état reçu', () => {
    const before = state(2);
    applyAnswer(before, ev({ mode: 'taper' }));
    expect(before.box).toBe(2);
  });
});

describe('isMastered', () => {
  it('est vrai à partir de la boîte 4', () => {
    expect(isMastered(state(3))).toBe(false);
    expect(isMastered(state(4))).toBe(true);
    expect(isMastered(state(5))).toBe(true);
    expect(isMastered(undefined)).toBe(false);
  });
});
