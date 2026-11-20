-- Classe Master : schéma Supabase
-- À exécuter une seule fois : Supabase > SQL Editor > New query > coller > Run.

-- 1. Table des classes (une ligne par classe et par enseignant)
create table if not exists public.classes (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 64),
  name       text        not null default 'Classe',
  subj       text        not null default '',
  students   jsonb       not null default '[]'::jsonb,
  records    jsonb       not null default '{}'::jsonb,
  notes      jsonb       not null default '{}'::jsonb,
  ev         jsonb       not null default '[]'::jsonb,
  ob         jsonb       not null default '[]'::jsonb,
  th         jsonb       not null default '{"a":3,"r":3}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- 2. Sécurité : chaque enseignant ne voit et ne modifie que ses propres classes
alter table public.classes enable row level security;

drop policy if exists "classes_select_own" on public.classes;
drop policy if exists "classes_insert_own" on public.classes;
drop policy if exists "classes_update_own" on public.classes;
drop policy if exists "classes_delete_own" on public.classes;

create policy "classes_select_own" on public.classes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "classes_insert_own" on public.classes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "classes_update_own" on public.classes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "classes_delete_own" on public.classes
  for delete to authenticated using (user_id = (select auth.uid()));

-- 3. Synchronisation en direct entre les appareils (Realtime)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ) then
    alter publication supabase_realtime add table public.classes;
  end if;
end $$;

-- 4. Suppression de son propre compte (bouton « Supprimer mon compte »)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();  -- supprime aussi ses classes (cascade)
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
