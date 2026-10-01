const KNOWN = /^(Fichier trop volumineux|Trop de feuilles|Feuille «)/;

/** Les messages de limite de l'importeur sont déjà en français ; le reste vient d'exceljs (technique, en anglais). */
export function friendlyReadError(message: string): string {
  if (KNOWN.test(message)) return message;
  return 'Ce fichier n\'est pas un classeur Excel (.xlsx) lisible. Enregistrez-le à nouveau depuis Excel.';
}
