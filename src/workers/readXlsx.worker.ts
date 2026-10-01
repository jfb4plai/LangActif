import { readWorkbook } from '../importer/readXlsx';
import { friendlyReadError } from '../lib/readError';

// Le typage DOM déclare `self` comme Window : on restreint à ce dont le Worker a besoin.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = async (e) => {
  try {
    const workbook = await readWorkbook(e.data);
    ctx.postMessage({ ok: true, workbook });
  } catch (err) {
    ctx.postMessage({ ok: false, error: friendlyReadError(err instanceof Error ? err.message : '') });
  }
};
