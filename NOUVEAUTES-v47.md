# Classe Master v47 — administrateur : enseignants, discipline, fin de période

Le tableau de bord de `admin.html` a maintenant sept onglets : Aperçu, Effectifs, Assiduité, Résultats, **Enseignants**, **Discipline**, **Fin de période**. L'Aperçu affiche aussi un bandeau **À traiter** (appels non faits, évaluations en retard, risque de décrochage, incidents graves) qui ouvre directement l'onglet concerné.

## Enseignants
- **Appel du jour** par classe et matière : fait, non fait (séance terminée sans appel), à venir, sans séance. Cela suppose que l'enseignant ait saisi son **emploi du temps** ; sans lui, la classe est notée « sans emploi du temps » et jamais « non fait ».
- **Notes saisies à temps** : évaluations datées de plus de 7 jours dont moins de la moitié de la classe a une note.
- **Charge de travail** : classes, matières, élèves et heures par semaine (d'après les emplois du temps).
- Enseignants sans mise à jour depuis 14 jours.

## Discipline
- Dans la fiche d'un élève, l'enseignant dispose de deux nouveaux types d'observation : **Incident** et **Incident grave**. Seuls ces incidents sont transmis à l'administration ; les autres observations restent privées.
- L'administrateur voit : incidents sur 30 jours, graves, élèves concernés, récidives (2 ou plus), par classe, par élève, derniers incidents avec leur description, et un export Excel.
- **Les parents ne voient jamais les incidents** : le script SQL les retire des deux fonctions de lecture publiques.

## Fin de période
- **Bulletins prêts** par période (T1, T2, T3, année) : une classe est prête quand chaque matière publiée a une moyenne pour tous les élèves, sans évaluation en retard.
- **Passages et redoublements** : proposition automatique avec seuil réglable (10 par défaut), puis décision confirmée élève par élève (passe, à examiner, redoublement), enregistrée par année scolaire.
- **Exports** : Excel (CSV) et PDF, pour l'établissement entier et pour une classe (conseil de classe). Le PDF s'obtient par « Enregistrer en PDF » dans la fenêtre d'impression.

## À faire (important)
1. Exécuter `supabase/vie-scolaire-admin.sql` dans Supabase (SQL Editor). Rien n'est perdu.
2. Publier les fichiers. Les enseignants doivent ouvrir l'application mise à jour (en ligne) : leurs résumés sont alors renvoyés avec les nouvelles informations (dernier appel, emploi du temps, évaluations, incidents).

## À savoir
- Le seuil de passage est gardé sur l'appareil de l'administrateur.
- Un appel fait sans internet n'apparaît qu'au retour de la connexion de l'enseignant.
- Une matière qu'un enseignant n'a jamais publiée n'est pas détectée dans « Bulletins prêts ».
- Une évaluation ancienne sans aucune note compte comme « en retard » tant que l'enseignant ne la supprime pas ou ne la note pas.
- Les fichiers Excel sont des CSV avec séparateur « ; » (ouverture directe dans Excel en français).
- `sw.js` : `cm-v47`.
