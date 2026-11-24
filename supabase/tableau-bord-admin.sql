-- Classe Master v46 : tableau de bord de l'administrateur (effectifs, assiduité, résultats)
-- À exécuter dans Supabase > SQL Editor > New query > coller > Run.
-- Remplace la version v45 de ce fichier : on peut l'exécuter même si la v45 l'a déjà été (rien n'est perdu).
-- Prérequis : partage-admin.sql et acces-admin.sql déjà exécutés.
--
-- Seul un compte administrateur reçoit des lignes, et seulement pour ses propres dossiers élèves.
-- Aucun code ni numéro de téléphone n'est renvoyé.

-- 0. Lecture sûre des valeurs publiées par les enseignants (v51)
-- Une valeur mal formée (texte à la place d'un nombre, date impossible) devient NULL au lieu de faire échouer
-- tout le tableau de bord pour tous les administrateurs.
create or replace function public.safe_num(t text)
returns numeric language sql immutable set search_path = ''
as $$ select case when t ~ '^-?[0-9]{1,9}([.][0-9]{1,15})?$' then t::numeric end $$;

create or replace function public.safe_int(t text)
returns integer language sql immutable set search_path = ''
as $$ select case when t ~ '^-?[0-9]{1,9}$' then t::integer end $$;

create or replace function public.safe_date(t text)
returns date language plpgsql immutable set search_path = ''
as $$
begin
  if t is null or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  return t::date;
exception when others then
  return null;
end $$;

revoke all on function public.safe_num(text), public.safe_int(text), public.safe_date(text) from public;

-- 1. Résumés publiés par les enseignants : une ligne par élève et par matière
drop function if exists public.admin_dashboard();

create or replace function public.admin_dashboard()
returns table (
  student_id  uuid,
  class_label text,
  subj        text,
  teacher     text,
  n           integer,   -- appels faits
  a           integer,   -- absences
  j           integer,   -- dont justifiées
  r           integer,   -- retards
  recent_a    integer,   -- absences des 14 derniers jours
  avg         numeric,   -- moyenne /20
  t1          numeric,   -- moyenne des évaluations : septembre à décembre
  t2          numeric,   -- janvier à mars
  t3          numeric,   -- avril à août
  hw_n        integer,   -- devoirs non rendus
  updated_at  timestamptz
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
         coalesce(public.safe_int(x.snapshot #>> '{pres,n}'), 0),
         coalesce(public.safe_int(x.snapshot #>> '{pres,a}'), 0),
         coalesce(public.safe_int(x.snapshot #>> '{pres,j}'), 0),
         coalesce(public.safe_int(x.snapshot #>> '{pres,r}'), 0),
         ab.recent_a,
         public.safe_num(x.snapshot->>'avg'),
         round(tr.t1, 2), round(tr.t2, 2), round(tr.t3, 2),
         coalesce(public.safe_int(x.snapshot #>> '{hw,n}'), 0),
         x.updated_at
  from public.registry_students g
  join lateral (
    select distinct on (s.user_id, s.class_id, s.student_id) s.snapshot, s.updated_at
    from public.parent_shares s
    where s.ref = g.ref
    order by s.user_id, s.class_id, s.student_id, s.updated_at desc
  ) x on true
  cross join lateral (
    select count(*)::integer as recent_a
    from jsonb_array_elements(case when jsonb_typeof(x.snapshot->'abs') = 'array' then x.snapshot->'abs' else '[]'::jsonb end) e
    where coalesce(e->>'v', 'a') <> 'r'
      and public.safe_date(e->>'d') >= current_date - 14
  ) ab
  cross join lateral (
    select avg(v) filter (where mo in (9, 10, 11, 12)) as t1,
           avg(v) filter (where mo in (1, 2, 3))       as t2,
           avg(v) filter (where mo in (4, 5, 6, 7, 8)) as t3
    from (
      select public.safe_num(e->>'n') / nullif(public.safe_num(e->>'m'), 0) * 20 as v,
             extract(month from public.safe_date(e->>'d'))::integer as mo
      from jsonb_array_elements(case when jsonb_typeof(x.snapshot->'notes') = 'array' then x.snapshot->'notes' else '[]'::jsonb end) e
    ) q
  ) tr
  where g.user_id = (select auth.uid())
    and (select public.is_admin())
  order by g.class_label, g.id, 3, 4
$$;

revoke all on function public.admin_dashboard() from public;
grant execute on function public.admin_dashboard() to authenticated;

-- 2. Départs : chaque dossier élève supprimé est noté (un dossier supprimé = un élève parti)
create table if not exists public.registry_log (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null,
  name        text        not null,
  class_label text        not null default '',
  event       text        not null default 'depart',
  created_at  timestamptz not null default now()
);
create index if not exists registry_log_owner_idx on public.registry_log (user_id, created_at desc);

alter table public.registry_log enable row level security;
drop policy if exists "registry_log_select_own" on public.registry_log;
create policy "registry_log_select_own" on public.registry_log
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.log_registry_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registry_log (user_id, name, class_label, event)
  values (old.user_id, old.name, coalesce(old.class_label, ''), 'depart');
  return old;
end $$;

revoke all on function public.log_registry_delete() from public;

drop trigger if exists registry_log_delete on public.registry_students;
create trigger registry_log_delete
  after delete on public.registry_students
  for each row execute function public.log_registry_delete();
