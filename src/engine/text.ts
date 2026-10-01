/** Espaces normalisés, forme Unicode composée. */
export function clean(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/** Clé de comparaison floue : sans accents, sans casse, espaces normalisés. */
export function foldKey(s: string): string {
  return stripAccents(clean(s)).toLowerCase();
}

/** Distance de Damerau-Levenshtein (variante « optimal string alignment »). */
export function damerau(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/** Nombre de fautes tolérées pour un verdict « presque », selon la longueur. */
export function maxTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 8) return 1;
  return 2;
}
