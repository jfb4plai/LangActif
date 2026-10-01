import { describe, expect, it } from 'vitest';
import { friendlyReadError } from './readError';

describe('friendlyReadError', () => {
  it('garde les messages de limite de l\'importeur', () => {
    expect(friendlyReadError('Fichier trop volumineux (maximum 2 Mo)')).toBe('Fichier trop volumineux (maximum 2 Mo)');
    expect(friendlyReadError('Trop de feuilles (maximum 40)')).toBe('Trop de feuilles (maximum 40)');
    expect(friendlyReadError('Feuille « Liste 1 » : plus de 1000 lignes')).toBe('Feuille « Liste 1 » : plus de 1000 lignes');
  });
  it('remplace une erreur technique par un message clair', () => {
    expect(friendlyReadError("Can't find end of central directory : is this a zip file ?"))
      .toBe('Ce fichier n\'est pas un classeur Excel (.xlsx) lisible. Enregistrez-le à nouveau depuis Excel.');
  });
});
