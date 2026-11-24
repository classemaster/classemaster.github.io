-- Classe Master v70 : DÉCISIONS RÉVERSIBLES sur les établissements (suspension, réactivation, nouvelle décision)
-- À exécuter UNE fois dans Supabase > SQL Editor, APRÈS validation-etablissements-v63.sql. Rejouable sans danger.
-- Ne rejouez pas validation-etablissements-v63.sql APRÈS celui-ci : il retirerait le statut « suspendu » de la liste admise
-- (rejouez alors celui-ci en dernier).
--
-- Ce que cela change :
--  * un établissement validé peut être SUSPENDU, puis réactivé, par un administrateur de Classe Master ;
--  * un établissement refusé peut être validé ensuite ; une validation peut être retirée (suspension) ;
--  * pendant la suspension, le chef n'a plus accès au tableau de bord, aux dossiers élèves ni au code, et personne ne peut
--    rejoindre l'établissement (le serveur refuse : is_etab_admin, is_admin et rejoindre_etablissement exigent « valide »).
--    Les enseignants déjà inscrits gardent l'accès à leurs propres classes ;
--  * la liste de l'administrateur du site indique qui a décidé et quand.

-- 1. Nouveau statut « suspendu » --------------------------------------------------------------------------------------------------
alter table public.etablissements drop constraint if exists etablissements_statut_check;
alter table public.etablissements add constraint etablissements_statut_check
  check (statut in ('en_attente', 'valide', 'refuse', 'suspendu'));

-- 2. Changer le statut (administrateurs de Classe Master seulement) ------------------------------------------------------------------
--    p_statut : 'valide' | 'refuse' | 'suspendu'. Le motif est conservé pour « refuse » et « suspendu », effacé pour « valide ».
create or replace function public.sa_changer_statut(p_etab uuid, p_statut text, p_motif text default '')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare n integer; s text := coalesce(p_statut, '');
begin
  if not (select public.est_admin_plateforme()) then return jsonb_build_object('ok', false, 'err', 'not_allowed'); end if;
  if s not in ('valide', 'refuse', 'suspendu') then return jsonb_build_object('ok', false, 'err', 'bad_status'); end if;
  update public.etablissements x
     set statut = s,
         verifie = (s = 'valide'),
         motif = case when s = 'valide' then '' else left(btrim(coalesce(p_motif, '')), 300) end,
         decide_le = now(), decide_par = (select auth.uid())
   where x.id = p_etab and x.statut <> s
     and not (s = 'suspendu' and x.statut <> 'valide');      -- on ne suspend qu'un établissement validé
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'err', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 3. Liste de l'administrateur du site : ajoute « décidé le » et « décidé par » --------------------------------------------------------
create or replace function public.sa_etablissements(p_statut text default 'en_attente')
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.est_admin_plateforme()) then raise exception 'not allowed'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'id', x.id, 'nom', x.nom, 'ville', x.ville, 'statut', x.statut, 'motif', x.motif, 'cree', x.created_at,
            'decide_le', x.decide_le, 'decide_par_email', d.email,
            'createur_email', u.email, 'createur_nom', coalesce(u.raw_user_meta_data ->> 'name', ''),
            'chefs', (select coalesce(jsonb_agg(jsonb_build_object('nom', coalesce(cu.raw_user_meta_data ->> 'name', ''), 'email', cu.email) order by m.depuis), '[]'::jsonb)
                        from public.etab_membres m join auth.users cu on cu.id = m.user_id
                       where m.etab_id = x.id and m.role = 'admin'),
            'enseignants', (select count(*) from public.etab_membres m where m.etab_id = x.id and m.role = 'enseignant')
          ) order by (x.statut <> 'en_attente'), x.created_at desc), '[]'::jsonb)
          from public.etablissements x
          left join auth.users u on u.id = x.cree_par
          left join auth.users d on d.id = x.decide_par
          where p_statut is null or x.statut = p_statut);
end $$;

-- 4. Mes établissements : le motif reste visible du chef (refus ou suspension) ; le code n'est donné qu'à un établissement VALIDÉ.
--    (inchangé par rapport à la v63 : statut et motif sont déjà renvoyés ; on le redéclare pour que ce script se suffise.)
create or replace function public.mes_etablissements()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'nom', x.nom, 'ville', x.ville, 'role', m.role,
           'code', case when m.role = 'admin' and x.statut = 'valide' then x.code end,
           'ouvert', x.ouvert, 'verifie', x.verifie, 'statut', x.statut,
           'motif', case when m.role = 'admin' then x.motif else '' end,
           'membres', (select count(*) from public.etab_membres q where q.etab_id = x.id)
         ) order by m.depuis), '[]'::jsonb)
  from public.etab_membres m join public.etablissements x on x.id = m.etab_id
  where m.user_id = (select auth.uid())
$$;

-- 5. Droits ------------------------------------------------------------------------------------------------------------------------------
revoke all on function public.sa_changer_statut(uuid, text, text), public.sa_etablissements(text), public.mes_etablissements() from public;
grant execute on function public.sa_changer_statut(uuid, text, text), public.sa_etablissements(text), public.mes_etablissements() to authenticated;

-- 6. Contrôle : établissements par statut
select x.statut, count(*) as nb from public.etablissements x group by x.statut order by x.statut;
