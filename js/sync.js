/* Synchronisation avec Supabase (table « classes », une ligne par classe) */
var sending={},pushed={},sgen=0,chan=null,hid=0;
/* Fusion entre appareils : rv = version en ligne connue de chaque classe, bases = dernière version commune, cf = conflits récents */
var rv={},bases={},cf={},baseT=null;

/* Barre d'état : ligne pleine = connecté et synchronisé ; ligne qui avance = connexion / envoi en cours ; ligne vide = hors connexion ou appareil seul. Le texte reste en infobulle et pour les lecteurs d'écran. */
function setSync(t){
  var e=document.getElementById("sync"),lab=(who?"Connecté : "+who+" · ":"")+t,
      ok=!!who&&/^Synchronisé/.test(t),busy=!!who&&!ok&&/^(Connexion en cours|Synchronisation…)/.test(t),
      m=/(\d+) classes sur (\d+)/.exec(t),pc=ok?100:busy?(m&&+m[2]?Math.max(8,Math.round(100*m[1]/m[2])):0):0;
  e.className="sync "+(ok?"on":busy?"busy"+(pc?" det":""):"off");
  e.innerHTML="<i></i>";e.firstChild.style.width=pc?pc+"%":"";
  e.setAttribute("role","img");e.setAttribute("aria-label",lab);e.title=lab;
  hookRun("sync",t);
}
var SYNC_KO="Synchronisation impossible : vos données restent sur cet appareil",pullT=null;
/* Détail technique de l’échec, affiché à la suite du message pour savoir quoi corriger */
function syncKo(e){
  var d="";
  if(e){d=frErr(e);var cd=String(e.code||e.status||"");if(cd)d+=" · code "+cd;}
  if(!navigator.onLine)d="pas d’internet";
  setSync(SYNC_KO+(d?" ("+d.slice(0,140)+")":""));
}
function retryPull(mine,first){clearTimeout(pullT);pullT=setTimeout(function(){if(col===mine)pull(first);},15000);}

/* Classes modifiées mais pas encore envoyées : conservées sur l’appareil pour ne rien perdre hors connexion */
function dkey(){return KEY?KEY+"-dirty":"";}
function persistDirty(){var k=dkey();if(!k)return;try{var a=Object.keys(dirty);if(a.length)kvSet(k,JSON.stringify(a));else kvDel(k);}catch(e){if(typeof stoFail==="function")stoFail(e);}}
function loadDirty(){var k=dkey();if(!k)return;try{var a=JSON.parse(kvGet(k)||"[]");if(Array.isArray(a))a.forEach(function(id){if(typeof id==="string"&&!dirty[id])dirty[id]=Date.now();});}catch(e){}}

function hasCls(c){return!!((c.students&&c.students.length)||Object.keys(c.records||{}).length);}
/* Cahier de textes, programme, carnet et appréciations : rangés dans la colonne « th » (clé « x »), sans changer la base */
var XK=["cr","ct","pg","bc","tt","pa","et"];
function xPack(c){var x={};XK.forEach(function(k){var v=c[k];if(v&&(Array.isArray(v)?v.length:Object.keys(v).length))x[k]=v;});return x;}
function thRow(c){var o={},b=c.th||{a:3,r:3},k;for(k in b)o[k]=b[k];var x=xPack(c);if(Object.keys(x).length)o.x=x;return o;}
function xUnpack(n){
  var x=n.th&&n.th.x,t={},k;
  if(!x)return n;
  XK.forEach(function(q){if(x[q])n[q]=x[q];});
  for(k in n.th)if(k!=="x")t[k]=n.th[k];
  n.th=t;return n;
}
function toRow(c,uid,ts){return{user_id:uid,id:c.id,name:c.name,subj:c.subj||"",students:c.students||[],records:c.records||{},notes:c.notes||{},ev:c.ev||[],ob:c.ob||[],th:thRow(c),updated_at:new Date(ts).toISOString()};}
function fromRow(v){return xUnpack({id:v.id,name:v.name||"Classe",students:v.students||[],records:v.records||{},notes:v.notes||{},ev:v.ev||[],ob:v.ob||[],th:v.th||{a:3,r:3},subj:v.subj||""});}
function sameCls(o,n){return JSON.stringify([o.name,o.students,o.records,o.notes||{},o.ev||[],o.ob||[],th(o),o.subj||"",xPack(o)])===JSON.stringify([n.name,n.students,n.records,n.notes||{},n.ev||[],n.ob||[],th(n),n.subj||"",xPack(n)]);}

