export interface Slip {
  pseudo: string;
  code: string;
  groupCode: string;
  url: string;
}

export function studentUrl(origin: string, groupCode: string): string {
  return `${origin.replace(/\/$/, '')}/eleve?g=${encodeURIComponent(groupCode)}`;
}

export function buildSlips(origin: string, groupCode: string, seats: Array<{ pseudo: string; code: string }>): Slip[] {
  const url = studentUrl(origin, groupCode);
  return seats.map((s) => ({ pseudo: s.pseudo, code: s.code, groupCode, url }));
}

/** Code de groupe lu dans `?g=` ; chaîne vide si absent ou invalide (jamais d'injection dans la page). */
export function groupCodeFromSearch(search: string): string {
  const raw = new URLSearchParams(search).get('g') ?? '';
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,10}$/.test(code) ? code : '';
}

export function isStudentRoute(pathname: string): boolean {
  return /^\/eleve(\/|$)/.test(pathname);
}
