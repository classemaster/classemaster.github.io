-- Classe Master v72 : AIDER UN CHEF D'ÉTABLISSEMENT + CHIFFRES D'USAGE ANONYMES (administrateur du site)
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS gestion-v71.sql. Faites d'abord une sauvegarde. Rejouable sans danger.
-- Ce script n'en remplace aucun autre : il ajoute trois fonctions réservées aux administrateurs de Classe Master
-- (table plateforme_admins, vérifiée par le serveur : est_admin_plateforme). Il ne touche ni aux classes, ni aux élèves.
--
-- Ce que cela ajoute :
--  1. sa_nouveau_code    : générer un nouveau code d'accès pour un établissement validé (le chef a perdu le sien, ou il a fuité).
--                          L'ancien code cesse de fonctionner ; les enseignants déjà inscrits restent membres.
--  2. sa_definir_chef    : désigner un chef d'établissement par son e-mail (la personne doit déjà avoir un compte), en laissant
--                          ou non les chefs actuels (cas d'un chef parti : ils redeviennent simples enseignants).
--  3. sa_usage           : chiffres d'usage ANONYMES : établissements actifs ou non sur 30 jours, nombre d'enseignants, dernière
--                          activité par établissement. Aucun nom d'élève, aucune classe, aucune note.
--  Les deux premières actions sont inscrites au journal du chef (visible dans etablissement.html, avec l'adresse de l'auteur).

-- 1. Nouveau code ----------------------------------------------------------------------------------------------------------------------------
create or replace function public.sa_nouveau_code(p_etab uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c text;
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  if not exists (select 1 from public.etablissements x where x.id = p_etab) then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  if not exists (select 1 from public.etablissements x where x.id = p_etab and x.statut = 'valide') then
    return jsonb_build_object('ok', false, 'err', 'not_valid');      -- un établissement non validé ou suspendu n'a pas de code
  end if;
  c := public.gen_etab_code();
  update public.etablissements x set code = c where x.id = p_etab;
  perform public.journaliser(p_etab, 'code', '', '', 'nouveau code d''accès généré par l''administrateur du site');
  return jsonb_build_object('ok', true, 'code', c);
end $$;

-- 2. Désigner un chef --------------------------------------------------------------------------------------------------------------------------
--    p_remplacer = true : les chefs actuels redeviennent enseignants (ils restent membres) ; false : le nouveau chef s'ajoute.
create or replace function public.sa_definir_chef(p_etab uuid, p_email text, p_remplacer boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare tid uuid; em text := lower(btrim(coalesce(p_email, '')));
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  if em !~ '^[^@[:space:]]+@[^@[:space:]]+$' then return jsonb_build_object('ok', false, 'err', 'bad_email'); end if;
  if not exists (select 1 from public.etablissements x where x.id = p_etab) then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  select u.id into tid from auth.users u where lower(u.email) = em;
  if tid is null then return jsonb_build_object('ok', false, 'err', 'unknown_user'); end if;
  insert into public.etab_membres (etab_id, user_id, role, statut) values (p_etab, tid, 'admin', 'actif')
  on conflict (etab_id, user_id) do update set role = 'admin', statut = 'actif';
  if coalesce(p_remplacer, false) then
    update public.etab_membres m set role = 'enseignant' where m.etab_id = p_etab and m.role = 'admin' and m.user_id <> tid;
  end if;
  perform public.journaliser(p_etab, 'role', em, '',
    case when coalesce(p_remplacer, false)
         then 'chef désigné par l''administrateur du site (les anciens chefs redeviennent enseignants)'
         else 'chef désigné par l''administrateur du site' end);
  return jsonb_build_object('ok', true);
end $$;

-- 3. Chiffres d'usage anonymes -----------------------------------------------------------------------------------------------------------------
--    « Dernière activité » d'un établissement = le plus récent entre la dernière connexion d'un de ses membres et la dernière
--    mise à jour d'un lien parent par l'un d'eux. Seules des DATES sont lues : jamais le contenu des liens.
create or replace function public.sa_usage()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.est_admin_plateforme()) then raise exception 'not allowed'; end if;
  return (
    with e as (
      select x.id, x.statut,
             (select count(*) from public.etab_membres m where m.etab_id = x.id and m.role = 'enseignant' and m.statut = 'actif') as ens,
             greatest(
               (select max(u.last_sign_in_at) from public.etab_membres m join auth.users u on u.id = m.user_id
                 where m.etab_id = x.id and m.statut = 'actif'),
               (select max(s.updated_at) from public.parent_shares s
                 where s.user_id in (select m.user_id from public.etab_membres m where m.etab_id = x.id and m.statut = 'actif'))
             ) as act
        from public.etablissements x)
    select jsonb_build_object(
             'actifs_30j',   count(*) filter (where e.statut = 'valide' and e.act > now() - interval '30 days'),
             'inactifs_30j', count(*) filter (where e.statut = 'valide' and (e.act is null or e.act <= now() - interval '30 days')),
             'enseignants',  coalesce(sum(e.ens) filter (where e.statut = 'valide'), 0),
             'par_etab',     coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'enseignants', e.ens, 'derniere_activite', e.act)), '[]'::jsonb))
      from e);
end $$;

-- 4. Droits ----------------------------------------------------------------------------------------------------------------------------------------
revoke all on function public.sa_nouveau_code(uuid), public.sa_definir_chef(uuid, text, boolean), public.sa_usage() from public;
grant execute on function public.sa_nouveau_code(uuid), public.sa_definir_chef(uuid, text, boolean), public.sa_usage() to authenticated;

-- 5. Contrôle : établissements par statut
select x.statut, count(*) as nb from public.etablissements x group by x.statut order by x.statut;
