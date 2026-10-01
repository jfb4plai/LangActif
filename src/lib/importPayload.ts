import type { Article } from '../engine/types';
import type { ParsedChapter } from '../importer/chapter';

export interface ImportWordPayload {
  fr: string;
  cible: string;
  article: Article | null;
  synonymes_fr: string[];
  synonymes_cible: string[];
  phrase_cible: string | null;
  phrase_fr: string | null;
  audio_url: string | null;
}

export interface ImportListPayload {
  nom: string;
  words: ImportWordPayload[];
}

export interface ImportPayload {
  langue: string;
  niveau: string;
  titre: string;
  numero: string;
  auteur: string | null;
  lists: ImportListPayload[];
}

/** Charge utile lue par la fonction SQL `lang_import_chapter`. */
export function toImportPayload(chapter: ParsedChapter): ImportPayload {
  return {
    langue: chapter.langue,
    niveau: chapter.niveau,
    titre: chapter.titre,
    numero: chapter.numero,
    auteur: chapter.auteur,
    lists: chapter.lists.map((list) => ({
      nom: list.name,
      words: list.words.map((w) => ({
        fr: w.fr,
        cible: w.cible,
        article: w.article,
        synonymes_fr: w.synonymesFr,
        synonymes_cible: w.synonymesCible,
        phrase_cible: w.phraseCible,
        phrase_fr: w.phraseFr,
        audio_url: w.audioUrl,
      })),
    })),
  };
}
