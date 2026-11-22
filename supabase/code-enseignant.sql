-- Classe Master v31 : l'enseignant peut afficher le code famille de SES élèves liés.
-- À exécuter une fois dans Supabase > SQL Editor (après partage-admin.sql).
--
-- Un enseignant obtient le code d'un élève seulement si :
--   * l'élève est dans le registre de l'administration (même référence), et
--   * l'enseignant a lui-même publié un résumé pour cette référence (élève lié dans sa classe).
-- Les codes restent illisibles directement (aucune règle de lecture ajoutée sur registry_students).

create or replace function public.get_family_code(p_ref text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select g.code
  from public.registry_students g
  where g.ref = p_ref
    and char_length(p_ref) between 10 and 40
    and exists (
      select 1 from public.parent_shares s
      where s.user_id = (select auth.uid()) and s.ref = p_ref
    )
  limit 1
$$;

revoke all on function public.get_family_code(text) from public;
grant execute on function public.get_family_code(text) to authenticated;
