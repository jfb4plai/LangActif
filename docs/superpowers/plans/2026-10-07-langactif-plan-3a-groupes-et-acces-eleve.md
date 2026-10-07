# LangActif, plan 3a : groupes et accès élève

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un enseignant crée un groupe, obtient une fiche imprimable (pseudo + code par élève) ; l'élève se connecte avec groupe + pseudo + code et arrive sur un accueil minimal ; tout est effaçable en un clic.

**Architecture:** Trois tables `lang_*` (groupes, places, sessions). Toute la logique sensible (génération aléatoire, hachage bcrypt via pgcrypto, blocage, jetons) vit dans des **fonctions SQL** : celles de l'enseignant sont des RPC `security definer` avec contrôle explicite de propriété (même modèle que `lang_import_chapter`), celles de l'élève ne sont exécutables que par `service_role`. Quatre fonctions Vercel `api/*.ts` minces et autonomes les appellent pour l'élève. Le navigateur de l'élève ne parle qu'à ces quatre fonctions ; il n'a aucun accès direct à Supabase.

**Tech Stack:** React 18, Vite 5, Supabase v2 (PostgreSQL, pgcrypto, RLS), Vercel Functions (`@vercel/node`), `qrcode`, Vitest 2.

**Spec de référence :** `docs/superpowers/specs/2026-10-07-langactif-3a-groupes-et-acces-eleve-design.md`. Plan précédent : `2026-10-01-langactif-plan-2-application-et-import.md`.

## Écarts assumés avec le spec (à valider par JF, consignés Task 1)

