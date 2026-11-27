/* Programme de l'établissement, côté enseignant (v142, étape 41 : lecture ; v143, étape 42 : ajout au cahier).
   L'enseignant voit les leçons que son chef d'établissement a prévues pour sa classe, mois par mois, et peut les AJOUTER à son cahier de textes
   (c.pg) : toutes d'un coup ou mois par mois ; v144, étape 43 : il peut RETIRER de son cahier les leçons que le chef a retirées du programme.
   Rien n'est jamais écrit côté serveur.
   v145, étape 44 (hors ligne) : la dernière liste reçue est gardée sur l'appareil (30 jours, effacée à la déconnexion) ; sans réseau, on la montre avec sa date.
   Les ajouts restent possibles (ils se font dans le cahier) ; les RETRAITS ne sont proposés qu'avec une liste reçue du serveur à l'instant, jamais d'après une copie.
   Chaque leçon ajoutée garde le repère « e » = identifiant de la leçon de l'établissement : c'est lui qui évite les doublons (même si le chef
   renomme la leçon ou change son mois) et qui sert à retirer ce que le chef a retiré SANS toucher aux leçons écrites par l'enseignant. « o » = titre d'origine : une leçon dont l'enseignant a changé le titre est la sienne. Le serveur ne renvoie que les niveaux et matières de ses classes
   (fonction etab_programmes_liste, supabase/programmes-v106.sql). S'appuie sur js/cahier.js (CX_MOIS, CX_NOM, cxMonth) et js/etab.js (ETAB). */
var PGE={st:"idle",rows:[],err:"",etab:"",all:false,seq:0,copie:0};

