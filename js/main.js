/* Démarrage : charge d’abord le stockage de l’appareil (IndexedDB), puis initialise l’état et affiche l’application */
function boot(){
ACC=loadAcc();ME=ACC.users.find(function(u){return u.id===ACC.cur})||null;
if(ME&&ME.hash)ME=null;   /* ancien compte local : reconnexion avec Supabase nécessaire */
KEY=ME?ME.key:"";
D=load();
view=RECOVERY?"reset":ME?"home":(ACC.users.length?"login":"signup");
date=today();
mo=dstr(new Date()).slice(0,7);
cmDlInit();
if(ME)initSync();
initAuth();
document.getElementById("lgo").addEventListener("click",tryUnlock);
document.getElementById("lfg").addEventListener("click",function(){
  if(!confirm("Code oublié : le code sera supprimé et les données enregistrées sur cet appareil seront effacées. Si la synchronisation est active, elles seront restaurées depuis votre compte. Continuer ?"))return;
  try{localStorage.removeItem(PK);kvWipe(KEY);}catch(e){}
  var rel=function(){try{location.reload();}catch(e){D=load();document.getElementById("lock").hidden=true;render();}};
  Promise.resolve(idbFlush()).then(rel,rel);   /* on attend que l’effacement soit écrit avant de recharger */
});
document.getElementById("lp").addEventListener("keydown",function(e){if(e.key==="Enter")tryUnlock();});
window.addEventListener("beforeunload",function(e){if(GUEST&&hasData(D)){e.preventDefault();e.returnValue="";}});
var away=0;
document.addEventListener("visibilitychange",function(){if(document.hidden)away=Date.now();else if(away&&Date.now()-away>60000)lock();});
render();lock();
}
idbInit().then(function(){
  if(idbBlocked()){
    document.getElementById("view").innerHTML='<div class="card"><h2>Stockage de l’appareil indisponible</h2><p class="sub">Vos données sont enregistrées sur cet appareil mais le navigateur ne les rend pas accessibles pour le moment. Elles ne sont pas perdues. Fermez les autres onglets de Classe Master puis réessayez.</p><button class="btn" id="idbretry">Réessayer</button></div>';
    document.getElementById("idbretry").onclick=function(){location.reload();};
    return;
  }
  boot();
});