1. **Fonctions enseignant en SQL (RPC), pas en `api/*.ts`.** Le spec §7 les prévoyait en fonctions Vercel. En SQL, le hachage et l'aléa restent au même endroit, l'enseignant n'a pas besoin de clé de service, et on évite de copier du code partagé dans huit fichiers `api/` (contrainte : fichiers autonomes). Seules les quatre fonctions élève restent dans `api/`.
2. **Code élève non unique dans le groupe.** La connexion exige aussi le pseudo, qui est unique : deux élèves avec le même code ne se gênent pas. Cela évite des vérifications bcrypt en cascade à la génération.
3. **Limite de débit par IP : au mieux** (mémoire d'une instance serverless). La vraie protection est le blocage par pseudo en base (5 échecs, 15 minutes).
4. **Plafonds :** 100 groupes par enseignant, 40 places actives par groupe.
5. **Honnêteté sur le hachage :** un code de 4 caractères (~9 700 possibilités) se retrouve par force brute hors ligne si la base fuite. Le hachage protège d'une lecture accidentelle, pas d'une fuite. La protection réelle est la RLS, l'absence d'accès direct des élèves et le blocage.

## Actions réservées à JF

- **B1** Exécuter les deux migrations (Task 2 et 3) puis le script de vérification (Task 4) dans l'éditeur SQL Supabase du projet partagé `dfoaumjleqtxjeaplnna`.
- **B2** Récupérer la clé « service_role » dans Supabase (Project Settings, API) et l'ajouter lui-même dans `langactif\.env.local` sous le nom `SUPABASE_SERVICE_ROLE_KEY`. Ne jamais la coller dans le chat.
- **B3** Lier le dossier à un projet Vercel (`vercel link`) pour pouvoir lancer `vercel dev` (les fonctions `api/` ne tournent pas avec `vite dev`). C'est la même action que le déploiement `langactif.jfb4plai.com` prévu plus tard.
- **B4** Relire la liste des 100 pseudos (Task 2) avant l'exécution de la migration.

## Structure des fichiers

**Créés**
- `supabase/migrations/20261007000000_create_lang_groups.sql` : tables, RLS, aléa, pseudos, RPC enseignant.
- `supabase/migrations/20261007000100_lang_student_access.sql` : fonctions élève (service_role seul).
- `supabase/tests/rls_lang_groups.sql` : vérification complète (RLS, blocage, sessions, effacement).
- `src/lib/groups.ts` + `groups.test.ts` : appels RPC et lecture des groupes.
- `src/lib/slips.ts` + `slips.test.ts` : bandes imprimables, adresse élève, lecture de `?g=`.
- `src/lib/studentApi.ts` + `studentApi.test.ts` : appels aux fonctions `api/`, stockage du jeton.
- `api/student-list-pseudos.ts`, `api/student-login.ts`, `api/student-me.ts`, `api/student-logout.ts`, `api/tsconfig.json`.
- `tests/api/helpers.ts`, `tests/api/student-list-pseudos.test.ts`, `tests/api/student-login.test.ts`, `tests/api/student-session.test.ts`.
- `vercel.json`.
- `src/components/GroupList.tsx`, `GroupCreate.tsx`, `GroupDetail.tsx`, `PrintSheet.tsx`, `StudentApp.tsx`, `PrivacyInfo.tsx`.

**Modifiés**
- `src/lib/errors.ts` + `errors.test.ts`, `src/components/Layout.tsx`, `src/App.tsx`, `src/overrides.css`, `vite.config.ts`, `package.json`, `.env.example`, `docs/superpowers/specs/2026-10-07-...-design.md`.

Convention de commit : message en français, suivi de la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (une ligne vide avant). Branche de travail : `feat/plan-3a-groupes-acces-eleve`. Ne rien pousser sans accord de JF. `npx vite build` doit passer avant tout push.

---

### Task 1: Consigner les écarts dans le spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-07-langactif-3a-groupes-et-acces-eleve-design.md` (ajout d'une section en fin de fichier)

- [ ] **Step 1: Ajouter la section 12 à la fin du spec**

Ajouter à la fin du fichier :

```markdown

## 12. Révisions d'implémentation (2026-10-07, à la rédaction du plan)

- **Fonctions enseignant en SQL.** Création de groupe, ajout de places, nouveau code, déblocage, archivage et régénération sont des RPC SQL `security definer` avec contrôle de propriété (même modèle que `lang_import_chapter`). Seules `student-login`, `student-me`, `student-logout` et `student-list-pseudos` sont des fonctions `api/*.ts`. Cela remplace le tableau du §7 pour les lignes enseignant.
- **Code élève non unique dans le groupe** (le pseudo, unique, fait partie de la connexion). Remplace « unique dans le groupe » aux §2, §3 et §4.
- **Limite de débit par IP au mieux** (mémoire d'une instance). La protection réelle est le blocage par pseudo.
- **Plafonds :** 100 groupes par enseignant, 40 places actives par groupe.
- **Hachage :** bcrypt (pgcrypto). Avec ~9 700 codes possibles, il ne résiste pas à une force brute hors ligne après une fuite de la base ; la protection réelle est la RLS, l'absence d'accès élève direct et le blocage.
- **Page d'information élève (FALC)** : texte rédigé, à faire valider par les écoles avant diffusion (§8.3).
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\jfbeg\OneDrive\claude-workspace\langactif
git add docs/superpowers/specs/2026-10-07-langactif-3a-groupes-et-acces-eleve-design.md
git commit -m "Spec 3a : révisions d'implémentation (RPC SQL, code non unique)"
```

---

### Task 2: Migration 1 : tables, RLS, aléa, pseudos, RPC enseignant

**Files:**
- Create: `supabase/migrations/20261007000000_create_lang_groups.sql`

- [ ] **Step 1: Écrire la migration**

Contenu complet du fichier :

```sql
-- LangActif, plan 3a : groupes, places (élèves) et sessions élève.
-- Tables préfixées lang_. Les élèves n'ont AUCUN accès direct : leurs fonctions sont dans la
-- migration suivante et réservées à service_role. L'enseignant agit par RPC security definer
-- (contrôle explicite de propriété) ou par suppression directe sous RLS.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.lang_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nom text not null,
  langue text not null check (langue in ('en-GB', 'nl-BE')),
  code text not null unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lang_groups_nom_len check (char_length(nom) between 1 and 200)
);
create index if not exists lang_groups_owner_idx on public.lang_groups (owner_id);

create table if not exists public.lang_students (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lang_groups(id) on delete cascade,
  pseudo text not null,
  code_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_seen_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, pseudo),
  constraint lang_students_pseudo_len check (char_length(pseudo) between 1 and 40)
);

create table if not exists public.lang_student_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.lang_students(id) on delete cascade,
  token_hash text not null unique,
  shared_device boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists lang_student_sessions_student_idx on public.lang_student_sessions (student_id);

-- Propriété d'un groupe : security definer, pas de politique auto-référentielle
-- (incident AménagActif du 2026-09-23).
create or replace function public.lang_owns_group(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lang_groups g
    where g.id = p_group and g.owner_id = auth.uid()
  );
$$;

revoke all on function public.lang_owns_group(uuid) from public;
revoke execute on function public.lang_owns_group(uuid) from anon;
grant execute on function public.lang_owns_group(uuid) to authenticated;

alter table public.lang_groups enable row level security;
alter table public.lang_students enable row level security;
alter table public.lang_student_sessions enable row level security;

drop policy if exists lang_groups_owner_select on public.lang_groups;
create policy lang_groups_owner_select on public.lang_groups
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists lang_groups_owner_update on public.lang_groups;
create policy lang_groups_owner_update on public.lang_groups
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists lang_groups_owner_delete on public.lang_groups;
create policy lang_groups_owner_delete on public.lang_groups
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists lang_students_owner_select on public.lang_students;
create policy lang_students_owner_select on public.lang_students
  for select to authenticated using (public.lang_owns_group(group_id));
drop policy if exists lang_students_owner_delete on public.lang_students;
create policy lang_students_owner_delete on public.lang_students
  for delete to authenticated using (public.lang_owns_group(group_id));
-- lang_student_sessions : aucune politique pour authenticated (accès refusé).

-- Grants Data API. Les privilèges par défaut du projet partagé sont retirés d'abord.
revoke all on public.lang_groups, public.lang_students, public.lang_student_sessions from anon, authenticated;
grant select, delete on public.lang_groups to authenticated;
grant update (nom) on public.lang_groups to authenticated;
-- code_hash n'est volontairement pas lisible par l'enseignant.
grant select (id, group_id, pseudo, failed_attempts, locked_until, last_seen_at, archived_at, created_at)
  on public.lang_students to authenticated;
grant delete on public.lang_students to authenticated;
grant select, insert, update, delete on public.lang_groups to service_role;
grant select, insert, update, delete on public.lang_students to service_role;
grant select, insert, update, delete on public.lang_student_sessions to service_role;

-- Entier uniforme dans [0, p_n) par rejet d'octets (p_n <= 256) : pas de biais de modulo.
create or replace function public.lang_rand_int(p_n integer)
returns integer
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_lim integer := 256 - (256 % p_n);
  v_b integer;
begin
  loop
    v_b := get_byte(gen_random_bytes(1), 0);
    exit when v_b < v_lim;
  end loop;
  return v_b % p_n;
end;
$$;

-- Code élève : 1 lettre (19, sans b d p q i l o) + 3 chiffres de 2 à 9.
create or replace function public.lang_new_student_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_letters constant text := 'ACEFGHJKMNRSTUVWXYZ';
  v_digits constant text := '23456789';
begin
  return substr(v_letters, public.lang_rand_int(19) + 1, 1)
      || substr(v_digits, public.lang_rand_int(8) + 1, 1)
      || substr(v_digits, public.lang_rand_int(8) + 1, 1)
      || substr(v_digits, public.lang_rand_int(8) + 1, 1);
end;
$$;

-- Code de groupe : 5 caractères parmi 19 lettres et 8 chiffres, unique.
create or replace function public.lang_new_group_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_alphabet constant text := 'ACEFGHJKMNRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, public.lang_rand_int(27) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.lang_groups where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- 100 pseudos neutres : rivières de Belgique, arbres, roches et minéraux, astres et vents.
create or replace function public.lang_pseudo_pool()
returns text[]
language sql
immutable
as $$
  select array[
    'Meuse','Ourthe','Lesse','Semois','Sambre','Dyle','Vesdre','Amblève','Lienne','Salm',
    'Warche','Gette','Senne','Dendre','Escaut','Lys','Yser','Demer','Nèthe','Mehaigne',
    'Orneau','Hoyoux','Viroin','Haine','Geer',
    'Chêne','Hêtre','Tilleul','Érable','Saule','Aulne','Bouleau','Frêne','Orme','Peuplier',
    'Noyer','Charme','Sapin','Mélèze','Cèdre','Platane','Sorbier','Cerisier','Pommier','Noisetier',
    'Tremble','Houx','If','Épicéa','Cormier',
    'Granit','Quartz','Ardoise','Basalte','Schiste','Calcaire','Marbre','Grès','Silex','Argile',
    'Gneiss','Mica','Jaspe','Opale','Onyx','Agate','Béryl','Obsidienne','Porphyre','Dolomie',
    'Gypse','Craie','Lave','Tourmaline','Grenat',
    'Orion','Sirius','Vega','Mistral','Zéphyr','Sirocco','Altaïr','Rigel','Antarès','Capella',
    'Polaris','Mizar','Pollux','Algol','Deneb','Aldébaran','Régulus','Spica','Borée','Autan',
    'Ponant','Tramontane','Alizé','Libeccio','Levant'
  ]::text[];
$$;

-- Tire p_count pseudos libres dans le groupe (les archivés comptent comme pris : contrainte
-- d'unicité). Si le pool est épuisé, un numéro est ajouté (« Meuse 2 »).
create or replace function public.lang_draw_pseudos(p_group uuid, p_count integer)
returns text[]
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_used text[];
  v_out text[];
  v_word text;
  v_candidate text;
  v_suffix integer := 2;
begin
  select coalesce(array_agg(pseudo), '{}'::text[]) into v_used
  from public.lang_students where group_id = p_group;

  select coalesce(array_agg(picked.w), '{}'::text[]) into v_out
  from (
    select w from unnest(public.lang_pseudo_pool()) as w
    where not (w = any (v_used))
    order by gen_random_uuid()
    limit p_count
  ) as picked;

  while cardinality(v_out) < p_count loop
    for v_word in select w from unnest(public.lang_pseudo_pool()) as w order by gen_random_uuid() loop
      exit when cardinality(v_out) >= p_count;
      v_candidate := v_word || ' ' || v_suffix::text;
      if not (v_candidate = any (v_used || v_out)) then
        v_out := v_out || v_candidate;
      end if;
    end loop;
    v_suffix := v_suffix + 1;
  end loop;
  return v_out;
end;
$$;

-- Crée p_count places et renvoie [{id, pseudo, code}] : les codes en clair ne sont renvoyés
-- que cette fois, seul le hachage est conservé. Interne : appelée par les RPC ci-dessous.
create or replace function public.lang_create_seats(p_group uuid, p_count integer)
returns jsonb
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_pseudos text[] := public.lang_draw_pseudos(p_group, p_count);
  v_out jsonb := '[]'::jsonb;
  v_code text;
  v_id uuid;
  i integer;
begin
  for i in 1..p_count loop
    v_code := public.lang_new_student_code();
    insert into public.lang_students (group_id, pseudo, code_hash)
    values (p_group, v_pseudos[i], crypt(v_code, gen_salt('bf', 8)))
    returning id into v_id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'pseudo', v_pseudos[i], 'code', v_code));
  end loop;
  return v_out;
end;
$$;

create or replace function public.lang_group_create(p_nom text, p_langue text, p_places integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Non authentifié';
  end if;
  if p_places is null or p_places not between 1 and 40 then
    raise exception 'Nombre de places invalide (1 à 40)';
  end if;
  if (select count(*) from public.lang_groups where owner_id = v_uid) >= 100 then
    raise exception 'Limite de 100 groupes atteinte';
  end if;
  v_code := public.lang_new_group_code();
  insert into public.lang_groups (owner_id, nom, langue, code)
  values (v_uid, trim(p_nom), p_langue, v_code)
  returning id into v_group;
  return jsonb_build_object('group_id', v_group, 'code', v_code, 'seats', public.lang_create_seats(v_group, p_places));
end;
$$;

create or replace function public.lang_group_add_seats(p_group uuid, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.lang_owns_group(p_group) then
    raise exception 'Groupe introuvable ou non autorisé';
  end if;
  if exists (select 1 from public.lang_groups where id = p_group and archived_at is not null) then
    raise exception 'Groupe archivé : impossible d''ajouter des places';
  end if;
  if p_count is null or p_count not between 1 and 40 then
    raise exception 'Nombre de places invalide (1 à 40)';
  end if;
  if (select count(*) from public.lang_students where group_id = p_group and archived_at is null) + p_count > 40 then
    raise exception 'Limite de 40 places actives par groupe atteinte';
  end if;
  return public.lang_create_seats(p_group, p_count);
end;
$$;

create or replace function public.lang_seat_reset_code(p_seat uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group uuid;
  v_pseudo text;
  v_code text := public.lang_new_student_code();
begin
  select group_id, pseudo into v_group, v_pseudo
  from public.lang_students where id = p_seat and archived_at is null;
  if v_group is null or not public.lang_owns_group(v_group) then
    raise exception 'Place introuvable ou non autorisée';
  end if;
  update public.lang_students
    set code_hash = crypt(v_code, gen_salt('bf', 8)), failed_attempts = 0, locked_until = null
    where id = p_seat;
  update public.lang_student_sessions set revoked_at = now()
    where student_id = p_seat and revoked_at is null;
  return jsonb_build_object('pseudo', v_pseudo, 'code', v_code);
end;
$$;

create or replace function public.lang_seat_unlock(p_seat uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.lang_students where id = p_seat;
  if v_group is null or not public.lang_owns_group(v_group) then
    raise exception 'Place introuvable ou non autorisée';
  end if;
  update public.lang_students set failed_attempts = 0, locked_until = null where id = p_seat;
end;
$$;

create or replace function public.lang_seat_archive(p_seat uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from public.lang_students where id = p_seat;
  if v_group is null or not public.lang_owns_group(v_group) then
    raise exception 'Place introuvable ou non autorisée';
  end if;
  update public.lang_students set archived_at = coalesce(archived_at, now()) where id = p_seat;
  update public.lang_student_sessions set revoked_at = now()
    where student_id = p_seat and revoked_at is null;
end;
$$;

create or replace function public.lang_group_archive(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.lang_owns_group(p_group) then
    raise exception 'Groupe introuvable ou non autorisé';
  end if;
  update public.lang_groups set archived_at = coalesce(archived_at, now()) where id = p_group;
  update public.lang_students set archived_at = coalesce(archived_at, now()) where group_id = p_group;
  update public.lang_student_sessions set revoked_at = now()
    where revoked_at is null and student_id in (select id from public.lang_students where group_id = p_group);
end;
$$;

create or replace function public.lang_group_regenerate_codes(p_group uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_code text;
  r record;
begin
  if not public.lang_owns_group(p_group) then
    raise exception 'Groupe introuvable ou non autorisé';
  end if;
  for r in
    select id, pseudo from public.lang_students
    where group_id = p_group and archived_at is null order by pseudo
  loop
    v_code := public.lang_new_student_code();
    update public.lang_students
      set code_hash = crypt(v_code, gen_salt('bf', 8)), failed_attempts = 0, locked_until = null
      where id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', r.id, 'pseudo', r.pseudo, 'code', v_code));
  end loop;
  update public.lang_student_sessions set revoked_at = now()
    where revoked_at is null and student_id in (select id from public.lang_students where group_id = p_group);
  return v_out;
end;
$$;

-- Fonctions internes : jamais appelables depuis le navigateur.
revoke all on function public.lang_rand_int(integer) from public, anon, authenticated;
revoke all on function public.lang_new_student_code() from public, anon, authenticated;
revoke all on function public.lang_new_group_code() from public, anon, authenticated;
revoke all on function public.lang_pseudo_pool() from public, anon, authenticated;
revoke all on function public.lang_draw_pseudos(uuid, integer) from public, anon, authenticated;
revoke all on function public.lang_create_seats(uuid, integer) from public, anon, authenticated;

-- RPC enseignant : authenticated seulement.
revoke all on function public.lang_group_create(text, text, integer) from public, anon;
revoke all on function public.lang_group_add_seats(uuid, integer) from public, anon;
revoke all on function public.lang_seat_reset_code(uuid) from public, anon;
revoke all on function public.lang_seat_unlock(uuid) from public, anon;
revoke all on function public.lang_seat_archive(uuid) from public, anon;
revoke all on function public.lang_group_archive(uuid) from public, anon;
revoke all on function public.lang_group_regenerate_codes(uuid) from public, anon;
grant execute on function public.lang_group_create(text, text, integer) to authenticated;
grant execute on function public.lang_group_add_seats(uuid, integer) to authenticated;
grant execute on function public.lang_seat_reset_code(uuid) to authenticated;
grant execute on function public.lang_seat_unlock(uuid) to authenticated;
grant execute on function public.lang_seat_archive(uuid) to authenticated;
grant execute on function public.lang_group_archive(uuid) to authenticated;
grant execute on function public.lang_group_regenerate_codes(uuid) to authenticated;
```

- [ ] **Step 2: Vérifier qu'aucun nom de table ne collisionne**

Run: `grep -rIn "create table" --include=*.sql --exclude-dir=node_modules C:\Users\jfbeg\OneDrive\claude-workspace | grep -E "lang_(groups|students|student_sessions)"`
Expected: uniquement les trois lignes de la migration ci-dessus (aucun autre fichier du workspace ne crée ces noms).

- [ ] **Step 3: Faire relire la liste de pseudos par JF (B4)**

Afficher à JF les 100 mots (quatre familles de 25) et attendre son accord ou ses retraits. Si un mot est retiré, le remplacer dans `lang_pseudo_pool()` par un mot de la même famille pour garder 100 mots distincts (le script de la Task 4 vérifie ce total).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261007000000_create_lang_groups.sql
git commit -m "Migration 3a : groupes, places, sessions et RPC enseignant"
```

---

### Task 3: Migration 2 : fonctions élève (service_role seul)

**Files:**
- Create: `supabase/migrations/20261007000100_lang_student_access.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- LangActif, plan 3a : fonctions élève. Exécutables par service_role UNIQUEMENT
-- (appelées par les fonctions Vercel api/student-*.ts avec la clé de service).

create or replace function public.lang_group_pseudos(p_group_code text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(s.pseudo order by s.pseudo), '{}'::text[])
  from public.lang_groups g
  join public.lang_students s on s.group_id = g.id
  where g.code = upper(trim(p_group_code))
    and g.archived_at is null
    and s.archived_at is null;
$$;

-- Connexion : toujours un calcul bcrypt (même pour un pseudo inconnu ou bloqué) afin de ne pas
-- révéler par le temps de réponse si un pseudo existe. 5 échecs = blocage de 15 minutes.
create or replace function public.lang_student_login(p_group_code text, p_pseudo text, p_code text, p_shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group public.lang_groups%rowtype;
  v_student public.lang_students%rowtype;
  v_shared boolean := coalesce(p_shared, false);
  v_token text;
  v_attempts integer;
begin
  select * into v_group from public.lang_groups
    where code = upper(trim(p_group_code)) and archived_at is null;
  if v_group.id is not null then
    select * into v_student from public.lang_students
      where group_id = v_group.id and pseudo = p_pseudo and archived_at is null
      for update;
  end if;

  if v_student.id is null then
    perform crypt(coalesce(p_code, ''), gen_salt('bf', 8));
    return jsonb_build_object('ok', false, 'reason', 'invalide');
  end if;

  if v_student.locked_until is not null and v_student.locked_until > now() then
    perform crypt(coalesce(p_code, ''), gen_salt('bf', 8));
    return jsonb_build_object('ok', false, 'reason', 'bloque',
      'retry_after_seconds', ceil(extract(epoch from (v_student.locked_until - now())))::integer);
  end if;

  if v_student.code_hash = crypt(coalesce(p_code, ''), v_student.code_hash) then
    update public.lang_students
      set failed_attempts = 0, locked_until = null, last_seen_at = now()
      where id = v_student.id;
    v_token := encode(gen_random_bytes(32), 'hex');
    insert into public.lang_student_sessions (student_id, token_hash, shared_device, expires_at)
    values (
      v_student.id,
      encode(digest(v_token, 'sha256'), 'hex'),
      v_shared,
      now() + case when v_shared then interval '12 hours' else interval '12 months' end
    );
    return jsonb_build_object('ok', true, 'token', v_token, 'pseudo', v_student.pseudo, 'langue', v_group.langue);
  end if;

  v_attempts := v_student.failed_attempts + 1;
  if v_attempts >= 5 then
    update public.lang_students
      set failed_attempts = 0, locked_until = now() + interval '15 minutes'
      where id = v_student.id;
    return jsonb_build_object('ok', false, 'reason', 'bloque', 'retry_after_seconds', 900);
  end if;
  update public.lang_students set failed_attempts = v_attempts where id = v_student.id;
  return jsonb_build_object('ok', false, 'reason', 'invalide');
end;
$$;

-- Valide un jeton. Session personnelle : expiration glissante de 12 mois. Appareil partagé :
-- expiration fixe (12 h après la connexion), non renouvelée.
create or replace function public.lang_student_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.lang_student_sessions%rowtype;
  v_pseudo text;
  v_langue text;
begin
  select ss.* into v_session
  from public.lang_student_sessions ss
  join public.lang_students st on st.id = ss.student_id
  join public.lang_groups g on g.id = st.group_id
  where ss.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and ss.revoked_at is null
    and ss.expires_at > now()
    and st.archived_at is null
    and g.archived_at is null;
  if v_session.id is null then
    return null;
  end if;

  update public.lang_student_sessions
    set last_used_at = now(),
        expires_at = case when shared_device then expires_at else now() + interval '12 months' end
    where id = v_session.id;
  update public.lang_students set last_seen_at = now() where id = v_session.student_id;

  select st.pseudo, g.langue into v_pseudo, v_langue
  from public.lang_students st join public.lang_groups g on g.id = st.group_id
  where st.id = v_session.student_id;
  return jsonb_build_object('pseudo', v_pseudo, 'langue', v_langue);
end;
$$;

create or replace function public.lang_student_logout(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.lang_student_sessions
    set revoked_at = now()
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and revoked_at is null;
end;
$$;

revoke all on function public.lang_group_pseudos(text) from public, anon, authenticated;
revoke all on function public.lang_student_login(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.lang_student_me(text) from public, anon, authenticated;
revoke all on function public.lang_student_logout(text) from public, anon, authenticated;
grant execute on function public.lang_group_pseudos(text) to service_role;
grant execute on function public.lang_student_login(text, text, text, boolean) to service_role;
grant execute on function public.lang_student_me(text) to service_role;
grant execute on function public.lang_student_logout(text) to service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261007000100_lang_student_access.sql
git commit -m "Migration 3a : fonctions élève réservées à service_role"
```

---

### Task 4: Script de vérification SQL et application (JF, B1)

**Files:**
- Create: `supabase/tests/rls_lang_groups.sql`

- [ ] **Step 1: Écrire le script**

Le script s'exécute en une fois dans l'éditeur SQL, après les deux migrations. Tout est annulé à la fin. Remplacer les occurrences de `UUID_COMPTE_A` par l'identifiant d'un compte enseignant existant (`select id, email from auth.users order by created_at desc limit 5;`). Copie locale avec l'identifiant : `supabase/tests/rls_lang_groups.local.sql` (ignorée par git).

```sql
-- Vérification du plan 3a. À exécuter dans l'éditeur SQL Supabase, APRÈS les deux migrations.
-- Tout est annulé (rollback). Remplacer UUID_COMPTE_A (toutes les occurrences) par l'id d'un
-- compte enseignant existant. Succès attendu : « Success. No rows returned ».

begin;

-- 0) Constantes et formats (rôle propriétaire : fonctions internes)
do $$
begin
  assert (select count(distinct w) from unnest(public.lang_pseudo_pool()) as w) = 100,
    'le pool doit compter 100 pseudos distincts';
  assert public.lang_new_student_code() ~ '^[ACEFGHJKMNRSTUVWXYZ][2-9]{3}$', 'format du code élève';
  assert public.lang_new_group_code() ~ '^[ACEFGHJKMNRSTUVWXYZ2-9]{5}$', 'format du code de groupe';
end $$;

-- 1) Enseignant A : création, lecture, code_hash illisible
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);

do $$
declare
  r jsonb;
  r2 jsonb;
  g uuid;
begin
  r := public.lang_group_create('Groupe test RLS', 'nl-BE', 3);
  g := (r->>'group_id')::uuid;
  assert jsonb_array_length(r->'seats') = 3, '3 places attendues';
  assert (r->>'code') ~ '^[ACEFGHJKMNRSTUVWXYZ2-9]{5}$', 'code de groupe invalide';
  assert (select count(distinct s->>'pseudo') from jsonb_array_elements(r->'seats') s) = 3, 'pseudos distincts';
  assert (select bool_and((s->>'code') ~ '^[ACEFGHJKMNRSTUVWXYZ][2-9]{3}$') from jsonb_array_elements(r->'seats') s),
    'format des codes élèves';
  assert (select count(*) from public.lang_groups where id = g) = 1, 'A ne voit pas son groupe';
  assert (select count(*) from public.lang_students where group_id = g) = 3, 'A ne voit pas ses places';

  begin
    perform code_hash from public.lang_students limit 1;
    raise exception 'FAIL: code_hash lisible par l''enseignant';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.lang_student_sessions;
    raise exception 'FAIL: sessions lisibles par l''enseignant';
  exception when insufficient_privilege then
    null;
  end;

  r2 := public.lang_group_add_seats(g, 2);
  assert jsonb_array_length(r2) = 2, '2 places ajoutées attendues';
  assert (select count(distinct pseudo) from public.lang_students where group_id = g) = 5, 'pseudos uniques sur 5 places';

  perform set_config('lang.test_group', g::text, true);
  perform set_config('lang.test_code', r->>'code', true);
  perform set_config('lang.test_seat_id', r->'seats'->0->>'id', true);
  perform set_config('lang.test_seat_pseudo', r->'seats'->0->>'pseudo', true);
  perform set_config('lang.test_seat_secret', r->'seats'->0->>'code', true);
end $$;

-- 2) Un autre enseignant (B) ne voit rien et ne peut rien faire
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$
declare
  g uuid := current_setting('lang.test_group')::uuid;
  s uuid := current_setting('lang.test_seat_id')::uuid;
  n integer;
begin
  assert (select count(*) from public.lang_groups where id = g) = 0, 'B voit le groupe de A';
  assert (select count(*) from public.lang_students where group_id = g) = 0, 'B voit les places de A';

  begin
    perform public.lang_group_add_seats(g, 1);
    raise exception 'FAIL: B a ajouté des places au groupe de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.lang_seat_reset_code(s);
    raise exception 'FAIL: B a réinitialisé un code de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.lang_seat_unlock(s);
    raise exception 'FAIL: B a débloqué une place de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    perform public.lang_group_archive(g);
    raise exception 'FAIL: B a archivé le groupe de A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
  end;
  begin
    insert into public.lang_students (group_id, pseudo, code_hash) values (g, 'Intrus', 'x');
    raise exception 'FAIL: insertion directe de place acceptée';
  exception when insufficient_privilege then
    null;
  end;

  delete from public.lang_groups where id = g;
  get diagnostics n = row_count;
  assert n = 0, 'B a supprimé le groupe de A';
  delete from public.lang_students where id = s;
  get diagnostics n = row_count;
  assert n = 0, 'B a supprimé une place de A';
end $$;

-- 3) anon : aucun accès
set local role anon;
do $$
begin
  begin
    perform count(*) from public.lang_groups;
    raise exception 'FAIL: anon lit lang_groups';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.lang_group_create('x', 'nl-BE', 1);
    raise exception 'FAIL: anon appelle lang_group_create';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.lang_student_login('AAAAA', 'x', 'A222', false);
    raise exception 'FAIL: anon appelle lang_student_login';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- 4) Un enseignant ne peut pas appeler les fonctions élève
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.lang_student_login(current_setting('lang.test_code'), 'x', 'A222', false);
    raise exception 'FAIL: authenticated appelle lang_student_login';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- 5) Élève (service_role) : liste, mauvais code, blocage
set local role service_role;
do $$
declare
  g text := current_setting('lang.test_code');
  p text := current_setting('lang.test_seat_pseudo');
  c text := current_setting('lang.test_seat_secret');
  wrong text := case when current_setting('lang.test_seat_secret') = 'A222' then 'A223' else 'A222' end;
  r jsonb;
  i integer;
begin
  assert cardinality(public.lang_group_pseudos(g)) = 5, '5 pseudos attendus';
  assert cardinality(public.lang_group_pseudos('ZZZZZ')) = 0, 'groupe inconnu = liste vide';

  r := public.lang_student_login(g, p, wrong, false);
  assert (r->>'ok')::boolean = false and r->>'reason' = 'invalide', 'mauvais code : invalide';
  r := public.lang_student_login(g, 'Inconnu', wrong, false);
  assert (r->>'ok')::boolean = false and r->>'reason' = 'invalide', 'pseudo inconnu : même message';

  for i in 1..3 loop
    perform public.lang_student_login(g, p, wrong, false);
  end loop;
  r := public.lang_student_login(g, p, wrong, false);  -- 5e échec cumulé
  assert r->>'reason' = 'bloque', '5 échecs : blocage';
  r := public.lang_student_login(g, p, c, false);
  assert r->>'reason' = 'bloque', 'le bon code est refusé pendant le blocage';
end $$;

-- 6) Déblocage par l'enseignant
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
select public.lang_seat_unlock(current_setting('lang.test_seat_id')::uuid);

-- 7) Connexion réussie, session personnelle glissante, appareil partagé, déconnexion
set local role service_role;
do $$
declare
  g text := current_setting('lang.test_code');
  p text := current_setting('lang.test_seat_pseudo');
  c text := current_setting('lang.test_seat_secret');
  s uuid := current_setting('lang.test_seat_id')::uuid;
  r jsonb;
  tok text;
  tok2 text;
begin
  r := public.lang_student_login(g, p, c, false);
  assert (r->>'ok')::boolean, 'connexion avec le bon code';
  tok := r->>'token';
  assert length(tok) = 64, 'jeton de 64 caractères hexadécimaux';
  assert public.lang_student_me(tok)->>'pseudo' = p, 'me renvoie le pseudo';

  update public.lang_student_sessions set expires_at = now() + interval '1 day'
    where student_id = s and not shared_device;
  perform public.lang_student_me(tok);
  assert (select expires_at > now() + interval '11 months' from public.lang_student_sessions
          where student_id = s and not shared_device limit 1), 'expiration glissante de 12 mois';

  r := public.lang_student_login(g, p, c, true);
  tok2 := r->>'token';
  assert (select count(*) from public.lang_student_sessions
          where student_id = s and shared_device and expires_at < now() + interval '13 hours') = 1,
    'appareil partagé : 12 heures';

  perform public.lang_student_logout(tok);
  assert public.lang_student_me(tok) is null, 'jeton révoqué après déconnexion';
  assert public.lang_student_me(tok2) is not null, 'l''autre appareil reste connecté';
  perform set_config('lang.test_token2', tok2, true);
end $$;

-- 8) Nouveau code : révoque les appareils, ancien code refusé, nouveau code accepté
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
do $$
declare
  r jsonb := public.lang_seat_reset_code(current_setting('lang.test_seat_id')::uuid);
begin
  perform set_config('lang.test_new_secret', r->>'code', true);
end $$;

set local role service_role;
do $$
declare
  g text := current_setting('lang.test_code');
  p text := current_setting('lang.test_seat_pseudo');
  old_c text := current_setting('lang.test_seat_secret');
  new_c text := current_setting('lang.test_new_secret');
  r jsonb;
begin
  assert public.lang_student_me(current_setting('lang.test_token2')) is null, 'nouveau code : sessions révoquées';
  if old_c <> new_c then
    r := public.lang_student_login(g, p, old_c, false);
    assert (r->>'ok')::boolean = false, 'ancien code refusé';
  end if;
  r := public.lang_student_login(g, p, new_c, false);
  assert (r->>'ok')::boolean, 'nouveau code accepté';
end $$;

-- 9) Archivage d'une place puis du groupe : plus de connexion
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
select public.lang_group_archive(current_setting('lang.test_group')::uuid);

set local role service_role;
do $$
begin
  assert cardinality(public.lang_group_pseudos(current_setting('lang.test_code'))) = 0, 'groupe archivé : liste vide';
  assert (public.lang_student_login(current_setting('lang.test_code'), current_setting('lang.test_seat_pseudo'),
          current_setting('lang.test_new_secret'), false)->>'ok')::boolean = false, 'groupe archivé : connexion refusée';
end $$;

-- 10) Effacement en cascade (RGPD) : groupe supprimé = plus aucune ligne liée
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_COMPTE_A","role":"authenticated"}', true);
delete from public.lang_groups where id = current_setting('lang.test_group')::uuid;

set local role service_role;
do $$
declare
  g uuid := current_setting('lang.test_group')::uuid;
begin
  assert (select count(*) from public.lang_groups where id = g) = 0, 'groupe encore présent';
  assert (select count(*) from public.lang_students where group_id = g) = 0, 'places restantes';
  assert (select count(*) from public.lang_student_sessions
          where student_id = current_setting('lang.test_seat_id')::uuid) = 0, 'sessions restantes';
end $$;

rollback;
```

- [ ] **Step 2: Créer la copie locale et la faire exécuter par JF (B1)**

Donner à JF les chemins exacts :
- Migration 1 : `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\supabase\migrations\20261007000000_create_lang_groups.sql`
- Migration 2 : `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\supabase\migrations\20261007000100_lang_student_access.sql`
- Script : `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\supabase\tests\rls_lang_groups.sql` (JF remplace `UUID_COMPTE_A` par son identifiant dans une copie `rls_lang_groups.local.sql` du même dossier, ignorée par git).

Ordre : migration 1, migration 2, script. L'éditeur SQL s'ouvre dans Supabase, projet affiché « RetroActif ». Attendu : « Success. No rows returned » pour chacun. Pour une erreur du script, demander à JF la capture du message : il indique l'assertion qui échoue ; corriger la fonction SQL en cause (nouvelle migration `20261007000200_...` si la migration est déjà appliquée, sinon éditer le fichier et rejouer).

Si la migration 1 échoue sur `gen_random_bytes` ou `crypt` (« function does not exist »), demander à JF d'exécuter `select extname, extnamespace::regnamespace from pg_extension where extname = 'pgcrypto';` et adapter `search_path` au schéma indiqué.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_lang_groups.sql
git commit -m "Script de vérification SQL du plan 3a (RLS, blocage, sessions, effacement)"
```

---

### Task 5: Messages d'erreur français

**Files:**
- Modify: `src/lib/errors.ts`
- Modify: `src/lib/errors.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/lib/errors.test.ts`, remplacer la liste du dernier `it.each` par :

```ts
  it.each([
    'Limite de 50 chapitres atteinte',
    'Limite de 100 groupes atteinte',
    'Limite de 40 places actives par groupe atteinte',
    'Nombre de listes invalide',
    'Nombre de places invalide (1 à 40)',
    'Groupe introuvable ou non autorisé',
    'Place introuvable ou non autorisée',
    "Pas d'article en anglais",
    'permission denied',
    'autre',
  ])('inchangé : %s', (m) => {
    expect(friendlyError(m)).toBe(m);
  });
```

(supprimer l'ancien `it.each([...])('inchangé : %s', ...)`.)

- [ ] **Step 2: Lancer le test**

Run: `npx vitest run src/lib/errors.test.ts`
Expected: les cas « Nombre de places invalide » et « introuvable » passent déjà (les autres règles ne les modifient pas), donc tout passe. Vérifier ensuite que la règle de passage est bien explicite dans le code (Step 3) ; ces cas servent de garde contre une future règle trop gourmande.

- [ ] **Step 3: Rendre le passage explicite dans `errors.ts`**

Remplacer le bloc `if (message.includes('Limite de') || ...) { return message; }` par :

```ts
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
```

- [ ] **Step 4: Relancer**

Run: `npx vitest run src/lib/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts src/lib/errors.test.ts
git commit -m "Messages d'erreur français des fonctions de groupes"
```

---

### Task 6: Bibliothèque `groups.ts`

**Files:**
- Create: `src/lib/groups.ts`
- Test: `src/lib/groups.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  addSeats,
  archiveGroup,
  archiveSeat,
  createGroup,
  deleteGroup,
  deleteSeat,
  getGroup,
  listGroups,
  regenerateCodes,
  resetSeatCode,
  seatState,
  unlockSeat,
  type SeatRow,
} from './groups';

const asClient = (fake: unknown) => fake as SupabaseClient;

function rpcClient(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = asClient({
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data, error };
    },
  });
  return { client, calls };
}

const seat = (over: Partial<SeatRow> = {}): SeatRow => ({
  id: 's1', group_id: 'g1', pseudo: 'Meuse', failed_attempts: 0, locked_until: null,
  last_seen_at: null, archived_at: null, created_at: '2026-10-07T08:00:00Z', ...over,
});

describe('seatState', () => {
  const now = new Date('2026-10-07T10:00:00Z');
  it('archivée prime sur tout', () => {
    expect(seatState(seat({ archived_at: '2026-10-01', locked_until: '2026-10-08T00:00:00Z' }), now)).toBe('archive');
  });
  it('bloquée tant que locked_until est dans le futur', () => {
    expect(seatState(seat({ locked_until: '2026-10-07T10:10:00Z' }), now)).toBe('bloque');
  });
  it('blocage expiré : on retombe sur jamais ou actif', () => {
    expect(seatState(seat({ locked_until: '2026-10-07T09:00:00Z' }), now)).toBe('jamais');
    expect(seatState(seat({ locked_until: '2026-10-07T09:00:00Z', last_seen_at: '2026-10-06' }), now)).toBe('actif');
  });
  it('jamais connecté', () => {
    expect(seatState(seat(), now)).toBe('jamais');
  });
});

describe('listGroups', () => {
  it('compte seulement les places non archivées', async () => {
    const rows = [
      { id: 'g1', nom: 'Rem NL', langue: 'nl-BE', code: 'K7M4X', archived_at: null, created_at: 'x',
        lang_students: [{ id: 'a', archived_at: null }, { id: 'b', archived_at: '2026-10-01' }, { id: 'c', archived_at: null }] },
    ];
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: rows, error: null }) }) }) });
    const out = await listGroups(client);
    expect(out[0].seatsCount).toBe(2);
    expect(out[0]).not.toHaveProperty('lang_students');
  });
  it('lève une erreur lisible', async () => {
    const client = asClient({ from: () => ({ select: () => ({ order: async () => ({ data: null, error: { message: 'permission denied' } }) }) }) });
    await expect(listGroups(client)).rejects.toThrow('permission denied');
  });
});

describe('getGroup', () => {
  it('trie les places par pseudo', async () => {
    const row = { id: 'g1', nom: 'n', langue: 'nl-BE', code: 'K7M4X', archived_at: null, created_at: 'x',
      lang_students: [seat({ id: '2', pseudo: 'Orion' }), seat({ id: '1', pseudo: 'Érable' }), seat({ id: '3', pseudo: 'Meuse' })] };
    const client = asClient({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) }) });
    const g = await getGroup(client, 'g1');
    expect(g.seats.map((s) => s.pseudo)).toEqual(['Érable', 'Meuse', 'Orion']);
  });
});

describe('appels RPC', () => {
  it('createGroup', async () => {
    const { client, calls } = rpcClient({ group_id: 'g', code: 'K7M4X', seats: [{ id: '1', pseudo: 'Meuse', code: 'K472' }] });
    const out = await createGroup(client, { nom: 'Rem NL', langue: 'nl-BE', places: 8 });
    expect(calls[0]).toEqual({ name: 'lang_group_create', args: { p_nom: 'Rem NL', p_langue: 'nl-BE', p_places: 8 } });
    expect(out.code).toBe('K7M4X');
  });
  it('addSeats, regenerateCodes, resetSeatCode', async () => {
    const a = rpcClient([{ id: '1', pseudo: 'Meuse', code: 'K472' }]);
    expect(await addSeats(a.client, 'g1', 2)).toHaveLength(1);
    expect(a.calls[0]).toEqual({ name: 'lang_group_add_seats', args: { p_group: 'g1', p_count: 2 } });
    const b = rpcClient([{ id: '1', pseudo: 'Meuse', code: 'K472' }]);
    await regenerateCodes(b.client, 'g1');
    expect(b.calls[0]).toEqual({ name: 'lang_group_regenerate_codes', args: { p_group: 'g1' } });
    const c = rpcClient({ pseudo: 'Meuse', code: 'M829' });
    expect(await resetSeatCode(c.client, 's1')).toEqual({ pseudo: 'Meuse', code: 'M829' });
    expect(c.calls[0]).toEqual({ name: 'lang_seat_reset_code', args: { p_seat: 's1' } });
  });
  it('unlockSeat, archiveSeat, archiveGroup', async () => {
    const { client, calls } = rpcClient(null);
    await unlockSeat(client, 's1');
    await archiveSeat(client, 's1');
    await archiveGroup(client, 'g1');
    expect(calls.map((c) => c.name)).toEqual(['lang_seat_unlock', 'lang_seat_archive', 'lang_group_archive']);
  });
  it("traduit l'erreur de la base", async () => {
    const { client } = rpcClient(null, { message: 'Failed to fetch' });
    await expect(unlockSeat(client, 's1')).rejects.toThrow('Connexion impossible');
  });
});

describe('suppressions directes', () => {
  const deleting = (error: { message: string } | null) => {
    const seen: Array<[string, string]> = [];
    const client = asClient({
      from: (table: string) => ({ delete: () => ({ eq: async (_c: string, v: string) => { seen.push([table, v]); return { error }; } }) }),
    });
    return { client, seen };
  };
  it('deleteSeat et deleteGroup', async () => {
    const { client, seen } = deleting(null);
    await deleteSeat(client, 's1');
    await deleteGroup(client, 'g1');
    expect(seen).toEqual([['lang_students', 's1'], ['lang_groups', 'g1']]);
  });
  it('lève une erreur lisible', async () => {
    await expect(deleteGroup(deleting({ message: 'permission denied' }).client, 'g1')).rejects.toThrow('permission denied');
  });
});
```

- [ ] **Step 2: Lancer pour constater l'échec**

Run: `npx vitest run src/lib/groups.test.ts`
Expected: FAIL (« Failed to resolve import ./groups »).

- [ ] **Step 3: Implémenter `src/lib/groups.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Langue } from '../engine/types';
import { friendlyError } from './errors';

export interface GroupSummary {
  id: string;
  nom: string;
  langue: Langue;
  code: string;
  archived_at: string | null;
  created_at: string;
  seatsCount: number;
}

export interface SeatRow {
  id: string;
  group_id: string;
  pseudo: string;
  failed_attempts: number;
  locked_until: string | null;
  last_seen_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface GroupDetail {
  id: string;
  nom: string;
  langue: Langue;
  code: string;
  archived_at: string | null;
  created_at: string;
  seats: SeatRow[];
}

/** Une place dont le code en clair vient d'être généré (affiché une seule fois). */
export interface IssuedSeat {
  id: string;
  pseudo: string;
  code: string;
}

export interface CreatedGroup {
  group_id: string;
  code: string;
  seats: IssuedSeat[];
}

export type SeatState = 'archive' | 'bloque' | 'jamais' | 'actif';

export function seatState(seat: SeatRow, now: Date = new Date()): SeatState {
  if (seat.archived_at) return 'archive';
  if (seat.locked_until && new Date(seat.locked_until) > now) return 'bloque';
  if (!seat.last_seen_at) return 'jamais';
  return 'actif';
}

type SummaryRow = Omit<GroupSummary, 'seatsCount'> & { lang_students: Array<{ id: string; archived_at: string | null }> };
type DetailRow = Omit<GroupDetail, 'seats'> & { lang_students: SeatRow[] };

export async function listGroups(client: SupabaseClient): Promise<GroupSummary[]> {
  const { data, error } = await client
    .from('lang_groups')
    .select('id, nom, langue, code, archived_at, created_at, lang_students(id, archived_at)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendlyError(error.message));
  return ((data ?? []) as unknown as SummaryRow[]).map(({ lang_students, ...rest }) => ({
    ...rest,
    seatsCount: lang_students.filter((s) => !s.archived_at).length,
  }));
}

export async function getGroup(client: SupabaseClient, id: string): Promise<GroupDetail> {
  const { data, error } = await client
    .from('lang_groups')
    .select(
      'id, nom, langue, code, archived_at, created_at, ' +
        'lang_students(id, group_id, pseudo, failed_attempts, locked_until, last_seen_at, archived_at, created_at)',
    )
    .eq('id', id)
    .single();
  if (error) throw new Error(friendlyError(error.message));
  const { lang_students, ...rest } = data as unknown as DetailRow;
  return { ...rest, seats: [...lang_students].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr')) };
}

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

export function createGroup(client: SupabaseClient, input: { nom: string; langue: Langue; places: number }): Promise<CreatedGroup> {
  return rpc<CreatedGroup>(client, 'lang_group_create', { p_nom: input.nom, p_langue: input.langue, p_places: input.places });
}

export function addSeats(client: SupabaseClient, groupId: string, count: number): Promise<IssuedSeat[]> {
  return rpc<IssuedSeat[]>(client, 'lang_group_add_seats', { p_group: groupId, p_count: count });
}

export function regenerateCodes(client: SupabaseClient, groupId: string): Promise<IssuedSeat[]> {
  return rpc<IssuedSeat[]>(client, 'lang_group_regenerate_codes', { p_group: groupId });
}

export function resetSeatCode(client: SupabaseClient, seatId: string): Promise<{ pseudo: string; code: string }> {
  return rpc<{ pseudo: string; code: string }>(client, 'lang_seat_reset_code', { p_seat: seatId });
}

export async function unlockSeat(client: SupabaseClient, seatId: string): Promise<void> {
  await rpc<null>(client, 'lang_seat_unlock', { p_seat: seatId });
}

export async function archiveSeat(client: SupabaseClient, seatId: string): Promise<void> {
  await rpc<null>(client, 'lang_seat_archive', { p_seat: seatId });
}

export async function archiveGroup(client: SupabaseClient, groupId: string): Promise<void> {
  await rpc<null>(client, 'lang_group_archive', { p_group: groupId });
}

/** Suppression définitive : la cascade efface places et sessions (droit à l'effacement). */
export async function deleteSeat(client: SupabaseClient, seatId: string): Promise<void> {
  const { error } = await client.from('lang_students').delete().eq('id', seatId);
  if (error) throw new Error(friendlyError(error.message));
}

export async function deleteGroup(client: SupabaseClient, groupId: string): Promise<void> {
  const { error } = await client.from('lang_groups').delete().eq('id', groupId);
  if (error) throw new Error(friendlyError(error.message));
}
```

- [ ] **Step 4: Relancer**

Run: `npx vitest run src/lib/groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/groups.ts src/lib/groups.test.ts
git commit -m "Bibliothèque groupes : lecture, RPC et suppressions"
```

---

### Task 7: Bandes imprimables et adresse élève (`slips.ts`)

**Files:**
- Create: `src/lib/slips.ts`
- Test: `src/lib/slips.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, expect, it } from 'vitest';
import { buildSlips, groupCodeFromSearch, isStudentRoute, studentUrl } from './slips';

describe('studentUrl', () => {
  it('construit l\'adresse de connexion du groupe', () => {
    expect(studentUrl('https://langactif.jfb4plai.com', 'K7M4X')).toBe('https://langactif.jfb4plai.com/eleve?g=K7M4X');
  });
  it('ignore la barre finale de l\'origine', () => {
    expect(studentUrl('http://localhost:3000/', 'K7M4X')).toBe('http://localhost:3000/eleve?g=K7M4X');
  });
});

describe('buildSlips', () => {
  it('une bande par place, avec adresse et code de groupe', () => {
    const slips = buildSlips('http://localhost:3000', 'K7M4X', [{ pseudo: 'Meuse', code: 'K472' }, { pseudo: 'Orion', code: 'M829' }]);
    expect(slips).toEqual([
      { pseudo: 'Meuse', code: 'K472', groupCode: 'K7M4X', url: 'http://localhost:3000/eleve?g=K7M4X' },
      { pseudo: 'Orion', code: 'M829', groupCode: 'K7M4X', url: 'http://localhost:3000/eleve?g=K7M4X' },
    ]);
  });
});

describe('groupCodeFromSearch', () => {
  it('lit et normalise ?g=', () => {
    expect(groupCodeFromSearch('?g=k7m4x')).toBe('K7M4X');
  });
  it('rejette ce qui n\'est pas un code plausible', () => {
    expect(groupCodeFromSearch('?g=<script>')).toBe('');
    expect(groupCodeFromSearch('?g=ABCDEFGHIJKLMN')).toBe('');
    expect(groupCodeFromSearch('')).toBe('');
  });
});

describe('isStudentRoute', () => {
  it.each([['/eleve', true], ['/eleve/', true], ['/eleve/x', true], ['/eleves', false], ['/', false], ['/chapitres', false]])(
    '%s',
    (path, expected) => {
      expect(isStudentRoute(path)).toBe(expected);
    },
  );
});
```

- [ ] **Step 2: Lancer pour constater l'échec**

Run: `npx vitest run src/lib/slips.test.ts`
Expected: FAIL (« Failed to resolve import ./slips »).

- [ ] **Step 3: Implémenter `src/lib/slips.ts`**

```ts
export interface Slip {
  pseudo: string;
  code: string;
  groupCode: string;
  url: string;
}

export function studentUrl(origin: string, groupCode: string): string {
  return `${origin.replace(/\/$/, '')}/eleve?g=${encodeURIComponent(groupCode)}`;
}

export function buildSlips(origin: string, groupCode: string, seats: Array<{ pseudo: string; code: string }>): Slip[] {
  const url = studentUrl(origin, groupCode);
  return seats.map((s) => ({ pseudo: s.pseudo, code: s.code, groupCode, url }));
}

/** Code de groupe lu dans `?g=` ; chaîne vide si absent ou invalide (jamais d'injection dans la page). */
export function groupCodeFromSearch(search: string): string {
  const raw = new URLSearchParams(search).get('g') ?? '';
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,10}$/.test(code) ? code : '';
}

export function isStudentRoute(pathname: string): boolean {
  return /^\/eleve(\/|$)/.test(pathname);
}
```

- [ ] **Step 4: Relancer**

Run: `npx vitest run src/lib/slips.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slips.ts src/lib/slips.test.ts
git commit -m "Bandes imprimables, adresse élève et lecture du code de groupe"
```

---

### Task 8: Client élève (`studentApi.ts`)

**Files:**
- Create: `src/lib/studentApi.ts`
- Test: `src/lib/studentApi.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, expect, it } from 'vitest';
import {
  clearToken,
  fetchMe,
  fetchPseudos,
  loadToken,
  loginStudent,
  logoutStudent,
  saveToken,
  type Stores,
} from './studentApi';

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const fakeStore = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage;
};
const stores = (): Stores => ({ local: fakeStore(), session: fakeStore() });

