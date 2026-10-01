import { describe, expect, it } from 'vitest';
import type { ParsedChapter } from '../importer/chapter';
import { toImportPayload } from './importPayload';

const chapter: ParsedChapter = {
  langue: 'nl-BE',
  niveau: 'A1',
  titre: 'Chapitre 4 : Le vélo et la ville',
  numero: '4',
  auteur: null,
  lists: [
    {
      name: 'Liste 4.1',
      words: [
        {
          fr: 'vélo',
          cible: 'fiets',
          article: 'de',
          synonymesFr: ['bicyclette'],
          synonymesCible: ['het rijwiel'],
          phraseCible: 'Ik ga met de fiets naar school.',
          phraseFr: 'Je vais à l\'école à vélo.',
          audioUrl: null,
        },
        { fr: 'courir', cible: 'lopen', article: null, synonymesFr: [], synonymesCible: [], phraseCible: null, phraseFr: null, audioUrl: 'https://exemple.be/lopen.mp3' },
      ],
    },
    { name: 'Liste 4.2', words: [] },
  ],
};

describe('toImportPayload', () => {
  it('met les champs en snake_case, comme la fonction SQL les lit', () => {
    const p = toImportPayload(chapter);
    expect(p).toMatchObject({ langue: 'nl-BE', niveau: 'A1', titre: 'Chapitre 4 : Le vélo et la ville', numero: '4', auteur: null });
    expect(p.lists[0].words[0]).toEqual({
      fr: 'vélo',
      cible: 'fiets',
      article: 'de',
      synonymes_fr: ['bicyclette'],
      synonymes_cible: ['het rijwiel'],
      phrase_cible: 'Ik ga met de fiets naar school.',
      phrase_fr: 'Je vais à l\'école à vélo.',
      audio_url: null,
    });
  });

  it('conserve l\'ordre des listes et des mots, les nulls et l\'audio fourni', () => {
    const p = toImportPayload(chapter);
    expect(p.lists.map((l) => l.nom)).toEqual(['Liste 4.1', 'Liste 4.2']);
    expect(p.lists[0].words.map((w) => w.cible)).toEqual(['fiets', 'lopen']);
    expect(p.lists[0].words[1].article).toBeNull();
    expect(p.lists[0].words[1].audio_url).toBe('https://exemple.be/lopen.mp3');
  });
});
