-- Classe Master v47 : enseignants, discipline, fin de période (tableau de bord de l'administrateur)
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run. Peut être réexécuté sans risque.
-- Prérequis : partage-admin.sql, acces-admin.sql et tableau-bord-admin.sql déjà exécutés.
--
-- Seul un compte administrateur reçoit des lignes, et seulement pour ses propres dossiers élèves.

-- 1. Les parents ne doivent jamais recevoir les incidents de discipline : on les retire des deux fonctions publiques.
create or replace function public.get_parent_share(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (s.snapshot - 'dis') || jsonb_build_object('updated_at', s.updated_at)
  from public.parent_shares s
  where s.token = p_token
$$;
revoke all on function public.get_parent_share(text) from public;
grant execute on function public.get_parent_share(text) to anon, authenticated;

create or replace function public.get_family_shares(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg((r.snapshot - 'dis') || jsonb_build_object('updated_at', r.updated_at)
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

-- 2. Enseignants : une ligne par enseignant, classe et matière (dernier appel, emploi du temps, évaluations)
drop function if exists public.admin_teaching();
create or replace function public.admin_teaching()
returns table (
  teacher     text,
  subj        text,
  class_label text,
  n_students  integer,
  lc          text,         -- date du dernier appel
  tt          jsonb,        -- séances de la semaine [[jour, début, fin], ...]
  ev          jsonb,        -- évaluations {ne, l: [[date, élèves notés], ...]}
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (s.user_id, s.class_id, s.student_id)
           s.user_id, s.class_id, s.snapshot, s.updated_at, g.class_label
    from public.parent_shares s
    join public.registry_students g on g.ref = s.ref
    where g.user_id = (select auth.uid())
      and (select public.is_admin())
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
  )
  select coalesce(max(l.snapshot->>'teacher'), ''),
         coalesce(max(l.snapshot->>'subj'), ''),
         coalesce(mode() within group (order by l.class_label), ''),
         count(*)::integer,
         max(l.snapshot->>'lc'),
         (array_agg(l.snapshot->'tt' order by (l.snapshot->'tt') is null, l.updated_at desc))[1],
         (array_agg(l.snapshot->'ev' order by (l.snapshot->'ev') is null, l.updated_at desc))[1],
         max(l.updated_at)
  from latest l
  group by l.user_id, l.class_id
  order by 3, 1, 2
$$;
revoke all on function public.admin_teaching() from public;
grant execute on function public.admin_teaching() to authenticated;

-- 3. Discipline : incidents signalés par les enseignants (les autres observations restent privées)
drop function if exists public.admin_discipline();
create or replace function public.admin_discipline()
returns table (
  student_id  uuid,
  class_label text,
  subj        text,
  teacher     text,
  d           text,
  k           text,        -- inc = incident, grv = incident grave
  t           text
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id,
         g.class_label,
         coalesce(x.snapshot->>'subj', ''),
         coalesce(x.snapshot->>'teacher', ''),
         coalesce(e->>'d', ''),
         coalesce(e->>'k', 'inc'),
         left(coalesce(e->>'t', ''), 400)
  from public.registry_students g
  join lateral (
    select distinct on (s.user_id, s.class_id, s.student_id) s.snapshot
    from public.parent_shares s
    where s.ref = g.ref
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
  ) x on true
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(x.snapshot->'dis') = 'array' then x.snapshot->'dis' else '[]'::jsonb end) e
  where g.user_id = (select auth.uid())
    and (select public.is_admin())
  order by 5 desc, 2, 1
$$;
revoke all on function public.admin_discipline() from public;
grant execute on function public.admin_discipline() to authenticated;

-- 4. Décisions de fin d'année : passage, à examiner, redoublement (une par élève et par année scolaire)
create table if not exists public.registry_decisions (
  student_id uuid        not null references public.registry_students (id) on delete cascade,
  year       text        not null check (char_length(year) between 4 and 12),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  decision   text        not null check (decision in ('p', 'x', 'r')),
  updated_at timestamptz not null default now(),
  primary key (student_id, year)
);
create index if not exists registry_decisions_owner_idx on public.registry_decisions (user_id, year);

alter table public.registry_decisions enable row level security;
drop policy if exists "decisions_select_own" on public.registry_decisions;
drop policy if exists "decisions_insert_own" on public.registry_decisions;
drop policy if exists "decisions_update_own" on public.registry_decisions;
drop policy if exists "decisions_delete_own" on public.registry_decisions;

create policy "decisions_select_own" on public.registry_decisions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "decisions_insert_own" on public.registry_decisions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.registry_students g where g.id = student_id and g.user_id = (select auth.uid())));
create policy "decisions_update_own" on public.registry_decisions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "decisions_delete_own" on public.registry_decisions
  for delete to authenticated using (user_id = (select auth.uid()));
