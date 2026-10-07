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
