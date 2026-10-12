import { describe, expect, it } from 'vitest';
import { applyAnswer, replayEvents, type Word } from '../engine';
import { ArcadeSession, answerText, promptText } from './session';

function word(id: string, fr: string, cible: string, article: Word['article'] = null, synonymesFr: string[] = []): Word {
  return { id, fr, cible, article, synonymesFr, synonymesCible: [] };
}

const WORDS: Word[] = [
  word('w1', 'le vélo', 'fiets', 'de'),
  word('w2', 'le cartable', 'boekentas', 'de'),
  word('w3', 'le cahier', 'schrift', 'het'),
  word('w4', 'la gomme', 'gom', 'de'),
  word('w5', 'la règle', 'liniaal', 'de'),
];

let n = 0;
function make(count = 5, over: Partial<ConstructorParameters<typeof ArcadeSession>[0]> = {}) {
  let t = 1_000;
  return new ArcadeSession({
    words: WORDS,
    direction: 'fr_to_l',
    count,
    studentId: 'essai',
    now: () => (t += 10),
    rng: () => 0.5,
    newId: () => `e${++n}`,
    ...over,
  });
}

describe('textes affichés', () => {
  it('ajoute l\'article en néerlandais vers la langue cible', () => {
    expect(answerText(WORDS[0], 'fr_to_l')).toBe('de fiets');
    expect(promptText(WORDS[0], 'fr_to_l')).toBe('le vélo');
  });
  it('sens inverse : la consigne est le mot cible', () => {
    expect(answerText(WORDS[0], 'l_to_fr')).toBe('le vélo');
    expect(promptText(WORDS[0], 'l_to_fr')).toBe('de fiets');
  });
});

describe('vague', () => {
  it('3 cartes dont une seule correcte', () => {
    const s = make();
    const w = s.nextWave()!;
    expect(w.options).toHaveLength(3);
    expect(w.options.filter((o) => o.correct)).toHaveLength(1);
    expect(w.options.find((o) => o.correct)!.text).toBe(answerText(w.word, 'fr_to_l'));
  });
  it('un distracteur n\'est jamais une forme acceptée du mot cible (synonyme)', () => {
    const words = [word('a', 'la voiture', 'auto', 'de'), word('b', 'l\'auto', 'auto', 'de'), word('c', 'la gomme', 'gom', 'de'), word('d', 'la règle', 'liniaal', 'de')];
    const s = new ArcadeSession({ words, direction: 'fr_to_l', count: 4, studentId: 'x', rng: () => 0.1, newId: () => 'i' });
    for (let i = 0; i < 4; i++) {
      const w = s.nextWave()!;
      const texts = w.options.map((o) => o.text);
      expect(new Set(texts).size).toBe(texts.length);
      s.finishWave('clean');
    }
  });
});

describe('séance', () => {
  it('toutes les cartes réussies du premier coup', () => {
    const s = make(3);
    const events = [];
    while (s.nextWave()) events.push(s.finishWave('clean'));
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.verdict === 'juste' && e.mode === 'arcade_tir' && !e.aide)).toBe(true);
    expect(s.summary().first).toHaveLength(3);
    expect(s.score).toBe(10 + 20 + 30);
  });

  it('le score ne dépend pas de la vitesse et la série plafonne à x5', () => {
    const s = make(5);
    while (s.nextWave()) s.finishWave('clean');
    expect(s.score).toBe(10 + 20 + 30 + 40 + 50);
  });

  it('une erreur est journalisée « faux » puis la réussite « juste avec aide », et le mot revient', () => {
    const s = make(3);
    const w = s.nextWave()!;
    const bad = w.options.find((o) => !o.correct)!;
    const e1 = s.wrongShot(bad);
    expect(e1).toMatchObject({ verdict: 'faux', errorType: 'confusion_liste', answerText: bad.text });
    expect(s.hadWrongShot).toBe(true);
    const e2 = s.finishWave('dirty');
    expect(e2).toMatchObject({ verdict: 'juste', aide: true });
    expect(s.removed).toBe(0);
    // la carte revient dans la file
    let seen = 0;
    while (s.nextWave()) {
      if (s.currentWave!.word.id === w.word.id) seen++;
      s.finishWave('clean');
    }
    expect(seen).toBe(1);
    expect(s.summary().retry.map((x) => x.id)).toContain(w.word.id);
  });

  it('un mot manqué deux fois part dans « à retravailler »', () => {
    const s = make(3);
    const first = s.nextWave()!.word.id;
    expect(s.finishWave('missed')).toMatchObject({ verdict: 'sans_reponse', errorType: 'sans_reponse' });
    while (s.nextWave()) {
      s.finishWave(s.currentWave!.word.id === first ? 'missed' : 'clean');
    }
    expect(s.summary().review.map((x) => x.id)).toEqual([first]);
  });

  it('la série retombe à 0 après une erreur', () => {
    const s = make(5);
    s.nextWave();
    s.finishWave('clean');
    s.nextWave();
    s.finishWave('clean');
    expect(s.combo).toBe(2);
    const w = s.nextWave()!;
    s.wrongShot(w.options.find((o) => !o.correct)!);
    expect(s.combo).toBe(0);
  });

  it('le nombre de cartes est borné par la config et par la taille de la liste', () => {
    expect(make(3).total).toBe(3);
    expect(make(50).total).toBe(5);
  });
});

describe('compatibilité avec le moteur Leitner', () => {
  it('une réussite en arcade ne dépasse jamais la boîte 3', () => {
    const events = [];
    let state;
    for (let i = 0; i < 6; i++) {
      const s = make(1, { words: WORDS.slice(0, 3), rng: () => 0.2 });
      const w = s.nextWave()!;
      const ev = s.finishWave('clean');
      events.push({ ...ev, wordId: 'w1', id: `x${i}`, ts: 1_000 + i });
      state = applyAnswer(state, events[events.length - 1]);
      void w;
    }
    expect(state!.box).toBe(3);
  });

  it('« juste avec aide » ne fait ni monter ni descendre', () => {
    const s = make(3);
    const w = s.nextWave()!;
    s.wrongShot(w.options.find((o) => !o.correct)!);
    const dirty = s.finishWave('dirty');
    const states = replayEvents([{ ...dirty, wordId: 'w1', ts: 5 }]);
    expect(states.get('w1:fr_to_l')!.box).toBe(1);
    expect(states.get('w1:fr_to_l')!.nbAide).toBe(1);
  });
});
