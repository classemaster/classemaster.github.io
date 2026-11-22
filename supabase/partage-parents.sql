-- Classe Master : lien de suivi en lecture seule pour les parents
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > coller > Run.
--
-- Principe : l'enseignant publie, pour un seul élève, un résumé (présences, notes, devoirs).
-- Le parent ouvre un lien secret (jeton aléatoire) : il ne voit que ce résumé, jamais la classe ni les autres élèves.
-- La table n'est lisible que par son propriétaire ; le public n'a accès qu'à la fonction get_parent_share(jeton).

create table if not exists public.parent_shares (
  token      text        primary key check (char_length(token) between 24 and 80),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  class_id   text        not null check (char_length(class_id) between 1 and 64),
  student_id text        not null check (char_length(student_id) between 1 and 64),
  snapshot   jsonb       not null default '{}'::jsonb check (pg_column_size(snapshot) < 100000),
  updated_at timestamptz not null default now()
);

create index if not exists parent_shares_owner_idx on public.parent_shares (user_id, class_id, student_id);

alter table public.parent_shares enable row level security;

drop policy if exists "shares_select_own" on public.parent_shares;
drop policy if exists "shares_insert_own" on public.parent_shares;
drop policy if exists "shares_update_own" on public.parent_shares;
drop policy if exists "shares_delete_own" on public.parent_shares;

create policy "shares_select_own" on public.parent_shares
  for select to authenticated using (user_id = (select auth.uid()));
create policy "shares_insert_own" on public.parent_shares
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "shares_update_own" on public.parent_shares
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "shares_delete_own" on public.parent_shares
  for delete to authenticated using (user_id = (select auth.uid()));

-- Lecture publique : uniquement avec le jeton exact (impossible de lister les liens)
create or replace function public.get_parent_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.snapshot || jsonb_build_object('updated_at', s.updated_at)
  from public.parent_shares s
  where s.token = p_token
$$;

revoke all on function public.get_parent_share(text) from public;
grant execute on function public.get_parent_share(text) to anon, authenticated;