/* Dernière version commune de chaque classe, gardée sur l’appareil pour fusionner après un travail hors connexion */
function bkey(){return KEY?KEY+"-base":"";}
function loadBases(){var k=bkey();if(!k)return;try{var o=JSON.parse(kvGet(k)||"{}");if(o&&typeof o==="object"&&!Array.isArray(o))bases=o;}catch(e){}}
function persistBases(){
  var k=bkey();if(!k)return;
  try{var b=bases;kvSet(k,function(){return JSON.stringify(b);});}catch(e){if(typeof stoFail==="function")stoFail(e);}   /* l’écriture est regroupée par idb.js */
}
var CKEYS=["name","subj","students","records","notes","ev","ob","th"].concat(XK);
function canon(c){return JSON.parse(JSON.stringify(fromRow(toRow(c,"",0))));}
function clsIdx(id){return D.classes.findIndex(function(c){return c.id===id;});}

/* Fusionne la version en ligne v avec la classe locale (modifiée hors connexion ou pas encore envoyée) */
function mergeLocal(i,v){
  var c=D.classes[i],id=c.id,rem=JSON.parse(JSON.stringify(fromRow(v))),n0=MG.n,m=m3(bases[id],canon(c),rem),out=Object.assign({},c);
  CKEYS.forEach(function(k){if(m[k]!==undefined)out[k]=m[k];else delete out[k];});
  D.classes[i]=out;bases[id]=rem;rv[id]=v.updated_at;persistBases();
  return MG.n-n0;
}
/* Prend en compte une version en ligne : remplace, fusionne si la classe a des modifications locales. Renvoie true si l’écran doit changer. */
function adopt(v){
  var id=v.id,i=clsIdx(id),n,b,old;
  if(sending[id])return false;
  if(rv[id]&&Date.parse(v.updated_at)===Date.parse(rv[id]))return false;   /* version déjà connue (écho de notre envoi) */
  n=fromRow(v);
  if(i>=0&&dirty[id]){
    old=canon(D.classes[i]);
    var k=mergeLocal(i,v),chg;
    if(sameCls(D.classes[i],n))delete dirty[id];
    chg=!dEq(old,canon(D.classes[i]));
    if(chg)toast("Les modifications faites sur votre autre appareil ont été fusionnées avec les vôtres."+(k?" "+k+" valeur"+(k>1?"s":"")+" modifiée"+(k>1?"s":"")+" des deux côtés : la vôtre a été gardée.":""));
    else if(k)toast(k+" valeur"+(k>1?"s":"")+" modifiée"+(k>1?"s":"")+" des deux côtés : la vôtre a été gardée.");
    return chg;
  }
  b=JSON.parse(JSON.stringify(n));
  rv[id]=v.updated_at;bases[id]=b;persistBases();
  if(i>=0&&!n.tt&&D.classes[i].tt&&D.classes[i].tt.length){n.tt=D.classes[i].tt;dirty[id]=Date.now();}
  if(i<0){D.classes.push(n);return true;}
  if(!sameCls(D.classes[i],n)){D.classes[i]=n;return true;}
  return false;
}
/* L’envoi a été refusé parce que la version en ligne a changé : on récupère, on fusionne, puis on renvoie */
function conflict(id){
  cf[id]=(cf[id]||0)+1;
  clearTimeout(pullT);
  /* On ne force jamais l’envoi : la version de l’autre appareil n’est donc jamais écrasée.
     Après quelques refus, on patiente de plus en plus longtemps avant de refusionner. */
  if(cf[id]>=6)setSync("Synchronisation en attente : une autre modification est en cours sur un autre appareil");
  var wait=cf[id]<3?0:Math.min((cf[id]-2)*3000,30000);
  if(wait)pullT=setTimeout(function(){pull(false);},wait);else pull(false);
}

