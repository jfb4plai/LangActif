import type { ImportIssue } from '../importer/chapter';

/** « Feuille « Liste 4.1 », ligne 3, colonne « article » : message » */
export function formatIssue(issue: ImportIssue): string {
  let where = `Feuille « ${issue.sheet} »`;
  if (issue.row !== null) where += `, ligne ${issue.row}`;
  if (issue.column !== null) where += `, colonne « ${issue.column} »`;
  return `${where} : ${issue.message}`;
}
