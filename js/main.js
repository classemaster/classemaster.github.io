/* Démarrage : initialise l’état puis affiche l’application */
ACC=loadAcc();ME=ACC.users.find(function(u){return u.id===ACC.cur})||null;
if(ME&&ME.hash)ME=null;   /* ancien compte local : reconnexion avec Supabase nécessaire */
KEY=ME?ME.key:"";
D=load();
view=RECOVERY?"reset":ME?"home":(ACC.users.length?"login":"signup");
date=today();
mo=dstr(new Date()).slice(0,7);
if(window.claude&&claude.use)claude.use("downloads").then(function(x){dl=x;},function(){});
if(ME)initSync();
initAuth();
document.getElementById("lgo").addEventListener("click",tryUnlock);
document.getElementById("lfg").addEventListener("click",function(){
  if(!confirm("Code oublié : le code sera supprimé et les données enregistrées sur cet appareil seront effacées. Si la synchronisation est active, elles seront restaurées depuis votre compte. Continuer ?"))return;
  try{localStorage.removeItem(PK);localStorage.removeItem(KEY);localStorage.removeItem(KEY+"-dirty");}catch(e){}
  try{location.reload();}catch(e){D=load();document.getElementById("lock").hidden=true;render();}
});
document.getElementById("lp").addEventListener("keydown",function(e){if(e.key==="Enter")tryUnlock();});
window.addEventListener("beforeunload",function(e){if(GUEST&&hasData(D)){e.preventDefault();e.returnValue="";}});
var away=0;
document.addEventListener("visibilitychange",function(){if(document.hidden)away=Date.now();else if(away&&Date.now()-away>60000)lock();});
render();lock();