function pushNow(){
  if(!col||!sb)return;
  var mine=col;
  Object.keys(dirty).forEach(function(id){
    if(sending[id])return;
    var ts=Date.now(),c=D.classes.find(function(x){return x.id===id}),p,snap=null,row;
    sending[id]=ts;
    if(c){
      snap=canon(c);row=toRow(c,mine.uid,ts);
      if(rv[id]){
        /* envoi conditionnel : refusé si un autre appareil a envoyé une version entre-temps */
        var u=Object.assign({},row);delete u.user_id;delete u.id;
        p=sb.from("classes").update(u).eq("user_id",mine.uid).eq("id",id).eq("updated_at",rv[id]).select("updated_at");
      }else p=sb.from("classes").insert(row).select("updated_at");
    }else p=sb.from("classes").delete().eq("id",id);
    p.then(function(r){
      delete sending[id];
      if(col!==mine)return;
      if(r.error){
        if(c&&r.error.code==="23505"){delete rv[id];conflict(id);return;}   /* la classe existe déjà en ligne */
        syncKo(r.error);clearTimeout(timer);timer=setTimeout(pushNow,15000);return;
      }
      if(c&&rv[id]&&(!r.data||!r.data.length)){conflict(id);return;}   /* version en ligne différente */
      cf[id]=0;
      if(c){rv[id]=(r.data&&r.data[0]&&r.data[0].updated_at)||new Date(ts).toISOString();bases[id]=snap;}
      else{delete rv[id];delete bases[id];}
      persistBases();
      pushed[id]=ts;
      if(dirty[id]&&dirty[id]<=ts)delete dirty[id];
      persistDirty();
      if(dirty[id]){clearTimeout(timer);timer=setTimeout(pushNow,300);}
      else if(!Object.keys(dirty).length)setSync("Synchronisé entre vos appareils");
    },function(e){delete sending[id];if(col===mine){syncKo(e);clearTimeout(timer);timer=setTimeout(pushNow,15000);}});
  });
}

function finSync(ch){
  if(!D.classes.length){D.classes.push({id:uid(),name:"Ma classe",students:[],records:{},notes:{}});ch=true;}
  if(!D.classes.some(function(c){return c.id===D.cur})){D.cur=D.classes[0].id;ch=true;}
  if(ch){local();var a=document.activeElement;if(!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))render();}
  if(!Object.keys(dirty).length)setSync("Synchronisé entre vos appareils");
}

/* Lecture des classes en ligne, en plusieurs petites requêtes :
   1) la liste légère (identifiant + date de version) de toutes les classes ;
   2) puis seulement les classes dont la version a changé, PULL_N à la fois.
   Une classe déjà à jour n’est donc plus retéléchargée à chaque reprise. first : première connexion de cette session. */
var PULL_N=4;
function pull(first){
  var mine=col;if(!mine||!sb)return;
  var t0=Date.now();
  function ko(e){if(col===mine){syncKo(e);retryPull(mine,first);}}
  sb.from("classes").select("id,updated_at").then(function(r){
    if(col!==mine)return;
    if(r.error){ko(r.error);return;}
    var list=r.data||[],need=[],rows=[];
    list.forEach(function(v){if(!(rv[v.id]&&Date.parse(v.updated_at)===Date.parse(rv[v.id])))need.push(v.id);});
    (function more(a){
      if(a>=need.length){apply(list,rows);return;}
      if(need.length>PULL_N)setSync("Synchronisation… "+Math.min(a+PULL_N,need.length)+" classes sur "+need.length);
      sb.from("classes").select("*").in("id",need.slice(a,a+PULL_N)).then(function(r2){
        if(col!==mine)return;
        if(r2.error){ko(r2.error);return;}
        rows=rows.concat(r2.data||[]);more(a+PULL_N);
      },ko);
    })(0);
  },ko);
  function apply(list,rows){
    var ids={},ch=false;
    list.forEach(function(v){ids[v.id]=1;});
    if(!list.length&&first){
      /* Compte vide en ligne : on envoie ce qui existe sur l’appareil */
      D.classes.forEach(function(c){if(hasCls(c))dirty[c.id]=Date.now();});
      persistDirty();
      if(Object.keys(dirty).length)pushNow();else setSync("Synchronisé entre vos appareils");
      return;
    }
    var keep=[];
    D.classes.forEach(function(c){
      if(ids[c.id]||dirty[c.id]||sending[c.id]||(pushed[c.id]||0)>t0-5000){
        if(!ids[c.id]&&dirty[c.id]&&!sending[c.id])delete rv[c.id];   /* supprimée en ligne mais modifiée ici : on la renvoie */
        keep.push(c);return;
      }
      if(first&&hasCls(c)){dirty[c.id]=Date.now();delete rv[c.id];keep.push(c);return;}   /* données locales jamais envoyées */
      delete rv[c.id];delete bases[c.id];
      ch=true;                                                              /* supprimée ailleurs, ou classe vide */
    });
    D.classes=keep;
    rows.forEach(function(v){if(adopt(v))ch=true;});
    persistDirty();persistBases();
    if(Object.keys(dirty).length)pushNow();
    finSync(ch);
  }
}

