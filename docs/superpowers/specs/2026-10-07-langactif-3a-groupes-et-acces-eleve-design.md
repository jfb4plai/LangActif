# LangActif, plan 3a : groupes et accès élève (spec)

Date : 2026-10-07. Statut : conçu avec JF, à relire avant le plan d'implémentation.
Rattachement : sous-plan 3a du plan 3 (spec principal : `2026-10-01-langactif-design.md`, §7, §8, §9, §10, §13). Plan 3 découpé en 3a (ce document), 3b (séance, journal, Leitner persistant), 3c (hors ligne, synchronisation), 3d (tableau de bord minimal).

## 1. Objectif

Permettre à un enseignant ou remédiateur de créer un groupe, de distribuer à chaque élève un pseudo et un code personnel, et à l'élève de se connecter depuis son appareil, sans compte, sans nom, sans e-mail. Le 3a livre l'identité et la connexion ; le jeu arrive au 3b.

Public : élèves du fondamental et du secondaire en remédiation (groupes de 5 à 10 élèves, parfois jusqu'à une classe). Un pseudo doit être acceptable dans les deux niveaux.

## 2. Décisions validées avec JF (2026-10-06 et 2026-10-07)

| # | Sujet | Décision |
|---|---|---|
| 1 | Accès élève | Fonctions `/api/*` avec jeton élève ; seul le serveur écrit, avec la clé de service. Pas de compte Supabase élève ni de session anonyme. |
| 2 | Code personnel | 1 lettre + 3 chiffres, unique dans le groupe, généré par le serveur, alphabet sans caractères confondables. |
| 3 | Connexion | Code de groupe + pseudo choisi dans la liste + code. Jamais le code seul. |
| 4 | Blocage | 5 échecs sur un pseudo, blocage 15 minutes ou déblocage par l'enseignant. |
| 5 | Pseudos | Un mot neutre tiré de quatre familles : rivières de Belgique, arbres, roches et minéraux, astres et vents. Une centaine de mots, unique dans le groupe, numéro ajouté si la liste est épuisée. Pas de texte libre. |
| 6 | Création des places | L'enseignant génère à l'avance les places et imprime une fiche (option B). Pas d'inscription libre. |
| 7 | Périmètre d'une identité | Une identité par groupe (option A). Un élève présent dans deux groupes a deux pseudos et deux progressions séparées. |
| 8 | Durée de session | 12 mois glissants, renouvelés à chaque utilisation. Case « Appareil partagé » : jeton de 12 heures. |
| 9 | Carnet nom et pseudo | Hors de l'app. Pas de champ « note » libre par place. |

## 3. Données

Trois tables, préfixées `lang_` (vérifié : seules `lang_chapters`, `lang_lists`, `lang_words` existent). Projet Supabase partagé `dfoaumjleqtxjeaplnna`. RLS activée sur chacune ; grants explicites dans la même migration.

### `lang_groups`
`id` uuid, `owner_id` (auth.uid() de l'enseignant), `nom` (200 car. max), `langue` (`nl-BE` ou `en-GB`), `code` (code de groupe court, unique, lisible à voix haute), `archived_at`, `created_at`.

### `lang_students` (une place)
`id`, `group_id`, `pseudo` (unique dans le groupe), `code_hash` (haché ; le code en clair n'est jamais stocké), `failed_attempts`, `locked_until`, `last_seen_at`, `archived_at`, `created_at`. Aucun nom, aucun e-mail.

### `lang_student_sessions`
`id`, `student_id`, `token_hash` (empreinte du jeton, jamais le jeton), `expires_at`, `shared_device` (booléen), `created_at`, `last_used_at`, `revoked_at`.

### Politiques RLS
- Enseignant : lecture et écriture de ses groupes, et des places et sessions rattachées, via `auth.uid() = owner_id`. Toute vérification qui joint plusieurs tables passe par une fonction `security definer` (pas de politique auto-référentielle, voir l'incident AménagActif du 2026-09-23).
- `anon` : aucun accès. Les élèves n'ont aucun accès direct : tout passe par les fonctions serveur.
- Script de vérification RLS dans `supabase/tests/`, sur le modèle de `rls_lang_content.sql`. Une copie `*.local.sql` est ignorée par git.

## 4. Génération des pseudos et des codes

- Pseudos : liste fixe de ~100 mots dans le code serveur, relue par JF avant implémentation. Exclusion des mots difficiles à prononcer, moqueurs, ou à homophone gênant.
- Code : une lettre dans un alphabet réduit (~20 lettres, sans b, d, p, q, i, l, o ; soit 19 lettres) suivie de trois chiffres de 2 à 9. Environ 10 000 combinaisons ; unicité vérifiée à l'intérieur du groupe.
- Les deux sont tirés avec une source aléatoire cryptographique, côté serveur.
- Le code est haché avec un sel propre à la place ; la comparaison se fait à temps constant.

## 5. Parcours enseignant

Nouvel onglet « Mes groupes » à côté de « Mes chapitres ».

**Créer un groupe** : nom (placeholder « Remédiation néerlandais, 2e S, lundi 12 h » ; aide : visible par vous seul, aucun nom d'élève), langue (aide : détermine les chapitres assignables), nombre de places (1 à 40 ; placeholder « 8 » ; aide : une place = un pseudo et un code, on peut en ajouter sans changer les codes existants).

**Fiche imprimable**, générée une seule fois : une bande détachable par élève (adresse de l'app, code de groupe, pseudo, code élève, QR vers la page de connexion avec le groupe prérempli, ligne vide pour écrire le nom au crayon). Arial 12, noir et blanc possible, A4 découpable. Un avertissement précède le bouton Imprimer : les codes ne seront plus affichés.

**Vue d'un groupe** : tableau pseudo, état (jamais connecté, actif, bloqué, archivé), dernière activité. Aucun code affiché. Actions par place : nouveau code (révoque tous les appareils de l'élève, bande unique à imprimer), débloquer, archiver, supprimer définitivement (avec confirmation). Actions sur le groupe : ajouter des places, régénérer toutes les fiches (avec avertissement), archiver, supprimer (avec confirmation).

**Hors 3a** : assignation de chapitres, remédiateur invité, tableau de bord, bibliothèque partagée.

## 6. Parcours élève

1. **Connexion** : code de groupe (prérempli si QR), pseudo choisi dans la liste, code. Case « Appareil partagé » décochée par défaut. Chaque champ avec label, exemple, aide.
2. **Accueil minimal** : « Bonjour, [pseudo] », bouton « Se déconnecter », message « Ton enseignant n'a pas encore assigné de travail ».
3. **Erreurs** : message neutre « Pseudo ou code incorrect » (ne révèle pas lequel est faux) ; blocage : « Trop d'essais. Demande à ton enseignant ou réessaie dans 15 minutes ».
4. Style élève B (tuiles, fond clair), Arial 16 px minimum, grandes cibles tactiles, jamais la couleur seule.

## 7. Fonctions serveur

Chacune est un fichier `api/*.ts` autonome (aucun import entre fichiers d'`api/`).

| Fonction | Appelant | Rôle |
|---|---|---|
| `student-login` | élève | Vérifie groupe, pseudo, code. Blocage, délai constant, limite de débit par IP. Émet le jeton. |
| `student-me` | élève | Valide le jeton, renvoie pseudo et groupe, renouvelle l'expiration glissante. |
| `student-logout` | élève | Révoque le jeton de l'appareil. |
| `student-list-pseudos` | élève (avant connexion) | Pseudos d'un groupe, sans code ni état. |
| `group-create`, `group-add-seats` | enseignant | Création, ajout de places, génération des codes. |
| `seat-reset-code`, `seat-unlock` | enseignant | Nouveau code (révocation des sessions), déblocage. |
| `seat-delete`, `group-delete` | enseignant | Suppression définitive, y compris dans les futures données du journal. |

L'enseignant s'authentifie avec son jeton Supabase habituel, vérifié côté serveur. L'élève s'authentifie avec son jeton élève.

## 8. RGPD (marque de fabrique PLAI : à traiter dans le plan, pas après)

### 8.1 Ce que le 3a met en oeuvre
- **Minimisation** : aucun nom, aucun e-mail, aucune date de naissance, aucune adresse IP stockée en base (l'IP ne sert qu'à la limite de débit, en mémoire).
- **Pseudonymisation par construction** : le pseudo est attribué par l'enseignant ; la correspondance avec l'identité réelle n'existe que dans son carnet, hors de l'app.
- **Limitation de la conservation** : session glissante de 12 mois ; groupe archivé = jetons révoqués ; durée du journal fixée au 3b (90 jours proposés au spec principal).
- **Droit à l'effacement** : suppression d'une place ou d'un groupe en un clic, avec effacement en cascade (sessions, et, dès le 3b, journal et progression). Test automatisé qui vérifie qu'il ne reste aucune ligne liée.
- **Sécurité** : codes hachés, jetons stockés sous forme d'empreinte, clé de service côté serveur seulement, aucun `console.log` d'identifiant, de code ou de pseudo.
- **Transparence** : page d'information à l'élève et à sa famille, en langage simple (FALC), accessible depuis l'écran de connexion : quelles données, pourquoi, qui les voit, combien de temps, comment les faire effacer.

### 8.2 Point de vigilance
Un pseudonyme reste une donnée à caractère personnel au sens du RGPD tant que l'enseignant peut ré-identifier l'élève avec son carnet. Le dispositif réduit fortement le risque (pas de nom dans l'app), mais ne rend pas les données anonymes. À présenter ainsi aux écoles, sans l'appeler « anonyme ».

### 8.3 À confirmer avec les écoles et la FWB, hors périmètre de ce spec
Base légale et responsable de traitement (l'école, le pôle territorial, ou LangActif), désignation éventuelle d'un DPO, modèle d'information aux familles, hébergement (région du projet Supabase partagé, sous-traitants Supabase et Vercel, transferts hors UE), registre des traitements, durée de conservation définitive, mention d'un éventuel consentement parental pour les mineurs. Ces points ne sont pas traités juridiquement ici et ne doivent pas être affirmés dans l'app avant validation.

## 9. Tests (écrits avant le code des parties critiques)

- Génération : unicité des pseudos et des codes dans un groupe, alphabet sans caractères confondables, extension d'un groupe sans modifier les codes existants.
- Connexion : succès, mauvais code, mauvais pseudo (même message), blocage après 5 échecs, déblocage, délai constant.
- Sessions : expiration glissante de 12 mois, jeton de 12 heures pour appareil partagé, révocation par nouveau code, révocation à l'archivage du groupe, déconnexion.
- RLS : un enseignant ne voit ni ne modifie les groupes d'un autre ; `anon` n'a aucun accès ; script exécuté sur la base partagée avant déploiement.
- Effacement : suppression d'une place et d'un groupe ne laisse aucune ligne liée.
- Parcours en navigateur sur GSM réel : création de groupe, impression, scan du QR, connexion, déconnexion, reconnexion, appareil partagé.
- Accessibilité : contraste, taille de police, navigation au clavier, lecture sans la couleur seule.

## 10. Hors périmètre et risques

- Assignations, séance, journal, Leitner persistant : 3b. Hors ligne : 3c. Tableau de bord : 3d.
- Un élève dans deux groupes a deux identités (décision 7) : à expliquer à l'enseignant dans l'aide de la page de création.
- Une fiche perdue avant distribution impose de régénérer les codes de la place concernée.
- Le jeton est conservé dans le stockage du navigateur : exposé à une faille XSS. Atténuation : aucun HTML saisi par un utilisateur n'est affiché dans l'app, et le jeton est révocable.
- Les messages « Appareil partagé » reposent sur l'attention de l'élève : une salle de remédiation avec tablettes de l'école devrait être documentée dans le mode d'emploi enseignant.
- Ordre de grandeur de ~10 000 codes par groupe : suffisant pour un groupe de 40 places avec blocage par pseudo.

## 11. Références RISS

Aucune référence scientifique n'est citée dans ce spec. Toute mention ultérieure dans l'app doit être vérifiée dans RISS avant publication.
