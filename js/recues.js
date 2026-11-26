/* Classes reçues du chef d'établissement (v88).
   Un enseignant rattaché à un établissement ne crée plus ses classes : son chef les lui donne (avec la matière).
   Elles apparaissent ici avec leurs élèves, sans rien à saisir. Les classes déjà présentes sur l'appareil sont conservées :
   une classe de même nom est simplement reliée à celle du chef (aucune note, aucun appel n'est touché).
   Côté serveur : supabase/parcours-enseignant-v88.sql. Sans ce script, l'application fonctionne comme avant (rien n'est verrouillé). */
var RECU={ok:false,loaded:false,list:[],busy:false,at:0};
function recuReset(){RECU.ok=false;RECU.loaded=false;RECU.list=[];RECU.busy=false;RECU.at=0;}

/* Verrou : un enseignant (pas le chef) d'un établissement dont le serveur gère les classes reçues */
function recuLocked(){
  var e=typeof etabCur==="function"?etabCur():null;
  return!!(RECU.ok&&ME&&!GUEST&&e&&e.role!=="admin");
}

/* Relie les classes reçues à celles de l'appareil. Renvoie true si quelque chose a changé (noSave : l'appelant enregistre lui-même). */
function recuApply(noSave){
  if(!RECU.ok||typeof D==="undefined"||!D||!D.classes)return false;
  var ch=false,now=Date.now();
  RECU.list.forEach(function(rc){
    if(!rc||!rc.classe_id)return;
    var c=D.classes.find(function(x){return x.ca===rc.classe_id;});
    if(!c)c=D.classes.find(function(x){return!x.ca&&!isArch(x)&&(!x.et||x.et===rc.etab_id)&&nrm(x.name)===nrm(rc.classe);});
    var fresh=false,touched=false;
    if(!c){c={id:uid(),name:String(rc.classe),students:[],records:{},notes:{},et:rc.etab_id,ca:rc.classe_id};D.classes.push(c);fresh=true;touched=true;}
    if(c.ca!==rc.classe_id){c.ca=rc.classe_id;touched=true;}
    var subj=(rc.matieres||[]).join(", ");
    if(subj&&!c.subj){c.subj=subj;touched=true;}
    /* élèves : on ajoute ceux qui manquent, on lie ceux qui ont le même nom ; on ne retire jamais personne */
    var used={},byKey={};
    c.students.forEach(function(s){if(s.ref)used[s.ref]=1;else{var k=shNameKey(s.name);(byKey[k]=byKey[k]||[]).push(s);}});
    (rc.eleves||[]).forEach(function(x){
      if(!x||!x.ref||!x.name)return;
      var rf=shRefNorm(x.ref);
      if(rf.length<SH_RMIN||used[rf])return;
      var m=byKey[shNameKey(x.name)];
      if(m&&m.length){var s=m.shift();s.ref=rf;if(!s.sh)s.sh=shTok();}
      else c.students.push({id:uid(),name:String(x.name),ref:rf,sh:shTok()});
      used[rf]=1;touched=true;
    });
    if(touched){dirty[c.id]=now;ch=true;}
  });
  /* la classe vide « Ma classe » créée automatiquement au premier lancement n'a plus de raison d'être */
  if(RECU.list.length){
    var keep=D.classes.filter(function(c){return!(c.name==="Ma classe"&&!c.ca&&!(c.students||[]).length&&!Object.keys(c.records||{}).length);});
    if(keep.length!==D.classes.length){D.classes=keep;ch=true;}
    if(!D.classes.some(function(c){return c.id===D.cur;})){var lv=liveCls();if(lv.length)D.cur=lv[0].id;}
  }
  if(ch&&!noSave&&typeof save==="function")save();
  return ch;
}

function recuLoad(cb){
  var e=typeof etabCur==="function"?etabCur():null;
  if(!sb||!ME||GUEST||!navigator.onLine||!e||e.role==="admin"||RECU.busy){if(cb)cb();return;}
  var mine=ME.id;RECU.busy=true;
  sb.rpc("mes_classes_recues").then(function(r){
    RECU.busy=false;
    if(!ME||ME.id!==mine)return;
    RECU.loaded=true;
    if(r.error||!Array.isArray(r.data)){RECU.ok=false;if(cb)cb();return;}   /* script SQL v88 pas encore exécuté : l'appli fonctionne comme avant */
    RECU.ok=true;RECU.list=r.data;RECU.at=Date.now();
    recuApply();
    if(typeof render==="function"&&/^(home|classe|eleves|etab)$/.test(view))render();
    if(cb)cb();
  },function(){RECU.busy=false;if(cb)cb();});
}

/* Message d'accueil tant que l'enseignant n'a rien reçu */
function recuCard(){
  if(!recuLocked())return"";
  var e=etabCur(),t,p;
  if(typeof etabMembreAttente==="function"&&etabMembreAttente(e)){
    t="En attente de validation";
    p="Votre chef d’établissement doit d’abord accepter votre demande. Ensuite il vous donnera vos classes et vos matières : elles apparaîtront ici avec leurs élèves.";
  }else if(!RECU.list.length){
    t="Aucune classe pour le moment";
    p="Votre chef d’établissement doit vous donner vos classes et vos matières. Elles apparaîtront ici avec leurs élèves, sans rien à saisir.";
  }else return"";
  return'<section class="hm-card"><h2 class="hm-h">'+esc(t)+'</h2><p class="sub" style="margin:0 0 10px">'+esc(p)+'</p><button class="btn ghost" data-recu="1">Actualiser</button></section>';
}

function recuNotice(){if(typeof toast==="function")toast("Vos classes sont données par votre chef d’établissement.");}

document.getElementById("view").addEventListener("click",function(e){
  if(!e.target.closest("[data-recu]"))return;
  if(!navigator.onLine){if(typeof toast==="function")toast("Pas de connexion internet.");return;}
  RECU.busy=false;
  recuLoad(function(){if(typeof toast==="function")toast(RECU.list.length?"Classes mises à jour.":"Rien de nouveau pour le moment.");});
});
/* Mise à jour au retour sur l'application ou d'internet : au plus une fois par minute */
function recuSoon(){if(RECU.ok&&Date.now()-RECU.at>60000)recuLoad();}
window.addEventListener("online",recuSoon);
document.addEventListener("visibilitychange",function(){if(!document.hidden)recuSoon();});
