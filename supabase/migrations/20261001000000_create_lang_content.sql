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
  created_at timestamptz not null default now()
);

create table if not exists public.lang_lists (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.lang_chapters(id) on delete cascade,
  nom text not null,
  position integer not null check (position >= 0),
  unique (chapter_id, position)
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
  unique (list_id, position)
);

create index if not exists lang_chapters_user_id_idx on public.lang_chapters (user_id);
create index if not exists lang_lists_chapter_id_idx on public.lang_lists (chapter_id);
create index if not exists lang_words_list_id_idx on public.lang_words (list_id);

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
grant execute on function public.lang_owns_chapter(uuid) to authenticated;
grant execute on function public.lang_owns_list(uuid) to authenticated;

alter table public.lang_chapters enable row level security;
alter table public.lang_lists enable row level security;
alter table public.lang_words enable row level security;

create policy lang_chapters_owner_all on public.lang_chapters
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy lang_lists_owner_all on public.lang_lists
  for all to authenticated
  using (public.lang_owns_chapter(chapter_id))
  with check (public.lang_owns_chapter(chapter_id));

create policy lang_words_owner_all on public.lang_words
  for all to authenticated
  using (public.lang_owns_list(list_id))
  with check (public.lang_owns_list(list_id));

-- Grants Data API (obligatoires pour toute nouvelle table). Pas d'accès anonyme :
-- les élèves passeront par des fonctions serveur (plan 3).
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
      insert into public.lang_words
        (list_id, position, fr, cible, article, synonymes_fr, synonymes_cible, phrase_cible, phrase_fr, audio_url)
      values (
        v_list, wi, w->>'fr', w->>'cible', nullif(w->>'article', ''),
        array(select jsonb_array_elements_text(coalesce(w->'synonymes_fr', '[]'::jsonb))),
        array(select jsonb_array_elements_text(coalesce(w->'synonymes_cible', '[]'::jsonb))),
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
