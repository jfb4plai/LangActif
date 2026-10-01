-- LangActif : contenu des chapitres (chapitres, listes, mots).
-- Toutes les tables sont préfixées lang_. Ne pas recréer profiles ni le trigger updated_at.

create table if not exists public.lang_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  langue text not null check (langue in ('en-GB', 'nl-BE')),
  niveau text not null,
  titre text not null,
  numero text not null,
  auteur text,
  created_at timestamptz not null default now(),
  constraint lang_chapters_niveau_len check (char_length(niveau) between 1 and 20),
  constraint lang_chapters_titre_len check (char_length(titre) between 1 and 200),
  constraint lang_chapters_numero_len check (char_length(numero) between 1 and 20),
  constraint lang_chapters_auteur_len check (auteur is null or char_length(auteur) <= 100)
);

create table if not exists public.lang_lists (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.lang_chapters(id) on delete cascade,
  nom text not null,
  position integer not null check (position >= 0),
  unique (chapter_id, position),
  constraint lang_lists_nom_len check (char_length(nom) between 1 and 100)
);

create table if not exists public.lang_words (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lang_lists(id) on delete cascade,
  position integer not null check (position >= 0),
  fr text not null,
  cible text not null,
  article text check (article in ('de', 'het')),
  synonymes_fr text[] not null default '{}',
  synonymes_cible text[] not null default '{}',
  phrase_cible text,
  phrase_fr text,
  audio_url text,
  unique (list_id, position),
  constraint lang_words_fr_len check (char_length(fr) between 1 and 200),
  constraint lang_words_cible_len check (char_length(cible) between 1 and 200),
  constraint lang_words_phrase_cible_len check (phrase_cible is null or char_length(phrase_cible) <= 500),
  constraint lang_words_phrase_fr_len check (phrase_fr is null or char_length(phrase_fr) <= 500),
  constraint lang_words_audio_url_fmt check (audio_url is null or (char_length(audio_url) <= 500 and audio_url ~ '^https://')),
  constraint lang_words_syn_fr_card check (cardinality(synonymes_fr) <= 20),
  constraint lang_words_syn_cible_card check (cardinality(synonymes_cible) <= 20)
);

create index if not exists lang_chapters_user_id_idx on public.lang_chapters (user_id);
create index if not exists lang_lists_chapter_id_idx on public.lang_lists (chapter_id);
create index if not exists lang_words_list_id_idx on public.lang_words (list_id);

