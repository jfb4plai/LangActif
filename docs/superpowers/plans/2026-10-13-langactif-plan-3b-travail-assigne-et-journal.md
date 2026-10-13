# LangActif, plan 3b : travail assigné, mode arcade pour l'élève et journal des réponses

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un enseignant assigne un chapitre (ou une liste) à un groupe ; l'élève connecté voit ce travail, joue en mode arcade Atari, et chaque réponse est enregistrée dans un journal qui alimente son état Leitner (cartes dues d'abord) ; l'enseignant peut essayer le travail « comme un élève » sans rien enregistrer.

**Architecture:** Deux tables `lang_*` (`lang_assignments`, `lang_answers`). L'enseignant crée les assignations par RPC SQL `security definer` (même modèle que les groupes du 3a). L'élève ne parle qu'à deux nouvelles fonctions Vercel minces et autonomes (`api/student-work.ts`, `api/student-answers.ts`) qui appellent des fonctions SQL exécutables par `service_role` seul. L'état Leitner n'est pas stocké : il est recalculé dans le navigateur par `replayEvents` (déjà écrit et testé) à partir des 90 derniers jours de journal. Les réponses passent par une file locale (`localStorage`) vidée par lots de 50, avec identifiants client : un envoi répété ne crée aucun doublon.

**Tech Stack:** React 18, Vite 5, Supabase v2 (PostgreSQL, RLS, pgcrypto), Vercel Functions (`@vercel/node`), Vitest 2, PGlite (`npm run test:sql`).

**Spec:** `docs/superpowers/specs/2026-10-01-langactif-design.md` (§5 moteur, §6.2 arcade, §7 parcours élève, §8 espace enseignant, §10 RGPD, §12 hors ligne) et `docs/superpowers/specs/2026-10-07-langactif-3a-groupes-et-acces-eleve-design.md` (§7 fonctions serveur, §8 RGPD). Les décisions propres au 3b sont dans la section « Décisions » ci-dessous (pas de spec séparé). Code existant réutilisé : `src/engine/*` (Leitner, `replayEvents`, `pickSessionCards`, `expandCards`), `src/arcade/*` (jeu Atari, commit 5420843).

## Global Constraints

- Tables Supabase préfixées `lang_` ; projet partagé `dfoaumjleqtxjeaplnna` ; RLS sur toutes les tables ; `GRANT` explicites dans la même migration ; fonction `security definer` pour toute vérification de propriété (jamais d'`EXISTS` auto-joint dans une politique).
- Les fonctions `api/*.ts` sont **autonomes** : aucun import d'un autre fichier de `api/`, et aucun import de `src/`.
- Clé `SUPABASE_SERVICE_ROLE_KEY` côté serveur seulement ; aucun `console.log` d'identifiant, de pseudo, de code, de jeton ni de réponse.
- Interface élève : Arial (texte des cartes et des consignes), 16 px minimum, jamais la couleur seule (icône et texte aussi), cibles tactiles d'au moins 44 px, exemples et vocabulaire scolaire de la FWB (pas de « collège/lycée »).
- Jamais de classement ; aucun point pour la vitesse ; pas de vies ; une erreur n'interrompt pas la séance.
- Mots lus **uniquement** via `audio_url` en `https://` ; jamais la voix du navigateur.
- Guidage contextuel sur chaque champ de formulaire : label précis, placeholder concret, aide sous le champ.
- Convention de commit : message en français, puis une ligne vide, puis `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branche de travail : `feat/plan-3b-travail-assigne-et-journal`, créée depuis `main`. Ne rien pousser sans accord de JF. `npx vite build` et `npm test` doivent passer avant tout push. La branche Vercel de production est `main`.
- Aucune migration n'est appliquée sur la base partagée sans accord explicite de JF (action B1).

## Décisions (propres au 3b)

| # | Décision | Pourquoi |
|---|---|---|
| D1 | **Un seul mode en 3b : arcade (tir)**, sens `fr_to_l`, `l_to_fr` ou `both` par assignation. Pas de colonne « modes » (QCM, taper : plans suivants). | Le moteur et le jeu existent déjà ; on évite une colonne inutilisée. |
| D2 | **Une assignation = un chapitre entier ou une liste** du chapitre (pas de regroupement en 3b). Plafond 300 mots par assignation, 20 assignations actives par groupe, minimum 3 mots. | Le jeu a besoin d'au moins 3 mots pour fabriquer les fausses réponses ; un chapitre peut contenir 40 000 mots, ce qui ne tient pas dans une réponse HTTP. |
| D3 | **Pas d'état Leitner stocké.** L'état est recalculé par `replayEvents` sur le journal des 90 derniers jours. | Évite de réécrire la logique Leitner en SQL (risque de divergence) ; le tableau de bord (3d) pourra faire le même calcul. Conséquence assumée : une carte sans réponse depuis plus de 90 jours redevient « nouvelle ». |
| D4 | **Journal conservé 90 jours puis supprimé** (`lang_purge_answers()`), planifié par `pg_cron` (action JF B3). L'agrégation hebdomadaire est repoussée au 3d. | Minimisation RGPD ; le spec principal propose 90 jours « à confirmer ». |
| D5 | **Supprimer un chapitre supprime aussi ses assignations et les réponses des élèves sur ses mots** (cascade). Le message de confirmation l'écrit. | Droit à l'effacement simple ; un mot supprimé ne peut plus être rejoué. |
| D6 | **Le journal n'est pas lisible par l'enseignant en 3b** (aucune politique RLS de lecture). Le tableau de bord est le plan 3d. | Garde le 3b petit ; la politique de lecture sera écrite avec le tableau de bord. |
| D7 | **Réponses « juste avec aide »** : bonne carte tirée après une erreur dans la même vague ; ni montée ni retour (règle existante du moteur). | Déjà codé dans `ArcadeSession`. |
| D8 | **L'enseignant « voit comme un élève »** via le même composant `ArcadeGame` en mode essai (aucune écriture). | Répond au besoin de visualiser avant de proposer le travail. |
| D9 | **Hors ligne minimal** : file locale + renvoi, sans PWA ni précache (plan 3c). | Ne perdre aucune réponse en cas de coupure de réseau. |

## Actions réservées à JF

- **B1** Exécuter la migration (Task 1) puis le script `supabase/tests/rls_lang_assignments.sql` dans l'éditeur SQL du projet partagé, après relecture. Ne pas committer le remplacement de l'UUID de compte dans le script.
- **B2** Variables d'environnement Vercel : déjà en place (aucune nouvelle variable en 3b).
- **B3** Activer `pg_cron` (Supabase, Database, Extensions) puis exécuter une fois la commande de planification donnée en Task 1, Step 7.
- **B4** Relire le texte de la page « Comment mes données sont-elles utilisées ? » (Task 8) et le faire valider par les écoles avant diffusion (spec 3a §8.3).
- **B5** Recette navigateur (Task 9), une action à la fois.

## Review Focus

Entrées ou conditions que le spec n'exerce pas et qui risquent de poser problème en classe, les plus probables d'abord. Chaque ligne a son test dans la tâche qui possède le code.

1. **Mots dont les formes se confondent** (deux mots avec la même traduction ou un synonyme commun) : une vague ne doit jamais proposer deux cartes qui sont toutes deux justes, ni une carte seule. Test : Task 3 (`ArcadeSession` saute la carte qui n'a pas assez de fausses réponses).
2. **Envoi répété** (réseau instable : le même lot part deux fois) : aucun doublon, aucune erreur visible. Tests : Task 1 (SQL, idempotence), Task 6 (file locale).
3. **Horloge de l'appareil fausse** (date dans le futur ou très ancienne) : la réponse est enregistrée avec un horodatage borné ; elle ne doit pas fausser l'ordre du rejeu. Test : Task 1 (SQL).
4. **Chapitre réimporté ou supprimé après l'assignation** : l'élève ne voit plus que ce qui existe ; une réponse en file sur un mot disparu est ignorée sans bloquer l'envoi des suivantes. Tests : Task 1 (SQL), Task 6.
5. **Session élève expirée ou groupe archivé en pleine séance** : les réponses restent dans la file, un message demande de se reconnecter, rien n'est perdu. Test : Task 6 (`flush` conserve la file sur `expire`) et Task 7.
6. **Assignation impossible** (moins de 3 mots, plus de 300, langue du chapitre différente de celle du groupe, liste d'un autre chapitre, groupe archivé) : refus avec un message français lisible. Test : Task 1 (SQL) et Task 2 (messages).

---

## Structure des fichiers

**Créés**
- `supabase/migrations/20261013000000_lang_assignments_answers.sql` : tables, RLS, grants, fonctions enseignant, fonctions élève, purge.
- `supabase/tests/rls_lang_assignments.sql` : vérification complète (rejouée en local par PGlite).
- `src/lib/assignments.ts` + `assignments.test.ts` : lecture et RPC des assignations (enseignant).
- `src/lib/arcadeWords.ts` + `arcadeWords.test.ts` : conversion chapitre vers listes et audio du jeu (partagée par ChapterDetail et l'assignation).
- `src/lib/work.ts` + `work.test.ts` : conversion des réponses de l'API vers le moteur, états, progression, format d'envoi.
- `src/lib/answerQueue.ts` + `answerQueue.test.ts` : file locale des réponses.
- `api/student-work.ts`, `api/student-answers.ts`, `tests/api/student-work.test.ts`, `tests/api/student-answers.test.ts`.
- `src/components/AssignmentsPanel.tsx` : bloc « Travail assigné » du détail d'un groupe.
- `src/components/StudentHome.tsx` : accueil élève (travail, jeu, synchronisation).

**Modifiés**
- `supabase/tests/run-local.mjs` (rejoue aussi le nouveau script).
- `src/arcade/session.ts` + `session.test.ts` (sens par carte, saut des cartes injouables).
- `src/arcade/ArcadeGame.tsx` (prop `assignment`, sens `both`).
- `src/lib/errors.ts` + `errors.test.ts`, `src/lib/studentApi.ts` + `studentApi.test.ts`.
- `src/components/ChapterDetail.tsx` (utilise `arcadeWords.ts`, message de suppression), `src/components/GroupDetail.tsx` (insère le bloc), `src/components/StudentApp.tsx` (délègue l'accueil), `src/components/PrivacyInfo.tsx`.

---

### Task 1: Migration SQL, script de vérification et banc d'essai local

**Files:**
- Create: `supabase/migrations/20261013000000_lang_assignments_answers.sql`
- Create: `supabase/tests/rls_lang_assignments.sql`
- Modify: `supabase/tests/run-local.mjs`

**Interfaces:**
- Produces (SQL, appelables par `authenticated`) : `lang_assignment_create(p_group uuid, p_chapter uuid, p_list uuid, p_titre text, p_sens text, p_mots integer, p_vitesse integer, p_echeance date) returns uuid` ; `lang_assignment_archive(p_id uuid) returns void`.
- Produces (SQL, `service_role` seul) : `lang_student_work(p_token text) returns jsonb` (`null` si le jeton est invalide) ; `lang_student_record_answers(p_token text, p_answers jsonb) returns jsonb` (`null` si jeton invalide, `{"error":"trop"}` si limite de débit, sinon `{"received":n,"stored":m}`) ; `lang_purge_answers() returns integer`.
- Produces (tables) : `lang_assignments`, `lang_answers` (colonnes ci-dessous).

- [ ] **Step 1: Créer la branche**

```bash
cd C:/Users/jfbeg/OneDrive/claude-workspace/langactif
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b feat/plan-3b-travail-assigne-et-journal
```

Si `feat/arcade-atari` n'est pas encore fusionnée dans `main`, la fusionner d'abord (avec l'accord de JF) ou créer la branche depuis `feat/arcade-atari` : le plan suppose que `src/arcade/` existe.

- [ ] **Step 2: Écrire le script de vérification (il doit échouer)**

Créer `supabase/tests/rls_lang_assignments.sql` :

```sql
-- Vérification du plan 3b. À exécuter dans l'éditeur SQL Supabase, APRÈS la migration 20261013000000.
-- Tout est annulé (rollback). Remplacer UUID_COMPTE_A (toutes les occurrences) par l'id d'un compte
-- enseignant existant (ne pas committer ce remplacement). Succès attendu : « Success. No rows returned ».

begin;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);

-- 1) Enseignant A : chapitres de test, groupe, assignation
do $$
declare
  ch uuid; li uuid; ch_en uuid; li_en uuid; ch_small uuid; li_small uuid; ch_big uuid; li_big uuid; li_other uuid;
  g jsonb; gid uuid; a uuid; a2 uuid; i integer;
