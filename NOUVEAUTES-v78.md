# Classe Master v78

## Administrateur du site (`admin.html`)
- **Supprimer un établissement** suspendu ou refusé (bouton « Supprimer »). Un établissement validé ou en attente doit d'abord être suspendu.
- Avant d'effacer, un aperçu indique le nombre de dossiers d'élèves et de membres concernés ; il faut retaper le nom exact de l'établissement (vérifié aussi par le serveur).
- Effacé définitivement : l'établissement, ses membres, ses messages, les dossiers d'élèves et leurs liens famille, les accès des enseignants, les résumés publiés aux parents, la rentrée en cours et le journal. Restent : les classes et notes gardées dans l'application de chaque enseignant, et les demandes d'aide à l'équipe (sans lien avec l'établissement).
- Le chef et les enseignants retombent sur l'écran « Votre établissement » à leur prochaine ouverture.
- Une ligne d'archive (nom, ville, date, auteur, effectifs) reste dans la table `plateforme_suppressions`, lisible depuis l'éditeur SQL.

## À faire
1. Exécuter `supabase/suppression-v78.sql` dans Supabase (SQL Editor), après sauvegarde. Sans lui, le bouton affiche « Suppression indisponible ».
2. Publier les fichiers sur GitHub. Cache hors ligne : `cm-v78`.
