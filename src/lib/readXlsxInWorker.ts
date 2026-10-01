import type { RawWorkbook } from '../importer/chapter';
import { MAX_FILE_BYTES } from '../importer/limits';

export const READ_TIMEOUT_MS = 15_000;

/** Contrôles rapides avant d'ouvrir le fichier ; renvoie un message ou null. */
export function checkFileBeforeRead(file: { name: string; size: number }): string | null {
  if (!/\.xlsx$/i.test(file.name)) return 'Format non pris en charge : enregistrez le fichier au format Excel .xlsx.';
  if (file.size === 0) return 'Le fichier est vide.';
  if (file.size > MAX_FILE_BYTES) return 'Fichier trop volumineux (maximum 2 Mo).';
  return null;
}

type WorkerReply = { ok: true; workbook: RawWorkbook } | { ok: false; error: string };

/**
 * Lit le classeur hors du fil principal ; le Worker est arrêté au bout de `timeoutMs`
 * (protège l'onglet contre un fichier qui prend un temps déraisonnable).
 */
export async function readXlsxInWorker(file: File, timeoutMs = READ_TIMEOUT_MS): Promise<RawWorkbook> {
  const problem = checkFileBeforeRead(file);
  if (problem) throw new Error(problem);
  const buffer = await file.arrayBuffer();

  return new Promise<RawWorkbook>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/readXlsx.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Lecture trop longue (plus de 15 secondes) : fichier refusé.'));
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      finish();
      if (e.data.ok) resolve(e.data.workbook);
      else reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Impossible de lire ce fichier Excel.'));
    };
    worker.postMessage(buffer, [buffer]);
  });
}
