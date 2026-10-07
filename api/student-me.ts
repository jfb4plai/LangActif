// api/student-me.ts
// Fonction autonome : ne rien importer d'un autre fichier de api/ (voir student-list-pseudos.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }
    const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!/^[0-9a-f]{64}$/.test(token)) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceKey) {
      res.status(500).json({ error: 'Configuration serveur manquante' });
      return;
    }
    const response = await fetch(`${baseUrl}/rest/v1/rpc/lang_student_me`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Service indisponible' });
      return;
    }
    const me = (await response.json()) as { pseudo: string; langue: string } | null;
    if (!me) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    res.status(200).json({ pseudo: me.pseudo, langue: me.langue });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
