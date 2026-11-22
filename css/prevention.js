/* Protection des données : alerte de mémoire pleine, nettoyage des archives, rappel de sauvegarde */
var STO_KO=false,STO_QUOTA=5000000,STO_WARN=0.7,BK_DAYS=30,BK_SNOOZE=7;   /* quota estimé en caractères (limite habituelle du navigateur : environ 5 Mo) */
var stoT=0,stoMemo=null,lastSyncT=0,lastBkMem=0;

function pk(x){return KEY?KEY+x:"";}
function pkGet(x){var k=pk(x);if(!k)return 0;try{return +localStorage.getItem(k)||0;}catch(e){return 0;}}
function pkSet(x,v){var k=pk(x);if(!k)return;try{localStorage.setItem(k,String(v));}catch(e){}}

/* ---- 1. Mémoire de l'appareil ---- */
function stoUsed(fresh){
  if(!fresh&&stoMemo!==null&&Date.now()-stoMemo.t<20000)return stoMemo.v;
  var n=0,i,k;
  try{for(i=0;i<localStorage.length;i++){k=localStorage.key(i);n+=k.length+(localStorage.getItem(k)||"").length;}}catch(e){}
  if(IDB.ok)n+=idbSize();
  stoMemo={t:Date.now(),v:n};return n;
}
function stoPct(fresh){return Math.min(100,Math.round(stoUsed(fresh)/STO_QUOTA*100));}
function stoFail(){
  stoMemo=null;
  if(STO_KO)return;
  STO_KO=true;
  if(typeof toast==="function"&&Date.now()-stoT>60000){
    stoT=Date.now();
    toast("Mémoire de l’appareil pleine : cette saisie n’est pas enregistrée ici.","Libérer",function(){view="part";render();window.scrollTo(0,0);});
  }
  if(typeof updPend==="function")updPend();
}
function stoOk(){STO_KO=false;stoMemo=null;if(typeof updPend==="function")updPend();}

function stoSize(n){return n>=1e9?(n/1e9).toFixed(1).replace(".",",")+" Go":n>=1e6?(n/1e6).toFixed(1).replace(".",",")+" Mo":Math.max(1,Math.round(n/1000))+" Ko";}
function stoArch(){
  return D.classes.filter(isArch).map(function(c){return{c:c,n:JSON.stringify(c).length};}).sort(function(a,b){return b.n-a.n;});
}
function stoTrashInfo(){var a=tLoad();return{n:a.length,sz:a.length?JSON.stringify(a).length:0};}

/* Exporte l'archive en fichier, puis la supprime de l'appareil (et du compte en ligne) après confirmation */
function stoPurge(id){
  var c=D.classes.find(function(x){return x.id===id;});
  if(!c||!isArch(c))return;
  var nm=c.name,fn="archive-"+nm.replace(/[^\w-]+/g,"_")+".json";
  saveFile(fn,JSON.stringify({app:"appel-matin",version:1,classes:[c]}),"application/json",function(m){
    if(/annul|pas disponible/i.test(m)){stoMsg(m+" L’archive n’a pas été supprimée.");return;}
    if(!confirm("Le fichier « "+fn+" » est-il bien enregistré sur votre téléphone ?\n\nOK = supprimer l’archive « "+nm+" » de cet appareil"+(col?" et de votre compte en ligne":"")+".\nAnnuler = la garder."))return;
    D.classes=D.classes.filter(function(x){return x.id!==id;});
    if(!D.classes.length)D.classes.push({id:uid(),name:"Ma classe",students:[],records:{},notes:{}});
    if(!D.classes.some(function(x){return x.id===D.cur;}))D.cur=(liveCls()[0]||D.classes[0]).id;
    dirty[id]=Date.now();
    stoMemo=null;save();render();
    stoMsg("Archive supprimée. Pour la consulter de nouveau : Sauvegarde et partage > Recevoir des données.");
  });
}
function stoMsg(t){var e=document.getElementById("stomsg");if(e)e.textContent=t;}

/* ---- 3. Sauvegarde ---- */
function bkMark(){lastBkMem=Date.now();pkSet("-lastbk",lastBkMem);}
function bkLast(){return Math.max(lastBkMem,pkGet("-lastbk"));}
function syncLast(){return Math.max(lastSyncT,pkGet("-lastsync"));}
function bkRef(){
  var a=Math.max(bkLast(),syncLast());if(a)return a;
  var f=pkGet("-bk0");if(!f){f=Date.now();pkSet("-bk0",f);}
  return f;
}
function bkDays(){return Math.floor((Date.now()-bkRef())/864e5);}
function bkDue(){
  if(!ME||!KEY||!hasData(D))return false;
  if(col&&!Object.keys(dirty).length&&!needOnline())return false;   /* compte en ligne à jour */
  if(Date.now()<pkGet("-bksnz"))return false;
  return Date.now()-bkRef()>=BK_DAYS*864e5;
}
function bkDate(t){return new Date(t).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});}
function bkAgo(t){var d=Math.floor((Date.now()-t)/864e5);return d<=0?"aujourd’hui":d===1?"hier":"il y a "+d+" jours";}

