-- Classe Master v71 : GESTION DE L'ÉTABLISSEMENT (validation des enseignants, transferts d'élèves, seuils d'alerte, messages, journal)
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS validation-reversible-v70.sql. Faites d'abord une sauvegarde. Rejouable sans danger.
-- Ne rejouez pas etablissements-v60.sql ni validation-etablissements-v63.sql APRÈS celui-ci (ils remettraient l'ancien
-- fonctionnement) : si vous le faites, rejouez celui-ci en dernier.
--
-- Ce que cela ajoute :
--  1. Validation des enseignants : le chef peut exiger qu'un enseignant qui rejoint avec le code soit accepté (ou refusé).
--     Tant qu'il est « en attente », l'enseignant ne reçoit aucun accès aux dossiers (le serveur refuse).
--  2. Transfert d'élèves d'une classe à une autre (les accès des enseignants à ces élèves sont retirés, à réaffecter).
--  3. Seuils d'alerte réglables par établissement : moyenne, présence, absences sur 14 jours.
--  4. Messages du chef à tous les enseignants ou à toutes les familles.
--  5. Journal des actions (qui a fait quoi, quand), visible du seul chef.

-- 1. Colonnes ---------------------------------------------------------------------------------------------------------------------------
alter table public.etablissements add column if not exists seuil_moy numeric not null default 10;
alter table public.etablissements add column if not exists seuil_pres integer not null default 80;
alter table public.etablissements add column if not exists seuil_abs integer not null default 3;
alter table public.etablissements add column if not exists valider_enseignants boolean not null default false;
alter table public.etablissements drop constraint if exists etablissements_seuils_check;
alter table public.etablissements add constraint etablissements_seuils_check
  check (seuil_moy between 1 and 19 and seuil_pres between 10 and 100 and seuil_abs between 1 and 14);

alter table public.etab_membres add column if not exists statut text not null default 'actif';
alter table public.etab_membres drop constraint if exists etab_membres_statut_check;
alter table public.etab_membres add constraint etab_membres_statut_check check (statut in ('actif', 'en_attente'));

alter table public.registry_log add column if not exists detail text not null default '';
alter table public.registry_log add column if not exists acteur uuid;

-- 2. Messages ------------------------------------------------------------------------------------------------------------------------------
create table if not exists public.etab_messages (
  id         uuid        primary key default gen_random_uuid(),
  etab_id    uuid        not null references public.etablissements (id) on delete cascade,
  cible      text        not null check (cible in ('enseignants', 'familles')),
  titre      text        not null check (char_length(btrim(titre)) between 1 and 100),
  corps      text        not null check (char_length(btrim(corps)) between 1 and 1000),
  auteur     uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists etab_messages_idx on public.etab_messages (etab_id, cible, created_at desc);
alter table public.etab_messages enable row level security;   -- aucune règle : tout passe par les fonctions ci-dessous

-- 3. Journal (fonction interne : appelée uniquement par les fonctions ci-dessous) -----------------------------------------------------------
create or replace function public.journaliser(p_etab uuid, p_event text, p_name text, p_class text, p_detail text)
returns void language sql security definer set search_path = ''
as $$
  insert into public.registry_log (user_id, name, class_label, event, etab_id, detail, acteur)
  values ((select auth.uid()), left(coalesce(p_name, ''), 120), left(coalesce(p_class, ''), 80), p_event, p_etab,
          left(coalesce(p_detail, ''), 300), (select auth.uid()))
$$;
revoke all on function public.journaliser(uuid, text, text, text, text) from public;

create or replace function public.etab_journal(p_etab uuid, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc), '[]'::jsonb) from (
            select l.event, l.name, l.class_label, l.detail, l.created_at, u.email as acteur
              from public.registry_log l left join auth.users u on u.id = l.acteur
             where l.etab_id = p_etab
             order by l.created_at desc
             limit least(greatest(coalesce(p_limit, 100), 1), 300)) j);
end $$;