begin
  insert into public.lang_chapters (user_id, langue, niveau, titre, numero) values ('UUID_COMPTE_A', 'nl-BE', 'S1', 'Chapitre 3b', '1') returning id into ch;
  insert into public.lang_lists (chapter_id, nom, position) values (ch, 'Liste A', 0) returning id into li;
  insert into public.lang_words (list_id, position, fr, cible, article)
    select li, n, 'mot' || n, 'woord' || n, 'het' from generate_series(0, 3) n;
  insert into public.lang_lists (chapter_id, nom, position) values (ch, 'Liste B', 1) returning id into li_other;
  insert into public.lang_words (list_id, position, fr, cible) select li_other, n, 'autre' || n, 'ander' || n from generate_series(0, 3) n;

  insert into public.lang_chapters (user_id, langue, niveau, titre, numero) values ('UUID_COMPTE_A', 'en-GB', 'S1', 'Chapitre anglais', '2') returning id into ch_en;
  insert into public.lang_lists (chapter_id, nom, position) values (ch_en, 'L', 0) returning id into li_en;
  insert into public.lang_words (list_id, position, fr, cible) select li_en, n, 'a' || n, 'b' || n from generate_series(0, 3) n;

  insert into public.lang_chapters (user_id, langue, niveau, titre, numero) values ('UUID_COMPTE_A', 'nl-BE', 'S1', 'Chapitre court', '3') returning id into ch_small;
  insert into public.lang_lists (chapter_id, nom, position) values (ch_small, 'L', 0) returning id into li_small;
  insert into public.lang_words (list_id, position, fr, cible) select li_small, n, 'c' || n, 'd' || n from generate_series(0, 1) n;

  insert into public.lang_chapters (user_id, langue, niveau, titre, numero) values ('UUID_COMPTE_A', 'nl-BE', 'S1', 'Chapitre long', '4') returning id into ch_big;
  insert into public.lang_lists (chapter_id, nom, position) values (ch_big, 'L', 0) returning id into li_big;
  insert into public.lang_words (list_id, position, fr, cible) select li_big, n, 'e' || n, 'f' || n from generate_series(0, 300) n;

  g := public.lang_group_create('Groupe 3b', 'nl-BE', 2);
  gid := (g->>'group_id')::uuid;

  a := public.lang_assignment_create(gid, ch, null, null, 'both', 8, 14, null);
  assert a is not null, 'assignation créée';
  assert (select char_length(titre) > 0 from public.lang_assignments where id = a), 'titre par défaut non vide';
  a2 := public.lang_assignment_create(gid, ch, li_other, 'Les autres mots', 'fr_to_l', 5, 9, current_date + 7);
  assert (select count(*) from public.lang_assignments where group_id = gid) = 2, '2 assignations visibles par A';

  -- refus : langue différente
  begin perform public.lang_assignment_create(gid, ch_en, null, null, 'fr_to_l', 8, 14, null); raise exception 'FAIL: langue différente acceptée';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; assert sqlerrm like 'La langue du chapitre%', 'message langue : ' || sqlerrm; end;
  -- refus : moins de 3 mots
  begin perform public.lang_assignment_create(gid, ch_small, null, null, 'fr_to_l', 8, 14, null); raise exception 'FAIL: 2 mots acceptés';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; assert sqlerrm like 'Il faut au moins 3 mots%', 'message 3 mots : ' || sqlerrm; end;
  -- refus : plus de 300 mots
  begin perform public.lang_assignment_create(gid, ch_big, null, null, 'fr_to_l', 8, 14, null); raise exception 'FAIL: 301 mots acceptés';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; assert sqlerrm like 'Limite de 300 mots%', 'message 300 mots : ' || sqlerrm; end;
  -- refus : liste d'un autre chapitre
  begin perform public.lang_assignment_create(gid, ch, li_big, null, 'fr_to_l', 8, 14, null); raise exception 'FAIL: liste étrangère acceptée';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; assert sqlerrm like 'Liste introuvable%', 'message liste : ' || sqlerrm; end;
  -- refus : sens invalide
  begin perform public.lang_assignment_create(gid, ch, null, null, 'nimporte', 8, 14, null); raise exception 'FAIL: sens invalide accepté';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; assert sqlerrm like 'Sens invalide%', 'message sens : ' || sqlerrm; end;
  -- refus : 21e assignation active
  for i in 3..20 loop
    perform public.lang_assignment_create(gid, ch, null, 'Travail ' || i, 'fr_to_l', 8, 14, null);
  end loop;
  begin perform public.lang_assignment_create(gid, ch, null, 'Trop', 'fr_to_l', 8, 14, null); raise exception 'FAIL: 21e assignation acceptée';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; assert sqlerrm like 'Limite de 20 travaux%', 'message 20 : ' || sqlerrm; end;
  -- l'archivage libère une place
  perform public.lang_assignment_archive(a2);
  perform public.lang_assignment_create(gid, ch, null, 'Après archivage', 'fr_to_l', 8, 14, null);

  perform set_config('lang.t_group', gid::text, true);
  perform set_config('lang.t_group_code', g->>'code', true);
  perform set_config('lang.t_chapter', ch::text, true);
  perform set_config('lang.t_list_other', li_other::text, true);
  perform set_config('lang.t_assignment', a::text, true);
  perform set_config('lang.t_seat_pseudo', g->'seats'->0->>'pseudo', true);
  perform set_config('lang.t_seat_code', g->'seats'->0->>'code', true);
  perform set_config('lang.t_seat_id', g->'seats'->0->>'id', true);
  -- une assignation limitée à la liste B, dans un groupe séparé, pour tester la portée des mots
  perform set_config('lang.t_word', (select id::text from public.lang_words where list_id = li order by position limit 1), true);
  perform set_config('lang.t_word_other', (select id::text from public.lang_words where list_id = li_other order by position limit 1), true);
  perform set_config('lang.t_word_big', (select id::text from public.lang_words where list_id = li_big order by position limit 1), true);
end $$;

-- 2) Enseignant B : ne voit rien, ne peut rien faire
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$
declare gid uuid := current_setting('lang.t_group')::uuid; ch uuid := current_setting('lang.t_chapter')::uuid;
begin
  assert (select count(*) from public.lang_assignments where group_id = gid) = 0, 'B voit les assignations de A';
  begin perform public.lang_assignment_create(gid, ch, null, null, 'fr_to_l', 8, 14, null); raise exception 'FAIL: B a assigné dans le groupe de A';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin perform public.lang_assignment_archive(current_setting('lang.t_assignment')::uuid); raise exception 'FAIL: B a archivé une assignation de A';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;
  delete from public.lang_assignments where id = current_setting('lang.t_assignment')::uuid;
  update public.lang_assignments set titre = 'piraté' where id = current_setting('lang.t_assignment')::uuid;
end $$;

-- 3) anon et authenticated : aucun accès au journal ni aux fonctions élève
reset role;
set local role anon;
do $$
begin
  begin perform count(*) from public.lang_assignments; raise exception 'FAIL: anon lit lang_assignments';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.lang_answers; raise exception 'FAIL: anon lit lang_answers';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
do $$
begin
  begin perform count(*) from public.lang_answers; raise exception 'FAIL: authenticated lit lang_answers';
  exception when insufficient_privilege then null; end;
  begin perform public.lang_student_work('x'); raise exception 'FAIL: authenticated appelle lang_student_work';
  exception when insufficient_privilege then null; end;
  begin perform public.lang_student_record_answers('x', '[]'::jsonb); raise exception 'FAIL: authenticated appelle lang_student_record_answers';
  exception when insufficient_privilege then null; end;
  begin perform public.lang_purge_answers(); raise exception 'FAIL: authenticated appelle lang_purge_answers';
  exception when insufficient_privilege then null; end;
end $$;

-- 4) Élève (service_role) : travail, réponses, idempotence, bornes, débit
reset role;
set local role service_role;
do $$
declare
  r jsonb; tok text; w jsonb; ans jsonb; n integer; i integer; got_trop boolean := false;
  gcode text := current_setting('lang.t_group_code'); pseudo text := current_setting('lang.t_seat_pseudo');
  word uuid := current_setting('lang.t_word')::uuid; word_other uuid := current_setting('lang.t_word_other')::uuid;
  word_big uuid := current_setting('lang.t_word_big')::uuid; id1 uuid := gen_random_uuid(); id2 uuid := gen_random_uuid();
  future_ts numeric := (extract(epoch from now() + interval '2 days') * 1000);
begin
  r := public.lang_student_login(gcode, pseudo, current_setting('lang.t_seat_code'), false);
  assert (r->>'ok')::boolean, 'connexion élève';
  tok := r->>'token';

  assert public.lang_student_work('jeton-invalide') is null, 'jeton invalide : null';
  w := public.lang_student_work(tok);
  -- 20 assignations actives dans le groupe, plafonnées à 20 : on cherche celle du chapitre complet
  assert jsonb_array_length(w->'assignments') = 20, 'vingt assignations actives visibles';
  assert (select count(*) from jsonb_array_elements(w->'assignments') x where jsonb_array_length(x->'words') = 8) >= 1, 'chapitre entier : 8 mots';
  assert jsonb_array_length(w->'events') = 0, 'journal vide au départ';

  -- 2 réponses valides, 1 mot hors travail (chapitre non assigné), 1 ligne mal formée
  ans := jsonb_build_array(
    jsonb_build_object('id', id1, 'word_id', word, 'direction', 'fr_to_l', 'mode', 'arcade_tir', 'verdict', 'juste', 'error_type', null, 'aide', false, 'test', false, 'ts', (extract(epoch from now()) * 1000), 'answer_text', 'het woord0', 'latency_ms', 1200),
    jsonb_build_object('id', id2, 'word_id', word_other, 'direction', 'l_to_fr', 'mode', 'arcade_tir', 'verdict', 'faux', 'error_type', 'confusion_liste', 'aide', false, 'test', false, 'ts', future_ts, 'answer_text', repeat('x', 300), 'latency_ms', 99999999),
    jsonb_build_object('id', gen_random_uuid(), 'word_id', word_big, 'direction', 'fr_to_l', 'mode', 'arcade_tir', 'verdict', 'juste', 'aide', false, 'test', false, 'ts', (extract(epoch from now()) * 1000)),
    jsonb_build_object('id', 'pas-un-uuid', 'word_id', word, 'direction', 'fr_to_l', 'mode', 'arcade_tir', 'verdict', 'juste', 'aide', false, 'test', false, 'ts', 1)
  );
  r := public.lang_student_record_answers(tok, ans);
  assert (r->>'received')::int = 4 and (r->>'stored')::int = 2, 'deux réponses valides enregistrées : ' || r::text;

  -- idempotence : le même lot renvoyé ne crée rien
  r := public.lang_student_record_answers(tok, ans);
  assert (r->>'stored')::int = 0, 'renvoi du même lot : aucun doublon';
  assert (select count(*) from public.lang_answers) = 2, 'deux lignes au journal';

  -- bornes : date future ramenée à now + 5 min au plus ; texte et latence plafonnés
  assert (select ts <= now() + interval '5 minutes 5 seconds' from public.lang_answers where id = id2), 'ts futur borné';
  assert (select char_length(answer_text) <= 100 and latency_ms <= 600000 from public.lang_answers where id = id2), 'texte et latence bornés';

  w := public.lang_student_work(tok);
  assert jsonb_array_length(w->'events') = 2, 'le journal revient dans le travail';

  -- trop d'envois en une minute
  for i in 1..8 loop
    ans := (select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'word_id', word, 'direction', 'fr_to_l', 'mode', 'arcade_tir',
      'verdict', 'juste', 'aide', false, 'test', false, 'ts', (extract(epoch from now()) * 1000))) from generate_series(1, 50));
    r := public.lang_student_record_answers(tok, ans);
    if r->>'error' = 'trop' then got_trop := true; exit; end if;
  end loop;
  assert got_trop, 'limite de débit atteinte';

  -- plus de 50 réponses dans un envoi : refusé
  begin
    perform public.lang_student_record_answers(tok, (select jsonb_agg('{}'::jsonb) from generate_series(1, 51)));
    raise exception 'FAIL: 51 réponses acceptées';
  exception when others then if sqlerrm like 'FAIL:%' then raise; end if; end;

  perform set_config('lang.t_token', tok, true);
end $$;

-- 5) Purge à 90 jours
do $$
declare n integer; id_old uuid;
begin
  select id into id_old from public.lang_answers order by ts limit 1;
  update public.lang_answers set ts = now() - interval '91 days' where id = id_old;
  n := public.lang_purge_answers();
  assert n >= 1, 'purge : au moins une ligne supprimée';
  assert not exists (select 1 from public.lang_answers where id = id_old), 'la ligne ancienne a disparu';
end $$;

-- B n'a rien pu modifier dans les assignations de A
do $$
begin
  assert (select titre from public.lang_assignments where id = current_setting('lang.t_assignment')::uuid) <> 'piraté', 'B a modifié une assignation de A';
  assert exists (select 1 from public.lang_assignments where id = current_setting('lang.t_assignment')::uuid), 'B a supprimé une assignation de A';
end $$;

-- 6) Effacement : supprimer une place efface ses réponses (droit à l'effacement)
do $$
begin
  assert (select count(*) from public.lang_answers where student_id = current_setting('lang.t_seat_id')::uuid) > 0, 'la place a des réponses avant effacement';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
delete from public.lang_students where id = current_setting('lang.t_seat_id')::uuid;
reset role;
set local role service_role;
do $$
begin
  assert (select count(*) from public.lang_answers where student_id = current_setting('lang.t_seat_id')::uuid) = 0, 'effacement en cascade du journal';
end $$;

-- 7) Suppression d'un chapitre : assignations supprimées (et réponses sur ses mots, par cascade)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
delete from public.lang_chapters where id = current_setting('lang.t_chapter')::uuid;
do $$
begin
  assert (select count(*) from public.lang_assignments where chapter_id = current_setting('lang.t_chapter')::uuid) = 0, 'assignations supprimées avec le chapitre';
end $$;

rollback;
```

- [ ] **Step 3: Brancher le script dans le banc d'essai local**

Dans `supabase/tests/run-local.mjs`, remplacer le bloc final (lecture d'un seul script) par une boucle :

```js
for (const name of ['rls_lang_groups.sql', 'rls_lang_assignments.sql']) {
  try {
    const script = readFileSync(join(root, 'tests', name), 'utf8').replaceAll('UUID_COMPTE_A', TEACHER);
    await db.exec(script);
    console.log('OK tests/' + name);
  } catch (e) {
    console.error('ERREUR tests/' + name + '\n', e.message);
    process.exit(1);
  }
}
```

(garder au-dessus le commentaire existant, en remplaçant « Seul le script du plan 3a » par « Les scripts des plans 3a et 3b »).

- [ ] **Step 4: Lancer le banc d'essai : il doit échouer**

Run: `npm run test:sql`
Expected: les migrations existantes passent, puis `ERREUR tests/rls_lang_assignments.sql` (la fonction `lang_assignment_create` n'existe pas).

- [ ] **Step 5: Écrire la migration**

Créer `supabase/migrations/20261013000000_lang_assignments_answers.sql` :

```sql
-- LangActif, plan 3b : travail assigné (lang_assignments) et journal des réponses (lang_answers).
-- Tables préfixées lang_. L'élève n'a AUCUN accès direct : ses fonctions sont réservées à
-- service_role (appelées par api/student-work.ts et api/student-answers.ts).

create table if not exists public.lang_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lang_groups(id) on delete cascade,
  chapter_id uuid not null references public.lang_chapters(id) on delete cascade,
  list_id uuid references public.lang_lists(id) on delete cascade,
  titre text not null,
  sens text not null check (sens in ('fr_to_l', 'l_to_fr', 'both')),
  mots_par_seance integer not null default 8 check (mots_par_seance between 3 and 20),
  vitesse_s integer not null default 14 check (vitesse_s in (9, 14, 20)),
  echeance date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lang_assignments_titre_len check (char_length(titre) between 1 and 100)
);
create index if not exists lang_assignments_group_idx on public.lang_assignments (group_id) where archived_at is null;
create index if not exists lang_assignments_chapter_idx on public.lang_assignments (chapter_id);

create table if not exists public.lang_answers (
  id uuid primary key,                      -- fourni par le client : le renvoi d'un lot ne crée pas de doublon
  student_id uuid not null references public.lang_students(id) on delete cascade,
  word_id uuid not null references public.lang_words(id) on delete cascade,
  assignment_id uuid references public.lang_assignments(id) on delete set null,
  direction text not null check (direction in ('fr_to_l', 'l_to_fr')),
  mode text not null check (mode in ('flashcards', 'qcm', 'association', 'taper', 'roue_sans_leurres', 'roue_avec_leurres', 'arcade_tir', 'arcade_defense')),
  verdict text not null check (verdict in ('juste', 'presque', 'faux', 'sans_reponse')),
  error_type text check (error_type in ('orthographe_proche', 'mauvais_article', 'confusion_liste', 'sans_reponse', 'autre')),
  aide boolean not null default false,
  test boolean not null default false,
  ts timestamptz not null,
  received_at timestamptz not null default now(),
  answer_text text,
  latency_ms integer check (latency_ms between 0 and 600000),
  constraint lang_answers_text_len check (answer_text is null or char_length(answer_text) <= 100)
);
create index if not exists lang_answers_student_ts_idx on public.lang_answers (student_id, ts desc);
create index if not exists lang_answers_word_idx on public.lang_answers (word_id);
create index if not exists lang_answers_received_idx on public.lang_answers (student_id, received_at);

