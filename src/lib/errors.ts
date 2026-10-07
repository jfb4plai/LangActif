/** Traduit les messages techniques courants en français ; les autres passent tels quels. */
const RULES: Array<{ match: string[]; text: string }> = [
  { match: ['cannot coerce the result to a single json object'], text: 'Ce chapitre est introuvable (il a peut-être été supprimé).' },
  { match: ['failed to fetch', 'networkerror', 'load failed'], text: 'Connexion impossible : vérifiez votre réseau puis réessayez.' },
  { match: ['rate limit'], text: 'Trop de tentatives : patientez quelques minutes avant de réessayer.' },
  { match: ['user already registered'], text: 'Un compte existe déjà avec cette adresse : connectez-vous.' },
];

export function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  // messages de nos fonctions SQL : déjà en français, conservés tels quels
  const FRENCH_SQL_MESSAGES = [
    'Limite de',
    'Nombre de listes invalide',
    'Nombre de places invalide',
    "Pas d'article en anglais",
    'introuvable ou non autoris',
    'Groupe archivé',
  ];
  if (FRENCH_SQL_MESSAGES.some((m) => message.includes(m))) {
    return message;
  }
  return RULES.find((r) => r.match.some((m) => lower.includes(m)))?.text ?? message;
}