const input = { groupe: 'K7M4X', pseudo: 'Meuse', code: 'K472', appareilPartage: false };

describe('loginStudent', () => {
  it('succès : renvoie le jeton', async () => {
    const f = async () => jsonResponse(200, { ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
    expect(await loginStudent(input, f)).toEqual({ ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
  });
  it('401 : invalide', async () => {
    const f = async () => jsonResponse(401, { ok: false, reason: 'invalide' });
    expect(await loginStudent(input, f)).toEqual({ ok: false, reason: 'invalide' });
  });
  it('423 : bloqué avec délai', async () => {
    const f = async () => jsonResponse(423, { ok: false, reason: 'bloque', retry_after_seconds: 600 });
    expect(await loginStudent(input, f)).toEqual({ ok: false, reason: 'bloque', retryAfterSeconds: 600 });
  });
  it('429 : trop de tentatives', async () => {
    const f = async () => jsonResponse(429, { ok: false, reason: 'trop_de_tentatives' });
    expect(await loginStudent(input, f)).toEqual({ ok: false, reason: 'trop_de_tentatives' });
  });
  it('500 et réseau coupé : reseau', async () => {
    expect(await loginStudent(input, async () => jsonResponse(500, {}))).toEqual({ ok: false, reason: 'reseau' });
    expect(await loginStudent(input, async () => { throw new Error('offline'); })).toEqual({ ok: false, reason: 'reseau' });
  });
  it('envoie une requête POST JSON', async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const f = async (url: RequestInfo | URL, init?: RequestInit) => {
      seen = { url: String(url), init };
      return jsonResponse(401, { ok: false, reason: 'invalide' });
    };
    await loginStudent(input, f as typeof fetch);
    expect(seen!.url).toBe('/api/student-login');
    expect(seen!.init?.method).toBe('POST');
    expect(JSON.parse(String(seen!.init?.body))).toEqual(input);
  });
});

describe('fetchPseudos', () => {
  it('renvoie la liste', async () => {
    expect(await fetchPseudos('K7M4X', async () => jsonResponse(200, { pseudos: ['Meuse', 'Orion'] }))).toEqual(['Meuse', 'Orion']);
  });
  it('null si groupe inconnu ou réseau coupé', async () => {
    expect(await fetchPseudos('ZZZZZ', async () => jsonResponse(404, { error: 'x' }))).toBeNull();
    expect(await fetchPseudos('ZZZZZ', async () => { throw new Error('offline'); })).toBeNull();
  });
});

describe('fetchMe', () => {
  it('ok', async () => {
    expect(await fetchMe('t', async () => jsonResponse(200, { pseudo: 'Meuse', langue: 'nl-BE' }))).toEqual({
      status: 'ok', pseudo: 'Meuse', langue: 'nl-BE',
    });
  });
  it('401 : session expirée', async () => {
    expect(await fetchMe('t', async () => jsonResponse(401, { error: 'x' }))).toEqual({ status: 'expire' });
  });
  it('réseau coupé : on ne déconnecte pas l\'élève', async () => {
    expect(await fetchMe('t', async () => { throw new Error('offline'); })).toEqual({ status: 'reseau' });
  });
});

describe('logoutStudent', () => {
  it('ne lève jamais d\'erreur', async () => {
    await expect(logoutStudent('t', async () => { throw new Error('offline'); })).resolves.toBeUndefined();
  });
});

describe('stockage du jeton', () => {
  it('session personnelle : localStorage', () => {
    const s = stores();
    saveToken('abc', false, s);
    expect(loadToken(s)).toBe('abc');
    expect(s.local!.getItem('langactif.eleve.jeton')).toBe('abc');
    expect(s.session!.getItem('langactif.eleve.jeton')).toBeNull();
  });
  it('appareil partagé : sessionStorage seulement', () => {
    const s = stores();
    saveToken('abc', true, s);
    expect(s.session!.getItem('langactif.eleve.jeton')).toBe('abc');
    expect(s.local!.getItem('langactif.eleve.jeton')).toBeNull();
  });
  it('un nouveau jeton remplace l\'ancien des deux côtés', () => {
    const s = stores();
    saveToken('ancien', false, s);
    saveToken('nouveau', true, s);
    expect(s.local!.getItem('langactif.eleve.jeton')).toBeNull();
    expect(loadToken(s)).toBe('nouveau');
  });
  it('clearToken efface tout', () => {
    const s = stores();
    saveToken('abc', false, s);
    clearToken(s);
    expect(loadToken(s)).toBeNull();
  });
  it('fonctionne sans stockage disponible', () => {
    const none: Stores = { local: null, session: null };
    expect(() => saveToken('abc', false, none)).not.toThrow();
    expect(loadToken(none)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer pour constater l'échec**

Run: `npx vitest run src/lib/studentApi.test.ts`
Expected: FAIL (« Failed to resolve import ./studentApi »).

- [ ] **Step 3: Implémenter `src/lib/studentApi.ts`**

```ts
const TOKEN_KEY = 'langactif.eleve.jeton';

type Fetch = typeof fetch;

export type LoginResult =
  | { ok: true; token: string; pseudo: string; langue: string }
  | { ok: false; reason: 'invalide' | 'bloque' | 'trop_de_tentatives' | 'reseau'; retryAfterSeconds?: number };

export type MeResult = { status: 'ok'; pseudo: string; langue: string } | { status: 'expire' } | { status: 'reseau' };

export interface LoginInput {
  groupe: string;
  pseudo: string;
  code: string;
  appareilPartage: boolean;
}

export async function fetchPseudos(groupCode: string, f: Fetch = fetch): Promise<string[] | null> {
  try {
    const r = await f(`/api/student-list-pseudos?g=${encodeURIComponent(groupCode)}`);
    if (!r.ok) return null;
    const d = (await r.json()) as { pseudos?: string[] };
    return d.pseudos ?? null;
  } catch {
    return null;
  }
}

export async function loginStudent(input: LoginInput, f: Fetch = fetch): Promise<LoginResult> {
  try {
    const r = await f('/api/student-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const d = (await r.json()) as { ok?: boolean; token?: string; pseudo?: string; langue?: string; retry_after_seconds?: number };
    if (r.ok && d.ok && d.token) return { ok: true, token: d.token, pseudo: d.pseudo ?? '', langue: d.langue ?? '' };
    if (r.status === 423) return { ok: false, reason: 'bloque', retryAfterSeconds: d.retry_after_seconds };
    if (r.status === 429) return { ok: false, reason: 'trop_de_tentatives' };
    if (r.status >= 500) return { ok: false, reason: 'reseau' };
    return { ok: false, reason: 'invalide' };
  } catch {
    return { ok: false, reason: 'reseau' };
  }
}

export async function fetchMe(token: string, f: Fetch = fetch): Promise<MeResult> {
  try {
    const r = await f('/api/student-me', { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) return { status: 'expire' };
    if (!r.ok) return { status: 'reseau' };
    const d = (await r.json()) as { pseudo: string; langue: string };
    return { status: 'ok', pseudo: d.pseudo, langue: d.langue };
  } catch {
    return { status: 'reseau' };
  }
}

/** Révocation au mieux : la déconnexion locale ne dépend pas de la réponse. */
export async function logoutStudent(token: string, f: Fetch = fetch): Promise<void> {
  try {
    await f('/api/student-logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* hors ligne : le jeton expirera ou sera révoqué à la prochaine occasion */
  }
}

export interface Stores {
  local: Storage | null;
  session: Storage | null;
}

export function defaultStores(): Stores {
  const get = (name: 'localStorage' | 'sessionStorage'): Storage | null => {
    try {
      return window[name];
    } catch {
      return null; // navigation privée ou stockage bloqué
    }
  };
  return { local: get('localStorage'), session: get('sessionStorage') };
}

export function clearToken(stores: Stores = defaultStores()): void {
  for (const s of [stores.local, stores.session]) {
    try {
      s?.removeItem(TOKEN_KEY);
    } catch {
      /* ignoré */
    }
  }
}

/** Appareil partagé : sessionStorage (disparaît à la fermeture de l'onglet). Sinon localStorage. */
export function saveToken(token: string, shared: boolean, stores: Stores = defaultStores()): void {
  clearToken(stores);
  try {
    (shared ? stores.session : stores.local)?.setItem(TOKEN_KEY, token);
  } catch {
    /* sans stockage, l'élève devra se reconnecter à chaque visite */
  }
}

export function loadToken(stores: Stores = defaultStores()): string | null {
  try {
    return stores.session?.getItem(TOKEN_KEY) ?? stores.local?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Relancer**

Run: `npx vitest run src/lib/studentApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/studentApi.ts src/lib/studentApi.test.ts
git commit -m "Client élève : appels aux fonctions api et stockage du jeton"
```

---

### Task 9: Fonctions Vercel `api/*.ts`

**Files:**
- Create: `vercel.json`, `api/tsconfig.json`, `api/student-list-pseudos.ts`, `api/student-login.ts`, `api/student-me.ts`, `api/student-logout.ts`
- Create: `tests/api/helpers.ts`, `tests/api/student-list-pseudos.test.ts`, `tests/api/student-login.test.ts`, `tests/api/student-session.test.ts`
- Modify: `vite.config.ts`, `package.json`, `.env.example`

- [ ] **Step 1: Installer `@vercel/node` et configurer**

Run: `npm install -D @vercel/node@^3.2.29`

`vercel.json` :

```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

`api/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["*.ts"]
}
```

Dans `vite.config.ts`, remplacer `test: { include: ['src/**/*.test.ts'] }` par :

```ts
  test: { include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
```

Dans `package.json`, ajouter dans `scripts` : `"typecheck:api": "tsc --noEmit -p api/tsconfig.json"`.

Dans `.env.example`, ajouter à la fin :

```
# Côté serveur uniquement (fonctions api/*). Ne jamais préfixer par VITE_ ni la coller dans le chat.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Écrire les aides de test `tests/api/helpers.ts`**

```ts
import { vi } from 'vitest';

export interface FakeRes {
  statusCode: number;
  body: unknown;
  status(code: number): FakeRes;
  json(body: unknown): FakeRes;
}

export function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

export function fakeReq(init: {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}) {
  return { method: init.method ?? 'GET', headers: init.headers ?? {}, query: init.query ?? {}, body: init.body };
}

export function setEnv() {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-test';
}

/** Simule la réponse PostgREST (appel RPC). */
export function stubSupabase(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => payload }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
```

- [ ] **Step 3: Écrire les tests qui échouent**

`tests/api/student-list-pseudos.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/student-list-pseudos';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

const call = async (req: ReturnType<typeof fakeReq>) => {
  const res = fakeRes();
  await handler(req as never, res as never);
  return res;
};

describe('student-list-pseudos', () => {
  it('renvoie les pseudos du groupe', async () => {
    const fetchMock = stubSupabase(['Meuse', 'Orion']);
    const res = await call(fakeReq({ query: { g: 'k7m4x' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ pseudos: ['Meuse', 'Orion'] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/lang_group_pseudos');
    expect(JSON.parse(String(init.body))).toEqual({ p_group_code: 'K7M4X' });
  });
  it('404 si le groupe est inconnu (liste vide)', async () => {
    stubSupabase([]);
    expect((await call(fakeReq({ query: { g: 'ZZZZZ' } }))).statusCode).toBe(404);
  });
  it('400 si le code est absent ou invalide, sans appeler la base', async () => {
    const fetchMock = stubSupabase([]);
    expect((await call(fakeReq({ query: {} }))).statusCode).toBe(400);
    expect((await call(fakeReq({ query: { g: '<script>' } }))).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors GET', async () => {
    expect((await call(fakeReq({ method: 'POST', query: { g: 'K7M4X' } }))).statusCode).toBe(405);
  });
});
```

`tests/api/student-login.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/student-login';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

let ipCounter = 0;
const nextIp = () => `10.0.0.${++ipCounter}`;

const call = async (body: unknown, ip = nextIp(), method = 'POST') => {
  const res = fakeRes();
  await handler(fakeReq({ method, headers: { 'x-forwarded-for': ip }, body }) as never, res as never);
  return res;
};
const good = { groupe: 'k7m4x', pseudo: 'Meuse', code: 'k472', appareilPartage: true };

describe('student-login', () => {
  it('succès : 200 avec le jeton, entrées normalisées', async () => {
    const fetchMock = stubSupabase({ ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
    const res = await call(good);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, token: 'abc', pseudo: 'Meuse', langue: 'nl-BE' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/lang_student_login');
    expect(JSON.parse(String(init.body))).toEqual({ p_group_code: 'K7M4X', p_pseudo: 'Meuse', p_code: 'K472', p_shared: true });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-key-test');
  });
  it('401 pour un code incorrect, sans détail', async () => {
    stubSupabase({ ok: false, reason: 'invalide' });
    const res = await call(good);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, reason: 'invalide' });
  });
  it('423 avec le délai restant pour un pseudo bloqué', async () => {
    stubSupabase({ ok: false, reason: 'bloque', retry_after_seconds: 600 });
    const res = await call(good);
    expect(res.statusCode).toBe(423);
    expect(res.body).toEqual({ ok: false, reason: 'bloque', retry_after_seconds: 600 });
  });
  it('400 si un champ manque ou est trop long, sans appeler la base', async () => {
    const fetchMock = stubSupabase({});
    expect((await call({ ...good, pseudo: '' })).statusCode).toBe(400);
    expect((await call({ ...good, code: 'A'.repeat(11) })).statusCode).toBe(400);
    expect((await call(undefined)).statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors POST', async () => {
    expect((await call(good, nextIp(), 'GET')).statusCode).toBe(405);
  });
  it('502 si la base répond en erreur', async () => {
    stubSupabase({}, false);
    expect((await call(good)).statusCode).toBe(502);
  });
  it('429 au-delà de 30 tentatives par IP', async () => {
    stubSupabase({ ok: false, reason: 'invalide' });
    const ip = nextIp();
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await call(good, ip)).statusCode;
    expect(last).toBe(429);
  });
});
```

`tests/api/student-session.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logout from '../../api/student-logout';
import me from '../../api/student-me';
import { fakeReq, fakeRes, setEnv, stubSupabase } from './helpers';

beforeEach(setEnv);
afterEach(() => vi.unstubAllGlobals());

const TOKEN = 'a'.repeat(64);
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

const run = async (h: typeof me, req: ReturnType<typeof fakeReq>) => {
  const res = fakeRes();
  await h(req as never, res as never);
  return res;
};

describe('student-me', () => {
  it('200 avec le pseudo si le jeton est valide', async () => {
    const fetchMock = stubSupabase({ pseudo: 'Meuse', langue: 'nl-BE' });
    const res = await run(me, fakeReq({ headers: bearer(TOKEN) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ pseudo: 'Meuse', langue: 'nl-BE' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ p_token: TOKEN });
  });
  it('401 si la base répond null (jeton inconnu, expiré ou révoqué)', async () => {
    stubSupabase(null);
    expect((await run(me, fakeReq({ headers: bearer(TOKEN) }))).statusCode).toBe(401);
  });
  it('401 sans appeler la base si le jeton est absent ou mal formé', async () => {
    const fetchMock = stubSupabase({});
    expect((await run(me, fakeReq({}))).statusCode).toBe(401);
    expect((await run(me, fakeReq({ headers: bearer('court') }))).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors GET', async () => {
    expect((await run(me, fakeReq({ method: 'POST', headers: bearer(TOKEN) }))).statusCode).toBe(405);
  });
});

describe('student-logout', () => {
  it('200 et appel de la révocation', async () => {
    const fetchMock = stubSupabase(null);
    const res = await run(logout, fakeReq({ method: 'POST', headers: bearer(TOKEN) }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/lang_student_logout');
  });
  it('200 même sans jeton valide (rien à révoquer), sans appeler la base', async () => {
    const fetchMock = stubSupabase(null);
    const res = await run(logout, fakeReq({ method: 'POST', headers: bearer('court') }));
    expect(res.statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('405 hors POST', async () => {
    expect((await run(logout, fakeReq({ method: 'GET', headers: bearer(TOKEN) }))).statusCode).toBe(405);
  });
});
```

- [ ] **Step 4: Lancer pour constater l'échec**

Run: `npx vitest run tests/api`
Expected: FAIL (modules `../../api/...` introuvables).

- [ ] **Step 5: Implémenter les quatre fonctions**

Chaque fichier est autonome (aucun import depuis un autre fichier de `api/`, voir la note de LexiActif dans `lexiactif/api/play-list.ts` : un import asynchrone entre fichiers `api/` a provoqué des `FUNCTION_INVOCATION_FAILED`).

`api/student-list-pseudos.ts` :

```ts
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
```

`api/student-login.ts` :

```ts
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
```

`api/student-me.ts` :

```ts
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
```

`api/student-logout.ts` :

```ts
// api/student-logout.ts
// Fonction autonome : ne rien importer d'un autre fichier de api/ (voir student-list-pseudos.ts).
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
      res.status(200).json({ ok: true }); // rien à révoquer
      return;
    }
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceKey) {
      res.status(500).json({ error: 'Configuration serveur manquante' });
      return;
    }
    const response = await fetch(`${baseUrl}/rest/v1/rpc/lang_student_logout`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Service indisponible' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
```

- [ ] **Step 6: Lancer les tests et le contrôle de types**

Run: `npx vitest run tests/api && npm run typecheck:api`
Expected: tous les tests PASS ; `tsc` sans erreur.

- [ ] **Step 7: Commit**

```bash
git add api tests vercel.json vite.config.ts package.json package-lock.json .env.example
git commit -m "Fonctions api élève : connexion, session, déconnexion, liste des pseudos"
```

---

### Task 10: Fiche imprimable et styles

**Files:**
- Create: `src/components/PrintSheet.tsx`
- Modify: `src/overrides.css`, `package.json`

- [ ] **Step 1: Installer la bibliothèque de QR**

Run: `npm install qrcode && npm install -D @types/qrcode`

- [ ] **Step 2: Créer `src/components/PrintSheet.tsx`**

```tsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Slip } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';

interface Props {
  title: string;
  slips: Slip[];
  doneLabel: string;
  onDone: () => void;
}

function SlipCard({ slip }: { slip: Slip }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(slip.url, { margin: 1, width: 160 })
      .then((u) => alive && setQr(u))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [slip.url]);

  return (
    <div className="lang-slip">
      <p className="lang-slip-app">LangActif</p>
      <dl>
        <dt>Groupe</dt>
        <dd>{slip.groupCode}</dd>
        <dt>Pseudo</dt>
        <dd>{slip.pseudo}</dd>
        <dt>Code</dt>
        <dd className="lang-slip-code">{slip.code}</dd>
      </dl>
      {qr && <img src={qr} alt="QR code vers la page de connexion du groupe" width={110} height={110} />}
      <p className="lang-slip-url">{slip.url.replace(/^https?:\/\//, '').split('?')[0]}</p>
      <p className="lang-slip-name">Nom : ____________________</p>
    </div>
  );
}

export function PrintSheet({ title, slips, doneLabel, onDone }: Props) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section>
      <div className="lang-no-print">
        <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26, marginBottom: 12 }}>{title}</h1>
        <div className="plai-banner" role="alert">
          Les codes ne seront plus affichés après cette page. Imprimez les fiches maintenant ou notez les codes. Si une fiche
          est perdue, vous pourrez générer un nouveau code pour cette place.
        </div>
        <p style={{ margin: '12px 0' }}>
          Écrivez le nom de l'élève au crayon sur sa bande. La correspondance entre le pseudo et le nom reste dans votre carnet,
          jamais dans l'application.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button type="button" className="plai-btn" onClick={() => window.print()}>Imprimer les fiches</button>
          <button type="button" className="plai-btn-ghost" onClick={onDone}>{doneLabel}</button>
        </div>
      </div>
      <div className="lang-slips">
        {slips.map((s) => (
          <SlipCard key={s.pseudo} slip={s} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Ajouter les styles à `src/overrides.css`** (à la fin du fichier)

```css
/* Fiches imprimables (plan 3a) */
.lang-slips {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}
.lang-slip {
  border: 2px dashed var(--text3);
  border-radius: 8px;
  padding: 12px 14px;
  background: #fff;
  break-inside: avoid;
}
.lang-slip dl { margin: 8px 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.lang-slip dt { color: var(--text2); }
.lang-slip dd { margin: 0; font-weight: 600; }
.lang-slip-app { font-weight: 700; }
.lang-slip-code { font-size: 28px; letter-spacing: 0.15em; }
.lang-slip-url,
.lang-slip-name { font-size: 14px; margin-top: 6px; }

@media print {
  .plai-nav,
  .plai-footer,
  .lang-no-print {
    display: none !important;
  }
  body {
    background: #fff;
    font-family: Arial, sans-serif;
    font-size: 12pt;
  }
  .lang-slips { grid-template-columns: repeat(2, 1fr); }
  .lang-slip { border-color: #000; }
}

/* Grille de choix du pseudo (écran élève) */
.lang-pseudo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.lang-pseudo-grid label {
  display: block;
  min-height: 44px;
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
}
.lang-pseudo-grid input { position: absolute; opacity: 0; }
.lang-pseudo-grid input:checked + span { font-weight: 700; }
.lang-pseudo-grid label:has(input:checked) { border-color: var(--teal); background: var(--teal-bg); }
.lang-pseudo-grid label:has(input:focus-visible) { outline: 3px solid var(--teal); outline-offset: 2px; }
```

- [ ] **Step 4: Contrôle de types**

Run: `npx tsc --noEmit`
Expected: aucune erreur (le composant n'est pas encore utilisé : `noUnusedLocals` ne signale pas un export).

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintSheet.tsx src/overrides.css package.json package-lock.json
git commit -m "Fiche imprimable : bandes détachables avec QR"
```

---

### Task 11: Espace enseignant : liste, création, détail, navigation

**Files:**
- Create: `src/components/GroupList.tsx`, `src/components/GroupCreate.tsx`, `src/components/GroupDetail.tsx`
- Modify: `src/components/Layout.tsx`, `src/App.tsx`

- [ ] **Step 1: Créer `src/components/GroupList.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listGroups, type GroupSummary } from '../lib/groups';
import { langueLabel } from '../lib/labels';
import { useFocusOnMount } from '../lib/useFocusOnMount';

interface Props {
  client: SupabaseClient;
  onOpen: (id: string) => void;
  onCreate: () => void;
}

export function GroupList({ client, onOpen, onCreate }: Props) {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    let alive = true;
    listGroups(client)
      .then((g) => alive && setGroups(g))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client]);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26 }}>Mes groupes</h1>
        <button type="button" className="plai-btn" onClick={onCreate}>Créer un groupe</button>
      </div>

      {error && <div className="plai-error" role="alert">Impossible de charger vos groupes : {error}</div>}
      {!error && groups === null && <p aria-live="polite">Chargement...</p>}
      {groups !== null && groups.length === 0 && (
        <p className="plai-empty">
          Aucun groupe pour l'instant. Un groupe réunit les élèves d'une remédiation ou d'une classe : chacun reçoit un pseudo et un
          code personnel, sans nom ni adresse e-mail.
        </p>
      )}
      {groups?.map((g) => (
        <button
          key={g.id}
          type="button"
          className="plai-card"
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          onClick={() => onOpen(g.id)}
        >
          <strong>{g.nom}</strong>
          <span style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="lang-badge">{langueLabel(g.langue)}</span>
            <span style={{ color: 'var(--text2)' }}>Code de groupe : {g.code}</span>
            <span style={{ color: 'var(--text2)' }}>{g.seatsCount} {g.seatsCount > 1 ? 'places' : 'place'}</span>
            {g.archived_at && <span style={{ color: 'var(--text2)' }}>Archivé</span>}
          </span>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Créer `src/components/GroupCreate.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Langue } from '../engine/types';
import { createGroup, type CreatedGroup } from '../lib/groups';
import { buildSlips } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { FormField } from './FormField';
import { PrintSheet } from './PrintSheet';

interface Props {
  client: SupabaseClient;
  onDone: (groupId: string) => void;
  onCancel: () => void;
}

export function GroupCreate({ client, onDone, onCancel }: Props) {
  const [nom, setNom] = useState('');
  const [langue, setLangue] = useState<Langue>('nl-BE');
  const [places, setPlaces] = useState('8');
  const [errors, setErrors] = useState<{ nom?: string; places?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedGroup | null>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  if (created) {
    return (
      <PrintSheet
        title={`Fiches du groupe « ${nom.trim()} »`}
        slips={buildSlips(window.location.origin, created.code, created.seats)}
        doneLabel="Ouvrir le groupe"
        onDone={() => onDone(created.group_id)}
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const trimmed = nom.trim();
    const n = Number(places);
    if (!trimmed) next.nom = 'Donnez un nom au groupe.';
    else if (trimmed.length > 200) next.nom = 'Le nom est trop long (200 caractères au maximum).';
    if (!Number.isInteger(n) || n < 1 || n > 40) next.places = 'Indiquez un nombre entier de 1 à 40.';
    setErrors(next);
    if (next.nom || next.places) return;

    setSubmitting(true);
    try {
      setCreated(await createGroup(client, { nom: trimmed, langue, places: n }));
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Création impossible.' });
      setSubmitting(false);
    }
  };

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onCancel} style={{ marginBottom: '1rem' }}>Retour aux groupes</button>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 26, marginBottom: 12 }}>Créer un groupe</h1>
      <form className="plai-card" onSubmit={submit} noValidate>
        <FormField
          label="Nom du groupe"
          required
          error={errors.nom}
          help="Visible par vous seul. N'écrivez aucun nom d'élève : l'application ne doit jamais contenir de nom."
        >
          <input
            className="plai-input"
            value={nom}
            maxLength={200}
            placeholder="Remédiation néerlandais, 2e S, lundi 12 h"
            onChange={(e) => setNom(e.target.value)}
          />
        </FormField>
        <FormField label="Langue" help="Détermine les chapitres que vous pourrez assigner à ce groupe.">
          <select className="plai-input" value={langue} onChange={(e) => setLangue(e.target.value as Langue)}>
            <option value="nl-BE">Néerlandais (Belgique)</option>
            <option value="en-GB">Anglais (Royaume-Uni)</option>
          </select>
        </FormField>
        <FormField
          label="Nombre de places"
          required
          error={errors.places}
          help="Une place = un pseudo et un code à distribuer. Vous pourrez en ajouter plus tard sans changer les codes déjà distribués. Un élève qui suit deux groupes aura un pseudo dans chacun."
        >
          <input
            className="plai-input"
            inputMode="numeric"
            value={places}
            placeholder="8"
            onChange={(e) => setPlaces(e.target.value)}
          />
        </FormField>
        {errors.general && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{errors.general}</div>}
        <button type="submit" className="plai-btn" disabled={submitting}>
          {submitting ? 'Création...' : 'Créer le groupe et les fiches'}
        </button>
      </form>
    </section>
  );
}
```

- [ ] **Step 3: Créer `src/components/GroupDetail.tsx`**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addSeats,
  archiveGroup,
  archiveSeat,
  deleteGroup,
  deleteSeat,
  getGroup,
  regenerateCodes,
  resetSeatCode,
  seatState,
  unlockSeat,
  type GroupDetail as Detail,
  type SeatState,
} from '../lib/groups';
import { langueLabel } from '../lib/labels';
import { buildSlips, type Slip } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { FormField } from './FormField';
import { PrintSheet } from './PrintSheet';

interface Props {
  client: SupabaseClient;
  id: string;
  onBack: () => void;
}

const STATE_LABEL: Record<SeatState, string> = {
  archive: 'Archivée',
  bloque: 'Bloquée',
  jamais: 'Jamais connecté',
  actif: 'Active',
};

function Title({ children }: { children: ReactNode }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <h1 ref={ref} tabIndex={-1} className="font-serif" style={{ fontSize: 26 }}>
      {children}
    </h1>
  );
}

export function GroupDetail({ client, id, onBack }: Props) {
  const [group, setGroup] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ title: string; slips: Slip[] } | null>(null);
  const [extra, setExtra] = useState('1');

  const load = useCallback(async () => {
    try {
      setGroup(await getGroup(client, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [client, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!group) {
    return error ? (
      <section>
        <div className="plai-error" role="alert">{error}</div>
        <button type="button" className="plai-btn-ghost" onClick={onBack}>Retour</button>
      </section>
    ) : (
      <p aria-live="polite">Chargement...</p>
    );
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setConfirming(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  const show = (title: string, seats: Array<{ pseudo: string; code: string }>) =>
    setIssued({ title, slips: buildSlips(window.location.origin, group.code, seats) });

  if (issued) {
    return <PrintSheet title={issued.title} slips={issued.slips} doneLabel="Retour au groupe" onDone={() => setIssued(null)} />;
  }

  const archived = group.archived_at !== null;
  const activeSeats = group.seats.filter((s) => !s.archived_at).length;

  const addMore = () => {
    const n = Number(extra);
    if (!Number.isInteger(n) || n < 1 || n > 40) {
      setError('Indiquez un nombre entier de 1 à 40.');
      return;
    }
    void run(async () => show(`Fiches des ${n} nouvelles places`, await addSeats(client, group.id, n)));
  };

  const confirmBox = (key: string, text: string, onYes: () => void) =>
    confirming === key && (
      <div role="alert" style={{ marginTop: 8 }}>
        <p style={{ marginBottom: 8 }}>{text}</p>
        <button type="button" className="plai-btn" disabled={busy} onClick={onYes}>Confirmer</button>{' '}
        <button type="button" className="plai-btn-ghost" onClick={() => setConfirming(null)}>Annuler</button>
      </div>
    );

  return (
    <section>
      <button type="button" className="plai-btn-ghost" onClick={onBack} style={{ marginBottom: '1rem' }}>Retour aux groupes</button>
      <Title>{group.nom}</Title>
      <div style={{ margin: '8px 0 1.25rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="lang-badge">{langueLabel(group.langue)}</span>
        <span style={{ color: 'var(--text2)' }}>Code de groupe : <strong>{group.code}</strong></span>
        <span style={{ color: 'var(--text2)' }}>{activeSeats} {activeSeats > 1 ? 'places actives' : 'place active'}</span>
      </div>

      {archived && <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>Groupe archivé : les élèves ne peuvent plus se connecter.</div>}
      {error && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="plai-card" style={{ overflowX: 'auto' }}>
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Places</h2>
        <table className="lang-table">
          <thead>
            <tr>
              <th scope="col">Pseudo</th>
              <th scope="col">État</th>
              <th scope="col">Dernière activité</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {group.seats.map((s) => {
              const state = seatState(s);
              return (
                <tr key={s.id}>
                  <td>{s.pseudo}</td>
                  <td>{STATE_LABEL[state]}</td>
                  <td>{s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString('fr-BE') : ''}</td>
                  <td>
                    {state !== 'archive' && !archived && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="plai-btn-ghost"
                          disabled={busy}
                          onClick={() => void run(async () => show(`Nouveau code pour ${s.pseudo}`, [await resetSeatCode(client, s.id)]))}
                        >
                          Nouveau code
                        </button>
                        {state === 'bloque' && (
                          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => void run(() => unlockSeat(client, s.id))}>
                            Débloquer
                          </button>
                        )}
                        <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming(`seat-archive:${s.id}`)}>
                          Archiver
                        </button>
                      </div>
                    )}
                    <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming(`seat-delete:${s.id}`)}>
                      Supprimer
                    </button>
                    {confirmBox(`seat-archive:${s.id}`, `Archiver « ${s.pseudo} » ? L'élève ne pourra plus se connecter ; ses données sont conservées.`, () =>
                      void run(() => archiveSeat(client, s.id)),
                    )}
                    {confirmBox(
                      `seat-delete:${s.id}`,
                      `Supprimer définitivement « ${s.pseudo} » ? Cela efface aussi tout son travail. Cette action ne peut pas être annulée.`,
                      () => void run(() => deleteSeat(client, s.id)),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!archived && (
        <div className="plai-card" style={{ marginTop: '1rem' }}>
          <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Ajouter des places</h2>
          <FormField
            label="Nombre de places à ajouter"
            help="Seules les nouvelles places reçoivent un pseudo et un code. Les codes déjà distribués ne changent pas."
          >
            <input className="plai-input" inputMode="numeric" value={extra} placeholder="2" onChange={(e) => setExtra(e.target.value)} />
          </FormField>
          <button type="button" className="plai-btn" disabled={busy} onClick={addMore}>Ajouter et imprimer</button>

          <h2 className="font-serif" style={{ fontSize: 20, margin: '1.25rem 0 8px' }}>Régénérer toutes les fiches</h2>
          <p style={{ color: 'var(--text2)', marginBottom: 8 }}>
            Nouveaux codes pour toutes les places actives. Les anciennes fiches et tous les appareils connectés sont invalidés.
          </p>
          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming('regen')}>Régénérer les fiches</button>
          {confirmBox('regen', 'Tous les élèves devront utiliser leur nouveau code. Continuer ?', () =>
            void run(async () => show('Nouvelles fiches du groupe', await regenerateCodes(client, group.id))),
          )}
        </div>
      )}

      <div className="plai-card" style={{ marginTop: '1rem' }}>
        <h2 className="font-serif" style={{ fontSize: 20, marginBottom: 8 }}>Archiver ou supprimer le groupe</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {!archived && (
            <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming('group-archive')}>Archiver le groupe</button>
          )}
          <button type="button" className="plai-btn-ghost" disabled={busy} onClick={() => setConfirming('group-delete')}>Supprimer le groupe</button>
        </div>
        {confirmBox('group-archive', 'Archiver le groupe ? Plus aucun élève ne pourra se connecter ; les données sont conservées.', () =>
          void run(() => archiveGroup(client, group.id)),
        )}
        {confirmBox(
          'group-delete',
          `Supprimer définitivement « ${group.nom} » (${group.seats.length} places) ? Cela efface aussi tout le travail des élèves. Cette action ne peut pas être annulée.`,
          () => void run(async () => { await deleteGroup(client, group.id); onBack(); }),
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Modifier `src/components/Layout.tsx` (liens de navigation)**

Remplacer l'interface et le bloc des actions :

```tsx
interface NavItem {
  label: string;
  active: boolean;
  onClick: () => void;
}

interface LayoutProps {
  children: ReactNode;
  userEmail?: string;
  onSignOut?: () => void;
  onHome?: () => void;
  nav?: NavItem[];
}

export function Layout({ children, userEmail, onSignOut, onHome, nav }: LayoutProps) {
```

et, dans `<div className="plai-nav-actions">`, juste avant le `<span className="lang-nav-email" ...>` :

```tsx
            {nav?.map((item) => (
              <button
                key={item.label}
                type="button"
                className="plai-nav-link"
                style={{ fontSize: 16, fontWeight: item.active ? 700 : 400 }}
                aria-current={item.active ? 'page' : undefined}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            ))}
```

- [ ] **Step 5: Réécrire `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Auth } from './components/Auth';
import { ChapterDetail } from './components/ChapterDetail';
import { ChapterList } from './components/ChapterList';
import { GroupCreate } from './components/GroupCreate';
import { GroupDetail } from './components/GroupDetail';
import { GroupList } from './components/GroupList';
import { ImportChapter } from './components/ImportChapter';
import { Layout } from './components/Layout';
import { StudentApp } from './components/StudentApp';
import { isStudentRoute } from './lib/slips';
import { supabase } from './lib/supabase';
import { useSession } from './lib/useSession';

type View =
  | { name: 'chapters' }
  | { name: 'import' }
  | { name: 'chapter'; id: string }
  | { name: 'groups' }
  | { name: 'group-create' }
  | { name: 'group'; id: string };

export default function App() {
  return isStudentRoute(window.location.pathname) ? <StudentApp /> : <TeacherApp />;
}

function TeacherApp() {
  const { session, loading, passwordRecovery, clearPasswordRecovery } = useSession();
  const [view, setView] = useState<View>({ name: 'chapters' });

  // changement de compte ou déconnexion : retour à l'écran d'accueil
  useEffect(() => {
    setView({ name: 'chapters' });
  }, [session?.user.id]);

  if (loading) {
    return (
      <Layout>
        <p aria-live="polite">Chargement...</p>
      </Layout>
    );
  }

  if (!session || passwordRecovery) {
    return (
      <Layout>
        <Auth passwordRecovery={passwordRecovery} onPasswordUpdated={clearPasswordRecovery} />
      </Layout>
    );
  }

  const home = () => setView({ name: 'chapters' });
  const groups = () => setView({ name: 'groups' });
  const inGroups = view.name === 'groups' || view.name === 'group-create' || view.name === 'group';

  return (
    <Layout
      userEmail={session.user.email ?? ''}
      onSignOut={() => supabase.auth.signOut()}
      onHome={home}
      nav={[
        { label: 'Mes chapitres', active: !inGroups, onClick: home },
        { label: 'Mes groupes', active: inGroups, onClick: groups },
      ]}
    >
      {view.name === 'chapters' && (
        <ChapterList client={supabase} onOpen={(id) => setView({ name: 'chapter', id })} onImport={() => setView({ name: 'import' })} />
      )}
      {view.name === 'import' && (
        <ImportChapter client={supabase} onDone={(id) => setView({ name: 'chapter', id })} onCancel={home} />
      )}
      {view.name === 'chapter' && <ChapterDetail client={supabase} id={view.id} onBack={home} />}
      {view.name === 'groups' && (
        <GroupList client={supabase} onOpen={(id) => setView({ name: 'group', id })} onCreate={() => setView({ name: 'group-create' })} />
      )}
      {view.name === 'group-create' && (
        <GroupCreate client={supabase} onDone={(id) => setView({ name: 'group', id })} onCancel={groups} />
      )}
      {view.name === 'group' && <GroupDetail client={supabase} id={view.id} onBack={groups} />}
    </Layout>
  );
}
```

(`StudentApp` est créé à la Task 12 ; faire les Tasks 11 et 12 avant de compiler.)

- [ ] **Step 6: Commit (après la Task 12, une fois le type-check vert)**

```bash
git add src/components/GroupList.tsx src/components/GroupCreate.tsx src/components/GroupDetail.tsx src/components/Layout.tsx src/App.tsx
git commit -m "Espace enseignant : liste, création et détail des groupes"
```

---

### Task 12: Écran élève et page d'information

**Files:**
- Create: `src/components/PrivacyInfo.tsx`, `src/components/StudentApp.tsx`

- [ ] **Step 1: Créer `src/components/PrivacyInfo.tsx`**

```tsx
// Texte à faire valider par les écoles avant diffusion (spec 3a, §8.3).
export function PrivacyInfo() {
  return (
    <details className="plai-card" style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontSize: 16, minHeight: 44 }}>Comment mes données sont-elles utilisées ?</summary>
      <ul style={{ marginTop: 12, paddingLeft: 20, lineHeight: 1.7 }}>
        <li>LangActif t'aide à apprendre du vocabulaire.</li>
        <li>L'application connaît ton pseudo et ton code.</li>
        <li>Elle ne connaît pas ton nom.</li>
        <li>Elle ne connaît pas ton adresse e-mail.</li>
        <li>Ton enseignant sait quel pseudo est le tien.</li>
        <li>Ton enseignant peut voir ton travail dans LangActif.</li>
        <li>Ton enseignant peut effacer ton pseudo et ton travail.</li>
        <li>Tu peux lui demander de les effacer.</li>
        <li>Si tu as une question, parle à ton enseignant.</li>
      </ul>
    </details>
  );
}
```

- [ ] **Step 2: Créer `src/components/StudentApp.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import {
  clearToken,
  fetchMe,
  fetchPseudos,
  loadToken,
  loginStudent,
  logoutStudent,
  saveToken,
  type LoginResult,
} from '../lib/studentApi';
import { groupCodeFromSearch } from '../lib/slips';
import { useFocusOnMount } from '../lib/useFocusOnMount';
import { FormField } from './FormField';
import { Layout } from './Layout';
import { PrivacyInfo } from './PrivacyInfo';

type Phase = 'loading' | 'login' | 'home';

function failureMessage(r: Extract<LoginResult, { ok: false }>): string {
  switch (r.reason) {
    case 'bloque': {
      const minutes = Math.max(1, Math.ceil((r.retryAfterSeconds ?? 900) / 60));
      return `Trop d'essais. Demande à ton enseignant ou réessaie dans ${minutes} minutes.`;
    }
    case 'trop_de_tentatives':
      return "Trop d'essais depuis cet appareil. Réessaie dans quelques minutes.";
    case 'reseau':
      return 'Connexion impossible : vérifie ton réseau.';
    default:
      return 'Pseudo ou code incorrect.';
  }
}

export function StudentApp() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [pseudo, setPseudo] = useState('');
  const [networkNote, setNetworkNote] = useState(false);

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setPhase('login');
      return;
    }
    fetchMe(token).then((r) => {
      if (r.status === 'ok') {
        setPseudo(r.pseudo);
        setPhase('home');
      } else {
        if (r.status === 'expire') clearToken();
        setNetworkNote(r.status === 'reseau');
        setPhase('login');
      }
    });
  }, []);

  const signOut = async () => {
    const token = loadToken();
    clearToken();
    if (token) await logoutStudent(token);
    setPhase('login');
  };

  return (
    <Layout>
      {phase === 'loading' && <p aria-live="polite">Chargement...</p>}
      {phase === 'login' && (
        <Login
          networkNote={networkNote}
          onLoggedIn={(p) => {
            setPseudo(p);
            setPhase('home');
          }}
        />
      )}
      {phase === 'home' && <Home pseudo={pseudo} onSignOut={signOut} />}
    </Layout>
  );
}

function Home({ pseudo, onSignOut }: { pseudo: string; onSignOut: () => void }) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 28, marginBottom: 12 }}>Bonjour, {pseudo}</h1>
      <p className="plai-empty">Ton enseignant n'a pas encore assigné de travail.</p>
      <button type="button" className="plai-btn-ghost" onClick={onSignOut}>Se déconnecter</button>
      <PrivacyInfo />
    </section>
  );
}

function Login({ networkNote, onLoggedIn }: { networkNote: boolean; onLoggedIn: (pseudo: string) => void }) {
  const [groupe, setGroupe] = useState(() => groupCodeFromSearch(window.location.search));
  const [pseudos, setPseudos] = useState<string[] | null>(null);
  const [unknownGroup, setUnknownGroup] = useState(false);
  const [pseudo, setPseudo] = useState('');
  const [code, setCode] = useState('');
  const [partage, setPartage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  useEffect(() => {
    setPseudo('');
    setUnknownGroup(false);
    if (!/^[A-Z0-9]{5}$/.test(groupe)) {
      setPseudos(null);
      return;
    }
    let alive = true;
    fetchPseudos(groupe).then((list) => {
      if (!alive) return;
      setPseudos(list);
      setUnknownGroup(list === null);
    });
    return () => {
      alive = false;
    };
  }, [groupe]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pseudo || !code.trim()) {
      setError('Choisis ton pseudo et écris ton code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await loginStudent({ groupe, pseudo, code: code.trim().toUpperCase(), appareilPartage: partage });
    if (result.ok) {
      saveToken(result.token, partage);
      onLoggedIn(result.pseudo);
      return;
    }
    setError(failureMessage(result));
    setSubmitting(false);
  };

  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="font-serif" style={{ fontSize: 28, marginBottom: 12 }}>Entrer dans LangActif</h1>
      {networkNote && <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>Connexion impossible : vérifie ton réseau.</div>}
      <form className="plai-card" onSubmit={submit} noValidate>
        <FormField
          label="Code du groupe"
          help="Ton enseignant te le donne. Si tu as scanné le QR code, il est déjà écrit."
          error={unknownGroup ? 'Ce groupe est introuvable. Vérifie le code.' : undefined}
        >
          <input
            className="plai-input"
            value={groupe}
            maxLength={10}
            placeholder="K7M4X"
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setGroupe(e.target.value.trim().toUpperCase())}
          />
        </FormField>

        {pseudos && (
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem' }}>
            <legend className="plai-label">Ton pseudo</legend>
            <p style={{ fontSize: 16, color: 'var(--text2)' }}>Choisis le pseudo écrit sur ta fiche.</p>
            <div className="lang-pseudo-grid">
              {pseudos.map((p) => (
                <label key={p}>
                  <input type="radio" name="pseudo" value={p} checked={pseudo === p} onChange={() => setPseudo(p)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <FormField label="Ton code" help="Une lettre et trois chiffres, écrits sur ta fiche.">
          <input
            className="plai-input"
            value={code}
            maxLength={4}
            placeholder="K472"
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </FormField>

        <div className="plai-field">
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minHeight: 44, fontSize: 16 }}>
            <input type="checkbox" checked={partage} onChange={(e) => setPartage(e.target.checked)} style={{ width: 24, height: 24, marginTop: 2 }} />
            <span>Je suis sur un appareil de l'école (tablette ou ordinateur partagé)</span>
          </label>
          <p style={{ fontSize: 16, color: 'var(--text2)', marginTop: 4 }}>
            Coche cette case si d'autres élèves utilisent le même appareil : tu seras déconnecté au bout de quelques heures.
          </p>
        </div>

        {error && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
        <button type="submit" className="plai-btn" disabled={submitting}>{submitting ? 'Connexion...' : 'Entrer'}</button>
      </form>
      <PrivacyInfo />
    </section>
  );
}
```

- [ ] **Step 3: Type-check, tests et build**

Run: `npx tsc --noEmit && npm run typecheck:api && npx vitest run && npx vite build`
Expected: aucune erreur de types ; tous les tests PASS (171 existants + nouveaux) ; build « built in … ».

- [ ] **Step 4: Commit**

```bash
git add src/components/PrivacyInfo.tsx src/components/StudentApp.tsx
git commit -m "Écran élève : connexion, accueil minimal et page d'information"
```

(Si les composants de la Task 11 n'ont pas encore été commités, les ajouter dans ce même commit ou dans le commit prévu à la Task 11 Step 6.)

---

### Task 13: Recette avec JF (une action à la fois)

Aucun code. Donner à JF, pour chaque action : le POURQUOI, le COMMENT avec chemins et adresses exacts, puis ce qu'il doit voir. Attendre son retour avant la suivante. Ne jamais saisir de mot de passe ni demander de clé dans le chat.

- [ ] **Step 1 (B1) : appliquer les migrations et le script SQL.** Voir Task 4, Step 2. Succès attendu : les trois exécutions sans erreur.
- [ ] **Step 2 (B2, B3) : préparer `vercel dev`.** JF ajoute `SUPABASE_SERVICE_ROLE_KEY=...` dans `C:\Users\jfbeg\OneDrive\claude-workspace\langactif\.env.local` (sans la montrer), puis dans ce dossier : `vercel link` (projet `langactif`), et lance `vercel dev` (adresse : http://localhost:3000). Si la variable n'est pas vue par `vercel dev`, ajouter la même variable à l'environnement « Development » du projet Vercel lié avec `vercel env add SUPABASE_SERVICE_ROLE_KEY development` (JF saisit la valeur lui-même). Vérifié par la suite : une fiche élève qui se connecte.
- [ ] **Step 3 : créer un groupe.** http://localhost:3000, connexion enseignant, onglet « Mes groupes », « Créer un groupe » : nom « Remédiation néerlandais, 2e S, lundi 12 h », langue néerlandais, 3 places. Voir : la fiche avec 3 bandes (groupe, pseudo, code lettre + 3 chiffres, QR, ligne « Nom »), l'avertissement « Les codes ne seront plus affichés ». Capture demandée.
- [ ] **Step 4 : imprimer.** Bouton « Imprimer les fiches », aperçu d'impression : sans barre de navigation ni pied de page, bandes bien découpables. Capture de l'aperçu.
- [ ] **Step 5 : se connecter comme élève.** Dans une fenêtre de navigation privée : http://localhost:3000/eleve?g=CODE_DU_GROUPE (ou scanner le QR). Voir : code de groupe prérempli, pseudos affichés en tuiles, aucun code visible. Choisir un pseudo, saisir le code de la bande, « Entrer » : « Bonjour, Meuse » (ou le pseudo choisi).
- [ ] **Step 6 : persistance et déconnexion.** Recharger la page : on reste connecté. « Se déconnecter » : retour au formulaire. Se reconnecter.
- [ ] **Step 7 : blocage.** Cinq codes erronés pour un pseudo : message « Trop d'essais... ». Dans l'espace enseignant, le pseudo apparaît « Bloquée » ; « Débloquer » ; connexion de nouveau possible.
- [ ] **Step 8 : appareil partagé.** Cocher la case, se connecter, fermer l'onglet puis rouvrir l'adresse : retour au formulaire (jeton en sessionStorage).
- [ ] **Step 9 : nouveau code et places.** « Nouveau code » pour un pseudo : bande unique ; l'ancien code échoue, le nouveau fonctionne ; l'élève connecté ailleurs est déconnecté au rechargement. « Ajouter des places » (2) : seules les nouvelles places ont une fiche.
- [ ] **Step 10 : effacement (RGPD).** Supprimer une place puis le groupe, avec confirmation : la liste de groupes est vide après rechargement, et `/eleve?g=CODE` affiche « Ce groupe est introuvable ».
- [ ] **Step 11 : 375 px.** Mêmes écrans (liste, création, détail, fiche, connexion élève) en largeur 375 px : aucun défilement horizontal (sauf le tableau des places dans son conteneur), tuiles et boutons d'au moins 44 px.
- [ ] **Step 12 : second compte enseignant (facultatif).** Un second compte ne voit pas les groupes du premier (déjà couvert par le script SQL).

---

### Task 14: Clôture

- [ ] **Step 1: Relancer la suite complète**

Run: `npx tsc --noEmit && npm run typecheck:api && npx vitest run && npx vite build`
Expected: tout vert.

- [ ] **Step 2: Revue finale globale**

Dispatcher une revue globale de la branche `feat/plan-3a-groupes-acces-eleve` contre le spec (règle : revue finale après la dernière tâche d'un plan). Points à vérifier en priorité : aucune clé ni code dans les journaux, `code_hash` jamais renvoyé au navigateur, aucune politique RLS auto-référentielle, respect de l'accessibilité (16 px, 44 px, jamais la couleur seule).

- [ ] **Step 3: Mettre à jour la mémoire**

Mettre à jour `C:\Users\jfbeg\OneDrive\claude-workspace\memory\langactif-session-prompt.md` (avancement 3a, écarts avec le spec, actions restantes de JF) et la ligne de `MEMORY.md`.

- [ ] **Step 4: Demander l'accord de JF avant tout push ou fusion**

Proposer : fusion de `feat/plan-3a-groupes-acces-eleve` dans `main` (avance rapide si possible), `npx vite build` relancé, push sur https://github.com/jfb4plai/LangActif (dépôt public : aucun secret dans l'historique ; vérifier `git ls-files` pour `.env*` et `*.local.sql`).

---

## Auto-revue

**Couverture du spec :**
- §2 décisions 1 à 9 : jeton serveur (Tasks 3, 9), code (Tasks 2, 3), connexion groupe + pseudo + code (Tasks 3, 9, 12), blocage (Task 3), pseudos des quatre familles (Task 2), places créées à l'avance + fiche (Tasks 2, 10, 11), identité par groupe (modèle de données), durée 12 mois / appareil partagé 12 h (Tasks 3, 8, 12), pas de champ « note » (aucune colonne de note).
- §3 données : trois tables, RLS, grants explicites, `code_hash` non lisible (Task 2, vérifié Task 4).
- §5 parcours enseignant : création, fiche, vue du groupe, ajout de places, nouveau code, déblocage, archivage, régénération, suppression (Tasks 2, 6, 10, 11).
- §6 parcours élève : connexion, accueil minimal, messages neutres, style de tuiles (Task 12).
- §7 fonctions : élève en `api/`, enseignant en RPC SQL (écart consigné Task 1).
- §8 RGPD : minimisation (aucun nom/IP stocké), effacement en cascade avec test (Task 4 étape 10), page d'information FALC (Task 12), vigilance pseudonymisation (§8.2 du spec), points juridiques non affirmés (§8.3).
- §9 tests : génération, connexion, sessions, RLS, effacement dans le script SQL ; handlers et client en Vitest ; parcours navigateur en Task 13.

**Hors plan, à noter :** mode d'emploi enseignant en HTML PLAI (règle de mémoire : tout guide PLAI en HTML stylé), vignette portail, durée de rétention du journal (3b), validation de la page d'information par les écoles.

**Cohérence des noms :** `IssuedSeat {id, pseudo, code}` (Task 6) utilisé par `buildSlips` (Task 7, qui n'exige que `pseudo` et `code`) ; `seatState` / `SeatState` partagés entre Tasks 6 et 11 ; `Stores`, `saveToken(token, shared, stores)` identiques en Tasks 8 et 12 ; RPC `lang_group_create(p_nom, p_langue, p_places)`, `lang_group_add_seats(p_group, p_count)`, `lang_seat_reset_code(p_seat)`, `lang_student_login(p_group_code, p_pseudo, p_code, p_shared)` identiques entre migrations, tests SQL, `groups.ts` et `api/`.

**Risques non levés :** le script SQL et les migrations n'ont pas pu être exécutés localement (aucun Postgres disponible) : la première exécution par JF peut révéler une erreur de syntaxe ou de privilège, à corriger dans une migration suivante. Le comportement de `vercel dev` face aux variables d'environnement est à confirmer à la recette.
