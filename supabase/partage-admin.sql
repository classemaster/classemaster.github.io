-- Classe Master : dossiers élèves de l'établissement et lien unique « famille »
-- À exécuter UNE SEULE FOIS, après partage-parents.sql : Supabase > SQL Editor > New query > coller > Run.
-- (Remplace partage-famille.sql de la v27 : inutile de l'exécuter si ce n'est pas déjà fait.)
--
-- Principe :
--  * L'administrateur (page admin.html) crée un dossier par élève. Chaque dossier a un CODE secret (jamais montré aux
--    enseignants) et une RÉFÉRENCE aléatoire non secrète, remise aux enseignants avec la liste de l'élève.
--  * Chaque enseignant publie son résumé avec la référence. Il ne peut rien lire avec elle, ni voir le code.
--  * Le parent ouvre parent.html?c=CODE : la fonction retrouve la référence du code, puis tous les résumés qui la portent.

-- 1. Dossiers élèves (lisibles uniquement par l'administrateur qui les a créés)
create table if not exists public.registry_students (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name        text        not null check (char_length(name) between 1 and 120),
  class_label text        not null default '' check (char_length(class_label) <= 80),
  phone       text        not null default '' check (char_length(phone) <= 30),
  ref         text        not null unique check (char_length(ref) between 10 and 40),
  code        text        not null unique check (char_length(code) between 10 and 40),
  created_at  timestamptz not null default now()
);

create index if not exists registry_students_owner_idx on public.registry_students (user_id, class_label, name);

alter table public.registry_students enable row level security;

drop policy if exists "registry_select_own" on public.registry_students;
drop policy if exists "registry_insert_own" on public.registry_students;
drop policy if exists "registry_update_own" on public.registry_students;
drop policy if exists "registry_delete_own" on public.registry_students;

create policy "registry_select_own" on public.registry_students
  for select to authenticated using (user_id = (select auth.uid()));
create policy "registry_insert_own" on public.registry_students
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "registry_update_own" on public.registry_students
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "registry_delete_own" on public.registry_students
  for delete to authenticated using (user_id = (select auth.uid()));

-- 2. Les résumés des enseignants portent la référence de l'élève
alter table public.parent_shares add column if not exists ref text;
alter table public.parent_shares drop constraint if exists parent_shares_ref_check;
alter table public.parent_shares
  add constraint parent_shares_ref_check check (ref is null or char_length(ref) between 10 and 40);
create index if not exists parent_shares_ref_idx on public.parent_shares (ref) where ref is not null;

-- 3. Lecture publique : uniquement avec le code exact (impossible de lister les codes, les références ou les élèves).
-- Si un même élève de la même classe apparaît deux fois (ancien lien + nouveau), seul le plus récent est gardé.
create or replace function public.get_family_shares(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(r.snapshot || jsonb_build_object('updated_at', r.updated_at)
              order by r.snapshot->>'subj', r.snapshot->>'cls', r.snapshot->>'teacher'),
    '[]'::jsonb)
  from (
    select distinct on (s.user_id, s.class_id, s.student_id) s.snapshot, s.updated_at
    from public.parent_shares s
    where char_length(p_code) between 10 and 40
      and s.ref in (select g.ref from public.registry_students g where g.code = p_code)
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
    limit 30
  ) r
$$;

revoke all on function public.get_family_shares(text) from public;
grant execute on function public.get_family_shares(text) to anon, authenticated;