-- Limites d'insertion appliquées par déclencheur : elles tiennent aussi pour les insertions
-- directes via PostgREST (pas seulement via lang_import_chapter). Security definer : le
-- comptage passe par les index sans réévaluer la politique RLS ligne par ligne (un import de
-- 1000 mots ferait sinon des centaines de milliers d'appels de la fonction de propriété).
-- Les déclencheurs BEFORE s'exécutent avant le contrôle WITH CHECK de la RLS : un appelant
-- malveillant pourrait donc, au pire, apprendre qu'un chapitre ou une liste d'autrui a atteint
-- la limite (un fait binaire, sans autre donnée) ; l'insertion est ensuite refusée par la RLS.
create or replace function public.lang_enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'lang_chapters' then
    if (select count(*) from public.lang_chapters where user_id = new.user_id) >= 200 then
      raise exception 'Limite de 200 chapitres atteinte';
    end if;
  elsif tg_table_name = 'lang_lists' then
    if (select count(*) from public.lang_lists where chapter_id = new.chapter_id) >= 40 then
      raise exception 'Limite de 40 listes par chapitre atteinte';
    end if;
  elsif tg_table_name = 'lang_words' then
    if (select count(*) from public.lang_words where list_id = new.list_id) >= 1000 then
      raise exception 'Limite de 1000 mots par liste atteinte';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lang_chapters_limits on public.lang_chapters;
create trigger lang_chapters_limits before insert on public.lang_chapters
  for each row execute function public.lang_enforce_limits();

drop trigger if exists lang_lists_limits on public.lang_lists;
create trigger lang_lists_limits before insert on public.lang_lists
  for each row execute function public.lang_enforce_limits();

drop trigger if exists lang_words_limits on public.lang_words;
create trigger lang_words_limits before insert on public.lang_words
  for each row execute function public.lang_enforce_limits();

-- Fonctions de propriété en security definer : pas d'auto-référence de politique RLS
-- (incident AménagActif du 2026-09-23).
create or replace function public.lang_owns_chapter(p_chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lang_chapters c
    where c.id = p_chapter and c.user_id = auth.uid()
  );
$$;

create or replace function public.lang_owns_list(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lang_lists l
    join public.lang_chapters c on c.id = l.chapter_id
    where l.id = p_list and c.user_id = auth.uid()
  );
$$;

revoke all on function public.lang_owns_chapter(uuid) from public;
revoke all on function public.lang_owns_list(uuid) from public;
revoke execute on function public.lang_owns_chapter(uuid) from anon;
revoke execute on function public.lang_owns_list(uuid) from anon;
grant execute on function public.lang_owns_chapter(uuid) to authenticated;
grant execute on function public.lang_owns_list(uuid) to authenticated;

alter table public.lang_chapters enable row level security;
alter table public.lang_lists enable row level security;
alter table public.lang_words enable row level security;

drop policy if exists lang_chapters_owner_all on public.lang_chapters;
create policy lang_chapters_owner_all on public.lang_chapters
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists lang_lists_owner_all on public.lang_lists;
create policy lang_lists_owner_all on public.lang_lists
  for all to authenticated
  using (public.lang_owns_chapter(chapter_id))
  with check (public.lang_owns_chapter(chapter_id));

drop policy if exists lang_words_owner_all on public.lang_words;
create policy lang_words_owner_all on public.lang_words
  for all to authenticated
  using (public.lang_owns_list(list_id))
  with check (public.lang_owns_list(list_id));

-- Grants Data API (obligatoires pour toute nouvelle table). Pas d'accès anonyme :
-- les élèves passeront par des fonctions serveur (plan 3).
-- Les privilèges par défaut du projet partagé donnent des droits à anon et authenticated :
-- on les retire d'abord, puis on accorde le strict nécessaire.
revoke all on public.lang_chapters, public.lang_lists, public.lang_words from anon, authenticated;
grant select, insert, update, delete on public.lang_chapters to authenticated;
grant select, insert, update, delete on public.lang_lists to authenticated;
grant select, insert, update, delete on public.lang_words to authenticated;
grant select, insert, update, delete on public.lang_chapters to service_role;
grant select, insert, update, delete on public.lang_lists to service_role;
grant select, insert, update, delete on public.lang_words to service_role;

-- Import atomique d'un chapitre : tout ou rien, sous les droits de l'appelant (RLS appliquée).
create or replace function public.lang_import_chapter(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_chapter uuid;
  v_list uuid;
  l jsonb;
  w jsonb;
  li integer := 0;
  wi integer;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  if coalesce(jsonb_array_length(p->'lists'), 0) not between 1 and 40 then
    raise exception 'Nombre de listes invalide (1 à 40)';
  end if;

  insert into public.lang_chapters (user_id, langue, niveau, titre, numero, auteur)
  values (auth.uid(), p->>'langue', p->>'niveau', p->>'titre', p->>'numero', nullif(p->>'auteur', ''))
  returning id into v_chapter;

  for l in select value from jsonb_array_elements(p->'lists') loop
    if coalesce(jsonb_array_length(l->'words'), 0) > 1000 then
      raise exception 'Trop de mots dans la liste « % » (maximum 1000)', l->>'nom';
    end if;
    insert into public.lang_lists (chapter_id, nom, position)
    values (v_chapter, l->>'nom', li)
    returning id into v_list;

    wi := 0;
    for w in select value from jsonb_array_elements(l->'words') loop
      if p->>'langue' = 'en-GB' and nullif(w->>'article', '') is not null then
        raise exception 'Pas d''article en anglais';
      end if;
      insert into public.lang_words
        (list_id, position, fr, cible, article, synonymes_fr, synonymes_cible, phrase_cible, phrase_fr, audio_url)
      values (
        v_list, wi, w->>'fr', w->>'cible', nullif(w->>'article', ''),
        case when jsonb_typeof(w->'synonymes_fr') = 'array' then array(select jsonb_array_elements_text(w->'synonymes_fr')) else '{}'::text[] end,
        case when jsonb_typeof(w->'synonymes_cible') = 'array' then array(select jsonb_array_elements_text(w->'synonymes_cible')) else '{}'::text[] end,
        nullif(w->>'phrase_cible', ''), nullif(w->>'phrase_fr', ''), nullif(w->>'audio_url', '')
      );
      wi := wi + 1;
    end loop;
    li := li + 1;
  end loop;

  return v_chapter;
end;
$$;

revoke all on function public.lang_import_chapter(jsonb) from public;
revoke all on function public.lang_import_chapter(jsonb) from anon;
grant execute on function public.lang_import_chapter(jsonb) to authenticated;