alter table public.lang_assignments enable row level security;
alter table public.lang_answers enable row level security;

drop policy if exists lang_assignments_owner_select on public.lang_assignments;
create policy lang_assignments_owner_select on public.lang_assignments
  for select to authenticated using (public.lang_owns_group(group_id));
drop policy if exists lang_assignments_owner_update on public.lang_assignments;
create policy lang_assignments_owner_update on public.lang_assignments
  for update to authenticated using (public.lang_owns_group(group_id)) with check (public.lang_owns_group(group_id));
drop policy if exists lang_assignments_owner_delete on public.lang_assignments;
create policy lang_assignments_owner_delete on public.lang_assignments
  for delete to authenticated using (public.lang_owns_group(group_id));
-- lang_answers : aucune politique pour authenticated (accès refusé ; la lecture arrive avec le tableau de bord, plan 3d).

revoke all on public.lang_assignments, public.lang_answers from anon, authenticated;
grant select, delete on public.lang_assignments to authenticated;
grant update (titre, echeance, vitesse_s, mots_par_seance) on public.lang_assignments to authenticated;
grant select, insert, update, delete on public.lang_assignments to service_role;
grant select, insert, update, delete on public.lang_answers to service_role;

-- Identifiant d'élève derrière un jeton valide (null sinon). Interne : jamais appelable par le navigateur.
create or replace function public.lang_student_from_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select st.id
  from public.lang_student_sessions ss
  join public.lang_students st on st.id = ss.student_id
  join public.lang_groups g on g.id = st.group_id
  where ss.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and ss.revoked_at is null
    and ss.expires_at > now()
    and st.archived_at is null
    and g.archived_at is null;
$$;

