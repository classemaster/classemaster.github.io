/* Rappels d’appel : bandeau « Appel non fait » sur l’accueil et notifications facultatives
   (séance qui va commencer, appel oublié après la séance), d’après l’emploi du temps de chaque classe.
   Les notifications ne partent que lorsque l’application est ouverte ou installée et en cours d’exécution :
   il n’y a pas de serveur d’envoi, donc rien ne sort de l’appareil. Le choix est gardé sur l’appareil. */
var RPK="classemaster-rappels",RPV="classemaster-rappels-vus";
var RP_AVANT=5;      /* minutes avant le début d’une séance */
var RP_APRES=10;     /* minutes après la fin d’une séance sans appel */
var RP_FENETRE=120;  /* au-delà de ce délai après la fin, plus de notification (le bandeau reste affiché) */

function rpOn(){try{return localStorage.getItem(RPK)==="1";}catch(e){return false;}}
function rpSupported(){return typeof Notification!=="undefined";}
function rpPerm(){return rpSupported()?Notification.permission:"denied";}
function rpDay(now){return now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");}

/* Séances du jour concernées à cet instant : [{c, x, kind}]
   kind « start »  : la séance commence dans 5 minutes ou moins et l’appel n’est pas fait ;
   kind « missed » : la séance est terminée et l’appel n’a pas été fait. */
function rpDue(now){
  now=now||new Date();
  var dow=now.getDay(),nm=now.getHours()*60+now.getMinutes(),key=rpDay(now),L=[];
  if(typeof D==="undefined"||!D||!D.classes)return L;
  liveCls().forEach(function(c){
    (c.tt||[]).forEach(function(x){
      if(x.d!==dow||dayRate(c,key))return;
      var ds=hm(x.s)-nm,fin=nm-hm(x.e);
      if(ds>=0&&ds<=RP_AVANT)L.push({c:c,x:x,kind:"start",min:ds});
      else if(fin>=0)L.push({c:c,x:x,kind:"missed",min:fin});
    });
  });
  L.sort(function(a,b){return hm(a.x.s)-hm(b.x.s);});
  return L;
}

/* Bandeau de l’accueil : séances terminées dont l’appel n’est pas fait */
function rappelBanner(){
  var m=rpDue().filter(function(o){return o.kind==="missed";});
  if(!m.length)return"";
  return'<p class="bn" role="status">⚠ Appel non fait : '+m.map(function(o){return esc(o.c.name)+" ("+esc(o.x.s)+"–"+esc(o.x.e)+")";}).join(" ; ")+'</p>';
}

/* Notifications déjà envoyées aujourd’hui (une seule fois par séance et par type) */
function rpSeen(day){
  var v={d:day,ids:[]};
  try{var r=JSON.parse(localStorage.getItem(RPV)||"null");if(r&&r.d===day&&Array.isArray(r.ids))v=r;}catch(e){}
  return v;
}
function rpSaveSeen(v){try{localStorage.setItem(RPV,JSON.stringify(v));}catch(e){}}

function rpNotify(titre,corps,tag){
  var opt={body:corps,tag:tag,icon:"icons/icon-192.png",badge:"icons/favicon-32.png"};
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(function(r){r.showNotification(titre,opt);}).catch(function(){try{new Notification(titre,opt);}catch(e){}});
    }else new Notification(titre,opt);
  }catch(e){}
}

/* Une vérification (toutes les minutes, et au retour sur l’application) */
function rpTick(now){
  if(!rpOn()||rpPerm()!=="granted")return 0;
  now=now||new Date();
  var v=rpSeen(rpDay(now)),n=0;
  rpDue(now).forEach(function(o){
    var id=o.x.id+"|"+o.kind;
    if(v.ids.indexOf(id)>=0)return;
    if(o.kind==="missed"&&(o.min<RP_APRES||o.min>RP_FENETRE))return;
    v.ids.push(id);n++;
    if(o.kind==="start")rpNotify("Appel à faire : "+o.c.name,"La séance de "+o.x.s+" commence"+(o.min?" dans "+o.min+" min":" maintenant")+".","cm-"+id);
    else rpNotify("Appel non fait : "+o.c.name,"La séance de "+o.x.s+" à "+o.x.e+" est terminée, l’appel n’est pas enregistré.","cm-"+id);
  });
  if(n)rpSaveSeen(v);
  return n;
}

/* Carte de réglage (Compte) */
function rappelsCard(){
  var h='<div class="card"><h2>Rappels d’appel</h2>';
  if(!rpSupported())return h+'<p class="sub" style="margin:0">Ce navigateur ne gère pas les notifications. Le bandeau « Appel non fait » reste affiché sur l’accueil.</p></div>';
  var p=rpPerm(),on=rpOn()&&p==="granted";
  h+='<p class="sub" style="margin-top:0">Une notification avant chaque séance de votre emploi du temps, et un rappel si l’appel n’est pas fait après la séance. Elles arrivent quand l’application est ouverte ou installée sur l’écran d’accueil.</p>';
  if(p==="denied")return h+'<p class="sub" style="margin:0">Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur, puis revenez ici.</p></div>';
  h+='<div class="bar">'+(on?'<button class="btn ghost" data-rp="off">Désactiver</button><button class="btn ghost" data-rp="test">Tester</button>':'<button class="btn" data-rp="on">Activer les rappels</button>')+'</div>';
  if(on)h+='<p class="sub" style="margin:8px 0 0">Rappels activés.</p>';
  return h+'</div>';
}
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("[data-rp]");
  if(!b)return;
  var a=b.dataset.rp;
  function redraw(){var y=window.scrollY;if(typeof render==="function")render();window.scrollTo(0,y);}
  if(a==="off"){try{localStorage.removeItem(RPK);}catch(er){}redraw();return;}
  if(a==="test"){rpNotify("Classe Master","Les rappels d’appel fonctionnent sur cet appareil.","cm-test");return;}
  if(a==="on"){
    if(!rpSupported())return;
    var fini=false;
    function fin(p){
      if(fini)return;fini=true;
      if(p==="granted"){try{localStorage.setItem(RPK,"1");}catch(er){}rpNotify("Rappels activés","Vous serez prévenu avant chaque séance de votre emploi du temps.","cm-test");}
      else if(typeof toast==="function")toast("Notifications refusées : les rappels restent affichés dans l’application.");
      redraw();
    }
    try{var r=Notification.requestPermission(fin);if(r&&r.then)r.then(fin);}catch(er){fin("denied");}
  }
});
setInterval(function(){rpTick();},60000);
document.addEventListener("visibilitychange",function(){if(!document.hidden)rpTick();});
setTimeout(function(){rpTick();},3000);
