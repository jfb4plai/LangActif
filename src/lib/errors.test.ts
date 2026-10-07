import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('chapitre introuvable', () => {
    expect(friendlyError('JSON object requested, multiple (or no) rows returned. Cannot coerce the result to a single JSON object')).toBe(
      'Ce chapitre est introuvable (il a peut-être été supprimé).',
    );
  });
  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource', 'Load failed'])('réseau : %s', (m) => {
    expect(friendlyError(m)).toBe('Connexion impossible : vérifiez votre réseau puis réessayez.');
  });
  it('limite de tentatives, sans tenir compte de la casse', () => {
    expect(friendlyError('Email Rate Limit exceeded')).toBe('Trop de tentatives : patientez quelques minutes avant de réessayer.');
  });
  it('compte déjà existant', () => {
    expect(friendlyError('User already registered')).toBe('Un compte existe déjà avec cette adresse : connectez-vous.');
  });
  it.each([
    'Limite de 50 chapitres atteinte',
    'Limite de 100 groupes atteinte',
    'Limite de 40 places actives par groupe atteinte',
    'Nombre de listes invalide',
    'Nombre de places invalide (1 à 40)',
    'Groupe introuvable ou non autorisé',
    'Place introuvable ou non autorisée',
    "Pas d'article en anglais",
    'permission denied',
    'autre',
  ])('inchangé : %s', (m) => {
    expect(friendlyError(m)).toBe(m);
  });
});