-- 4. Seuls les enseignants ACCEPTÉS comptent comme membres ------------------------------------------------------------------------------------
create or replace function public.is_etab_member(p_etab uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select p_etab is not null and exists (
  select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = (select auth.uid()) and m.statut = 'actif') $$;

create or replace function public.can_use_ref(p_ref text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_ref is not null and exists (
    select 1 from public.registry_students g
    where g.ref = p_ref
      and (
        public.is_etab_admin(g.etab_id)
        or exists (
          select 1 from public.registry_access a
          join public.etab_membres m on m.user_id = a.teacher_id and m.etab_id = g.etab_id and m.statut = 'actif'
          where a.registry_id = g.id and a.teacher_id = (select auth.uid()))
      )
  )
$$;

create or replace function public.admin_assign(p_etab uuid, p_email text, p_class text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare tid uuid; n integer;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  select u.id into tid from auth.users u where lower(u.email) = lower(btrim(p_email));
  if tid is null then raise exception 'unknown teacher'; end if;
  if not exists (select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = tid and m.statut = 'actif') then
    raise exception 'not member';
  end if;
  insert into public.registry_access (registry_id, teacher_id)
  select g.id, tid from public.registry_students g
  where g.etab_id = p_etab and (coalesce(p_class, '') = '' or g.class_label = p_class)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- 5. Rejoindre : « en attente » si le chef exige une validation ---------------------------------------------------------------------------------
create or replace function public.rejoindre_etablissement(p_code text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid()); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); e record; fails integer; st text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.etab_essais t where t.at < now() - interval '1 day';
  select count(*) into fails from public.etab_essais t where t.user_id = uid and t.at > now() - interval '15 minutes';
  if fails >= 8 then return jsonb_build_object('ok', false, 'err', 'too_many_attempts'); end if;
  select x.id, x.nom, x.ouvert, x.statut, x.valider_enseignants into e from public.etablissements x where x.code = c;
  if not found then
    insert into public.etab_essais (user_id) values (uid);
    return jsonb_build_object('ok', false, 'err', 'unknown_code');
  end if;
  if e.statut <> 'valide' then return jsonb_build_object('ok', false, 'err', 'pending'); end if;
  if not e.ouvert and not exists (select 1 from public.etab_membres m where m.etab_id = e.id and m.user_id = uid) then
    return jsonb_build_object('ok', false, 'err', 'closed');
  end if;
  insert into public.etab_membres (etab_id, user_id, role, statut)
  values (e.id, uid, 'enseignant', case when e.valider_enseignants then 'en_attente' else 'actif' end)
  on conflict do nothing;
  select m.statut into st from public.etab_membres m where m.etab_id = e.id and m.user_id = uid;
  if st = 'en_attente' then
    perform public.journaliser(e.id, 'enseignant_demande', coalesce((select u.email from auth.users u where u.id = uid), ''), '', 'demande à rejoindre l''établissement');
  end if;
  return jsonb_build_object('ok', true, 'id', e.id, 'nom', e.nom, 'attente', st = 'en_attente');
end $$;

-- 6. Mes établissements : ajoute le statut de membre, les seuils et le nombre de demandes en attente -----------------------------------------------
create or replace function public.mes_etablissements()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'nom', x.nom, 'ville', x.ville, 'role', m.role,
           'code', case when m.role = 'admin' and x.statut = 'valide' then x.code end,
           'ouvert', x.ouvert, 'verifie', x.verifie, 'statut', x.statut,
           'motif', case when m.role = 'admin' then x.motif else '' end,
           'membre_statut', m.statut,
           'seuil_moy', x.seuil_moy, 'seuil_pres', x.seuil_pres, 'seuil_abs', x.seuil_abs,
           'valider_enseignants', x.valider_enseignants,
           'attente', case when m.role = 'admin' then (select count(*) from public.etab_membres q where q.etab_id = x.id and q.statut = 'en_attente') else 0 end,
           'membres', (select count(*) from public.etab_membres q where q.etab_id = x.id and q.statut = 'actif')
         ) order by m.depuis), '[]'::jsonb)
  from public.etab_membres m join public.etablissements x on x.id = m.etab_id
  where m.user_id = (select auth.uid())
$$;