/* Changement reçu en direct depuis un autre appareil */
function onChange(p,mine){
  if(col!==mine)return;
  var o=p.old||{},n=p.new||{},id=n.id||o.id;
  if(!id||sending[id])return;
  var i=clsIdx(id),ch=false;
  if(p.eventType==="DELETE"){
    if(dirty[id])return;
    if(o.user_id&&o.user_id!==mine.uid)return;
    if(i>=0){D.classes.splice(i,1);delete rv[id];delete bases[id];persistBases();ch=true;}
  }else{
    ch=adopt(n);
    if(dirty[id]){persistDirty();clearTimeout(timer);timer=setTimeout(pushNow,300);}
  }
  finSync(ch);
}

function startSync(){
  var mine=col,subs=0;
  pull(true);
  chan=sb.channel("classes-"+mine.uid).on("postgres_changes",{event:"*",schema:"public",table:"classes",filter:"user_id=eq."+mine.uid},function(p){onChange(p,mine);}).subscribe(function(st){
    if(col!==mine)return;
    if(st==="SUBSCRIBED"&&subs++>0)pull(false);   /* reconnexion : on rattrape ce qui a été manqué */
  });
}

function stopSync(){
  sgen++;
  if(chan&&sb){try{sb.removeChannel(chan);}catch(e){}}
  chan=null;col=null;dirty={};sending={};pushed={};rv={};bases={};cf={};clearTimeout(timer);clearTimeout(pullT);who="";
}
function initSync(){
  stopSync();var g=sgen;
  if(!ME)return;
  loadDirty();loadBases();
  setSync("Enregistrement sur cet appareil uniquement");
  if(!sb)return;
  sb.auth.getSession().then(function(r){
    var s=r.data&&r.data.session;
    if(g!==sgen)return;
    if(!s||!s.user||s.user.id!==ME.id){setSync("Hors connexion : vos données restent sur cet appareil");return;}
    if(ME.resync){delete ME.resync;saveAcc();}if(ME.pending&&ME.id===s.user.id){delete ME.pending;saveAcc();}updPend();who=ME.name;col={uid:s.user.id};setSync("Connexion en cours…");startSync();
  },function(){});
}

window.addEventListener("online",function(){if(!ME)return;if(col){pushNow();pull(false);}else initSync();});
document.addEventListener("visibilitychange",function(){
  if(document.hidden){hid=Date.now();return;}
  if(col&&hid&&Date.now()-hid>120000){pull(false);pushNow();}
});
document.getElementById("view").addEventListener("keydown",function(e){
  if(e.key!=="Enter"||e.target.tagName!=="INPUT")return;
  var m={li:"lgin",lw:"lgin",sfn:"sgo",sln:"sgo",sid:"sgo",spw:"sgo",cp0:"cpw",cp1:"cpw",cp2:"cpw",rsp1:"rsgo",rsp2:"rsgo"},b=m[e.target.id];
  if(b){e.preventDefault();var x=document.getElementById(b);if(x)x.click();}
});
