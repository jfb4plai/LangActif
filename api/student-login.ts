// api/student-login.ts
// Fonction autonome : ne rien importer d'un autre fichier de api/ (voir student-list-pseudos.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Limite par IP « au mieux » : mémoire d'une seule instance serverless. La protection réelle
// est le blocage par pseudo en base (5 échecs, 15 minutes).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 30;
const attempts = new Map<string, number[]>();

function tooMany(ip: string, now = Date.now()): boolean {
  if (attempts.size > 5000) attempts.clear();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > MAX_ATTEMPTS;
}

interface LoginReply {
  ok: boolean;
  token?: string;
  pseudo?: string;
  langue?: string;
  reason?: string;
  retry_after_seconds?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (tooMany(first || 'inconnue')) {
      res.status(429).json({ ok: false, reason: 'trop_de_tentatives' });
      return;
    }

    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const groupe = typeof body.groupe === 'string' ? body.groupe.trim().toUpperCase() : '';
    const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!groupe || groupe.length > 10 || !pseudo || pseudo.length > 40 || !code || code.length > 10) {
      res.status(400).json({ ok: false, reason: 'invalide' });
      return;
    }

    const baseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceKey) {
      res.status(500).json({ error: 'Configuration serveur manquante' });
      return;
    }
    const response = await fetch(`${baseUrl}/rest/v1/rpc/lang_student_login`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_group_code: groupe, p_pseudo: pseudo, p_code: code, p_shared: body.appareilPartage === true }),
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Service indisponible' });
      return;
    }
    const result = (await response.json()) as LoginReply;
    if (!result.ok) {
      res.status(result.reason === 'bloque' ? 423 : 401).json(result);
      return;
    }
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
