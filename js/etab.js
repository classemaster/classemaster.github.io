/* Établissements : chaque enseignant appartient à un établissement.
   Le chef d'établissement crée l'établissement (il reçoit un code) et donne ce code à ses enseignants ;
   un enseignant s'inscrit avec le code et ne gère que les classes de son établissement.
   Côté serveur : supabase/etablissements-v60.sql. Sans ce script, l'application fonctionne comme avant. */
var ETAB={list:[],cur:"",loaded:false,unavailable:false,err:"",mem:null,busy:false,msgs:[]};
var ETAB_ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   /* pas de 0, 1, I, O : évite les confusions à la saisie */
var ETAB_IK="cm-etab-intent";

function etabNorm(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");}
function etabFmt(c){c=etabNorm(c);return c.length===8?c.slice(0,4)+"-"+c.slice(4):c;}
function etabCodeOk(s){var c=etabNorm(s),i;if(c.length!==8)return false;for(i=0;i<8;i++)if(ETAB_ALPHA.indexOf(c.charAt(i))<0)return false;return true;}
function etabCodeMsg(s){
  var c=etabNorm(s);
  if(!c)return"Entrez le code de votre établissement.";
  if(c.length!==8)return"Le code a 8 caractères (ex. K7M2-QX4P). Demandez-le à votre chef d’établissement.";
  return"Ce code contient un caractère impossible (jamais de 0, 1, I ni O). Vérifiez-le.";
}
function etabMsg(err){
  return({unknown_code:"Code inconnu. Vérifiez-le auprès de votre chef d’établissement.",
    closed:"Les inscriptions avec ce code sont fermées. Demandez un nouveau code à votre chef d’établissement.",
    too_many_attempts:"Trop d’essais. Réessayez dans quelques minutes.",
    bad_name:"Entrez le nom de l’établissement (2 caractères minimum).",
    too_many:"Vous avez déjà créé 3 établissements.",
    last_admin:"Vous êtes le seul administrateur : nommez d’abord un autre administrateur.",
    not_member:"Cet enseignant n’est pas membre de l’établissement.",
    bad_role:"Rôle inconnu.",
    pending:"Cet établissement n’a pas encore été validé par un administrateur de Classe Master. Réessayez plus tard.",
    not_validated:"Cet établissement doit d’abord être validé par un administrateur de Classe Master.",
    not_allowed:"Action réservée aux administrateurs de Classe Master.",
    bad_status:"Statut inconnu.",
    not_found:"Établissement introuvable, ou déjà dans cet état."})[err]||"Action impossible pour le moment. Vérifiez internet puis réessayez.";
}

/* Intention saisie à l'inscription : exécutée à la première connexion (marche aussi hors ligne) */
function intentGet(){try{var o=JSON.parse(localStorage.getItem(ETAB_IK)||"null");return o&&typeof o==="object"?o:null;}catch(e){return null;}}
function intentSet(o){try{if(o)localStorage.setItem(ETAB_IK,JSON.stringify(o));else localStorage.removeItem(ETAB_IK);}catch(e){}}

function etabCur(){var i;for(i=0;i<ETAB.list.length;i++)if(ETAB.list[i].id===ETAB.cur)return ETAB.list[i];return ETAB.list[0]||null;}
function etabId(){var e=etabCur();return e?e.id:undefined;}
function etabIsAdmin(){var e=etabCur();return!!e&&e.role==="admin";}
function etabNeeded(){return!!(ME&&!GUEST&&sb&&ETAB.loaded&&!ETAB.list.length);}
function etabReset(){ETAB.list=[];ETAB.cur="";ETAB.loaded=false;ETAB.unavailable=false;ETAB.err="";ETAB.mem=null;ETAB.busy=false;ETAB.msgs=[];}
/* Validation : un établissement créé reste « en attente » tant qu’un administrateur de Classe Master ne l’a pas validé.
   Sans le script SQL de validation, le serveur ne renvoie pas de statut : l’établissement est alors considéré comme validé. */
function etabStatut(e){return!e||!e.statut?"valide":e.statut;}
function etabValide(e){return etabStatut(e)==="valide";}
/* Un enseignant qui a rejoint avec le code reste « en attente » tant que le chef ne l’a pas accepté (si le chef l’exige). */
function etabMembreAttente(e){return!!e&&e.role!=="admin"&&e.membre_statut==="en_attente";}
/* Messages du chef d’établissement : « lu » est gardé sur l’appareil */
function etabReadKey(){return ME?"cm-etab-msg-lus-"+ME.id:"cm-etab-msg-lus";}
function etabReadGet(){try{var a=JSON.parse(localStorage.getItem(etabReadKey())||"[]");return Array.isArray(a)?a:[];}catch(e){return[];}}
function etabReadAdd(id){try{var a=etabReadGet();if(a.indexOf(id)<0)a.push(id);localStorage.setItem(etabReadKey(),JSON.stringify(a.slice(-100)));}catch(e){}}
function etabMsgsNew(){var lus=etabReadGet();return(ETAB.msgs||[]).filter(function(m){return m&&lus.indexOf(m.id)<0;});}
/* Appelée au début de chaque affichage : tant que le compte n'est pas rattaché à un établissement, on reste sur l'écran de rattachement */
function etabGate(){
  if(etabNeeded()){if(view!=="etab")view="etab";}
  else if(view==="etab"&&ME)view="home";
}
function etabKey(){return ME?"cm-etab-cur-"+ME.id:"cm-etab-cur";}

/* Classes : chacune porte l'établissement auquel elle appartient (clé « et », rangée avec les autres champs en ligne) */
function etabApply(){
  var cur=etabCur(),ch=false;
  if(!cur||!ME)return;
  if(ME.school!==cur.nom){ME.school=cur.nom;try{saveAcc();}catch(e){}}
  if(typeof D==="undefined"||!D||!D.classes)return;
  D.classes.forEach(function(c){
    if(!c.et||!ETAB.list.some(function(x){return x.id===c.et;})){c.et=cur.id;if(typeof dirty!=="undefined")dirty[c.id]=Date.now();ch=true;}
  });
  if(ch&&typeof save==="function")save();
}

function etabLoad(cb){
  if(!sb||!ME||GUEST||!navigator.onLine){if(cb)cb();return;}
  var mine=ME.id;
  sb.rpc("mes_etablissements").then(function(r){
    if(!ME||ME.id!==mine)return;
    if(r.error){ETAB.loaded=false;ETAB.unavailable=true;if(cb)cb();return;}   /* script SQL pas encore exécuté : l'appli fonctionne comme avant */
    ETAB.list=Array.isArray(r.data)?r.data:[];ETAB.loaded=true;ETAB.unavailable=false;
    var saved="";try{saved=localStorage.getItem(etabKey())||"";}catch(e){}
    ETAB.cur=ETAB.list.some(function(x){return x.id===saved;})?saved:(ETAB.list[0]?ETAB.list[0].id:"");
    etabApply();
    if(ETAB.list.some(function(x){return x.role==="admin";})&&typeof checkAdmin==="function")checkAdmin();
    if(cb)cb();
    sb.rpc("mes_messages_etab").then(function(m){   /* sans le script SQL v71 : aucun message, sans erreur */
      if(!ME||ME.id!==mine)return;
      ETAB.msgs=m.error||!Array.isArray(m.data)?[]:m.data;
      if(ETAB.msgs.length&&typeof render==="function"&&(view==="home"||view==="compte"))render();
    },function(){});
  },function(){ETAB.loaded=false;if(cb)cb();});
}

/* Exécute « créer » ou « rejoindre » ; cb(ok, message) */
function etabRun(it,cb){
  if(!sb||!ME){cb(false,"Connexion impossible. Vérifiez votre accès à internet.");return;}
  var p=it.mode==="create"?sb.rpc("creer_etablissement",{p_nom:it.nom||"",p_ville:it.ville||""}):sb.rpc("rejoindre_etablissement",{p_code:etabNorm(it.code)});
  p.then(function(r){
    if(r.error){cb(false,/function|schema cache|does not exist/i.test(r.error.message||"")?"Le serveur n’est pas encore prêt (script des établissements non installé).":"Action impossible pour le moment. Vérifiez internet puis réessayez.");return;}
    var d=r.data||{};
    if(!d.ok){cb(false,etabMsg(d.err));return;}
    etabLoad(function(){cb(true,"",d);});
  },function(){cb(false,"Pas de connexion internet. Réessayez dès que le réseau est revenu.");});
}

/* Après connexion : charge l'établissement, exécute l'intention de l'inscription, sinon affiche l'écran de rattachement */
function etabBoot(){
  etabReset();
  etabLoad(function(){
    var it=intentGet();
    if(it&&ME&&it.email&&it.email!==ME.login)it=null;
    if(ETAB.loaded&&!ETAB.list.length&&it){
      etabRun(it,function(ok,msg){intentSet(null);if(!ok)ETAB.err=msg;render();});
      return;
    }
    if(it&&ETAB.list.length)intentSet(null);
    render();
  });
}

/* ---------- Écran de rattachement (premier lancement, ou compte sans établissement) ---------- */
function etabModeBtns(mode,attr,labJ,labC){
  return'<p class="elab">Je m’inscris comme :</p><div class="emode" role="group" aria-label="Votre fonction">'+
    '<button type="button" '+attr+'="join" aria-pressed="'+(mode==="join")+'">'+labJ+'</button>'+
    '<button type="button" '+attr+'="create" aria-pressed="'+(mode==="create")+'">'+labC+'</button></div>';
}
function etabFields(mode,pre){
  pre=pre||{};
  return'<div class="ej"'+(mode==="join"?"":" hidden")+'><input class="ai afull" type="text" id="'+(pre.pf||"e")+'code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="Code de l’établissement" aria-label="Code de l’établissement" value="'+esc(pre.code||"")+'"><p class="ehint">Code à 8 caractères (ex. K7M2-QX4P) donné par votre chef d’établissement.</p></div>'+
    '<div class="ec"'+(mode==="create"?"":" hidden")+'><input class="ai afull" type="text" id="'+(pre.pf||"e")+'nom" autocomplete="organization" maxlength="120" placeholder="Nom de l’établissement" aria-label="Nom de l’établissement" value="'+esc(pre.nom||"")+'">'+
    '<input class="ai afull" type="text" id="'+(pre.pf||"e")+'vil" autocomplete="address-level2" maxlength="80" placeholder="Ville (facultatif)" aria-label="Ville" value="'+esc(pre.ville||"")+'"><p class="ehint">Ex. CG de Nsou. L’établissement doit être validé par un administrateur de Classe Master avant d’être activé.</p></div>';
}
function renderEtab(){
  var it=intentGet()||{},mode=it.mode==="create"?"create":"join";
  var body='<p class="eintro"><b>Votre compte est créé.</b> Choisissez maintenant votre type de compte. Un enseignant rejoint son établissement avec le code donné par son chef d’établissement ; un chef d’établissement crée l’établissement, qui doit ensuite être validé par un administrateur de Classe Master.</p>'+
    etabModeBtns(mode,"data-emode","Enseignant","Chef d’établissement")+
    etabFields(mode,{pf:"e",code:it.code?etabFmt(it.code):"",nom:it.nom,ville:it.ville})+
    '<p class="aerr" id="eerr" role="alert">'+esc(ETAB.err||"")+'</p>'+
    '<button class="abtn" id="ego">'+(mode==="create"?"Créer l’établissement":"Rejoindre l’établissement")+'</button>'+
    '<p class="aterms" id="enote"'+(mode==="create"?"":" hidden")+'>Votre établissement sera examiné et validé par un administrateur de Classe Master avant que vous puissiez utiliser le tableau de bord et le code des enseignants.</p>'+
    '<p class="afoot"><button class="alink" id="elout">Se déconnecter</button></p>';
  ETAB.err="";
  return authShell('Votre<br>établissement',body,true);
}

/* ---------- Carte « Établissement » du compte ---------- */
/* Écrire à un administrateur de Classe Master (page contact.html) : proposé à tout compte connecté, quel que soit l’état de l’établissement */
function etabCard(){
  if(!ME||GUEST||!sb)return"";
  return etabCardBase()+'<div class="card"><h2>Contacter un administrateur</h2><p class="sub" style="margin:0 0 10px">Une question, un problème, un code perdu, un établissement suspendu : écrivez à l’équipe Classe Master et retrouvez sa réponse sur la même page.</p><button class="btn ghost" id="contactbtn">Écrire à un administrateur</button></div>';
}
function etabCardBase(){
  var e=etabCur();
  if(!e){
    return ETAB.unavailable?'':'<div class="card"><h2>Établissement</h2><p class="sub" style="margin:0 0 8px">Votre compte n’est pas encore rattaché à un établissement.</p><button class="btn" data-go="etab-now">Choisir mon établissement</button></div>';
  }
  var adm=e.role==="admin";
  if(adm&&!etabValide(e)){
    var ref=etabStatut(e)==="refuse",sus=etabStatut(e)==="suspendu";
    if(sus)return'<div class="card"><h2>Établissement</h2><p style="margin:0 0 2px"><b>'+esc(e.nom)+'</b>'+(e.ville?' · '+esc(e.ville):'')+'</p><p class="sub" style="margin:0 0 10px">Suspendu</p><p class="sub" style="margin:0 0 10px">Un administrateur de Classe Master a suspendu cet établissement'+(e.motif?' : '+esc(e.motif):'')+'. Le tableau de bord, la gestion des enseignants et le code d’accès sont bloqués jusqu’à sa réactivation ; vos classes restent disponibles.</p><div class="bar"><button class="btn" id="etchk">Vérifier la réactivation</button></div></div>';
    return'<div class="card"><h2>Établissement</h2><p style="margin:0 0 2px"><b>'+esc(e.nom)+'</b>'+(e.ville?' · '+esc(e.ville):'')+'</p>'+
      '<p class="sub" style="margin:0 0 10px">'+(ref?'Demande refusée':'En attente de validation')+'</p>'+
      (ref?'<p class="sub" style="margin:0 0 10px">Un administrateur de Classe Master n’a pas validé cet établissement'+(e.motif?' : '+esc(e.motif):'')+'. Vous pouvez annuler cette demande et en faire une nouvelle.</p>'
          :'<p class="sub" style="margin:0 0 10px">Un administrateur de Classe Master doit valider votre établissement. Tant que ce n’est pas fait, le tableau de bord, la gestion des enseignants et le code d’accès restent verrouillés. Vous pouvez en attendant utiliser l’application comme enseignant.</p>')+
      '<div class="bar"><button class="btn" id="etchk">Vérifier la validation</button><button class="btn ghost" id="etcancel">Annuler la demande</button></div></div>';
  }
  var h='<div class="card"><h2>Établissement</h2><p style="margin:0 0 2px"><b>'+esc(e.nom)+'</b>'+(e.ville?' · '+esc(e.ville):'')+'</p><p class="sub" style="margin:0">'+(adm?'Administrateur':'Enseignant')+' · '+(e.membres||1)+' membre'+((e.membres||1)>1?'s':'')+'</p>';
  if(adm){
    h+='<div class="ecode"><span>Code d’accès des enseignants</span><b id="ecd">'+esc(etabFmt(e.code))+'</b></div>'+
      '<div class="bar" style="margin-top:10px"><button class="btn" id="etcp">Copier le code</button><button class="btn ghost" id="etsh">Envoyer</button></div>'+
      '<p class="sub" style="margin:10px 0 6px">Inscriptions avec ce code : <b>'+(e.ouvert===false?'fermées':'ouvertes')+'</b></p>'+
      '<div class="bar"><button class="btn ghost" id="etop">'+(e.ouvert===false?'Rouvrir':'Fermer')+' les inscriptions</button><button class="btn ghost" id="etnc">Nouveau code</button></div>'+
      '<p class="sub" style="margin:10px 0 0">Le tableau de bord, les élèves, les salles, les enseignants (retirer, nommer un autre chef) et le nom de l’établissement se gèrent sur la page <b>Gestion de l’établissement</b>.</p>';
  }else if(etabMembreAttente(e)){
    h+='<p class="sub" style="margin:10px 0 8px"><b>En attente d’acceptation.</b> Votre chef d’établissement doit accepter votre demande. Vous pouvez utiliser l’application pour vos classes en attendant ; les dossiers des élèves ne vous sont pas encore ouverts.</p><div class="bar"><button class="btn" id="etchk">Vérifier l’acceptation</button><button class="btn ghost" id="etquit">Annuler ma demande</button></div>';
  }else{
    h+='<p class="sub" style="margin:10px 0 8px">Vous gérez ici les classes de cet établissement. Pour en changer, quittez celui-ci puis rejoignez l’autre avec son code.</p><button class="btn ghost" id="etquit">Quitter l’établissement</button>';
  }
  return h+'</div>';
}

hookOn("pend",function(){
  var el=document.getElementById("pend");if(!el||!ME||GUEST||view==="reset"||view==="etab")return;
  var e=etabCur();if(!e||e.role!=="admin"||etabValide(e)||(view!=="home"&&view!=="compte"))return;
  el.innerHTML+='<div class="gban gban-w" role="status"><span>'+(etabStatut(e)==="suspendu"?'Votre établissement « '+esc(e.nom)+' » est suspendu.':etabStatut(e)==="refuse"?'Votre établissement n’a pas été validé.':'Votre établissement « '+esc(e.nom)+' » est en attente de validation par un administrateur.')+'</span><button class="btn ghost" data-go="compte">Détails</button></div>';
});

/* ---------- Clics ---------- */
function etabToggle(btn){
  var attr=btn.hasAttribute("data-smode")?"data-smode":"data-emode",mode=btn.getAttribute(attr),p=btn.closest(".apanel")||document;
  p.querySelectorAll(".emode button").forEach(function(b){b.setAttribute("aria-pressed",String(b===btn));});
  p.querySelectorAll(".ej").forEach(function(x){x.hidden=mode!=="join";});
  p.querySelectorAll(".ec").forEach(function(x){x.hidden=mode!=="create";});
  var nt=document.getElementById("enote");if(nt)nt.hidden=mode!=="create";
  var go=document.getElementById("ego");if(go)go.textContent=mode==="create"?"Créer l’établissement":"Rejoindre l’établissement";
}
function etabCall(fn,args,ok){
  if(!sb||ETAB.busy)return;
  ETAB.busy=true;
  sb.rpc(fn,args).then(function(r){
    ETAB.busy=false;
    if(r.error){toast("Action impossible pour le moment. Vérifiez internet puis réessayez.");return;}
    var d=r.data||{};
    if(d.ok===false){toast(etabMsg(d.err));return;}
    ok(d);
  },function(){ETAB.busy=false;toast("Pas de connexion internet.");});
}
function etabRefresh(){ETAB.mem=null;etabLoad(function(){render();});}
function etabClick(t){
  var e=etabCur(),b=t.closest?t.closest("button"):null;
  if(!b)return false;
  if(b.hasAttribute("data-smode")||b.hasAttribute("data-emode")){etabToggle(b);return true;}
  if(b.id==="elout"){doLogout();return true;}
  if(b.dataset.msgread){etabReadAdd(b.dataset.msgread);render();return true;}
  if(b.dataset.go==="etab-now"){ETAB.loaded=true;view="etab";render();return true;}
  if(b.id==="etchk"){etabRefresh();toast("Vérification en cours…");return true;}
  if(b.id==="etcancel"){
    if(!confirm("Annuler la demande pour cet établissement ? Vous pourrez ensuite choisir de nouveau votre type de compte."))return true;
    var cur=etabCur();if(!cur)return true;
    etabCall("etab_annuler_demande",{p_etab:cur.id},function(){ETAB.mem=null;etabLoad(function(){render();});});return true;
  }
  if(b.id==="ego"){
    var er=document.getElementById("eerr"),m=document.querySelector(".emode [aria-pressed=true]"),mode=m?(m.getAttribute("data-emode")||m.getAttribute("data-smode")||"join"):"join";
    var code=(document.getElementById("ecode")||{}).value||"",nom=(document.getElementById("enom")||{}).value||"",vil=(document.getElementById("evil")||{}).value||"";
    if(mode==="join"&&!etabCodeOk(code)){amsg(er,etabCodeMsg(code));return true;}
    if(mode==="create"&&nom.trim().length<2){amsg(er,etabMsg("bad_name"));return true;}
    amsg(er,"");b.disabled=true;
    etabRun(mode==="create"?{mode:"create",nom:nom.trim(),ville:vil.trim()}:{mode:"join",code:code},function(ok,msg,d){
      b.disabled=false;
      if(!ok){amsg(er,msg);return;}
      intentSet(null);view="home";render();window.scrollTo(0,0);
      toast(mode==="create"?"Demande envoyée : votre établissement est en attente de validation.":(d&&d.attente?"Demande envoyée : votre chef d’établissement doit vous accepter.":"Vous avez rejoint votre établissement."));
    });
    return true;
  }
  if(!e)return false;
  if(b.id==="etcp"){cmCopy(etabFmt(e.code),function(ok){toast(ok?"Code copié : "+etabFmt(e.code):"Copie impossible : notez le code affiché.");});return true;}
  if(b.id==="etsh"){
    var tx="Rejoignez « "+e.nom+" » sur Classe Master avec le code "+etabFmt(e.code)+" : "+location.origin+location.pathname.replace(/[^\/]*$/,"");
    if(navigator.share){navigator.share({text:tx}).then(function(){},function(){});}
    else cmCopy(tx,function(ok){toast(ok?"Message copié : collez-le dans WhatsApp ou un SMS.":"Copie impossible.");});
    return true;
  }
  if(b.id==="etnc"){
    if(!confirm("Créer un nouveau code ? L’ancien code ne fonctionnera plus. Les enseignants déjà inscrits restent membres."))return true;
    etabCall("etab_nouveau_code",{p_etab:e.id},function(){etabRefresh();toast("Nouveau code créé.");});return true;
  }
  if(b.id==="etop"){etabCall("etab_ouvrir",{p_etab:e.id,p_ouvert:e.ouvert===false},function(){etabRefresh();});return true;}
  if(b.id==="etquit"){
    if(!confirm("Quitter « "+e.nom+" » ? Vos classes restent dans votre compte, mais vous devrez rejoindre un établissement pour continuer."))return true;
    etabCall("etab_quitter",{p_etab:e.id},function(){ETAB.mem=null;etabLoad(function(){render();});});return true;
  }
  return false;
}

/* Bandeaux sur l’accueil : demande en attente, messages du chef d’établissement */
hookOn("pend",function(){
  var el=document.getElementById("pend");if(!el||!ME||GUEST||view==="reset"||view==="etab"||(view!=="home"&&view!=="compte"))return;
  var e=etabCur();
  if(etabMembreAttente(e))el.innerHTML+='<div class="gban gban-w" role="status"><span>Votre demande pour « '+esc(e.nom)+' » attend l’acceptation du chef d’établissement.</span><button class="btn ghost" data-go="compte">Détails</button></div>';
  etabMsgsNew().slice(0,3).forEach(function(m){
    el.innerHTML+='<div class="gban" role="status" style="border-radius:16px;padding:8px 8px 8px 14px"><span><b>'+esc(m.titre)+'</b> · '+esc(m.etab||"")+'<br>'+esc(m.corps)+'</span><button class="btn ghost" data-msgread="'+esc(m.id)+'">Lu</button></div>';
  });
});
