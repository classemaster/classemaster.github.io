# Classe Master v41 — page administrateur : élèves rangés par niveau puis par classe

## Ce qui change (`admin.html`)
- La liste des élèves n'est plus une suite infinie de noms. Elle est rangée **par niveau** (6e, 5e, 4e, 3e, 2nde, 1ère, Terminale…), puis **par classe** (5e A, 5e B…).
- Chaque niveau affiche son nombre de classes et d'élèves ; chaque classe est une ligne repliée avec son effectif. Touchez une classe pour voir ses élèves.
- **Tout ouvrir / Tout réduire** en haut de la liste.
- La **recherche** ouvre automatiquement les classes qui contiennent un résultat ; choisir une classe dans le filtre l'ouvre aussi.
- Le niveau est déduit du nom de la classe : « 5e A », « 5eA » et « 5e B » vont tous dans « 5e ». Les élèves sans classe sont dans « Sans classe ».
- Le bouton « Afficher 50 de plus » disparaît : il n'est plus utile.

## À savoir
- Les cartes QR, les exports et « Nouveaux codes pour cette sélection » fonctionnent comme avant (ils suivent le filtre de classe et la recherche).
- `sw.js` : `cm-v41`.
