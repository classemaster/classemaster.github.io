/* Comptes, mot de passe, code PIN, écrans de connexion */
function loadAcc(){try{var o=JSON.parse(localStorage.getItem("appel-comptes-v1"));if(o&&Array.isArray(o.users))return o;}catch(e){}return{users:[],cur:null};}
function saveAcc(){try{localStorage.setItem("appel-comptes-v1",JSON.stringify(ACC));return true;}catch(e){return false;}}
function toHex(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return("0"+x.toString(16)).slice(-2)}).join("");}
function rnd(){try{return toHex(crypto.getRandomValues(new Uint8Array(16)));}catch(e){return uid()+uid()+uid();}}
function pwHash(pw,salt){
  if(window.crypto&&crypto.subtle&&window.TextEncoder){
    var en=new TextEncoder();
    return crypto.subtle.importKey("raw",en.encode(pw),"PBKDF2",false,["deriveBits"]).then(function(k){return crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:en.encode(salt),iterations:150000},k,256);}).then(toHex);
  }
  return hashPin("pw:"+salt+":"+pw);
}
function blank(){var id=uid();return{cur:id,classes:[{id:id,name:"Ma classe",students:[],records:{}}]};}
function hasLegacy(){try{var o=JSON.parse(localStorage.getItem("appel-matin-v1"));return!!(o&&o.classes&&o.classes.some(function(c){return(c.students&&c.students.length)||Object.keys(c.records||{}).length;}));}catch(e){return false;}}

var PK="appel-pin-v1";
function hashPin(v){
  if(window.crypto&&crypto.subtle&&window.TextEncoder)return crypto.subtle.digest("SHA-256",new TextEncoder().encode("appel:"+v)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return("0"+x.toString(16)).slice(-2)}).join("");});
  return Promise.resolve("x"+btoa("appel:"+v));
}
function pinSet(){try{return localStorage.getItem(PK)||"";}catch(e){return"";}}
function lock(){
  if(!pinSet()||!ME)return;
  document.getElementById("lock").hidden=false;
  document.getElementById("lp").value="";document.getElementById("lm").textContent="";
  setTimeout(function(){document.getElementById("lp").focus();},50);
}
function tryUnlock(){
  hashPin(document.getElementById("lp").value.replace(/\D/g,"")).then(function(h){
    if(h===pinSet())document.getElementById("lock").hidden=true;
    else{document.getElementById("lm").textContent="Code incorrect.";document.getElementById("lp").value="";}
  });
}
function pinCard(){
  var on=!!pinSet();
  return'<div class="card"><h2>Verrouillage par code</h2><p class="sub" style="margin-top:0">'+(on?"Un code est actif sur cet appareil. Il est demandé à l’ouverture et après une minute d’absence.":"Protégez l’accès à l’application sur cet appareil avec un code de 4 à 8 chiffres.")+'</p><input class="pin" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="8" id="np" placeholder="'+(on?"Code actuel (4 à 8 chiffres)":"Nouveau code (4 à 8 chiffres)")+'" aria-label="Code" style="margin-bottom:8px"><div class="bar" style="margin:0">'+(on?'<button class="btn ghost" id="poff">Désactiver</button><button class="btn" id="pnow">Verrouiller maintenant</button>':'<button class="btn" id="pon">Activer le code</button>')+'</div><p class="sub" id="pmsg"></p></div>';
}

var GLOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
function eyeBtn(id){return'<button type="button" class="eye" data-eye="'+id+'" aria-pressed="false" aria-label="Afficher le mot de passe"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle class="pu" cx="12" cy="12" r="3"/><path class="sl" d="M4 4l16 16"/></svg></button>';}
function guestLink(){return'<p class="afoot gl"><button class="alink" data-guest="1">'+(GUEST?"Revenir en mode invité":"Continuer sans compte")+'</button></p>';}
function authShell(title,body){
  return'<div class="authpage"><div class="ascroll"><div class="acard"><div class="ahead"><i class="c1"></i><i class="c2"></i><h1><span>'+title+'</span></h1></div><div class="apanel">'+
  '<button type="button" class="gbtn" id="gbtn">'+GLOGO+'<span>Se connecter avec Google</span></button><div class="aor">ou</div>'+body+'</div></div></div></div>';
}
function renderLogin(){
  return authShell('Se connecter',
  '<input class="ai afull" type="text" id="li" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="E-mail ou identifiant" aria-label="E-mail ou identifiant">'+
  '<div class="arow pw"><input class="ai" type="password" id="lw" autocomplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe">'+eyeBtn("lw")+'</div>'+
  '<p class="aerr" id="lerr" role="alert"></p>'+
  '<button class="abtn" id="lgin">Se connecter</button>'+
  '<p class="aterms"><button class="alink" id="lfp">Mot de passe oublié ?</button></p>'+
  '<p class="afoot">Pas encore de compte ? <button class="alink" data-go="signup">Créer un compte</button></p>'+guestLink());
}
function renderSignup(){
  var lg=!ACC.users.length&&hasLegacy();
  return authShell('Créer un<br>compte',
  '<div class="arow"><input class="ai" type="text" id="sfn" autocomplete="given-name" placeholder="Prénom" aria-label="Prénom"><input class="ai" type="text" id="sln" autocomplete="family-name" placeholder="Nom" aria-label="Nom"></div>'+
  '<input class="ai afull" type="text" id="sid" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="E-mail" aria-label="E-mail">'+
  '<div class="arow pw"><input class="ai" type="password" id="spw" autocomplete="new-password" placeholder="Mot de passe" aria-label="Mot de passe (8 caractères minimum)">'+eyeBtn("spw")+'</div>'+
  '<p class="aerr" id="serr" role="alert"></p>'+
  '<button class="abtn" id="sgo">Créer un compte</button>'+
  '<p class="aterms">'+(lg?"Vos classes déjà enregistrées sur cet appareil seront rattachées à ce compte.":"Mot de passe de 8 caractères minimum. Compte enregistré uniquement sur cet appareil.")+'</p>'+
  '<p class="afoot">Déjà un compte ? <button class="alink" data-go="login">Connectez-vous ici</button></p>'+guestLink());
}
function renderCompte(){
  if(!ME)return'<h1 style="text-transform:none">Mon compte</h1><div class="card"><h2>Mode invité</h2><p class="sub" style="margin-top:0">Vous utilisez l’application sans compte : vos données ne sont pas enregistrées et disparaissent à la fermeture de la page. Connectez-vous ou créez un compte pour les sauvegarder ; ce que vous avez saisi pourra être ajouté à votre compte.</p><div class="bar" style="margin:0"><button class="btn" data-go="login">Se connecter</button><button class="btn ghost" data-go="signup">Créer un compte</button></div></div><div class="card"><h2>Importer des données</h2><p class="sub" style="margin-top:0">Chargez une sauvegarde reçue d’un collègue ou une ancienne sauvegarde. En mode invité, elle reste en mémoire jusqu’à la fermeture de la page : connectez-vous ensuite pour la conserver.</p><button class="btn ghost" data-go="part">Importer des données</button></div>';
  var u=ME,nC=D.classes.length,nE=0,nA=0;
  D.classes.forEach(function(c){nE+=c.students.length;nA+=Object.keys(c.records).filter(function(k){return Object.keys(c.records[k]).length}).length;});
  var ini=u.name.split(/\s+/).slice(0,2).map(function(w){return w.charAt(0).toUpperCase()}).join("");
  return'<h1 style="text-transform:none">Mon compte</h1>'+
  '<div class="card" style="display:flex;gap:12px;align-items:center"><div class="av">'+esc(ini)+'</div><div><b>'+esc(u.name)+'</b><div class="sub" style="margin:0">'+esc(u.login)+(u.school?" · "+esc(u.school):"")+'</div><div class="sub" style="margin:0">'+nC+" classe(s) · "+nE+" élève(s) · "+nA+" appel(s)</div></div></div>"+
  '<div class="card"><h2>Profil</h2><label class="fld">Nom<input type="text" id="an" value="'+esc(u.name)+'"></label><label class="fld">Établissement<input type="text" id="as" value="'+esc(u.school||"")+'"></label></div>'+
  '<div class="card"><h2>Mot de passe</h2><label class="fld">Mot de passe actuel<input type="password" id="cp0" autocomplete="current-password"></label><label class="fld">Nouveau mot de passe<input type="password" id="cp1" autocomplete="new-password"></label><label class="fld">Confirmer<input type="password" id="cp2" autocomplete="new-password"></label><p class="err" id="cpm" role="status"></p><button class="btn" id="cpw">Changer le mot de passe</button></div>'+
  '<div class="card"><h2>Sauvegarde et partage</h2><p class="sub" style="margin-top:0">Exportez vos données, partagez une classe, imprimez le bilan.</p><button class="btn ghost" data-go="part">Ouvrir</button></div>'+
  pinCard()+
  '<div class="bar"><button class="btn" id="lout">Se déconnecter</button><button class="btn ghost" id="adel">Supprimer mon compte</button></div>';
}

function hasData(d){return!!d&&d.classes.some(function(c){return(c.students&&c.students.length)||Object.keys(c.records||{}).length;});}
function enter(u,fresh){
  var g=GUEST&&hasData(D)?D:null;
  GUEST=false;ME=u;ACC.cur=u.id;saveAcc();KEY=u.key;D=load();view="home";date=today();qs="";gqs="";
  if(g&&(fresh||confirm("Ajouter les classes saisies en mode invité à ce compte ?"))){
    if(!hasData(D))D.classes=[];
    g.classes.forEach(function(c){D.classes.push(c);});
    D.cur=g.cur;local();
  }
  initSync();render();window.scrollTo(0,0);
}
function removeUser(u){
  try{localStorage.removeItem(u.key);}catch(e){}
  ACC.users=ACC.users.filter(function(x){return x.id!==u.id});
  if(ACC.cur===u.id)ACC.cur=null;
  saveAcc();
  if(ME&&ME.id===u.id){stopSync();ME=null;D=blank();KEY="";}
}
function doLogout(){
  stopSync();ME=null;ACC.cur=null;saveAcc();D=blank();KEY="";view="login";render();window.scrollTo(0,0);
}
