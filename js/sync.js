/* Synchronisation avec Supabase (table « classes », une ligne par classe) */
var sending={},pushed={},sgen=0,chan=null,hid=0;

function setSync(t){document.getElementById("sync").textContent=(who?"Connecté : "+who+" · ":"")+t;}
var SYNC_KO="Synchronisation impossible : vos données restent sur cet appareil",pullT=null;
/* Détail technique de l’échec, affiché à la suite du message pour savoir quoi corriger */
function syncKo(e){
  var d="";
  if(e){d=String(e.code||e.status||"");var m=String(e.message||"");if(m)d+=(d?" · ":"")+m;}
  if(!navigator.onLine)d="pas d’internet";
  setSync(SYNC_KO+(d?" ("+d.slice(0,140)+")":""));
}
function retryPull(mine,first){clearTimeout(pullT);pullT=setTimeout(function(){if(col===mine)pull(first);},15000);}

/* Classes modifiées mais pas encore envoyées : conservées sur l’appareil pour ne rien perdre hors connexion */
function dkey(){return KEY?KEY+"-dirty":"";}
function persistDirty(){var k=dkey();if(!k)return;try{var a=Object.keys(dirty);if(a.length)localStorage.setItem(k,JSON.stringify(a));else localStorage.removeItem(k);}catch(e){}}
function loadDirty(){var k=dkey();if(!k)return;try{var a=JSON.parse(localStorage.getItem(k)||"[]");if(Array.isArray(a))a.forEach(function(id){if(typeof id==="string"&&!dirty[id])dirty[id]=Date.now();});}catch(e){}}

function hasCls(c){return!!((c.students&&c.students.length)||Object.keys(c.records||{}).length);}
/* Cahier de textes, programme, carnet et appréciations : rangés dans la colonne « th » (clé « x »), sans changer la base */
var XK=["cr","ct","pg","bc"];
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

function pushNow(){
  if(!col||!sb)return;
  var mine=col;
  Object.keys(dirty).forEach(function(id){
    if(sending[id])return;
    var ts=Date.now(),c=D.classes.find(function(x){return x.id===id}),p;
    sending[id]=ts;
    p=c?sb.from("classes").upsert(toRow(c,mine.uid,ts),{onConflict:"user_id,id"}):sb.from("classes").delete().eq("id",id);
    p.then(function(r){
      delete sending[id];
      if(col!==mine)return;
      if(r.error){syncKo(r.error);clearTimeout(timer);timer=setTimeout(pushNow,15000);return;}
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

/* Lecture complète des classes en ligne. first : première connexion de cette session. */
function pull(first){
  var mine=col;if(!mine||!sb)return;
  var t0=Date.now();
  sb.from("classes").select("*").then(function(r){
    if(col!==mine)return;
    if(r.error){syncKo(r.error);retryPull(mine,first);return;}
    var ids={},ch=false;
    r.data.forEach(function(v){ids[v.id]=1;});
    if(!r.data.length&&first){
      /* Compte vide en ligne : on envoie ce qui existe sur l’appareil */
      D.classes.forEach(function(c){if(hasCls(c))dirty[c.id]=Date.now();});
      persistDirty();
      if(Object.keys(dirty).length)pushNow();else setSync("Synchronisé entre vos appareils");
      return;
    }
    var keep=[];
    D.classes.forEach(function(c){
      if(ids[c.id]||dirty[c.id]||sending[c.id]||(pushed[c.id]||0)>t0-5000){keep.push(c);return;}
      if(first&&hasCls(c)){dirty[c.id]=Date.now();keep.push(c);return;}   /* données locales jamais envoyées */
      ch=true;                                                              /* supprimée ailleurs, ou classe vide */
    });
    D.classes=keep;
    r.data.forEach(function(v){
      var id=v.id;
      if(dirty[id]||sending[id])return;
      if((Date.parse(v.updated_at)||0)<=(pushed[id]||0))return;
      var n=fromRow(v),i=D.classes.findIndex(function(c){return c.id===id});
      if(i<0){D.classes.push(n);ch=true;}
      else if(!sameCls(D.classes[i],n)){D.classes[i]=n;ch=true;}
    });
    persistDirty();
    if(Object.keys(dirty).length)pushNow();
    finSync(ch);
  },function(e){if(col===mine){syncKo(e);retryPull(mine,first);}});
}

/* Changement reçu en direct depuis un autre appareil */
function onChange(p,mine){
  if(col!==mine)return;
  var o=p.old||{},n=p.new||{},id=n.id||o.id;
  if(!id||dirty[id]||sending[id])return;
  var i=D.classes.findIndex(function(c){return c.id===id}),ch=false;
  if(p.eventType==="DELETE"){
    if(o.user_id&&o.user_id!==mine.uid)return;
    if(i>=0){D.classes.splice(i,1);ch=true;}
  }else{
    if((Date.parse(n.updated_at)||0)<=(pushed[id]||0))return;
    var c=fromRow(n);
    if(i<0){D.classes.push(c);ch=true;}
    else if(!sameCls(D.classes[i],c)){D.classes[i]=c;ch=true;}
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
  chan=null;col=null;dirty={};sending={};pushed={};clearTimeout(timer);clearTimeout(pullT);who="";
}
function initSync(){
  stopSync();var g=sgen;
  if(!ME)return;
  loadDirty();
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