-- RPC enseignant : créer une assignation (contrôles de propriété, de langue et de taille).
create or replace function public.lang_assignment_create(
  p_group uuid, p_chapter uuid, p_list uuid, p_titre text, p_sens text,
  p_mots integer, p_vitesse integer, p_echeance date
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group public.lang_groups%rowtype;
  v_chapter public.lang_chapters%rowtype;
  v_words integer;
  v_titre text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if not public.lang_owns_group(p_group) then
    raise exception 'Groupe introuvable ou non autorisé';
  end if;
  if not public.lang_owns_chapter(p_chapter) then
    raise exception 'Chapitre introuvable ou non autorisé';
  end if;
  select * into v_group from public.lang_groups where id = p_group;
  select * into v_chapter from public.lang_chapters where id = p_chapter;
  if v_group.archived_at is not null then
    raise exception 'Groupe archivé : impossible d''assigner du travail';
  end if;
  if v_group.langue <> v_chapter.langue then
    raise exception 'La langue du chapitre ne correspond pas à celle du groupe';
  end if;
  if p_list is not null and not exists (select 1 from public.lang_lists where id = p_list and chapter_id = p_chapter) then
    raise exception 'Liste introuvable dans ce chapitre';
  end if;
  if p_sens is null or p_sens not in ('fr_to_l', 'l_to_fr', 'both') then
    raise exception 'Sens invalide';
  end if;

  select count(*) into v_words
  from public.lang_words w join public.lang_lists l on l.id = w.list_id
  where l.chapter_id = p_chapter and (p_list is null or l.id = p_list);
  if v_words < 3 then
    raise exception 'Il faut au moins 3 mots pour assigner du travail';
  end if;
  if v_words > 300 then
    raise exception 'Limite de 300 mots par travail assigné atteinte : choisis une liste plutôt que tout le chapitre';
  end if;
  if (select count(*) from public.lang_assignments where group_id = p_group and archived_at is null) >= 20 then
    raise exception 'Limite de 20 travaux actifs par groupe atteinte';
  end if;

  v_titre := nullif(trim(coalesce(p_titre, '')), '');
  if v_titre is null then
    v_titre := left(v_chapter.numero || '. ' || v_chapter.titre, 100);
    if p_list is not null then
      v_titre := left(v_titre || ' : ' || (select nom from public.lang_lists where id = p_list), 100);
    end if;
  end if;

  insert into public.lang_assignments (group_id, chapter_id, list_id, titre, sens, mots_par_seance, vitesse_s, echeance)
  values (p_group, p_chapter, p_list, left(v_titre, 100), p_sens, coalesce(p_mots, 8), coalesce(p_vitesse, 14), p_echeance)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.lang_assignment_archive(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.lang_assignments where id = p_id;
  if v_group is null or not public.lang_owns_group(v_group) then
    raise exception 'Travail introuvable ou non autorisé';
  end if;
  update public.lang_assignments set archived_at = coalesce(archived_at, now()) where id = p_id;
end;
$$;

-- Travail de l'élève : assignations actives de son groupe (avec leurs mots) et son journal des 90 derniers jours.
create or replace function public.lang_student_work(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_sid uuid := public.lang_student_from_token(p_token);
  v_group uuid;
begin
  if v_sid is null then
    return null;
  end if;
  select group_id into v_group from public.lang_students where id = v_sid;
  return jsonb_build_object(
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'titre', a.titre,
        'chapter_titre', c.titre,
        'sens', a.sens,
        'mots_par_seance', a.mots_par_seance,
        'vitesse_s', a.vitesse_s,
        'echeance', a.echeance,
        'words', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', w.id, 'fr', w.fr, 'cible', w.cible, 'article', w.article,
            'synonymes_fr', w.synonymes_fr, 'synonymes_cible', w.synonymes_cible, 'audio_url', w.audio_url
          ) order by l.position, w.position), '[]'::jsonb)
          from public.lang_words w join public.lang_lists l on l.id = w.list_id
          where l.chapter_id = a.chapter_id and (a.list_id is null or l.id = a.list_id)
        )
      ) order by a.echeance nulls last, a.created_at)
      from public.lang_assignments a join public.lang_chapters c on c.id = a.chapter_id
      where a.group_id = v_group and a.archived_at is null
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(e) from (
        select id, word_id, direction, mode, verdict, error_type, aide, test,
               (extract(epoch from ts) * 1000)::bigint as ts, answer_text, latency_ms, assignment_id
        from public.lang_answers
        where student_id = v_sid and ts > now() - interval '90 days'
        order by ts desc limit 5000
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

-- Enregistrement des réponses : lot de 50 au plus, idempotent (clé = id client), horodatage borné,
-- ligne invalide ignorée sans bloquer les autres, limite de 300 réponses par minute et par élève.
create or replace function public.lang_student_record_answers(p_token text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sid uuid := public.lang_student_from_token(p_token);
  v_group uuid;
  v_n integer;
  v_stored integer := 0;
  v_rows integer;
  v_recent integer;
  a jsonb;
  v_ts timestamptz;
  v_word uuid;
begin
  if v_sid is null then
    return null;
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Format invalide';
  end if;
  v_n := jsonb_array_length(p_answers);
  if v_n > 50 then
    raise exception 'Trop de réponses dans un envoi (50 au maximum)';
  end if;
  select count(*) into v_recent from public.lang_answers where student_id = v_sid and received_at > now() - interval '1 minute';
  if v_recent + v_n > 300 then
    return jsonb_build_object('error', 'trop');
  end if;
  select group_id into v_group from public.lang_students where id = v_sid;

  for a in select * from jsonb_array_elements(p_answers) loop
    begin
      v_word := (a->>'word_id')::uuid;
      v_ts := to_timestamp((a->>'ts')::numeric / 1000.0);
      v_ts := least(greatest(v_ts, now() - interval '30 days'), now() + interval '5 minutes');
      -- le mot doit appartenir à un travail (même archivé) de ce groupe, et à sa liste si l'assignation est limitée à une liste
      if not exists (
        select 1
        from public.lang_words w
        join public.lang_lists l on l.id = w.list_id
        join public.lang_assignments x on x.chapter_id = l.chapter_id and (x.list_id is null or x.list_id = l.id)
        where w.id = v_word and x.group_id = v_group
      ) then
        continue;
      end if;
      insert into public.lang_answers (id, student_id, word_id, assignment_id, direction, mode, verdict, error_type, aide, test, ts, answer_text, latency_ms)
      values (
        (a->>'id')::uuid, v_sid, v_word,
        (select x.id from public.lang_assignments x where x.id = nullif(a->>'assignment_id', '')::uuid and x.group_id = v_group),
        a->>'direction', a->>'mode', a->>'verdict', nullif(a->>'error_type', ''),
        coalesce((a->>'aide')::boolean, false), coalesce((a->>'test')::boolean, false), v_ts,
        left(nullif(a->>'answer_text', ''), 100),
        least(greatest(coalesce((a->>'latency_ms')::numeric, 0), 0), 600000)::integer
      )
      on conflict (id) do nothing;
      get diagnostics v_rows = row_count;
      v_stored := v_stored + v_rows;
    exception when others then
      null; -- ligne invalide (type, valeur interdite) : ignorée
    end;
  end loop;
  return jsonb_build_object('received', v_n, 'stored', v_stored);
end;
$$;

-- Purge du journal détaillé (conservation : 90 jours). Planifiée par pg_cron (voir le plan, Task 1 Step 7).
create or replace function public.lang_purge_answers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from public.lang_answers where ts < now() - interval '90 days';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.lang_student_from_token(text) from public, anon, authenticated;
revoke all on function public.lang_student_work(text) from public, anon, authenticated;
revoke all on function public.lang_student_record_answers(text, jsonb) from public, anon, authenticated;
revoke all on function public.lang_purge_answers() from public, anon, authenticated;
grant execute on function public.lang_student_work(text) to service_role;
grant execute on function public.lang_student_record_answers(text, jsonb) to service_role;
grant execute on function public.lang_purge_answers() to service_role;

revoke all on function public.lang_assignment_create(uuid, uuid, uuid, text, text, integer, integer, date) from public, anon;
revoke all on function public.lang_assignment_archive(uuid) from public, anon;
grant execute on function public.lang_assignment_create(uuid, uuid, uuid, text, text, integer, integer, date) to authenticated;
grant execute on function public.lang_assignment_archive(uuid) to authenticated;
```

- [ ] **Step 6: Relancer le banc d'essai : il doit passer**

Run: `npm run test:sql`
Expected: `OK migration 20261013000000_lang_assignments_answers.sql` puis `OK tests/rls_lang_groups.sql` et `OK tests/rls_lang_assignments.sql`. Si une assertion échoue, lire son message (chaque `assert` est décrit), corriger la migration, relancer. PGlite est un filet de sécurité : le même script sera exécuté sur le projet réel (B1).

Cas à surveiller : `lang_student_record_answers` est `volatile` (elle écrit) ; ne pas la déclarer `stable`. `lang_student_work` met à jour rien : `stable` est correct.

- [ ] **Step 7: Documenter la planification de la purge (action JF B3)**

Ajouter à la fin de la migration, en commentaire (la commande n'est pas dans la migration : l'extension `pg_cron` peut ne pas être activée) :

```sql
-- Planification (à exécuter UNE FOIS par JF, après activation de pg_cron dans Database > Extensions) :
--   select cron.schedule('lang-purge-answers', '17 3 * * *', $$select public.lang_purge_answers()$$);
-- Vérification : select * from cron.job where jobname = 'lang-purge-answers';
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261013000000_lang_assignments_answers.sql supabase/tests/rls_lang_assignments.sql supabase/tests/run-local.mjs
git commit -m "Plan 3b : tables d'assignation et de journal, fonctions élève et enseignant, script de vérification

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9 (JF, B1) : appliquer sur le projet partagé**

Relire la migration, l'exécuter dans l'éditeur SQL Supabase, puis exécuter `rls_lang_assignments.sql` (UUID de compte remplacé). Attendu : « Success. No rows returned ». Ne rien committer de ce remplacement.

---

### Task 2: Messages d'erreur français et bibliothèque `assignments.ts`

**Files:**
- Modify: `src/lib/errors.ts`, `src/lib/errors.test.ts`
- Create: `src/lib/assignments.ts`, `src/lib/assignments.test.ts`

**Interfaces:**
- Consumes: `friendlyError(message: string): string` (existant), `Langue`, `Direction` du moteur.
- Produces :
  - `type Sens = Direction | 'both'`
  - `interface AssignmentRow { id: string; group_id: string; chapter_id: string; list_id: string | null; titre: string; sens: Sens; mots_par_seance: number; vitesse_s: number; echeance: string | null; archived_at: string | null; created_at: string; chapterTitre: string; chapterNumero: string; listNom: string | null }`
  - `listAssignments(client, groupId): Promise<AssignmentRow[]>`
  - `createAssignment(client, input: { groupId; chapterId; listId: string | null; titre: string; sens: Sens; mots: number; vitesse: number; echeance: string | null }): Promise<string>`
  - `archiveAssignment(client, id): Promise<void>`, `deleteAssignment(client, id): Promise<void>`
  - `updateAssignment(client, id, patch: { titre?: string; echeance?: string | null; vitesse_s?: number; mots_par_seance?: number }): Promise<void>`
  - `deadlineLabel(echeance: string | null, today?: Date): string`, `senseLabel(s: Sens): string`

- [ ] **Step 1: Test des messages (échec attendu)**

Ajouter dans `src/lib/errors.test.ts` :

```ts
it('conserve les messages français des assignations', () => {
  for (const m of [
    'Il faut au moins 3 mots pour assigner du travail',
    'La langue du chapitre ne correspond pas à celle du groupe',
    'Liste introuvable dans ce chapitre',
    'Sens invalide',
    'Limite de 300 mots par travail assigné atteinte : choisis une liste plutôt que tout le chapitre',
    'Limite de 20 travaux actifs par groupe atteinte',
    "Groupe archivé : impossible d'assigner du travail",
    'Travail introuvable ou non autorisé',
  ]) {
    expect(friendlyError(m)).toBe(m);
  }
});
```

Run: `npx vitest run src/lib/errors.test.ts` ; Expected: FAIL (trois messages ne sont pas conservés).

- [ ] **Step 2: Implémenter**

Dans `src/lib/errors.ts`, ajouter à `FRENCH_SQL_MESSAGES` : `'Il faut au moins'`, `'La langue du chapitre'`, `'Liste introuvable'`, `'Sens invalide'`. Run : PASS.

- [ ] **Step 3: Tests de `assignments.ts` (échec attendu)**

Créer `src/lib/assignments.test.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { archiveAssignment, createAssignment, deadlineLabel, deleteAssignment, listAssignments, senseLabel, updateAssignment } from './assignments';

const asClient = (fake: unknown) => fake as SupabaseClient;

function rpcClient(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ name: string; args: unknown }> = [];
  return { calls, client: asClient({ rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data, error }; } }) };
}

describe('createAssignment', () => {
  it('appelle la RPC avec les bons arguments et renvoie l\'id', async () => {
    const { client, calls } = rpcClient('a1');
    const id = await createAssignment(client, { groupId: 'g1', chapterId: 'c1', listId: null, titre: '', sens: 'both', mots: 8, vitesse: 14, echeance: null });
    expect(id).toBe('a1');
    expect(calls[0]).toEqual({
      name: 'lang_assignment_create',
      args: { p_group: 'g1', p_chapter: 'c1', p_list: null, p_titre: '', p_sens: 'both', p_mots: 8, p_vitesse: 14, p_echeance: null },
    });
  });
  it('traduit une erreur technique en message français', async () => {
    const { client } = rpcClient(null, { message: 'Il faut au moins 3 mots pour assigner du travail' });
    await expect(createAssignment(client, { groupId: 'g', chapterId: 'c', listId: null, titre: '', sens: 'fr_to_l', mots: 8, vitesse: 14, echeance: null }))
      .rejects.toThrow('Il faut au moins 3 mots');
  });
});

describe('archiveAssignment', () => {
  it('appelle lang_assignment_archive', async () => {
    const { client, calls } = rpcClient(null);
    await archiveAssignment(client, 'a1');
    expect(calls[0]).toEqual({ name: 'lang_assignment_archive', args: { p_id: 'a1' } });
  });
});

describe('listAssignments', () => {
  it('met les relations à plat et trie du plus récent au plus ancien', async () => {
    const rows = [
      { id: 'a1', group_id: 'g', chapter_id: 'c', list_id: null, titre: 'T', sens: 'both', mots_par_seance: 8, vitesse_s: 14, echeance: null, archived_at: null, created_at: '2026-10-01', lang_chapters: { titre: 'École', numero: '1' }, lang_lists: null },
      { id: 'a2', group_id: 'g', chapter_id: 'c', list_id: 'l', titre: 'U', sens: 'fr_to_l', mots_par_seance: 5, vitesse_s: 9, echeance: '2026-11-01', archived_at: null, created_at: '2026-10-05', lang_chapters: { titre: 'École', numero: '1' }, lang_lists: { nom: 'Liste B' } },
    ];
    const client = asClient({ from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }) });
    const out = await listAssignments(client, 'g');
    expect(out[1]).toMatchObject({ id: 'a2', chapterTitre: 'École', listNom: 'Liste B' });
    expect(out[0]).toMatchObject({ id: 'a1', listNom: null });
  });
});

describe('updateAssignment et deleteAssignment', () => {
  it('update ne touche que les champs fournis', async () => {
    const seen: Array<{ patch: unknown; id: unknown }> = [];
    const client = asClient({ from: () => ({ update: (patch: unknown) => ({ eq: async (_c: string, id: unknown) => { seen.push({ patch, id }); return { error: null }; } }) }) });
    await updateAssignment(client, 'a1', { echeance: '2026-12-01' });
    expect(seen[0]).toEqual({ patch: { echeance: '2026-12-01' }, id: 'a1' });
  });
  it('delete remonte l\'erreur en français', async () => {
    const client = asClient({ from: () => ({ delete: () => ({ eq: async () => ({ error: { message: 'Failed to fetch' } }) }) }) });
    await expect(deleteAssignment(client, 'a1')).rejects.toThrow('Connexion impossible');
  });
});

describe('senseLabel', () => {
  it('dit le sens en toutes lettres', () => {
    expect(senseLabel('fr_to_l')).toBe('Français vers langue cible');
    expect(senseLabel('l_to_fr')).toBe('Langue cible vers français');
    expect(senseLabel('both')).toBe('Les deux sens');
  });
});

describe('deadlineLabel', () => {
  const today = new Date('2026-10-13T10:00:00');
  it('sans échéance', () => expect(deadlineLabel(null, today)).toBe('Sans échéance'));
  it('aujourd\'hui', () => expect(deadlineLabel('2026-10-13', today)).toBe('À rendre aujourd\'hui'));
  it('demain', () => expect(deadlineLabel('2026-10-14', today)).toBe('À rendre demain'));
  it('dans n jours', () => expect(deadlineLabel('2026-10-20', today)).toBe('À rendre dans 7 jours'));
  it('dépassée : texte, jamais la couleur seule', () => expect(deadlineLabel('2026-10-10', today)).toBe('Échéance dépassée depuis 3 jours'));
});
```

Run: `npx vitest run src/lib/assignments.test.ts` ; Expected: FAIL (module absent).

- [ ] **Step 4: Implémenter `src/lib/assignments.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Direction } from '../engine/types';
import { friendlyError } from './errors';

export type Sens = Direction | 'both';

export interface AssignmentRow {
  id: string;
  group_id: string;
  chapter_id: string;
  list_id: string | null;
  titre: string;
  sens: Sens;
  mots_par_seance: number;
  vitesse_s: number;
  echeance: string | null;
  archived_at: string | null;
  created_at: string;
  chapterTitre: string;
  chapterNumero: string;
  listNom: string | null;
}

type Raw = Omit<AssignmentRow, 'chapterTitre' | 'chapterNumero' | 'listNom'> & {
  lang_chapters: { titre: string; numero: string } | null;
  lang_lists: { nom: string } | null;
};

export async function listAssignments(client: SupabaseClient, groupId: string): Promise<AssignmentRow[]> {
  const { data, error } = await client
    .from('lang_assignments')
    .select('id, group_id, chapter_id, list_id, titre, sens, mots_par_seance, vitesse_s, echeance, archived_at, created_at, lang_chapters(titre, numero), lang_lists(nom)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendlyError(error.message));
  return ((data ?? []) as unknown as Raw[]).map(({ lang_chapters, lang_lists, ...rest }) => ({
    ...rest,
    chapterTitre: lang_chapters?.titre ?? '',
    chapterNumero: lang_chapters?.numero ?? '',
    listNom: lang_lists?.nom ?? null,
  }));
}

export interface CreateAssignmentInput {
  groupId: string;
  chapterId: string;
  listId: string | null;
  titre: string;
  sens: Sens;
  mots: number;
  vitesse: number;
  echeance: string | null;
}

export async function createAssignment(client: SupabaseClient, i: CreateAssignmentInput): Promise<string> {
  const { data, error } = await client.rpc('lang_assignment_create', {
    p_group: i.groupId, p_chapter: i.chapterId, p_list: i.listId, p_titre: i.titre,
    p_sens: i.sens, p_mots: i.mots, p_vitesse: i.vitesse, p_echeance: i.echeance,
  });
  if (error) throw new Error(friendlyError(error.message));
  return data as string;
}

export async function archiveAssignment(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc('lang_assignment_archive', { p_id: id });
  if (error) throw new Error(friendlyError(error.message));
}

export async function deleteAssignment(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('lang_assignments').delete().eq('id', id);
  if (error) throw new Error(friendlyError(error.message));
}

export async function updateAssignment(
  client: SupabaseClient,
  id: string,
  patch: { titre?: string; echeance?: string | null; vitesse_s?: number; mots_par_seance?: number },
): Promise<void> {
  const { error } = await client.from('lang_assignments').update(patch).eq('id', id);
  if (error) throw new Error(friendlyError(error.message));
}

export function senseLabel(s: Sens): string {
  if (s === 'fr_to_l') return 'Français vers langue cible';
  if (s === 'l_to_fr') return 'Langue cible vers français';
  return 'Les deux sens';
}

const DAY = 86_400_000;

/** Libellé d'échéance en toutes lettres (jamais la couleur seule). `echeance` : 'AAAA-MM-JJ'. */
export function deadlineLabel(echeance: string | null, today: Date = new Date()): string {
  if (!echeance) return 'Sans échéance';
  const [y, m, d] = echeance.split('-').map(Number);
  const due = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due - now) / DAY);
  if (days === 0) return "À rendre aujourd'hui";
  if (days === 1) return 'À rendre demain';
  if (days > 1) return `À rendre dans ${days} jours`;
  const late = -days;
  return `Échéance dépassée depuis ${late} ${late > 1 ? 'jours' : 'jour'}`;
}
```

- [ ] **Step 5: Vérifier, committer**

Run: `npx vitest run src/lib/errors.test.ts src/lib/assignments.test.ts && npx tsc --noEmit` ; Expected: PASS, aucune erreur.

```bash
git add src/lib/errors.ts src/lib/errors.test.ts src/lib/assignments.ts src/lib/assignments.test.ts
git commit -m "Plan 3b : messages français et bibliothèque des assignations

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `ArcadeSession` : sens par carte et cartes injouables ; `arcadeWords.ts`

**Files:**
- Modify: `src/arcade/session.ts`, `src/arcade/session.test.ts`
- Create: `src/lib/arcadeWords.ts`, `src/lib/arcadeWords.test.ts`

**Interfaces:**
- Consumes: `ArcadeSession`, `answerText`, `promptText` (existants) ; `ChapterDetail`/`WordRow` de `src/lib/chapters.ts`.
- Produces :
  - `ArcadeConfig.direction: Direction | 'both'` ; `Wave` gagne `direction: Direction` ; `AnswerEvent.direction` suit la carte, pas la config.
  - `ArcadeSession.total` ne compte que les cartes jouables ; une carte qui n'a pas au moins 1 fausse réponse distincte est retirée à la construction.
  - `chapterToArcade(chapter: ChapterDetail, listId?: string | null): { lists: ArcadeList[]; audio: Record<string, string | null> }`
  - `wordRowToWord(w: WordRow): Word`

- [ ] **Step 1: Tests de session (échec attendu)**

Ajouter dans `src/arcade/session.test.ts` :

```ts
describe('sens par carte', () => {
  it('« both » : les deux sens apparaissent et chaque événement porte le sens de sa carte', () => {
    const s = new ArcadeSession({ words: WORDS, direction: 'both', count: 10, studentId: 'x', rng: () => 0.3, newId: () => `b${++n}` });
    expect(s.total).toBe(10);
    const dirs = new Set<string>();
    while (s.nextWave()) {
      const w = s.currentWave!;
      dirs.add(w.direction);
      const texts = w.options.find((o) => o.correct)!.text;
      expect(texts).toBe(answerText(w.word, w.direction));
      const ev = s.finishWave('clean');
      expect(ev.direction).toBe(w.direction);
    }
    expect([...dirs].sort()).toEqual(['fr_to_l', 'l_to_fr']);
  });
});

describe('cartes injouables', () => {
  it('une carte sans fausse réponse distincte est retirée (deux mots de même traduction)', () => {
    const words = [word('a', 'la voiture', 'auto', 'de'), word('b', 'l\'auto', 'auto', 'de'), word('c', 'la gomme', 'gom', 'de')];
    // vers la langue cible : a et b se traduisent pareil ; chacun n'a qu'une seule fausse réponse (c) : jouable.
    const ok = new ArcadeSession({ words, direction: 'fr_to_l', count: 3, studentId: 'x', rng: () => 0.2, newId: () => 'i' });
    expect(ok.total).toBe(3);
    // c n'a que deux fausses réponses identiques entre elles (a et b ont la même forme) : la vague ne doit pas dupliquer de texte
    const w = ok.nextWave()!;
    const texts = w.options.map((o) => o.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
  it('aucune carte jouable : séance vide', () => {
    const words = [word('a', 'x', 'y'), word('b', 'x', 'y'), word('c', 'x', 'y')];
    const s = new ArcadeSession({ words, direction: 'fr_to_l', count: 3, studentId: 'x', newId: () => 'i' });
    expect(s.total).toBe(0);
    expect(s.finished).toBe(true);
    expect(s.nextWave()).toBeNull();
  });
});
```

Run: `npx vitest run src/arcade/session.test.ts` ; Expected: FAIL (type `'both'` refusé, `direction` absent de `Wave`).

- [ ] **Step 2: Modifier `src/arcade/session.ts`**

Changements précis :
1. `ArcadeConfig.direction: Direction | 'both'`.
2. `Wave` : ajouter `direction: Direction`.
3. Dans `nextWave()`, remplacer `const dir = this.cfg.direction;` par `const dir = entry.ref.direction;` et construire `this.wave = { ref: entry.ref, word: entry.word, direction: dir, prompt: promptText(entry.word, dir), options, startedAt: this.now() };`.
4. Dans `event()`, remplacer `direction: this.cfg.direction` par `direction: w.direction`.
5. Ajouter une méthode privée `distractorsFor(word: Word, dir: Direction): Word[]` qui renvoie la liste `pool` filtrée (code déjà présent dans `nextWave`, extrait tel quel) :

```ts
private distractorsFor(word: Word, dir: Direction): Word[] {
  const forbidden = new Set(acceptedForms(word, dir).map((f) => f.toLowerCase()));
  const seen = new Set<string>();
  return this.cfg.words.filter((w) => {
    if (w.id === word.id) return false;
    const forms = acceptedForms(w, dir).map((f) => f.toLowerCase());
    if (forms.some((f) => forbidden.has(f))) return false;
    const key = forms[0];
    if (seen.has(key)) return false; // deux fausses réponses ne portent jamais le même texte
    seen.add(key);
    return true;
  });
}
```

6. Dans le constructeur, après la construction de `this.queue`, filtrer : `this.queue = this.queue.filter((e) => this.distractorsFor(e.word, e.ref.direction).length >= 1);` puis `this.total = this.queue.length;` (déplacer l'affectation de `total` après le filtre ; `total` reste `readonly`, assigné dans le constructeur).
7. Dans `nextWave()`, utiliser `shuffle(this.distractorsFor(entry.word, dir), this.rng).slice(0, 2)` (1 ou 2 fausses réponses : 2 ou 3 cartes).

- [ ] **Step 3: Faire passer les tests de session**

Run: `npx vitest run src/arcade/session.test.ts` ; Expected: PASS (les 12 tests existants + 3 nouveaux ; le test « un distracteur n'est jamais une forme acceptée » reste vert).

- [ ] **Step 4: Tests de `arcadeWords.ts` (échec attendu)**

Créer `src/lib/arcadeWords.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import type { ChapterDetail } from './chapters';
import { chapterToArcade, wordRowToWord } from './arcadeWords';

const row = (id: string, fr: string, cible: string, over: Record<string, unknown> = {}) => ({
  id, position: 0, fr, cible, article: null, synonymes_fr: [], synonymes_cible: [], phrase_cible: null, phrase_fr: null, audio_url: null, ...over,
});
const chapter: ChapterDetail = {
  id: 'c', langue: 'nl-BE', niveau: 'S1', titre: 'École', numero: '1', auteur: null, created_at: '',
  lists: [
    { id: 'l1', nom: 'A', position: 0, words: [row('w1', 'le vélo', 'fiets', { article: 'de', audio_url: 'https://x/fiets.mp3' })] },
    { id: 'l2', nom: 'B', position: 1, words: [row('w2', 'la gomme', 'gom', { article: 'de' })] },
  ],
};

describe('arcadeWords', () => {
  it('convertit une ligne en mot du moteur', () => {
    expect(wordRowToWord(chapter.lists[0].words[0])).toEqual({ id: 'w1', fr: 'le vélo', cible: 'fiets', article: 'de', synonymesFr: [], synonymesCible: [] });
  });
  it('tout le chapitre : toutes les listes et tout l\'audio', () => {
    const r = chapterToArcade(chapter);
    expect(r.lists.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(r.audio).toEqual({ w1: 'https://x/fiets.mp3', w2: null });
  });
  it('une seule liste', () => {
    expect(chapterToArcade(chapter, 'l2').lists.map((l) => l.id)).toEqual(['l2']);
  });
});
```

Run: FAIL (module absent).

- [ ] **Step 5: Implémenter `src/lib/arcadeWords.ts` et l'utiliser dans `ChapterDetail`**

```ts
import type { ArcadeList } from '../arcade/ArcadeGame';
import type { Word } from '../engine';
import type { ChapterDetail, WordRow } from './chapters';

export function wordRowToWord(w: WordRow): Word {
  return { id: w.id, fr: w.fr, cible: w.cible, article: w.article, synonymesFr: w.synonymes_fr, synonymesCible: w.synonymes_cible };
}

/** Listes et fichiers audio pour le jeu ; `listId` limite à une liste (null ou absent : tout le chapitre). */
export function chapterToArcade(chapter: ChapterDetail, listId?: string | null): { lists: ArcadeList[]; audio: Record<string, string | null> } {
  const chosen = chapter.lists.filter((l) => !listId || l.id === listId);
  const audio: Record<string, string | null> = {};
  chosen.forEach((l) => l.words.forEach((w) => (audio[w.id] = w.audio_url)));
  return { lists: chosen.map((l) => ({ id: l.id, nom: l.nom, words: l.words.map(wordRowToWord) })), audio };
}
```

Dans `ChapterDetail.tsx`, remplacer le `useMemo` de conversion par `const arcade = useMemo(() => (chapter ? chapterToArcade(chapter) : null), [chapter]);` et adapter `arcade.audio` (même forme). Supprimer l'import `ArcadeList` devenu inutile.

- [ ] **Step 6: Vérifier, committer**

Run: `npx vitest run && npx tsc --noEmit` ; Expected: tout passe.

```bash
git add src/arcade/session.ts src/arcade/session.test.ts src/lib/arcadeWords.ts src/lib/arcadeWords.test.ts src/components/ChapterDetail.tsx
git commit -m "Plan 3b : sens par carte dans la séance d'arcade, cartes injouables écartées

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `ArcadeGame` : prop `assignment`, sens « both », séance vide

**Files:**
- Modify: `src/arcade/ArcadeGame.tsx`

**Interfaces:**
- Consumes : `ArcadeSession` (Task 3), `Wave.direction`.
- Produces : `ArcadeGame` accepte `assignment?: { direction: Direction | 'both'; count: number; secs: number }`. Avec `assignment`, les champs Liste, Sens et Mots par séance ne sont pas affichés (réglés par l'enseignant) ; la vitesse, les effets et les sons restent modifiables. `Settings.direction` devient `Direction | 'both'`. Le libellé de consigne, la lecture audio automatique et l'écran de réponse suivent `wave.direction`.

Pas de test automatisé (composant canvas) : la vérification se fait en navigateur (Task 9) ; le typecheck et le build couvrent les types.

- [ ] **Step 1: Modifier le composant**

1. Type : `interface Settings { ...; direction: Direction | 'both'; ... }` ; état initial : `direction: assignment?.direction ?? 'fr_to_l'`, `count: assignment?.count ?? 8`, `secs: assignment?.secs ?? 14`.
2. Nouvel état `const [waveDirection, setWaveDirection] = useState<Direction>('fr_to_l');` mis à jour dans `setupWave()` avec `setWaveDirection(wave.direction)`.
3. Dans `setupWave()` : remplacer `if (settingsRef.current.direction === 'l_to_fr') void playAudioFor(wave.word);` par `if (wave.direction === 'l_to_fr') void playAudioFor(wave.word);`.
4. Dans `finishWave()` (écran de réponse) : `answer: answerText(wave.word, wave.direction)`.
5. Dans le rendu : `settings.direction === 'fr_to_l' ? 'Trouve la traduction de' : 'Trouve le français de'` devient `waveDirection === 'fr_to_l' ? ... : ...` ; la condition du bouton « Écouter » devient `waveDirection === 'l_to_fr' && prompt`.
6. Écran de fin : remplacer `answerText(w, 'fr_to_l')` par une paire `w.fr / answerText(w, 'fr_to_l')` (inchangé, le résumé reste en français / langue cible).
7. Écran de réglages : option supplémentaire `<option value="both">Les deux sens</option>` dans le select du sens ; envelopper les trois `FormField` Liste, Sens, Mots par séance dans `{!assignment && (<>...</>)}`.
8. Séance vide : après `new ArcadeSession(...)`, si `session.total === 0` : `setStatus("Ces mots se ressemblent trop pour fabriquer des fausses réponses. Demande à ton enseignant de modifier la liste.")`, rester en phase `setup` et ne pas appeler `setupWave()`. Pour que le message soit visible en phase setup, afficher `status` dans l'écran de réglages sous le bouton (`<div className="plai-error" role="alert">{status}</div>` quand `phase === 'setup' && status`). Remettre `setStatus('')` au début de `startSession`.
9. Prop : ajouter `assignment?: {...}` à `Props`.

- [ ] **Step 2: Vérifier**

Run: `npx tsc --noEmit && npx vitest run && npx vite build` ; Expected: sans erreur.

- [ ] **Step 3: Commit**

```bash
git add src/arcade/ArcadeGame.tsx
git commit -m "Plan 3b : le jeu accepte un travail assigné, les deux sens et une séance vide

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fonctions Vercel `student-work` et `student-answers`

**Files:**
- Create: `api/student-work.ts`, `api/student-answers.ts`, `tests/api/student-work.test.ts`, `tests/api/student-answers.test.ts`

**Interfaces:**
- Consumes : RPC `lang_student_work`, `lang_student_record_answers` (Task 1) ; helpers `tests/api/helpers.ts` (`fakeReq`, `fakeRes`, `setEnv`, `stubSupabase`).
- Produces :
  - `GET /api/student-work` (en-tête `Authorization: Bearer <jeton 64 hex>`) → `200 { assignments: [...], events: [...] }` ; `401` si jeton absent, mal formé ou refusé par la base ; `405` hors GET ; `502` si la base répond en erreur.
  - `POST /api/student-answers` (corps `{ answers: WireAnswer[] }`, 1 à 50 éléments) → `200 { received, stored }` ; `400` corps invalide ; `401` jeton ; `429` si la base répond `{error:'trop'}` ; `405` hors POST.

- [ ] **Step 1: Tests de `student-work` (échec attendu)**

Créer `tests/api/student-work.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import work from '../../api/student-work';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

const TOKEN = 'b'.repeat(64);
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const run = async (req: ReturnType<typeof fakeReq>) => {
  const res = fakeRes();
  await work(req as never, res as never);
  return res;
};

describe('student-work', () => {
  it('200 avec le travail et le journal renvoyés par la base', async () => {
    const payload = { assignments: [{ id: 'a1', titre: 'T', words: [] }], events: [] };
    const fetchMock = stubSupabase(payload);
    const res = await run(fakeReq({ headers: bearer(TOKEN) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/rest/v1/rpc/lang_student_work');
    expect(JSON.parse(String(init.body))).toEqual({ p_token: TOKEN });
  });
  it('401 si la base répond null (jeton refusé)', async () => {
    stubSupabase(null);
    expect((await run(fakeReq({ headers: bearer(TOKEN) }))).statusCode).toBe(401);
  });
  it('401 sans appeler la base si le jeton est absent ou mal formé', async () => {
    const fetchMock = stubSupabase({});
    expect((await run(fakeReq({}))).statusCode).toBe(401);
    expect((await run(fakeReq({ headers: bearer('court') }))).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors GET, 502 si la base est en erreur', async () => {
    stubSupabase({});
    expect((await run(fakeReq({ method: 'POST', headers: bearer(TOKEN) }))).statusCode).toBe(405);
    stubSupabase({}, false);
    expect((await run(fakeReq({ headers: bearer(TOKEN) }))).statusCode).toBe(502);
  });
});
```

- [ ] **Step 2: Tests de `student-answers` (échec attendu)**

Créer `tests/api/student-answers.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import answers from '../../api/student-answers';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

const TOKEN = 'c'.repeat(64);
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const one = { id: '4c1f6a0e-0b7a-4e2c-9a39-6d2f5e0c1b11', word_id: 'w', direction: 'fr_to_l', mode: 'arcade_tir', verdict: 'juste', aide: false, test: false, ts: 1 };
const run = async (req: ReturnType<typeof fakeReq>) => {
  const res = fakeRes();
  await answers(req as never, res as never);
  return res;
};
const post = (body: unknown, headers = bearer(TOKEN)) => fakeReq({ method: 'POST', headers, body });

describe('student-answers', () => {
  it('200 et transmet le lot tel quel avec le jeton', async () => {
    const fetchMock = stubSupabase({ received: 1, stored: 1 });
    const res = await run(post({ answers: [one] }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: 1, stored: 1 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ p_token: TOKEN, p_answers: [one] });
  });
  it('400 sans appeler la base : corps absent, vide, trop long ou non tableau', async () => {
    const fetchMock = stubSupabase({});
    expect((await run(post(undefined))).statusCode).toBe(400);
    expect((await run(post({ answers: [] }))).statusCode).toBe(400);
    expect((await run(post({ answers: 'x' }))).statusCode).toBe(400);
    expect((await run(post({ answers: Array(51).fill(one) }))).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('401 : jeton mal formé (sans appel) ou refusé par la base', async () => {
    const fetchMock = stubSupabase(null);
    expect((await run(post({ answers: [one] }, bearer('court')))).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await run(post({ answers: [one] }))).statusCode).toBe(401);
  });
  it('429 quand la limite de débit est atteinte', async () => {
    stubSupabase({ error: 'trop' });
    expect((await run(post({ answers: [one] }))).statusCode).toBe(429);
  });
  it('405 hors POST', async () => {
    stubSupabase({});
    expect((await run(fakeReq({ method: 'GET', headers: bearer(TOKEN) }))).statusCode).toBe(405);
  });
});
```

Run: `npx vitest run tests/api` ; Expected: FAIL (modules absents).

- [ ] **Step 3: Implémenter `api/student-work.ts`**

```ts
// api/student-work.ts
// Fonction autonome : ne rien importer d'un autre fichier de api/ ni de src/ (voir student-me.ts).
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
    const response = await fetch(`${baseUrl}/rest/v1/rpc/lang_student_work`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Service indisponible' });
      return;
    }
    const work = await response.json();
    if (!work) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    res.status(200).json(work);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
```

- [ ] **Step 4: Implémenter `api/student-answers.ts`**

```ts
// api/student-answers.ts
// Fonction autonome : ne rien importer d'un autre fichier de api/ ni de src/ (voir student-me.ts).
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Méthode non autorisée' });
      return;
    }
    const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!/^[0-9a-f]{64}$/.test(token)) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length < 1 || answers.length > 50) {
      res.status(400).json({ error: 'Lot de réponses invalide' });
      return;
    }
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceKey) {
      res.status(500).json({ error: 'Configuration serveur manquante' });
      return;
    }
    const response = await fetch(`${baseUrl}/rest/v1/rpc/lang_student_record_answers`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_answers: answers }),
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Service indisponible' });
      return;
    }
    const result = (await response.json()) as { received?: number; stored?: number; error?: string } | null;
    if (!result) {
      res.status(401).json({ error: 'Session invalide' });
      return;
    }
    if (result.error === 'trop') {
      res.status(429).json({ error: 'Trop de réponses envoyées, réessaie dans une minute' });
      return;
    }
    res.status(200).json({ received: result.received ?? 0, stored: result.stored ?? 0 });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
```

- [ ] **Step 5: Vérifier, committer**

Run: `npx vitest run tests/api && npm run typecheck:api` ; Expected: PASS, aucune erreur.

```bash
git add api/student-work.ts api/student-answers.ts tests/api/student-work.test.ts tests/api/student-answers.test.ts
git commit -m "Plan 3b : fonctions Vercel du travail et du journal de l'élève

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Client élève : `studentApi`, `work.ts`, `answerQueue.ts`

**Files:**
- Modify: `src/lib/studentApi.ts`, `src/lib/studentApi.test.ts`
- Create: `src/lib/work.ts`, `src/lib/work.test.ts`, `src/lib/answerQueue.ts`, `src/lib/answerQueue.test.ts`

**Interfaces:**
- Consumes : `fetch` ; `AnswerEvent`, `CardState`, `Word`, `Direction`, `replayEvents`, `expandCards`, `isMastered`, `cardKey` du moteur.
- Produces :
  - `studentApi.ts` : `interface WorkWord { id; fr; cible; article: 'de' | 'het' | null; synonymes_fr: string[]; synonymes_cible: string[]; audio_url: string | null }` ; `interface WorkAssignment { id; titre; chapter_titre; sens: Direction | 'both'; mots_par_seance: number; vitesse_s: number; echeance: string | null; words: WorkWord[] }` ; `interface WireAnswer { id: string; word_id: string; direction: Direction; mode: string; verdict: string; error_type: string | null; aide: boolean; test: boolean; ts: number; answer_text: string | null; latency_ms: number | null; assignment_id: string | null }` ; `type WorkResult = { status: 'ok'; assignments: WorkAssignment[]; events: WireAnswer[] } | { status: 'expire' } | { status: 'reseau' }` ; `fetchWork(token, f?): Promise<WorkResult>` ; `type SendResult = 'ok' | 'expire' | 'trop' | 'reseau'` ; `sendAnswers(token, answers, f?): Promise<SendResult>`.
  - `work.ts` : `toWords(a: WorkAssignment): Word[]` ; `toEvents(studentId: string, wire: WireAnswer[]): AnswerEvent[]` ; `statesFrom(wire: WireAnswer[]): Map<string, CardState>` ; `progress(a: WorkAssignment, states: Map<string, CardState>): { total: number; mastered: number }` ; `toWire(ev: AnswerEvent): WireAnswer`.
  - `answerQueue.ts` : `QUEUE_KEY`, `createQueue(storage: Storage | null, key?: string): AnswerQueue` ; `interface AnswerQueue { push(a: WireAnswer): void; size(): number; peek(): WireAnswer[]; flush(send: (batch: WireAnswer[]) => Promise<SendResult>): Promise<SendResult | 'vide'>; clear(): void }`.

- [ ] **Step 1: Tests `studentApi` (échec attendu)**

Ajouter à `src/lib/studentApi.test.ts` (même style que les tests existants avec un `fetch` factice) :

```ts
describe('fetchWork', () => {
  const ok = (body: unknown, status = 200) => (async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
  it('ok : renvoie le travail et le journal', async () => {
    const r = await fetchWork('t', ok({ assignments: [{ id: 'a' }], events: [] }));
    expect(r).toEqual({ status: 'ok', assignments: [{ id: 'a' }], events: [] });
  });
  it('401 : session expirée', async () => expect(await fetchWork('t', ok({}, 401))).toEqual({ status: 'expire' }));
  it('erreur serveur ou réseau : reseau', async () => {
    expect(await fetchWork('t', ok({}, 502))).toEqual({ status: 'reseau' });
    expect(await fetchWork('t', (async () => { throw new Error('x'); }) as unknown as typeof fetch)).toEqual({ status: 'reseau' });
  });
});

describe('sendAnswers', () => {
  const reply = (status: number) => (async () => ({ ok: status < 400, status, json: async () => ({}) })) as unknown as typeof fetch;
  const sample = [{ id: 'i', word_id: 'w', direction: 'fr_to_l', mode: 'arcade_tir', verdict: 'juste', error_type: null, aide: false, test: false, ts: 1, answer_text: null, latency_ms: null, assignment_id: null }] as never;
  it('ok / expire / trop / reseau', async () => {
    expect(await sendAnswers('t', sample, reply(200))).toBe('ok');
    expect(await sendAnswers('t', sample, reply(401))).toBe('expire');
    expect(await sendAnswers('t', sample, reply(429))).toBe('trop');
    expect(await sendAnswers('t', sample, reply(500))).toBe('reseau');
    expect(await sendAnswers('t', sample, (async () => { throw new Error('x'); }) as unknown as typeof fetch)).toBe('reseau');
  });
  it('un 400 (lot invalide) est traité comme ok : le renvoyer ne servirait à rien', async () => {
    expect(await sendAnswers('t', sample, reply(400))).toBe('ok');
  });
});
```

(ajouter `fetchWork`, `sendAnswers` à l'import en tête du fichier.)

- [ ] **Step 2: Implémenter dans `src/lib/studentApi.ts`**

Ajouter après `fetchMe` :

```ts
import type { Direction } from '../engine/types';

export interface WorkWord {
  id: string;
  fr: string;
  cible: string;
  article: 'de' | 'het' | null;
  synonymes_fr: string[];
  synonymes_cible: string[];
  audio_url: string | null;
}

export interface WorkAssignment {
  id: string;
  titre: string;
  chapter_titre: string;
  sens: Direction | 'both';
  mots_par_seance: number;
  vitesse_s: number;
  echeance: string | null;
  words: WorkWord[];
}

export interface WireAnswer {
  id: string;
  word_id: string;
  direction: Direction;
  mode: string;
  verdict: string;
  error_type: string | null;
  aide: boolean;
  test: boolean;
  /** Millisecondes depuis l'epoch. */
  ts: number;
  answer_text: string | null;
  latency_ms: number | null;
  assignment_id: string | null;
}

export type WorkResult =
  | { status: 'ok'; assignments: WorkAssignment[]; events: WireAnswer[] }
  | { status: 'expire' }
  | { status: 'reseau' };

export async function fetchWork(token: string, f: Fetch = fetch): Promise<WorkResult> {
  try {
    const r = await f('/api/student-work', { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) return { status: 'expire' };
    if (!r.ok) return { status: 'reseau' };
    const d = (await r.json()) as { assignments?: WorkAssignment[]; events?: WireAnswer[] };
    return { status: 'ok', assignments: d.assignments ?? [], events: d.events ?? [] };
  } catch {
    return { status: 'reseau' };
  }
}

export type SendResult = 'ok' | 'expire' | 'trop' | 'reseau';

/** Envoie un lot (50 au plus). Un 400 vaut « ok » : un lot refusé comme invalide ne deviendrait jamais valide. */
export async function sendAnswers(token: string, answers: WireAnswer[], f: Fetch = fetch): Promise<SendResult> {
  try {
    const r = await f('/api/student-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answers }),
    });
    if (r.status === 401) return 'expire';
    if (r.status === 429) return 'trop';
    if (r.status === 400) return 'ok';
    return r.ok ? 'ok' : 'reseau';
  } catch {
    return 'reseau';
  }
}
```

(l'import de `Direction` va en tête du fichier avec les autres.) Run : `npx vitest run src/lib/studentApi.test.ts` ; PASS.

- [ ] **Step 3: Tests `work.ts` (échec attendu)**

Créer `src/lib/work.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import type { AnswerEvent } from '../engine';
import type { WireAnswer, WorkAssignment } from './studentApi';
import { progress, statesFrom, toEvents, toWire, toWords } from './work';

const NOW = Date.UTC(2026, 9, 13, 10);
const assignment: WorkAssignment = {
  id: 'a1', titre: 'École', chapter_titre: 'École', sens: 'fr_to_l', mots_par_seance: 8, vitesse_s: 14, echeance: null,
  words: [
    { id: 'w1', fr: 'le vélo', cible: 'fiets', article: 'de', synonymes_fr: [], synonymes_cible: [], audio_url: null },
    { id: 'w2', fr: 'la gomme', cible: 'gom', article: 'de', synonymes_fr: [], synonymes_cible: [], audio_url: 'https://x/g.mp3' },
    { id: 'w3', fr: 'le cahier', cible: 'schrift', article: 'het', synonymes_fr: [], synonymes_cible: [], audio_url: null },
  ],
};
const wire = (over: Partial<WireAnswer>): WireAnswer => ({
  id: 'e', word_id: 'w1', direction: 'fr_to_l', mode: 'arcade_tir', verdict: 'juste', error_type: null, aide: false, test: false,
  ts: NOW, answer_text: null, latency_ms: null, assignment_id: 'a1', ...over,
});

describe('work', () => {
  it('toWords convertit les mots de l\'API en mots du moteur', () => {
    expect(toWords(assignment)[0]).toEqual({ id: 'w1', fr: 'le vélo', cible: 'fiets', article: 'de', synonymesFr: [], synonymesCible: [] });
  });
  it('toEvents / toWire : aller-retour sans perte', () => {
    const ev = toEvents('moi', [wire({ id: 'e1', answer_text: 'de fiets', latency_ms: 900 })])[0];
    expect(ev).toMatchObject({ id: 'e1', studentId: 'moi', wordId: 'w1', direction: 'fr_to_l', mode: 'arcade_tir', verdict: 'juste', answerText: 'de fiets', latencyMs: 900, blocId: 'a1' });
    expect(toWire(ev)).toEqual(wire({ id: 'e1', answer_text: 'de fiets', latency_ms: 900 }));
  });
  it('toWire convertit un AnswerEvent du jeu (blocId devient assignment_id, champs absents deviennent null)', () => {
    const ev: AnswerEvent = { id: 'x', studentId: 's', wordId: 'w2', direction: 'l_to_fr', mode: 'arcade_tir', verdict: 'faux', errorType: 'confusion_liste', aide: false, test: false, ts: 5, blocId: 'a1' };
    expect(toWire(ev)).toMatchObject({ word_id: 'w2', error_type: 'confusion_liste', answer_text: null, latency_ms: null, assignment_id: 'a1' });
  });
  it('statesFrom recalcule les boîtes (plafond 3 en arcade) et ignore les doublons', () => {
    const events = [1, 2, 3, 4, 5].map((i) => wire({ id: `e${i}`, ts: NOW + i }));
    const states = statesFrom([...events, ...events]);
    expect(states.get('w1:fr_to_l')!.box).toBe(3);
    expect(states.get('w1:fr_to_l')!.nbJuste).toBe(5);
  });
  it('progress compte les cartes maîtrisées (boîte 4 ou plus) selon le sens du travail', () => {
    expect(progress(assignment, new Map())).toEqual({ total: 3, mastered: 0 });
    expect(progress({ ...assignment, sens: 'both' }, new Map())).toEqual({ total: 6, mastered: 0 });
  });
});
```

- [ ] **Step 4: Implémenter `src/lib/work.ts`**

```ts
import { cardKey, expandCards, isMastered, replayEvents, type AnswerEvent, type CardState, type Word } from '../engine';
import type { WireAnswer, WorkAssignment } from './studentApi';

export function toWords(a: WorkAssignment): Word[] {
  return a.words.map((w) => ({ id: w.id, fr: w.fr, cible: w.cible, article: w.article, synonymesFr: w.synonymes_fr, synonymesCible: w.synonymes_cible }));
}

export function toEvents(studentId: string, wire: WireAnswer[]): AnswerEvent[] {
  return wire.map((w) => ({
    id: w.id,
    studentId,
    wordId: w.word_id,
    direction: w.direction,
    mode: w.mode as AnswerEvent['mode'],
    verdict: w.verdict as AnswerEvent['verdict'],
    errorType: w.error_type as AnswerEvent['errorType'],
    aide: w.aide,
    test: w.test,
    ts: w.ts,
    answerText: w.answer_text ?? undefined,
    latencyMs: w.latency_ms ?? undefined,
    blocId: w.assignment_id ?? undefined,
  }));
}

export function toWire(ev: AnswerEvent): WireAnswer {
  return {
    id: ev.id,
    word_id: ev.wordId,
    direction: ev.direction,
    mode: ev.mode,
    verdict: ev.verdict,
    error_type: ev.errorType,
    aide: ev.aide,
    test: ev.test,
    ts: ev.ts,
    answer_text: ev.answerText ?? null,
    latency_ms: ev.latencyMs ?? null,
    assignment_id: ev.blocId ?? null,
  };
}

/** États Leitner d'un élève, recalculés depuis son journal (ordre et doublons sans effet). */
export function statesFrom(wire: WireAnswer[]): Map<string, CardState> {
  return replayEvents(toEvents('moi', wire));
}

export function progress(a: WorkAssignment, states: Map<string, CardState>): { total: number; mastered: number } {
  const cards = expandCards(a.words, a.sens);
  return { total: cards.length, mastered: cards.filter((c) => isMastered(states.get(cardKey(c.wordId, c.direction)))).length };
}
```

Run: `npx vitest run src/lib/work.test.ts` ; PASS.

- [ ] **Step 5: Tests de la file (échec attendu)**

Créer `src/lib/answerQueue.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { createQueue } from './answerQueue';
import type { SendResult, WireAnswer } from './studentApi';

const a = (id: string): WireAnswer => ({ id, word_id: 'w', direction: 'fr_to_l', mode: 'arcade_tir', verdict: 'juste', error_type: null, aide: false, test: false, ts: 1, answer_text: null, latency_ms: null, assignment_id: null });
const memory = (): Storage => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
};

describe('answerQueue', () => {
  it('conserve les réponses dans le stockage (survit à un rechargement)', () => {
    const s = memory();
    createQueue(s).push(a('1'));
    expect(createQueue(s).size()).toBe(1);
  });
  it('envoie par lots de 50 et vide la file quand tout part', async () => {
    const q = createQueue(memory());
    for (let i = 0; i < 120; i++) q.push(a(`e${i}`));
    const sizes: number[] = [];
    const r = await q.flush(async (batch) => { sizes.push(batch.length); return 'ok'; });
    expect(r).toBe('ok');
    expect(sizes).toEqual([50, 50, 20]);
    expect(q.size()).toBe(0);
  });
  it('garde tout et s\'arrête au premier échec (réseau, session expirée, limite de débit)', async () => {
    for (const fail of ['reseau', 'expire', 'trop'] as SendResult[]) {
      const q = createQueue(memory());
      for (let i = 0; i < 70; i++) q.push(a(`e${i}`));
      let calls = 0;
      const r = await q.flush(async () => (++calls === 1 ? 'ok' : fail));
      expect(r).toBe(fail);
      expect(q.size()).toBe(20); // le premier lot de 50 est parti, le reste attend
    }
  });
  it('un renvoi après échec renvoie les mêmes identifiants (aucun doublon côté serveur)', async () => {
    const q = createQueue(memory());
    q.push(a('x'));
    const seen: string[] = [];
    await q.flush(async (b) => { seen.push(...b.map((x) => x.id)); return 'reseau'; });
    await q.flush(async (b) => { seen.push(...b.map((x) => x.id)); return 'ok'; });
    expect(seen).toEqual(['x', 'x']);
    expect(q.size()).toBe(0);
  });
  it('file vide : « vide » sans appeler l\'envoi', async () => {
    let called = false;
    expect(await createQueue(memory()).flush(async () => { called = true; return 'ok'; })).toBe('vide');
    expect(called).toBe(false);
  });
  it('sans stockage (navigation privée) : la file reste en mémoire', async () => {
    const q = createQueue(null);
    q.push(a('1'));
    expect(q.size()).toBe(1);
  });
  it('plafonne à 2000 réponses en gardant les plus récentes', () => {
    const q = createQueue(memory());
    for (let i = 0; i < 2005; i++) q.push(a(`e${i}`));
    expect(q.size()).toBe(2000);
  });
  it('un stockage corrompu est ignoré', () => {
    const s = memory();
    s.setItem('langactif.eleve.file', '{pas du json');
    expect(createQueue(s).size()).toBe(0);
  });
});
```

- [ ] **Step 6: Implémenter `src/lib/answerQueue.ts`**

```ts
import type { SendResult, WireAnswer } from './studentApi';

export const QUEUE_KEY = 'langactif.eleve.file';
const MAX = 2000;
const BATCH = 50;

export interface AnswerQueue {
  push(a: WireAnswer): void;
  size(): number;
  /** Copie de la file (lecture seule). */
  peek(): WireAnswer[];
  /** Envoie la file par lots ; s'arrête au premier échec et garde ce qui n'est pas parti. */
  flush(send: (batch: WireAnswer[]) => Promise<SendResult>): Promise<SendResult | 'vide'>;
  clear(): void;
}

export function createQueue(storage: Storage | null, key: string = QUEUE_KEY): AnswerQueue {
  let memory: WireAnswer[] = [];
  const load = (): WireAnswer[] => {
    if (!storage) return memory;
    try {
      const raw = storage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as WireAnswer[]) : [];
    } catch {
      return [];
    }
  };
  const save = (items: WireAnswer[]) => {
    memory = items;
    if (!storage) return;
    try {
      if (items.length === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(items));
    } catch {
      /* stockage plein ou bloqué : la file reste en mémoire */
    }
  };
  return {
    push(a) {
      const items = [...load(), a];
      save(items.length > MAX ? items.slice(items.length - MAX) : items);
    },
    size: () => load().length,
    peek: () => [...load()],
    clear: () => save([]),
    async flush(send) {
      let items = load();
      if (items.length === 0) return 'vide';
      while (items.length > 0) {
        const batch = items.slice(0, BATCH);
        const result = await send(batch);
        if (result !== 'ok') return result;
        // on relit : de nouvelles réponses ont pu arriver pendant l'envoi ; le lot parti est toujours en tête
        items = load().slice(batch.length);
        save(items);
      }
      return 'ok';
    },
  };
}
```

Attention : `load()` après `send` relit le stockage complet ; comme le lot envoyé occupe toujours la tête de la file, `load().slice(batch.length)` retire exactement le lot parti et conserve les ajouts. Le test « 120 réponses » vérifie ce comportement.

- [ ] **Step 7: Vérifier, committer**

Run: `npx vitest run && npx tsc --noEmit` ; Expected: tout passe.

```bash
git add src/lib/studentApi.ts src/lib/studentApi.test.ts src/lib/work.ts src/lib/work.test.ts src/lib/answerQueue.ts src/lib/answerQueue.test.ts
git commit -m "Plan 3b : client élève (travail, envoi des réponses, file locale, états recalculés)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Accueil élève : travail, jeu et synchronisation

**Files:**
- Create: `src/components/StudentHome.tsx`
- Modify: `src/components/StudentApp.tsx`

**Interfaces:**
- Consumes : `fetchWork`, `sendAnswers`, `logoutStudent`, `loadToken`, `clearToken` (`studentApi`) ; `statesFrom`, `progress`, `toWords`, `toWire` (`work`) ; `createQueue` (`answerQueue`) ; `ArcadeGame` (props `assignment`, `states`, `onAnswer`, `studentId`, `blocId`) ; `deadlineLabel` (`assignments`).
- Produces : `StudentHome({ pseudo, onSignOut, onExpired }: { pseudo: string; onSignOut: () => void; onExpired: () => void })`.

- [ ] **Step 1: Écrire `src/components/StudentHome.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArcadeGame } from '../arcade/ArcadeGame';
import type { AnswerEvent } from '../engine';
import { createQueue } from '../lib/answerQueue';
import { deadlineLabel } from '../lib/assignments';
import { defaultStores, fetchWork, loadToken, sendAnswers, type WireAnswer, type WorkAssignment } from '../lib/studentApi';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { progress, statesFrom, toWire, toWords } from '../lib/work';
import { PrivacyInfo } from './PrivacyInfo';

interface Props {
  pseudo: string;
  onSignOut: () => void;
  /** Session terminée côté serveur : l'écran de connexion prend le relais (la file de réponses est conservée). */
  onExpired: () => void;
}

type Load = { status: 'loading' } | { status: 'ok'; assignments: WorkAssignment[]; events: WireAnswer[] } | { status: 'reseau' };

export function StudentHome({ pseudo, onSignOut, onExpired }: Props) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [playing, setPlaying] = useState<WorkAssignment | null>(null);
  const [pending, setPending] = useState(0);
  const [note, setNote] = useState('');
  const queue = useMemo(() => createQueue(defaultStores().local), []);
  const flushing = useRef(false);
  const expiredRef = useRef(onExpired);
  expiredRef.current = onExpired;

  const flush = useCallback(async (): Promise<void> => {
    const token = loadToken();
    if (!token || flushing.current) return;
    flushing.current = true;
    try {
      const r = await queue.flush((batch) => sendAnswers(token, batch));
      if (r === 'expire') {
        expiredRef.current();
      } else if (r === 'reseau' || r === 'trop') {
        setNote(`${queue.size()} réponse(s) attendent d'être envoyées. Elles partiront dès que la connexion revient.`);
      } else {
        setNote('');
      }
    } finally {
      flushing.current = false;
      setPending(queue.size());
    }
  }, [queue]);

  const refresh = useCallback(async () => {
    const token = loadToken();
    if (!token) return expiredRef.current();
    await flush();
    const r = await fetchWork(token);
    if (r.status === 'expire') return expiredRef.current();
    setLoad(r.status === 'ok' ? { status: 'ok', assignments: r.assignments, events: r.events } : { status: 'reseau' });
  }, [flush]);

  useEffect(() => {
    void refresh();
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [refresh, flush]);

  const onAnswer = useCallback(
    (ev: AnswerEvent) => {
      queue.push(toWire(ev));
      setPending(queue.size());
      void flush();
    },
    [queue, flush],
  );

  // journal du serveur + réponses encore en file : même rejeu, mêmes identifiants (les doublons sont ignorés)
  const states = useMemo(
    () => (load.status === 'ok' ? statesFrom([...load.events, ...queue.peek()]) : new Map()),
    // `pending` change à chaque ajout ou envoi : les états suivent la file
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load, pending, queue],
  );

  if (playing) {
    return (
      <ArcadeGame
        lists={[{ id: playing.id, nom: playing.titre, words: toWords(playing) }]}
        audioByWordId={Object.fromEntries(playing.words.map((w) => [w.id, w.audio_url]))}
        studentId="moi"
        blocId={playing.id}
        states={states}
        assignment={{ direction: playing.sens, count: playing.mots_par_seance, secs: playing.vitesse_s }}
        onAnswer={onAnswer}
        onExit={() => {
          setPlaying(null);
          void refresh();
        }}
      />
    );
  }

  const signOut = async () => {
    await flush();
    if (
      queue.size() > 0 &&
      !window.confirm(`${queue.size()} réponse(s) ne sont pas encore envoyées. Si tu te déconnectes maintenant, elles seront perdues. Te déconnecter quand même ?`)
    ) {
      return;
    }
    queue.clear();
    onSignOut();
  };

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 28, marginBottom: 12 }}>Bonjour, {pseudo}</h1>
      {note && <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>{note}</div>}
      {pending > 0 && !note && <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>{pending} réponse(s) en cours d'envoi.</div>}
      {load.status === 'loading' && <p aria-live="polite">Chargement de ton travail...</p>}
      {load.status === 'reseau' && (
        <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>
          Connexion impossible : vérifie ton réseau.{' '}
          <button type="button" className="plai-btn-ghost" onClick={() => void refresh()}>Réessayer</button>
        </div>
      )}
      {load.status === 'ok' && load.assignments.length === 0 && <p className="plai-empty">Ton enseignant n'a pas encore assigné de travail.</p>}
      {load.status === 'ok' &&
        load.assignments.map((a) => {
          const p = progress(a, states);
          return (
            <div key={a.id} className="plai-card" style={{ marginBottom: 12 }}>
              <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 4 }}>{a.titre}</h2>
              <p style={{ color: 'var(--text2)', marginBottom: 4 }}>{a.words.length} mots · {deadlineLabel(a.echeance)}</p>
              <p style={{ marginBottom: 8 }}>
                Cartes maîtrisées : <strong>{p.mastered}</strong> sur {p.total}
              </p>
              <progress
                max={Math.max(p.total, 1)}
                value={p.mastered}
                aria-label={`${p.mastered} cartes maîtrisées sur ${p.total}`}
                style={{ width: '100%', height: 16, marginBottom: 12 }}
              />
              <button type="button" className="plai-btn" onClick={() => setPlaying(a)}>Jouer</button>
            </div>
          );
        })}
      <button type="button" className="plai-btn-ghost" onClick={() => void signOut()}>Se déconnecter</button>
      <PrivacyInfo />
    </section>
  );
}
```

- [ ] **Step 2: Déléguer l'accueil dans `StudentApp.tsx`**

Supprimer le composant `Home` local ; importer `StudentHome`, `createQueue` et `defaultStores` ; remplacer `{phase === 'home' && <Home pseudo={pseudo} onSignOut={signOut} />}` par :

```tsx
{phase === 'home' && (
  <StudentHome
    pseudo={pseudo}
    onSignOut={signOut}
    onExpired={() => {
      clearToken();
      setNetworkNote(false);
      setPhase('login');
    }}
  />
)}
```

Une session expirée **conserve la file** de réponses (elle repart avec le nouveau jeton à la reconnexion du même élève). Pour qu'un autre élève qui utiliserait ensuite le même appareil n'envoie pas ces réponses avec son propre jeton, vider la file à la connexion d'un pseudo différent du dernier. Dans `Login`, remplacer `onLoggedIn={(p) => { setPseudo(p); setPhase('home'); }}` par :

```tsx
onLoggedIn={(p) => {
  try {
    const store = defaultStores().local;
    if (store && store.getItem('langactif.eleve.dernier') !== p) createQueue(store).clear();
    store?.setItem('langactif.eleve.dernier', p);
  } catch {
    /* stockage bloqué : rien à nettoyer */
  }
  setPseudo(p);
  setPhase('home');
}}
```

La déconnexion volontaire vide déjà la file (`StudentHome.signOut`, après confirmation).

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit && npx vitest run && npx vite build` ; Expected: sans erreur.

- [ ] **Step 4: Commit**

```bash
git add src/components/StudentHome.tsx src/components/StudentApp.tsx
git commit -m "Plan 3b : accueil élève avec travail assigné, jeu d'arcade et envoi des réponses

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Espace enseignant : bloc « Travail assigné », aperçu élève, avertissements, page d'information

**Files:**
- Create: `src/components/AssignmentsPanel.tsx`
- Modify: `src/components/GroupDetail.tsx`, `src/components/ChapterDetail.tsx`, `src/components/PrivacyInfo.tsx`

**Interfaces:**
- Consumes : `listAssignments`, `createAssignment`, `archiveAssignment`, `deleteAssignment`, `updateAssignment`, `deadlineLabel`, `Sens` (`assignments`) ; `listChapters`, `getChapter` (`chapters`) ; `chapterToArcade` ; `ArcadeGame` ; `FormField` ; `langueLabel`.
- Produces : `AssignmentsPanel({ client, groupId, groupeLangue, archived }: { client: SupabaseClient; groupId: string; groupeLangue: Langue; archived: boolean })`.

- [ ] **Step 1: Écrire `AssignmentsPanel.tsx`**

```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArcadeGame, type ArcadeList } from '../arcade/ArcadeGame';
import type { Langue } from '../engine/types';
import { chapterToArcade } from '../lib/arcadeWords';
import {
  archiveAssignment,
  createAssignment,
  deadlineLabel,
  deleteAssignment,
  listAssignments,
  senseLabel,
  updateAssignment,
  type AssignmentRow,
  type Sens,
} from '../lib/assignments';
import { getChapter, listChapters, type ChapterDetail, type ChapterSummary } from '../lib/chapters';
import { langueLabel } from '../lib/labels';
import { FormField } from './FormField';

interface Props {
  client: SupabaseClient;
  groupId: string;
  groupeLangue: Langue;
  archived: boolean;
}

interface Form {
  chapterId: string;
  listId: string;
  titre: string;
  sens: Sens;
  mots: number;
  vitesse: number;
  echeance: string;
}

const EMPTY: Form = { chapterId: '', listId: '', titre: '', sens: 'fr_to_l', mots: 8, vitesse: 14, echeance: '' };

export function AssignmentsPanel({ client, groupId, groupeLangue, archived }: Props) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [detail, setDetail] = useState<ChapterDetail | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [preview, setPreview] = useState<{ row: AssignmentRow; lists: ArcadeList[]; audio: Record<string, string | null> } | null>(null);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Une erreur est survenue.');

  const reload = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([listAssignments(client, groupId), listChapters(client)]);
      setRows(r);
      setChapters(c.filter((x) => x.langue === groupeLangue));
      setError(null);
    } catch (e) {
      fail(e);
    }
  }, [client, groupId, groupeLangue]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // la liste des parties proposées dépend du chapitre choisi
  useEffect(() => {
    let alive = true;
    setDetail(null);
    if (!form.chapterId) return;
    getChapter(client, form.chapterId)
      .then((c) => alive && setDetail(c))
      .catch((e) => alive && fail(e));
    return () => {
      alive = false;
    };
  }, [client, form.chapterId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const wordsIn = (c: ChapterDetail, listId: string) =>
    c.lists.filter((l) => !listId || l.id === listId).reduce((n, l) => n + l.words.length, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.chapterId) {
      setError('Choisis un chapitre.');
      return;
    }
    setBusy(true);
    try {
      await createAssignment(client, {
        groupId,
        chapterId: form.chapterId,
        listId: form.listId || null,
        titre: form.titre,
        sens: form.sens,
        mots: form.mots,
        vitesse: form.vitesse,
        echeance: form.echeance || null,
      });
      setForm((f) => ({ ...EMPTY, chapterId: f.chapterId }));
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (row: AssignmentRow) => {
    try {
      const chapter = await getChapter(client, row.chapter_id);
      const { lists, audio } = chapterToArcade(chapter, row.list_id);
      setPreview({ row, lists, audio });
    } catch (err) {
      fail(err);
    }
  };

  if (preview) {
    const a = preview.row;
    return (
      <ArcadeGame
        preview
        lists={preview.lists}
        audioByWordId={preview.audio}
        studentId="essai-enseignant"
        blocId={a.id}
        assignment={{ direction: a.sens, count: a.mots_par_seance, secs: a.vitesse_s }}
        onExit={() => setPreview(null)}
      />
    );
  }

  const active = rows.filter((r) => !r.archived_at);
  const done = rows.filter((r) => r.archived_at);

  return (
    <div className="plai-card" style={{ marginTop: '1rem' }}>
      <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Travail assigné</h2>
      <p style={{ color: 'var(--text2)', marginBottom: 12 }}>
        Les élèves de ce groupe voient ces travaux à leur prochaine connexion et y jouent en mode arcade. Chaque réponse alimente la
        liste des mots à revoir de l'élève.
      </p>
      {error && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      {active.length === 0 && <p className="plai-empty">Aucun travail assigné pour l'instant.</p>}
      {active.map((a) => (
        <div key={a.id} className="plai-card" style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, marginBottom: 4 }}>{a.titre}</h3>
          <p style={{ color: 'var(--text2)', marginBottom: 8 }}>
            {a.chapterNumero}. {a.chapterTitre}
            {a.listNom ? ` : ${a.listNom}` : ''} · {senseLabel(a.sens)} · {a.mots_par_seance} mots par séance · {deadlineLabel(a.echeance)}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="plai-btn" disabled={busy} onClick={() => void openPreview(a)}>Voir comme un élève</button>
            {editing?.id === a.id ? (
              <>
                <label className="plai-label" htmlFor={`ech-${a.id}`} style={{ margin: 0 }}>Nouvelle échéance</label>
                <input id={`ech-${a.id}`} type="date" className="plai-input" style={{ width: 'auto' }} value={editing.value} onChange={(e) => setEditing({ id: a.id, value: e.target.value })} />
                <button
                  type="button"
                  className="plai-btn"
                  disabled={busy}
                  onClick={() => void run(async () => { await updateAssignment(client, a.id, { echeance: editing.value || null }); setEditing(null); })}
                >
                  Enregistrer
                </button>
                <button type="button" className="plai-btn-ghost" onClick={() => setEditing(null)}>Annuler</button>
              </>
            ) : (
              <button type="button" className="plai-btn-ghost" disabled={busy || archived} onClick={() => setEditing({ id: a.id, value: a.echeance ?? '' })}>Changer l'échéance</button>
            )}
            <button type="button" className="plai-btn-ghost" disabled={busy || archived} onClick={() => void run(() => archiveAssignment(client, a.id))}>Archiver</button>
            <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirmDelete(a.id)}>Supprimer</button>
          </div>
          {confirmDelete === a.id && (
            <div role="alert" style={{ marginTop: 10 }}>
              <p style={{ marginBottom: 8 }}>
                Supprimer « {a.titre} » ? Le travail disparaît de l'écran des élèves. Leurs réponses restent dans leur journal.
              </p>
              <button type="button" className="plai-btn" disabled={busy} style={{ marginRight: 8 }} onClick={() => void run(async () => { await deleteAssignment(client, a.id); setConfirmDelete(null); })}>
                Oui, supprimer
              </button>
              <button type="button" className="plai-btn-ghost" onClick={() => setConfirmDelete(null)}>Annuler</button>
            </div>
          )}
        </div>
      ))}

      {done.length > 0 && (
        <details style={{ margin: '8px 0 12px' }}>
          <summary style={{ cursor: 'pointer', minHeight: 44 }}>Travaux archivés ({done.length})</summary>
          <ul style={{ paddingLeft: 20 }}>
            {done.map((a) => (
              <li key={a.id}>{a.titre} ({a.chapterNumero}. {a.chapterTitre})</li>
            ))}
          </ul>
        </details>
      )}

      <h3 className="font-serif" style={{ fontSize: 18, margin: '1.25rem 0 8px' }}>Assigner un chapitre</h3>
      {archived && <p className="plai-banner" role="status">Groupe archivé : impossible d'assigner du travail.</p>}
      {!archived && chapters.length === 0 && (
        <p className="plai-empty">Tu n'as pas encore de chapitre en {langueLabel(groupeLangue)}. Importes-en un depuis « Mes chapitres ».</p>
      )}
      {!archived && chapters.length > 0 && (
        <form onSubmit={submit} noValidate>
          <FormField label="Chapitre" help="Le travail porte sur les mots de ce chapitre. Si tu le modifies ou le réimportes plus tard, les élèves verront la version à jour.">
            <select className="plai-input" value={form.chapterId} onChange={(e) => setForm((f) => ({ ...f, chapterId: e.target.value, listId: '' }))}>
              <option value="">Choisis un chapitre</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.numero}. {c.titre} (niveau {c.niveau})</option>
              ))}
            </select>
          </FormField>
          <FormField label="Partie du chapitre" help="Au-delà de 300 mots, choisis une liste. Une assignation de 30 à 60 mots est un bon point de départ.">
            <select className="plai-input" value={form.listId} onChange={(e) => set('listId', e.target.value)} disabled={!detail}>
              <option value="">{detail ? `Tout le chapitre (${wordsIn(detail, '')} mots)` : 'Choisis d\'abord un chapitre'}</option>
              {detail?.lists.map((l) => (
                <option key={l.id} value={l.id}>{l.nom} ({l.words.length} mots)</option>
              ))}
            </select>
          </FormField>
          <FormField label="Titre affiché à l'élève" help="Laisse vide pour reprendre le titre du chapitre. L'élève ne voit que ce titre.">
            <input className="plai-input" value={form.titre} maxLength={100} placeholder="Unité 3 : l'école" onChange={(e) => set('titre', e.target.value)} />
          </FormField>
          <FormField label="Sens" help="Vers la langue cible : l'élève cherche la traduction. Les deux sens : chaque mot est travaillé dans les deux directions, avec des progressions séparées.">
            <select className="plai-input" value={form.sens} onChange={(e) => set('sens', e.target.value as Sens)}>
              <option value="fr_to_l">Français vers langue cible</option>
              <option value="l_to_fr">Langue cible vers français</option>
              <option value="both">Les deux sens</option>
            </select>
          </FormField>
          <FormField label="Mots par séance" help="Une séance courte vaut mieux qu'une longue. Les mots à revoir passent avant les mots nouveaux.">
            <select className="plai-input" value={form.mots} onChange={(e) => set('mots', Number(e.target.value))}>
              {[5, 8, 12, 15, 20].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Vitesse de chute" help="Vitesse de départ proposée à l'élève ; il peut la changer. Aucun point n'est donné pour la vitesse.">
            <select className="plai-input" value={form.vitesse} onChange={(e) => set('vitesse', Number(e.target.value))}>
              <option value={20}>Très lente</option>
              <option value={14}>Lente</option>
              <option value={9}>Normale</option>
            </select>
          </FormField>
          <FormField label="Échéance (facultatif)" help="Date indicative affichée à l'élève. Le travail reste jouable après cette date.">
            <input type="date" className="plai-input" value={form.echeance} onChange={(e) => set('echeance', e.target.value)} />
          </FormField>
          <button type="submit" className="plai-btn" disabled={busy}>{busy ? 'Enregistrement...' : 'Assigner'}</button>
        </form>
      )}
    </div>
  );
}
```

Après assignation, l'élève voit le travail à sa prochaine ouverture de l'accueil (pas de notification).

- [ ] **Step 2: Insérer le bloc dans `GroupDetail.tsx`**

Après le bloc « Places » (la carte `plai-card` se terminant avant « Ajouter des places »), insérer :

```tsx
<AssignmentsPanel client={client} groupId={group.id} groupeLangue={group.langue} archived={archived} />
```

avec l'import `import { AssignmentsPanel } from './AssignmentsPanel';`.

- [ ] **Step 3: Avertir à la suppression d'un chapitre (`ChapterDetail.tsx`)**

Dans le texte de confirmation de suppression, ajouter : « Les travaux assignés à partir de ce chapitre et les réponses des élèves sur ses mots seront aussi supprimés. »

- [ ] **Step 4: Mettre à jour `PrivacyInfo.tsx`**

Remplacer les deux puces « Tes données restent… » et « La durée exacte n'est pas encore fixée. » par (phrases courtes, une idée par puce, sans emphase) :

```tsx
<li>Quand tu joues, LangActif garde tes réponses : le mot, juste ou faux, et l'heure.</li>
<li>Ces réponses servent à te proposer les mots à revoir.</li>
<li>Ton enseignant peut voir ces réponses.</li>
<li>Les réponses sont effacées au bout de 90 jours.</li>
<li>Ton pseudo reste tant que ton enseignant garde ta place dans son groupe.</li>
```

Garder le commentaire en tête du fichier : « Texte à faire valider par les écoles avant diffusion (spec 3a, §8.3) » et ajouter « le 3b ajoute la conservation du journal (90 jours) : à faire valider aussi ». Ne pas écrire « anonyme ».

Note : « Ton enseignant peut voir ces réponses » devient vrai au plan 3d ; tant que 3d n'existe pas, ne pas diffuser la page auprès des élèves sans cette précision (voir Task 10, point de vigilance).

- [ ] **Step 5: Vérifier**

Run: `npx tsc --noEmit && npx vitest run && npx vite build` ; Expected: sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/components/AssignmentsPanel.tsx src/components/GroupDetail.tsx src/components/ChapterDetail.tsx src/components/PrivacyInfo.tsx src/lib/assignments.ts src/lib/assignments.test.ts
git commit -m "Plan 3b : bloc « Travail assigné » du groupe, aperçu élève, avertissements, page d'information

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Recette avec JF (une action à la fois) et revue finale

**Préparation (une fois, dans une fenêtre PowerShell, dossier `C:\Users\jfbeg\OneDrive\claude-workspace\langactif`)** :

```powershell
Get-Content .env.local | ForEach-Object { if ($_ -match '^(SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL)=(.*)$') { Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2].Trim('"') } }
vercel dev --listen 3000
```

Adresse enseignant : `http://localhost:3000/` ; adresse élève : `http://localhost:3000/eleve`. Fichier d'essai : `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\exemples\chapitre-test-300-mots.xlsx` (importer, puis assigner une liste de moins de 300 mots).