/* ---------- Copie hors ligne : la dernière liste reçue, gardée sur cet appareil (par compte) ---------- */
var PGE_AGE=30*864e5,PGE_CHAMPS=["id","niveau","matiere","mois","titre","ordre","origine","auteur","mienne"];
function pgeCopieCle(){return ME?"cm-pge-"+ME.id:"";}
function pgeCopieLit(){
  try{
    var k=pgeCopieCle();if(!k)return null;
    var o=JSON.parse(localStorage.getItem(k)||"null");
    return o&&typeof o==="object"&&o.etab&&Array.isArray(o.rows)&&Date.now()-o.at<PGE_AGE?o:null;
  }catch(e){return null;}
}
function pgeCopieEcrit(etab,rows){
  try{
    var k=pgeCopieCle();if(!k)return;
    localStorage.setItem(k,JSON.stringify({etab:etab,at:Date.now(),rows:rows.map(function(x){var o={};PGE_CHAMPS.forEach(function(f){if(x[f]!==undefined)o[f]=x[f];});return o;})}));
  }catch(e){}   /* stockage plein ou refusé : tant pis, la lecture en ligne marche toujours */
}
function pgeCopieEfface(){
  try{var K=[],i,k;for(i=0;i<localStorage.length;i++){k=localStorage.key(i);if(k&&k.indexOf("cm-pge-")===0)K.push(k);}K.forEach(function(x){localStorage.removeItem(x);});}catch(e){}
}
/* Déconnexion, retrait du compte, accès retiré : plus de copie, plus de liste en mémoire */
function pgeReset(){pgeCopieEfface();PGE.seq++;PGE.st="idle";PGE.rows=[];PGE.err="";PGE.etab="";PGE.copie=0;PGE.all=false;}
function pgeDate(at){try{return new Date(at).toLocaleString("fr-FR",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"});}catch(e){return"";}}
/* Établissement dont on montre le programme : celui du compte ; sans réseau depuis le démarrage (la liste des établissements n'a pas pu être lue), celui de la copie */
function pgeEid(){var e=typeof etabCur==="function"?etabCur():null,c;if(e)return e.id;c=pgeCopieLit();return c?c.etab:"";}

function pgeOk(){
  if(!(ME&&!GUEST&&sb&&typeof ETAB!=="undefined"))return false;
  if(ETAB.loaded){var e=typeof etabCur==="function"?etabCur():null;return!!(e&&!etabMembreAttente(e));}
  return navigator.onLine===false&&!!pgeCopieLit();   /* hors ligne depuis le démarrage : seule une copie faite par un membre accepté ouvre l'écran */
}

/* Même niveau ? « 6e », « 6ème » et « 6 » se valent (niveaux.js) ; sinon on compare les textes sans majuscules ni espaces superflus */
function pgeNiv(a){var s=String(a==null?"":a).replace(/\s+/g," ").trim(),p=typeof nivParse==="function"?nivParse(s):null;return p?p.k:s.toLowerCase();}
function pgeLow(a){return String(a==null?"":a).replace(/\s+/g," ").trim().toLowerCase();}

/* Leçons de la classe ouverte : même niveau ; même matière si la classe en a une (sinon toutes les matières de ce niveau) */
function pgeRows(c,all){
  if(all)return PGE.rows.slice();
  var p=typeof nivParse==="function"?nivParse(c.name):null,nk=p?p.k:"",sj=pgeLow(c.subj);
  if(!nk)return PGE.rows.slice();   /* niveau non reconnu dans le nom de la classe : on montre tout ce que le serveur donne */
  return PGE.rows.filter(function(x){return pgeNiv(x.niveau)===nk&&(!sj||pgeLow(x.matiere)===sj);});
}

function pgeErr(e){
  var m=String((e&&e.message)||e||"").toLowerCase(),c=String((e&&e.code)||"");
  if(/not member/.test(m))return"Vous n’êtes pas (ou plus) membre actif de cet établissement.";
  if(c==="PGRST202"||c==="42883"||/could not find|does not exist|schema cache/.test(m))return"Les programmes ne sont pas encore installés côté serveur : demandez à votre chef d’établissement d’exécuter supabase/programmes-v106.sql.";
  if(!navigator.onLine||/failed to fetch|network|load failed/.test(m))return"Pas de connexion internet.";
  return"Le programme est indisponible pour le moment. Réessayez dans un instant.";
}
function pgeReseau(e){var m=String((e&&e.message)||e||"").toLowerCase();return!navigator.onLine||/failed to fetch|network|load failed/.test(m);}
function pgeCopieMontre(c){PGE.st="ok";PGE.err="";PGE.rows=c.rows;PGE.etab=c.etab;PGE.copie=c.at;}
function pgeLoad(){
  var id=pgeEid(),me=++PGE.seq,cp=pgeCopieLit();
  PGE.st="load";PGE.err="";PGE.etab=id;PGE.copie=0;
  if(cp&&cp.etab!==id)cp=null;
  if(!navigator.onLine){
    if(cp)pgeCopieMontre(cp);else{PGE.st="err";PGE.err="Pas de connexion internet et aucune copie du programme sur cet appareil : ouvrez-le une fois avec internet pour pouvoir le consulter ensuite sans réseau.";}
    return;
  }
  sb.rpc("etab_programmes_liste",{p_etab:id}).then(function(r){
    if(me!==PGE.seq)return;
    if(r.error){
      if(pgeReseau(r.error)&&cp)pgeCopieMontre(cp);   /* réseau coupé ou très mauvais : la dernière copie, avec sa date */
      else{PGE.st="err";PGE.err=pgeErr(r.error);PGE.rows=[];if(/not member/i.test(String(r.error.message||"")))pgeCopieEfface();}
    }else{PGE.st="ok";PGE.rows=Array.isArray(r.data)?r.data:[];pgeCopieEcrit(id,PGE.rows);}
    if(view==="progs")render();
  },function(){if(me!==PGE.seq)return;if(cp)pgeCopieMontre(cp);else{PGE.st="err";PGE.err="Pas de connexion internet.";}if(view==="progs")render();});
}

/* ---------- Ajout au cahier ---------- */
function pgeMo(x){return CX_MOIS.indexOf(x.mois)<0?"":x.mois;}
function pgeT(t){return nrm(String(t==null?"":t).replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g,"'").replace(/\s+/g," "));}   /* titre comparé sans accents, majuscules, espaces superflus ni différence ’ / ' (le chef colle souvent des apostrophes courbes) */
/* Une leçon de l'établissement est « déjà dans le cahier » si une leçon porte son repère, OU si l'enseignant a déjà écrit la même leçon (même titre, même mois) :
   dans ce second cas on ne touche à rien, la sienne reste la sienne. */
function pgeDeja(c,x){
  var P=pgList(c),t=pgeT(x.titre),m=pgeMo(x);
  return P.some(function(l){return l.e===x.id||(pgeT(l.t)===t&&(CX_MOIS.indexOf(l.m)<0?"":l.m)===m);});
}
/* Leçons à ajouter : celles de rows (éventuellement d'un seul mois) qui ne sont pas encore dans le cahier, dans l'ordre du chef */
function pgeNouvelles(c,rows,mo){
  return rows.filter(function(x){return(mo===undefined||pgeMo(x)===mo)&&!pgeDeja(c,x);}).sort(function(a,b){
    var ra=CX_MOIS.indexOf(pgeMo(a)),rb=CX_MOIS.indexOf(pgeMo(b));return(ra<0?99:ra)-(rb<0?99:rb)||(+a.ordre||0)-(+b.ordre||0);});
}
/* Ajoute les leçons au cahier de la classe c ; rend les identifiants créés (pour pouvoir annuler). Ne modifie ni ne supprime jamais une leçon existante. */
function pgeAjoute(c,L){
  var P=pgList(c),ids=[];
  L.forEach(function(x){
    if(pgeDeja(c,x))return;   /* garde-fou : deux clics rapides ou une liste qui se recoupe */
    /* identifiant stable (« e » + celui de la leçon de l'établissement) : si le programme est ajouté sur deux appareils avant la synchronisation,
       la fusion (merge.js) reconnaît la même leçon au lieu de la dupliquer */
    var o={id:"e"+x.id,t:String(x.titre),e:x.id,o:String(x.titre)},m=pgeMo(x);if(m)o.m=m;
    P.push(o);ids.push(o.id);
  });
  return ids;
}
/* Annule un ajout : retire seulement les leçons créées par lui, sauf si une séance s'y réfère déjà */
function pgeAnnule(c,ids){
  var S=ctList(c),n=0;
  c.pg=pgList(c).filter(function(l){
    if(ids.indexOf(l.id)<0||S.some(function(s){return s.p===l.id;})||l.x===true)return true;
    n++;return false;
  });
  return n;
}

/* ---------- Retrait des leçons que le chef a retirées ----------
   Une leçon du cahier qui porte un repère « e » absent de la liste reçue du serveur n'est plus au programme de l'établissement.
   On ne propose JAMAIS de retirer : une leçon sans repère (écrite par l'enseignant), une leçon déjà faite (cochée ou liée à une séance),
   une leçon dont l'enseignant a changé le titre. Rien n'est calculé tant que la liste n'a pas été reçue sans erreur, ni si elle est tronquée (5 000 leçons), ni si elle vient d'une copie hors ligne (elle peut être plus ancienne que le cahier : un autre appareil a pu y ajouter des leçons plus récentes). */
function pgeRetirees(c){
  var r={aRetirer:[],faites:[],perso:[],sur:false};
  if(PGE.st!=="ok"||PGE.copie||PGE.rows.length>=5000)return r;
  r.sur=true;
  var ids=Object.create(null);PGE.rows.forEach(function(x){ids[x.id]=1;});
  pgList(c).forEach(function(l){
    if(!l.e||ids[l.e])return;
    if(pgDone(c,l))r.faites.push(l);
    else if(l.o!==undefined&&l.t!==l.o)r.perso.push(l);
    else r.aRetirer.push(l);
  });
  return r;
}
/* Retire ces leçons du cahier ; rend { id de corbeille, n }. Même corbeille que le nettoyage du cahier : annulable 7 jours. */
function pgeRetire(c,L){
  var ids=Object.create(null);L.forEach(function(l){ids[l.id]=1;});
  var order=pgList(c).map(function(l){return l.id;}),P=pgList(c).filter(function(l){return ids[l.id];});
  if(!P.length)return null;
  c.pg=pgList(c).filter(function(l){return!ids[l.id];});
  var tid=trashAdd("cx","Leçons retirées du programme de l’établissement",c.id,{ct:[],pg:P,links:{},order:order});
  save();return{id:tid,n:P.length};
}
function pgeRetireCarte(c,R){
  if(!R.aRetirer.length&&!R.faites.length&&!R.perso.length)return"";
  var A=R.aRetirer,n=A.length,h='<div class="card"><h2>Retirées du programme</h2>';
  if(n){
    h+='<p class="sub" style="margin:0 0 6px">Votre chef d’établissement a retiré '+(n>1?"ces "+n+" leçons":"cette leçon")+' du programme. '+(n>1?"Elles sont":"Elle est")+' encore dans votre cahier :</p><ul style="margin:0 0 8px;padding-left:18px">'+
      A.slice(0,5).map(function(l){return"<li>"+esc(l.t)+(CX_MOIS.indexOf(l.m)>=0?' <small style="color:var(--mute)">('+esc(CX_NOM[l.m])+')</small>':"")+"</li>";}).join("")+(n>5?"<li>… et "+(n-5)+" autre"+(n-5>1?"s":"")+"</li>":"")+'</ul>'+
      '<button class="btn ghost" data-pgerm="1">Les retirer de mon cahier ('+n+')</button>';
  }
  var g=[];
  if(R.faites.length)g.push(R.faites.length+(R.faites.length>1?" leçons déjà faites":" leçon déjà faite"));
  if(R.perso.length)g.push(R.perso.length+(R.perso.length>1?" leçons dont vous avez changé le titre":" leçon dont vous avez changé le titre"));
  if(g.length)h+='<p class="sub" style="margin:'+(n?"8px":"0")+' 0 0">'+(n?"Conservées : ":"Plus au programme, mais conservées : ")+g.join(" et ")+'.</p>';
  return h+'</div>';
}

/* Carte placée dans le cahier de textes de la classe */
function pgeCard(){
  if(!pgeOk())return"";
  return'<div class="card"><h2>Programme de l’établissement</h2><p class="sub" style="margin-top:0">Les leçons prévues par votre chef d’établissement pour cette classe, mois par mois : vous les ajoutez à votre cahier en un geste.</p><button class="btn ghost" data-go="progs">Voir le programme</button></div>';
}

function pgeLecon(x,c){
  var ens=x.origine==="enseignant",au=String(x.auteur||"").trim(),deja=!!c&&pgeDeja(c,x);
  return'<div class="row"><span style="flex:1"><b>'+esc(x.titre)+'</b>'+(ens?'<small style="display:block;color:var(--mute)">'+(x.mienne?"Ajoutée par vous":"Ajoutée par "+esc(au||"un collègue"))+'</small>':'')+'</span>'+(deja?'<span class="tg ok">dans mon cahier</span>':'')+'</div>';
}
function pgeCle(x){return pgeNiv(x.niveau)+"|"+pgeLow(x.matiere);}
function pgeMois(rows,key,c,peut){
  var now=typeof cxMoisNow==="function"?cxMoisNow():"",out="";
  CX_MOIS.concat([""]).forEach(function(mo){
    var L=rows.filter(function(x){return(CX_MOIS.indexOf(x.mois)<0?"":x.mois)===mo;}).sort(function(a,b){return(+a.ordre||0)-(+b.ordre||0);});
    if(!L.length)return;
    var k="g|"+key+"|"+mo;
    var nv=pgeNouvelles(c,L).length,btn=peut&&nv?'<div class="bar" style="margin:8px 0 0"><button class="btn" data-pgeadd="'+esc(pgeCle(L[0])+"|"+mo)+'">Ajouter '+(nv>1?"les "+nv+" nouvelles":"la nouvelle")+' à mon cahier</button></div>':"";
    out+=cxMonth(k,mo?CX_NOM[mo]:"Sans mois",L.length+" leçon"+(L.length>1?"s":"")+(nv?" · "+nv+" à ajouter":(L.length?" · toutes dans le cahier":"")),cxIsOpen(k,mo===now),L.map(function(x){return pgeLecon(x,c);}).join("")+btn);
  });
  return out;
}

function renderProgs(){
  var c=cl(),h='<h1 style="text-transform:none">Programme de l’établissement</h1><p class="sub">'+esc(c.name)+(c.subj?' · '+esc(c.subj):'')+'</p>';
  if(!pgeOk())return h+'<div class="card"><p class="sub" style="margin:0">Le programme est disponible quand votre compte est rattaché à un établissement et accepté par son chef.</p></div>';
  if(PGE.st==="idle"||PGE.etab!==pgeEid())pgeLoad();
  if(PGE.st==="load")return h+'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
  if(PGE.st==="err")return h+'<div class="card"><p class="sub" style="margin:0 0 8px">'+esc(PGE.err)+'</p><button class="btn ghost" data-pgere="1">Réessayer</button></div>';
  var rows=pgeRows(c,PGE.all),peut=!PGE.all&&!isArch(c),nvTot=peut?pgeNouvelles(c,rows).length:0;
  if(PGE.copie)h+='<div class="card"><p class="sub" style="margin:0"><b>Copie du '+esc(pgeDate(PGE.copie))+'.</b> Vous voyez la dernière liste reçue : votre chef a peut-être changé le programme depuis. Vous pouvez ajouter des leçons à votre cahier ; les retraits sont proposés seulement avec une liste à jour, en ligne.</p></div>';
  if(!isArch(c))h+=pgeRetireCarte(c,pgeRetirees(c));
  if(rows.length){
    h+='<div class="card"><p class="sub" style="margin:0 0 8px">'+(PGE.all?"Pour ajouter des leçons à votre cahier, revenez à « Seulement cette classe » : elles sont ajoutées à la classe ouverte.":
      isArch(c)?"Cette classe est archivée : elle ne reçoit plus de leçons.":
      rows.length+" leçon"+(rows.length>1?"s":"")+" au programme · "+(rows.length-pgeNouvelles(c,rows).length)+" déjà dans votre cahier · "+nvTot+" à ajouter.")+'</p>'+
      (nvTot?'<button class="btn" data-pgeadd="*">Ajouter les '+nvTot+' nouvelle'+(nvTot>1?"s":"")+' à mon cahier</button>':'')+'</div>';
  }
  h+='<div class="bar" style="margin:0 0 10px">'+
    (PGE.all?'<button class="btn ghost" data-pgeall="0">Seulement cette classe</button>':'<button class="btn ghost" data-pgeall="1">Tous mes niveaux et matières</button>')+
    '<button class="btn ghost" data-pgere="1">Actualiser</button></div>';
  if(!rows.length){
    return h+'<div class="card"><p class="sub" style="margin:0">'+(PGE.rows.length?"Aucune leçon n’est prévue pour cette classe. Touchez « Tous mes niveaux et matières » pour voir le reste.":"Votre chef d’établissement n’a pas encore saisi de programme.")+'</p></div>';
  }
  /* regroupement niveau > matière (sans majuscules ni espaces superflus) puis mois */
  var G=Object.create(null),order=[];
  rows.forEach(function(x){
    var nv=String(x.niveau||"").trim(),mt=String(x.matiere||"").trim(),k=pgeNiv(nv)+"|"+pgeLow(mt);   /* 6e et 6ème : un seul bloc */
    if(!G[k]){G[k]={nv:nv,mt:mt,rows:[]};order.push(k);}
    G[k].rows.push(x);
  });
  order.sort(function(a,b){return G[a].nv.localeCompare(G[b].nv,"fr",{numeric:true})||G[a].mt.localeCompare(G[b].mt,"fr");});
  order.forEach(function(k){
    var g=G[k];
    h+='<div class="card"><h2>'+esc(g.mt||"(sans matière)")+' <span class="sub" style="font-weight:500">· '+esc(g.nv||"(sans niveau)")+' · '+g.rows.length+' leçon'+(g.rows.length>1?"s":"")+'</span></h2>'+pgeMois(g.rows,k,c,peut)+'</div>';
  });
  return h;
}

document.getElementById("view").addEventListener("click",function(e){
  if(view!=="progs")return;
  var t=e.target.closest?e.target.closest("[data-pgeall],[data-pgere],[data-pgeadd],[data-pgerm]"):null;if(!t)return;
  var y=window.scrollY;
  if(t.hasAttribute("data-pgerm")){pgeClicRetire();render();window.scrollTo(0,y);return;}
  if(t.hasAttribute("data-pgeadd")){pgeClic(t.getAttribute("data-pgeadd"));render();window.scrollTo(0,y);return;}
  if(t.hasAttribute("data-pgeall"))PGE.all=t.getAttribute("data-pgeall")==="1";
  else PGE.st="idle";
  render();window.scrollTo(0,y);
});

/* « * » = tout le programme de la classe ; « niveau|matière|mois » = un mois d'une matière */
function pgeClic(cle){
  var c=cl();if(PGE.st!=="ok"||PGE.all||isArch(c))return;
  var rows=pgeRows(c,false),L;
  if(cle==="*")L=pgeNouvelles(c,rows);
  else{var p=String(cle).split("|"),mo=p.pop(),k=p.join("|");L=pgeNouvelles(c,rows.filter(function(x){return pgeCle(x)===k;}),mo);}
  var ids=pgeAjoute(c,L);
  if(!ids.length){toast("Rien à ajouter : tout est déjà dans votre cahier.");return;}
  save();
  toast(ids.length+" leçon"+(ids.length>1?"s ajoutées":" ajoutée")+" au cahier de "+c.name+".","Annuler",function(){
    var n=pgeAnnule(c,ids);save();toast(n+" leçon"+(n>1?"s retirées":" retirée")+" du cahier.");if(view==="progs"||view==="cahier")render();
  });
}

function pgeClicRetire(){
  var c=cl();if(PGE.st!=="ok"||PGE.copie||isArch(c))return;
  var A=pgeRetirees(c).aRetirer;if(!A.length)return;
  var liste=A.slice(0,5).map(function(l){return"« "+l.t+" »";}).join(", ")+(A.length>5?" et "+(A.length-5)+" autre"+(A.length-5>1?"s":""):"");
  if(!confirm("Retirer "+(A.length>1?"ces "+A.length+" leçons":"cette leçon")+" du cahier de "+c.name+" ? "+liste+". Les leçons que vous avez écrites ou dont vous avez changé le titre, et celles déjà faites, restent. Vous pourrez annuler juste après, ou depuis la corbeille (7 jours)."))return;
  var r=pgeRetire(c,A);if(!r)return;
  toast(r.n+" leçon"+(r.n>1?"s retirées":" retirée")+" du cahier de "+c.name+".","Annuler",function(){undoTrash(r.id);});
}