/* Un envoi réussi de toutes les classes compte comme une sauvegarde en ligne */
hookOn("sync",function(t){
  if(t==="Synchronisé entre vos appareils"&&Date.now()-lastSyncT>600000){lastSyncT=Date.now();pkSet("-lastsync",lastSyncT);}
  if(t==="Synchronisé entre vos appareils"&&typeof shKick==="function")shKick(3000);
});

/* ---- Bandeaux (sous la barre de synchronisation) ---- */
hookOn("pend",function(){
    var el=document.getElementById("pend");if(!el||!ME||view==="reset")return;
    var calm=view==="home"||view==="compte"||view==="part",h="";
    if(STO_KO)h+='<div class="gban gban-w" role="alert"><span><b>Mémoire de l’appareil pleine.</b> Vos dernières saisies ne sont pas enregistrées ici'+(col?" (elles restent envoyées à votre compte en ligne tant que la connexion fonctionne)":"")+'. Libérez de l’espace maintenant.</span><button class="btn ghost" data-pk="go">Libérer</button></div>';
    else if(calm&&stoPct()>=STO_WARN*100)h+='<div class="gban gban-w"><span>Mémoire de l’appareil utilisée à '+stoPct()+' %. Libérez de l’espace avant qu’elle soit pleine.</span><button class="btn ghost" data-pk="go">Libérer</button></div>';
    if(calm&&bkDue())h+='<div class="gban gban-w"><span>Aucune sauvegarde depuis '+bkDays()+' jours. Si le téléphone est perdu ou réinitialisé, vos classes disparaissent.</span><button class="btn ghost" data-pk="go">Sauvegarder</button><button class="btn ghost" data-pk="snz">Plus tard</button></div>';
    if(h)el.innerHTML+=h;
});
document.getElementById("pend").addEventListener("click",function(e){
  var b=e.target.closest("[data-pk]");if(!b)return;
  if(b.dataset.pk==="go"){view="part";render();window.scrollTo(0,0);}
  else if(b.dataset.pk==="snz"){pkSet("-bksnz",Date.now()+BK_SNOOZE*864e5);updPend();}
});

/* ---- Carte « Espace et sauvegarde » dans Sauvegarde et partage ---- */
function stoCard(){
  var used=stoUsed(true),p=Math.min(100,Math.round(used/STO_QUOTA*100)),A=stoArch(),T=stoTrashInfo(),lb=bkLast(),ls=syncLast();
  var h='<div class="card" id="stoc"><h2>Espace et sauvegarde</h2>';
  h+='<p class="sub" style="margin:0 0 4px"><b>Dernière sauvegarde en fichier :</b> '+(lb?esc(bkDate(lb))+" ("+bkAgo(lb)+")":"jamais")+'.</p>';
  if(ME)h+='<p class="sub" style="margin:0 0 10px"><b>Dernière synchronisation en ligne :</b> '+(ls?esc(bkDate(ls))+" ("+bkAgo(ls)+")":"jamais")+'.</p>';
  h+='<div class="sto-m" role="img" aria-label="Mémoire de l’appareil utilisée à '+p+' pour cent"><i class="'+(p>=90?"hi":p>=70?"mid":"")+'" style="width:'+Math.max(2,p)+'%"></i></div>';
  h+='<p class="sub" style="margin:4px 0 8px">Mémoire de l’appareil : '+esc(stoSize(used))+' sur environ '+esc(stoSize(STO_QUOTA))+' ('+p+' %).</p>';
  if(A.length){
    h+='<p class="sub" style="margin:0 0 4px"><b>Archives des années passées</b></p>';
    A.forEach(function(x){h+='<div class="li pm-li"><span style="min-width:0"><b>'+esc(x.c.name)+'</b><br><small class="sub">'+esc(stoSize(x.n))+'</small></span><span class="pm-act"><button style="color:var(--accent)" data-stoa="'+esc(x.c.id)+'">Exporter puis supprimer</button></span></div>';});
  }else h+='<p class="sub" style="margin:0 0 8px">Aucune archive à ranger.</p>';
  if(T.n)h+='<div class="li pm-li"><span style="min-width:0"><b>Corbeille</b><br><small class="sub">'+T.n+' élément'+(T.n>1?"s":"")+' · '+esc(stoSize(T.sz))+'</small></span><span class="pm-act"><button style="color:var(--accent)" data-stot="1">Vider</button></span></div>';
  h+='<p class="sub" id="stomsg" role="status" style="margin:8px 0 0"></p></div>';
  return h;
}
hookOn("part",function(h){
  var m='<h3 class="sec-t">Sauvegarder</h3>';
  return ME&&h.indexOf(m)>=0?h.replace(m,m+stoCard()):h;
});
document.getElementById("view").addEventListener("click",function(e){
  var a=e.target.closest("[data-stoa]");
  if(a){stoPurge(a.dataset.stoa);return;}
  if(e.target.closest("[data-stot]")){
    if(!confirm("Vider la corbeille ? Les éléments supprimés ces 7 derniers jours ne pourront plus être rétablis."))return;
    tSave([]);stoMemo=null;render();
  }
});
