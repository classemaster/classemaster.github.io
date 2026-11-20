# Classe Master — mise en route de Supabase

Site : https://classemaster.github.io/

1. **Base de données** : Supabase > SQL Editor > New query > coller le contenu de `schema.sql` > Run.
2. **Clé publique** : Supabase > Project Settings > API Keys > copier la clé « anon / publishable ».
   La coller dans `js/supabase.js`, à la place de la clé publique.
   (Cette clé est faite pour être publique ; la protection vient des règles RLS du schéma.)
3. **Adresses autorisées** : Authentication > URL Configuration
   - Site URL : `https://classemaster.github.io/`
   - Redirect URLs : `https://classemaster.github.io/**`
4. **E-mails** : Authentication > Providers > Email. Laissez « Confirm email » activé (recommandé) ou désactivez-le pour une inscription immédiate.
5. **Google (facultatif)** : Authentication > Providers > Google, puis renseigner l'ID et le secret client Google Cloud.
   Tant que ce n'est pas fait, le bouton affiche « La connexion avec Google n'est pas activée ».
6. Publier les fichiers sur le dépôt GitHub `classemaster.github.io`.

Les anciens comptes locaux : à la première ouverture, l'utilisateur se connecte (ou crée son compte) avec la même adresse e-mail et retrouve ses données de l'appareil, qui sont ensuite envoyées en ligne.
