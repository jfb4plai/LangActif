// api/student-list-pseudos.ts
// Fonction autonome : ne rien importer d'un autre fichier de api/ (plantages Vercel documentés
// dans lexiactif/api/play-list.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }
    const raw = typeof req.query.g === 'string' ? req.query.g.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{1,10}$/.test(raw)) {
      res.status(400).json({ error: 'Code de groupe invalide' });
      return;
    }
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceKey) {
      res.status(500).json({ error: 'Configuration serveur manquante' });
      return;
    }
    const response = await fetch(`${baseUrl}/rest/v1/rpc/lang_group_pseudos`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_group_code: raw }),
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Service indisponible' });
      return;
    }
    const pseudos = (await response.json()) as string[];
    if (!Array.isArray(pseudos) || pseudos.length === 0) {
      res.status(404).json({ error: 'Groupe introuvable' });
      return;
    }
    res.status(200).json({ pseudos });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