- [ ] **R1** (JF) Migration appliquée sur Supabase et script `rls_lang_assignments.sql` exécuté : « Success. No rows returned ».
- [ ] **R2** Enseignant : créer un groupe en néerlandais, importer un chapitre, assigner une liste (sens « Les deux sens », 8 mots, vitesse « Lente »). Vérifier : le travail apparaît ; les refus (chapitre en anglais, tout un chapitre de 300 mots ou plus) affichent un message français.
- [ ] **R3** Enseignant : « Voir comme un élève » ouvre le jeu sans écran Liste/Sens/Mots ; jouer une vague ; aucune ligne dans `lang_answers` (requête dans l'éditeur SQL : `select count(*) from lang_answers;`).
- [ ] **R4** Élève (fenêtre privée) : se connecter avec la fiche ; le travail est visible avec « 0 sur N » ; jouer une séance entière (réussites, une erreur, un mot manqué). Vérifier : écran de réponse avec « Continuer », écran de fin, retour à l'accueil avec la progression mise à jour.
- [ ] **R5** Dans l'éditeur SQL : `select verdict, aide, direction, answer_text, latency_ms from lang_answers order by ts;` ; vérifier faux puis juste avec aide, sans_reponse, les deux sens.
- [ ] **R6** Coupure réseau (outils de développement du navigateur, onglet Réseau, « Hors connexion ») : jouer deux vagues ; le bandeau annonce les réponses en attente ; rétablir le réseau ; le bandeau disparaît et `select count(*)` augmente sans doublon.
- [ ] **R7** Rechargement de la page en cours d'attente : les réponses en file survivent.
- [ ] **R8** Session expirée : dans le SQL, `update lang_student_sessions set revoked_at = now();` puis jouer : message « Ta session est terminée », retour à l'écran de connexion, puis reconnexion : la file part.
- [ ] **R9** Archiver le travail : il disparaît de l'écran élève après rechargement. Supprimer une place : `select count(*) from lang_answers where student_id = '<id de la place>'` vaut 0.
- [ ] **R10** 375 px : l'accueil élève, les réglages, le bloc enseignant et l'écran de fin ne débordent pas horizontalement ; clavier seul : flèches, Espace, P, Tab jusqu'à « Continuer ».
- [ ] **R11** Planification de la purge (B3) : `select * from cron.job where jobname = 'lang-purge-answers';` renvoie une ligne.

- [ ] **Step final: revue globale**

Dispatcher une revue de toute la branche (`git diff main...HEAD`) avec les angles : sécurité (aucune clé côté navigateur, aucun accès direct d'un élève à Supabase, RLS), confidentialité (aucun `console.log` de données élèves), cohérence des types entre `session.ts`, `work.ts`, `studentApi.ts` et la migration, et les six lignes de la section Review Focus. Corriger, puis relancer `npm test`, `npm run test:sql`, `npm run typecheck:api` et `npx vite build`.

---

### Task 10: Clôture

- [ ] Mettre à jour `memory/langactif-session-prompt.md` (section « Plan 3b ») : branche, migrations appliquées ou non, ce qui reste (3c hors ligne complet/PWA, 3d tableau de bord et lecture du journal par l'enseignant, 2b audio, autres modes).
- [ ] Mettre à jour la vignette LangActif de `landing-jfb4plai/index.html` (texte : travail assigné, mode arcade) et la carte du portail (`projets/portail-plai/src/data/apps.ts`) ; références RISS : aucune nouvelle ; garder la mention existante (Latimier 2019, `tel-02461323`).
- [ ] Avec l'accord de JF : fusion dans `main` (`git checkout main && git merge --no-ff feat/plan-3b-travail-assigne-et-journal`), `npx vite build`, push (déclenche le déploiement Vercel de `langactif.jfb4plai.com`).

**Point de vigilance avant la première classe réelle.** Sans tableau de bord (plan 3d), l'enseignant ne voit pas les résultats de ses élèves, alors que la page d'information dit qu'il le peut. Deux options : (a) ne pas faire jouer d'élèves réels avant un 3d minimal (liste des élèves avec dernier passage et nombre de mots maîtrisés) ; (b) retirer la puce « Ton enseignant peut voir ces réponses » jusqu'au 3d. Recommandation : (a), car le spec principal place le tableau de bord minimal dans la même étape que le journal (spec §15, étape 2).

---

## Auto-revue

**Couverture du spec.** §5.6 journal et état recalculé (Tasks 1, 6, D3) ; §6.2 arcade vitesse réglable, sans vies, meilleure progression personnelle (Task 4, 7) ; §6.4 retour qualifié avec audio rejouable (existant, Task 4) ; §7 accueil avec blocs assignés et échéance, bilan simple (Task 7) ; §8 assignation avec réglages et aide contextuelle (Task 8) ; §10 minimisation, conservation 90 jours, effacement (Tasks 1, 8) ; §12 file locale et envoi sans doublon (Task 6) ; 3a §8.1 effacement en cascade du journal (Task 1, scénario 6). Non couverts volontairement : tableau de bord et lecture du journal (3d), PWA et précache (3c), audio généré (2b), autres modes, regroupements de listes, remédiation, test blanc, objectif de classe.

**Types.** `Sens` (assignments.ts) = `Direction | 'both'` = `WorkAssignment.sens` = `ArcadeConfig.direction`. `WireAnswer` (studentApi) ↔ `toWire`/`toEvents` (work) ↔ colonnes de `lang_answers` ↔ clés lues par `lang_student_record_answers` : `id, word_id, direction, mode, verdict, error_type, aide, test, ts, answer_text, latency_ms, assignment_id`. `SendResult` partagé par `sendAnswers` et `answerQueue`. `Wave.direction` défini en Task 3 et utilisé en Task 4.

**Points d'attention pour l'exécutant.** Le fichier `supabase/tests/rls_lang_groups.sql` contient un remplacement local de l'UUID de compte : ne pas le committer. `lang_student_record_answers` doit rester `volatile`. Les fonctions `api/*.ts` n'importent rien.