create or replace function public.etab_membres_liste(p_etab uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'user_id', m.user_id, 'email', u.email, 'nom', coalesce(u.raw_user_meta_data ->> 'name', ''),
            'role', m.role, 'statut', m.statut, 'depuis', m.depuis) order by m.statut, m.role, m.depuis), '[]'::jsonb)
          from public.etab_membres m join auth.users u on u.id = m.user_id
          where m.etab_id = p_etab);
end $$;

-- 7. Gestion des enseignants (avec journal) -----------------------------------------------------------------------------------------------------
create or replace function public.etab_valider_enseignants(p_etab uuid, p_on boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  update public.etablissements x set valider_enseignants = coalesce(p_on, false) where x.id = p_etab;
  perform public.journaliser(p_etab, 'validation_enseignants', '', '', case when p_on then 'validation des nouveaux enseignants activée' else 'validation des nouveaux enseignants désactivée' end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.etab_decider_membre(p_etab uuid, p_user uuid, p_accepter boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare em text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if not exists (select 1 from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user and m.statut = 'en_attente') then
    return jsonb_build_object('ok', false, 'err', 'not_member');
  end if;
  select u.email into em from auth.users u where u.id = p_user;
  if p_accepter then
    update public.etab_membres m set statut = 'actif' where m.etab_id = p_etab and m.user_id = p_user;
    perform public.journaliser(p_etab, 'enseignant_accepte', em, '', 'enseignant accepté');
  else
    delete from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user;
    perform public.journaliser(p_etab, 'enseignant_refuse', em, '', 'demande refusée');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.etab_retirer(p_etab uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r text; em text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  select m.role into r from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user;
  if r is null then return jsonb_build_object('ok', true); end if;
  if r = 'admin' and (select count(*) from public.etab_membres m where m.etab_id = p_etab and m.role = 'admin') <= 1 then
    return jsonb_build_object('ok', false, 'err', 'last_admin');
  end if;
  select u.email into em from auth.users u where u.id = p_user;
  delete from public.registry_access a using public.registry_students g
   where a.registry_id = g.id and g.etab_id = p_etab and a.teacher_id = p_user;
  delete from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user;
  perform public.journaliser(p_etab, 'retrait_enseignant', em, '', 'retiré de l''établissement');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.etab_definir_role(p_etab uuid, p_user uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare r text; em text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if p_role not in ('admin', 'enseignant') then return jsonb_build_object('ok', false, 'err', 'bad_role'); end if;
  select m.role into r from public.etab_membres m where m.etab_id = p_etab and m.user_id = p_user and m.statut = 'actif';
  if r is null then return jsonb_build_object('ok', false, 'err', 'not_member'); end if;
  if r = 'admin' and p_role = 'enseignant'
     and (select count(*) from public.etab_membres m where m.etab_id = p_etab and m.role = 'admin') <= 1 then
    return jsonb_build_object('ok', false, 'err', 'last_admin');
  end if;
  update public.etab_membres m set role = p_role where m.etab_id = p_etab and m.user_id = p_user;
  select u.email into em from auth.users u where u.id = p_user;
  perform public.journaliser(p_etab, 'role', em, '', case when p_role = 'admin' then 'nommé chef d''établissement' else 'droits de chef retirés' end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.etab_nouveau_code(p_etab uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  c := public.gen_etab_code();
  update public.etablissements x set code = c where x.id = p_etab;
  perform public.journaliser(p_etab, 'code', '', '', 'nouveau code d''accès des enseignants');
  return jsonb_build_object('ok', true, 'code', c);
end $$;

create or replace function public.etab_ouvrir(p_etab uuid, p_ouvert boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  update public.etablissements x set ouvert = coalesce(p_ouvert, true) where x.id = p_etab;
  perform public.journaliser(p_etab, 'inscriptions', '', '', case when coalesce(p_ouvert, true) then 'inscriptions rouvertes' else 'inscriptions fermées' end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.etab_renommer(p_etab uuid, p_nom text, p_ville text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare n text := btrim(coalesce(p_nom, ''));
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if char_length(n) < 2 or char_length(n) > 120 then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  update public.etablissements x set nom = n, ville = left(btrim(coalesce(p_ville, '')), 80) where x.id = p_etab;
  perform public.journaliser(p_etab, 'renommage', n, '', 'établissement renommé');
  return jsonb_build_object('ok', true);
end $$;

-- 8. Seuils d'alerte ----------------------------------------------------------------------------------------------------------------------------
create or replace function public.etab_seuils(p_etab uuid, p_moy numeric, p_pres integer, p_abs integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if p_moy is null or p_pres is null or p_abs is null or p_moy not between 1 and 19 or p_pres not between 10 and 100 or p_abs not between 1 and 14 then
    return jsonb_build_object('ok', false, 'err', 'bad_threshold');
  end if;
  update public.etablissements x set seuil_moy = round(p_moy, 1), seuil_pres = p_pres, seuil_abs = p_abs where x.id = p_etab;
  perform public.journaliser(p_etab, 'seuils', '', '', 'moyenne sous ' || round(p_moy, 1) || ', présence sous ' || p_pres || ' %, ' || p_abs || ' absences sur 14 jours');
  return jsonb_build_object('ok', true);
end $$;

-- 9. Transfert d'élèves -------------------------------------------------------------------------------------------------------------------------
-- Les accès des enseignants à ces élèves sont retirés (l'enseignant de l'ancienne classe ne doit plus lire leurs codes) :
-- le chef réaffecte ensuite les enseignants de la nouvelle classe.
create or replace function public.etab_deplacer_eleves(p_etab uuid, p_ids uuid[], p_classe text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare n integer; cl text := left(btrim(coalesce(p_classe, '')), 80); nom1 text; de text; moved uuid[];
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then return jsonb_build_object('ok', false, 'err', 'no_students'); end if;
  if array_length(p_ids, 1) > 1000 then return jsonb_build_object('ok', false, 'err', 'too_many_students'); end if;
  select array_agg(g.id order by g.name), string_agg(distinct coalesce(nullif(g.class_label, ''), '(sans classe)'), ', '), (array_agg(g.name order by g.name))[1]
    into moved, de, nom1
    from public.registry_students g
   where g.id = any (p_ids) and g.etab_id = p_etab and g.class_label is distinct from cl;
  n := coalesce(array_length(moved, 1), 0);
  if n = 0 then return jsonb_build_object('ok', true, 'n', 0); end if;
  update public.registry_students g set class_label = cl where g.id = any (moved);
  delete from public.registry_access a where a.registry_id = any (moved);
  perform public.journaliser(p_etab, 'transfert', case when n = 1 then nom1 else n || ' élèves' end, cl,
                             'de ' || coalesce(de, '') || ' vers ' || coalesce(nullif(cl, ''), '(sans classe)'));
  return jsonb_build_object('ok', true, 'n', n);
end $$;

-- 10. Messages ----------------------------------------------------------------------------------------------------------------------------------
create or replace function public.etab_message_envoyer(p_etab uuid, p_cible text, p_titre text, p_corps text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare t text := btrim(coalesce(p_titre, '')); c text := btrim(coalesce(p_corps, ''));
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  if p_cible not in ('enseignants', 'familles') then return jsonb_build_object('ok', false, 'err', 'bad_target'); end if;
  if char_length(t) < 1 or char_length(t) > 100 or char_length(c) < 1 or char_length(c) > 1000 then
    return jsonb_build_object('ok', false, 'err', 'bad_message');
  end if;
  if (select count(*) from public.etab_messages m where m.etab_id = p_etab and m.created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'err', 'too_many_messages');
  end if;
  insert into public.etab_messages (etab_id, cible, titre, corps, auteur) values (p_etab, p_cible, t, c, (select auth.uid()));
  perform public.journaliser(p_etab, 'message', t, '', 'message envoyé aux ' || p_cible);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.etab_messages_liste(p_etab uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb) from (
            select m.id, m.cible, m.titre, m.corps, m.created_at from public.etab_messages m
             where m.etab_id = p_etab order by m.created_at desc limit 30) q);
end $$;

create or replace function public.etab_message_supprimer(p_etab uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare t text;
begin
  if not (select public.is_etab_admin(p_etab)) then raise exception 'not admin'; end if;
  delete from public.etab_messages m where m.id = p_id and m.etab_id = p_etab returning m.titre into t;
  if t is not null then perform public.journaliser(p_etab, 'message_supprime', t, '', 'message retiré'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Messages reçus par un enseignant (ou un chef) : établissements dont il est membre accepté, 45 derniers jours
create or replace function public.mes_messages_etab()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.at desc), '[]'::jsonb) from (
    select g.id, x.nom as etab, g.titre, g.corps, g.created_at as at
      from public.etab_messages g
      join public.etab_membres m on m.etab_id = g.etab_id and m.user_id = (select auth.uid()) and m.statut = 'actif'
      join public.etablissements x on x.id = g.etab_id and x.statut = 'valide'
     where g.cible = 'enseignants' and g.created_at > now() - interval '45 days'
     order by g.created_at desc limit 10) q
$$;

-- Messages reçus par une famille : avec son code famille (comme le suivi), 60 derniers jours. Lecture publique par code exact.
create or replace function public.get_messages_famille(p_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.at desc), '[]'::jsonb) from (
    select m.titre, m.corps, m.created_at as at
      from public.etab_messages m
      join public.etablissements x on x.id = m.etab_id and x.statut = 'valide'
     where char_length(p_code) between 10 and 40
       and m.cible = 'familles' and m.created_at > now() - interval '60 days'
       and m.etab_id in (select g.etab_id from public.registry_students g where g.code = p_code)
     order by m.created_at desc limit 5) q
$$;

-- 11. Droits ------------------------------------------------------------------------------------------------------------------------------------
revoke all on function
  public.is_etab_member(uuid), public.can_use_ref(text), public.admin_assign(uuid, text, text), public.rejoindre_etablissement(text),
  public.mes_etablissements(), public.etab_membres_liste(uuid), public.etab_valider_enseignants(uuid, boolean),
  public.etab_decider_membre(uuid, uuid, boolean), public.etab_retirer(uuid, uuid), public.etab_definir_role(uuid, uuid, text),
  public.etab_nouveau_code(uuid), public.etab_ouvrir(uuid, boolean), public.etab_renommer(uuid, text, text),
  public.etab_seuils(uuid, numeric, integer, integer), public.etab_deplacer_eleves(uuid, uuid[], text),
  public.etab_journal(uuid, integer), public.etab_message_envoyer(uuid, text, text, text), public.etab_messages_liste(uuid),
  public.etab_message_supprimer(uuid, uuid), public.mes_messages_etab(), public.get_messages_famille(text) from public;
grant execute on function
  public.is_etab_member(uuid), public.can_use_ref(text), public.admin_assign(uuid, text, text), public.rejoindre_etablissement(text),
  public.mes_etablissements(), public.etab_membres_liste(uuid), public.etab_valider_enseignants(uuid, boolean),
  public.etab_decider_membre(uuid, uuid, boolean), public.etab_retirer(uuid, uuid), public.etab_definir_role(uuid, uuid, text),
  public.etab_nouveau_code(uuid), public.etab_ouvrir(uuid, boolean), public.etab_renommer(uuid, text, text),
  public.etab_seuils(uuid, numeric, integer, integer), public.etab_deplacer_eleves(uuid, uuid[], text),
  public.etab_journal(uuid, integer), public.etab_message_envoyer(uuid, text, text, text), public.etab_messages_liste(uuid),
  public.etab_message_supprimer(uuid, uuid), public.mes_messages_etab() to authenticated;
grant execute on function public.get_messages_famille(text) to anon, authenticated;

-- 12. Contrôle : établissements, seuils et enseignants en attente
select x.nom, x.seuil_moy, x.seuil_pres, x.seuil_abs, x.valider_enseignants,
       (select count(*) from public.etab_membres m where m.etab_id = x.id and m.statut = 'en_attente') as en_attente
  from public.etablissements x order by x.nom;
