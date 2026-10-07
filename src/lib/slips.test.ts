import { describe, expect, it } from 'vitest';
import { buildSlips, groupCodeFromSearch, isStudentRoute, studentUrl } from './slips';

describe('studentUrl', () => {
  it('construit l\'adresse de connexion du groupe', () => {
    expect(studentUrl('https://langactif.jfb4plai.com', 'K7M4X')).toBe('https://langactif.jfb4plai.com/eleve?g=K7M4X');
  });
  it('ignore la barre finale de l\'origine', () => {
    expect(studentUrl('http://localhost:3000/', 'K7M4X')).toBe('http://localhost:3000/eleve?g=K7M4X');
  });
});

describe('buildSlips', () => {
  it('une bande par place, avec adresse et code de groupe', () => {
    const slips = buildSlips('http://localhost:3000', 'K7M4X', [{ pseudo: 'Meuse', code: 'K472' }, { pseudo: 'Orion', code: 'M829' }]);
    expect(slips).toEqual([
      { pseudo: 'Meuse', code: 'K472', groupCode: 'K7M4X', url: 'http://localhost:3000/eleve?g=K7M4X' },
      { pseudo: 'Orion', code: 'M829', groupCode: 'K7M4X', url: 'http://localhost:3000/eleve?g=K7M4X' },
    ]);
  });
});

describe('groupCodeFromSearch', () => {
  it('lit et normalise ?g=', () => {
    expect(groupCodeFromSearch('?g=k7m4x')).toBe('K7M4X');
  });
  it('rejette ce qui n\'est pas un code plausible', () => {
    expect(groupCodeFromSearch('?g=<script>')).toBe('');
    expect(groupCodeFromSearch('?g=ABCDEFGHIJKLMN')).toBe('');
    expect(groupCodeFromSearch('')).toBe('');
  });
});

describe('isStudentRoute', () => {
  it.each([['/eleve', true], ['/eleve/', true], ['/eleve/x', true], ['/eleves', false], ['/', false], ['/chapitres', false]])(
    '%s',
    (path, expected) => {
      expect(isStudentRoute(path)).toBe(expected);
    },
  );
});
