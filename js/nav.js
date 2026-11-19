/* Navigation, en-tête et rendu principal */
function navOf(v){return{mois:"hist",fiche:"hist",part:"compte",classe:"home",appel:"home",eleves:"home",notes:"home",eval:"home",horaires:"home",suivi:"home"}[v]||v;}

function header(){
  var s=document.getElementById("cls");
  s.innerHTML=D.classes.map(function(c){return'<option value="'+c.id+'"'+(c.id===D.cur?" selected":"")+">"+esc(c.name)+"</option>"}).join("")+'<option value="__new">+ Nouvelle classe</option>';
  document.getElementById("dt").value=date;
  document.querySelectorAll("nav button").forEach(function(b){b.setAttribute("aria-selected",b.dataset.v===navOf(view))});
}


function render(){
  if(RECOVERY)view="reset";
  else if(!ME&&!GUEST&&view!=="login"&&view!=="signup")view=ACC.users.length?"login":"signup";
  var auth=view==="reset"||(!ME&&(!GUEST||view==="login"||view==="signup"));
  header();
  document.querySelector("header").hidden=auth||view==="compte"||view==="search"||view==="home"||view==="classe"||view==="notes"||view==="eval"||view==="horaires"||view==="suivi";
  document.querySelector("nav").hidden=auth;
  document.getElementById("sync").hidden=auth;
  var el=document.getElementById("view");
  var body=view==="home"?renderHome():view==="login"?renderLogin():view==="signup"?renderSignup():view==="reset"?renderReset():view==="appel"?renderAppel():view==="hist"?renderHist():view==="part"?renderPart():view==="mois"?renderMois():view==="fiche"?renderFiche():view==="classe"?renderClasse():view==="notes"?renderNotes():view==="horaires"?renderHoraires():view==="eval"?renderEval():view==="suivi"?renderSuivi():view==="search"?renderSearch():view==="compte"?renderCompte():renderEleves();
  var bk='<button class="lnk" data-go="classe">← '+esc(cl().name)+'</button>';var pre={suivi:bk,horaires:bk,notes:bk,eval:'<button class="lnk" data-go="notes">← Notes</button>',appel:bk,eleves:bk,classe:'<button class="lnk" data-go="home">← Accueil</button>',mois:'<button class="lnk" data-go="hist">← Bilan</button>',part:'<button class="lnk" data-go="compte">← Compte</button>',hist:'<div class="bar"><button class="btn ghost" data-go="mois">Vue du mois</button></div>'};
  el.innerHTML=(GUEST&&!auth?'<div class="gban"><span>Mode invité : vos données ne sont pas enregistrées. Connectez-vous pour les sauvegarder.</span><button class="btn ghost" data-go="login">Se connecter</button></div>':"")+(pre[view]||"")+body;
  if(view==="appel")applyQ();
  if(view==="search")drawSearch();
  document.documentElement.style.overflow=auth?"hidden":"";
  trackHist();
}

function applyQ(){
  var rows=document.querySelectorAll(".row[data-nm]"),n=0,m=document.getElementById("qm"),x=document.getElementById("qx");
  rows.forEach(function(r){var ok=hit(r.dataset.nm);r.hidden=!ok;if(ok)n++;});
  if(x)x.hidden=!qs;
  if(m)m.textContent=qs?(n?n+" élève(s) sur "+rows.length:"Aucun élève ne correspond."):"";
}

/* Historique : chaque écran est une entrée, le bouton Retour revient à l’écran précédent */
function hkey(){return view+"|"+(D?D.cur:"")+"|"+(view==="fiche"?sel:"")+"|"+(view==="eval"?evid:"");}
function snap(){return{view:view,cur:D?D.cur:"",sel:sel,evid:evid,fb:fb};}
function trackHist(){
  var k=hkey();if(k===histKey)return;
  var first=histKey==="";histKey=k;
  try{
    var u=location.pathname+location.search+"#"+view;
    if(/access_token=|error_code=|type=recovery/.test(location.hash))return;   /* laisse Supabase lire le retour de connexion */
    if(first||view==="login"||view==="signup"||view==="reset")history.replaceState(snap(),"",u);else history.pushState(snap(),"",u);
  }catch(e){}
}
function onPop(e){
  var s=e.state;
  if(!s||!s.view)s={view:(ME||GUEST)?"home":"login"};
  if(s.cur&&D&&D.classes.some(function(c){return c.id===s.cur}))D.cur=s.cur;
  sel=s.sel||"";evid=s.evid||"";fb=s.fb||"hist";view=s.view;
  if((ME||GUEST)&&(view==="login"||view==="signup"))view="home";
  local();histKey=hkey();render();window.scrollTo(0,0);
}
window.addEventListener("popstate",onPop);
