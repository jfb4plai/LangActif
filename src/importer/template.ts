import ExcelJS from 'exceljs';
import type { Langue } from '../engine/types';

const HEADERS_NL = ['fr', 'cible', 'article', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url'];
const HEADERS_EN = ['fr', 'cible', 'synonymes_fr', 'synonymes_cible', 'phrase_cible', 'phrase_fr', 'audio_url'];

// L'aide est portée par des notes de cellule : une ligne d'exemple serait importée comme un mot,
// une feuille d'aide visible serait lue comme une liste.
const COLUMN_HELP: Record<string, string> = {
  fr: 'Le mot en français, comme dans la liste du manuel. Exemple : vélo',
  cible: 'Le mot dans la langue apprise, SANS article. Exemple : fiets',
  article: 'Néerlandais seulement : de ou het. Écrire « - » si le mot n\'a pas d\'article (verbe, adjectif).',
  synonymes_fr: 'Autres traductions françaises acceptées, séparées par « ; » (jamais par une virgule). Exemple : bicyclette',
  synonymes_cible: 'Autres traductions acceptées dans la langue apprise, séparées par « ; ». En néerlandais, chaque synonyme s\'écrit AVEC son article. Exemple : het rijwiel',
  phrase_cible: 'Phrase exemple facultative dans la langue apprise. Si elle est remplie, remplir aussi phrase_fr.',
  phrase_fr: 'Traduction française de la phrase exemple. Obligatoire si phrase_cible est remplie.',
  audio_url: 'Facultatif : adresse d\'un fichier audio que vous possédez déjà. Laisser vide pour une génération automatique plus tard.',
};

const META_HELP: Record<string, string> = {
  langue: 'Ne pas modifier : en-GB (anglais) ou nl-BE (néerlandais de Belgique).',
  niveau: 'Niveau visé par le chapitre. Exemple : A1',
  titre: 'Titre du chapitre. Exemple : Chapitre 4 : Le vélo et la ville',
  numero: 'Numéro du chapitre dans le manuel. Exemple : 4',
  auteur: 'Facultatif : votre nom ou vos initiales.',
};

/** Classeur vide : feuille « Méta » et une feuille de liste, avec l'aide en notes d'en-tête. */
export async function buildTemplate(langue: Langue): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();

  const meta = wb.addWorksheet('Méta');
  const metaRows: Array<[string, string]> = [
    ['langue', langue],
    ['niveau', ''],
    ['titre', ''],
    ['numero', ''],
    ['auteur', ''],
  ];
  for (const [key, value] of metaRows) {
    const row = meta.addRow([key, value]);
    row.getCell(1).note = META_HELP[key];
    row.getCell(1).font = { bold: true };
  }
  meta.getColumn(1).width = 14;
  meta.getColumn(2).width = 44;

  const list = wb.addWorksheet('Liste 1');
  const headers = langue === 'nl-BE' ? HEADERS_NL : HEADERS_EN;
  const header = list.addRow(headers);
  headers.forEach((name, i) => {
    const cell = header.getCell(i + 1);
    cell.note = COLUMN_HELP[name];
    cell.font = { bold: true };
    list.getColumn(i + 1).width = name.startsWith('phrase') ? 38 : 18;
  });
  list.views = [{ state: 'frozen', ySplit: 1 }];

  return (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
