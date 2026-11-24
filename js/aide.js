/* Aide intégrée : guide court pour les nouveaux enseignants (écran « aide », ouvert depuis Compte et Accueil).
   Texte fixe, sans donnée personnelle : chaque rubrique se déplie au toucher. */
var AIDE=[
  ["La rentrée : passer à la nouvelle année",[
    "À la rentrée, une carte « Bonne rentrée » apparaît sur l’accueil (ou <b>Compte › Nouvelle année scolaire</b>). Pour chaque classe vous choisissez : <b>passe au niveau suivant</b> (6e B devient 5e B), <b>reste la même</b> ou <b>terminée</b>.",
    "L’année écoulée est rangée en archive (rien n’est perdu) et une sauvegarde est enregistrée avant le passage. Vous choisissez les élèves qui continuent ; les autres (redoublants, départs) ne sont pas reconduits.",
    "Côté administrateur : <b>Administration › Rentrée</b> fait passer les élèves du registre au niveau suivant selon les décisions « passe », « redoublement » ; le passage s’annule en un geste."]],
  ["Mon établissement et son code d’accès",[
    "Chaque enseignant travaille dans un <b>établissement</b>. Le <b>chef d’établissement</b> le crée à son inscription : un <b>code à 8 caractères</b> (ex. K7M2-QX4P) est alors généré.",
    "Le chef donne ce code à ses enseignants (bouton « Envoyer » dans <b>Compte › Établissement</b>). Chaque enseignant le saisit à l’inscription : il rejoint l’établissement et gère ses classes.",
    "Le chef peut fermer les inscriptions, créer un nouveau code, nommer d’autres administrateurs (direction, CPE) ou retirer un enseignant. Les données d’un établissement ne sont jamais visibles par un autre."]],
  ["Premiers pas en 3 minutes",[
    "Ouvrez l’<b>Accueil</b>, puis touchez « Ajouter des élèves ».",
    "Importez un fichier Excel ou CSV, ou collez votre liste (un nom par ligne). Vous pouvez créer d’autres classes avec « + Nouvelle classe » dans le menu en haut.",
    "Revenez à l’Accueil et touchez « Faire l’appel »."]],
  ["Faire l’appel",[
    "Pour chaque élève, indiquez présent, absent ou en retard. « Tous présents » remplit la liste d’un coup : il ne reste qu’à corriger les absents.",
    "Pour une absence, vous pouvez préciser si elle est justifiée ou non, et copier un message pour la vie scolaire.",
    "Pour corriger un jour passé, changez la date en haut de l’écran."]],
  ["Rappels d’appel",[
    "Si vous avez rempli l’emploi du temps d’une classe, l’accueil affiche « Appel non fait » pour chaque séance terminée sans appel.",
    "Dans <b>Compte › Rappels d’appel</b>, touchez « Activer les rappels » pour recevoir aussi une notification avant la séance et après, si l’appel est oublié. Elles arrivent quand l’appli est ouverte ou installée sur l’écran d’accueil."]],
  ["Saisir des notes",[
    "Ouvrez la classe, puis « Notes » : créez une évaluation (date, barème, coefficient) et saisissez les notes élève par élève.",
    "Les moyennes sur 20 et le classement se calculent tout seuls, par trimestre. Le détail d’un élève est dans sa fiche."]],
  ["Voir les absences et imprimer",[
    "L’onglet <b>Bilan</b> montre la présence, les absences et les retards de la période, avec des graphiques.",
    "Vous pouvez exporter en CSV, ou imprimer / enregistrer en PDF (relevé, fiche d’appel, bulletins)."]],
  ["Prévenir les parents",[
    "Dans <b>Compte › Sauvegarde et partage</b>, créez un lien de suivi ou affichez le « code famille » d’un élève, puis envoyez-le (WhatsApp, SMS…). Les parents voient les présences et les notes, en lecture seule.",
    "Un lien peut être désactivé à tout moment. Si le code famille est indisponible, demandez à l’administrateur de vous affecter la classe."]],
  ["Sauvegarder et travailler sans internet",[
    "L’appli fonctionne sans connexion : vos données restent sur le téléphone et sont envoyées à votre compte dès le retour d’internet (le bandeau en haut l’indique).",
    "Faites quand même une sauvegarde complète de temps en temps : <b>Compte › Sauvegarde et partage › Télécharger toutes mes données</b>.",
    "Une suppression par erreur ? Regardez dans la corbeille (Compte › Espace et sauvegarde) ou touchez « Annuler » juste après."]],
  ["Ça ne marche pas ?",[
    "<b>« Mémoire de l’appareil pleine »</b> : touchez « Libérer » dans le bandeau pour exporter puis supprimer les anciennes archives.",
    "<b>La synchronisation échoue</b> : vérifiez internet ; vos données ne sont pas perdues, elles restent sur l’appareil et repartent plus tard.",
    "<b>Mot de passe ou code oublié</b> : utilisez « Mot de passe oublié » à la connexion, ou « Code oublié ? » sur l’écran de verrouillage.",
    "<b>L’appli semble ancienne</b> : fermez-la complètement et rouvrez-la avec internet, elle se met à jour toute seule.",
    "Un souci persiste ? Notez ce que vous faisiez et le message affiché, et transmettez-le à votre administrateur."]]
];
function renderAide(){
  return'<h1 style="text-transform:none">Aide</h1><p class="sub" style="margin-top:0">Touchez une rubrique pour la lire.</p><button class="btn ghost" data-tour="1" style="margin-bottom:12px">Revoir la visite guidée</button>'+
    AIDE.map(function(r,i){
      return'<details class="card aide"'+(i===0?" open":"")+'><summary>'+r[0]+'</summary>'+r[1].map(function(p){return"<p>"+p+"</p>";}).join("")+'</details>';
    }).join("");
}
function aideCard(){return'<div class="card"><h2>Aide</h2><p class="sub" style="margin-top:0">Premiers pas, appel, notes, parents, sauvegarde et dépannage.</p><button class="btn ghost" data-go="aide">Ouvrir l’aide</button></div>';}
