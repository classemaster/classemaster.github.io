/* Comptes (Supabase Auth), code PIN, écrans de connexion */
function loadAcc(){try{var o=JSON.parse(localStorage.getItem("appel-comptes-v1"));if(o&&Array.isArray(o.users))return o;}catch(e){}return{users:[],cur:null};}
function saveAcc(){try{localStorage.setItem("appel-comptes-v1",JSON.stringify(ACC));return true;}catch(e){return false;}}
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
function authShell(title,body,nog){
  return'<div class="authpage"><div class="ascroll"><div class="acard"><div class="ahead"><i class="c1"></i><i class="c2"></i><h1><span>'+title+'</span></h1></div><div class="apanel">'+
  (nog?'':'<button type="button" class="gbtn" id="gbtn">'+GLOGO+'<span>Se connecter avec Google</span></button><div class="aor">ou</div>')+body+'</div></div></div></div>';
}
function legacyNote(){return ACC.users.some(function(u){return u.hash})?'<p class="aterms">Mise à jour : les comptes sont maintenant en ligne. Connectez-vous avec la même adresse e-mail (ou créez le compte) pour retrouver vos données.</p>':"";}
function renderReset(){
  return authShell('Nouveau mot<br>de passe',
  '<div class="arow pw"><input class="ai" type="password" id="rsp1" autocomplete="new-password" placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe (8 caractères minimum)">'+eyeBtn("rsp1")+'</div>'+
  '<div class="arow pw"><input class="ai" type="password" id="rsp2" autocomplete="new-password" placeholder="Confirmer le mot de passe" aria-label="Confirmer le mot de passe">'+eyeBtn("rsp2")+'</div>'+
  '<p class="aerr" id="rserr" role="alert"></p>'+
  '<button class="abtn" id="rsgo">Enregistrer</button>'+
  '<p class="aterms">Mot de passe de 8 caractères minimum.</p>'+
  '<p class="afoot"><button class="alink" id="rscancel">Annuler</button></p>',true);
}
function renderLogin(){
  return authShell('Se connecter',
  '<input class="ai afull" type="text" id="li" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="E-mail" aria-label="E-mail">'+
  '<div class="arow pw"><input class="ai" type="password" id="lw" autocomplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe">'+eyeBtn("lw")+'</div>'+
  '<p class="aerr" id="lerr" role="alert"></p>'+
  '<button class="abtn" id="lgin">Se connecter</button>'+
  '<p class="aterms"><button class="alink" id="lfp">Mot de passe oublié ?</button></p>'+
  '<p class="afoot">Pas encore de compte ? <button class="alink" data-go="signup">Créer un compte</button></p>'+legacyNote()+guestLink());
}
function renderSignup(){
  var lg=!ACC.users.length&&hasLegacy();
  return authShell('Créer un<br>compte',
  '<div class="arow"><input class="ai" type="text" id="sfn" autocomplete="given-name" placeholder="Prénom" aria-label="Prénom"><input class="ai" type="text" id="sln" autocomplete="family-name" placeholder="Nom" aria-label="Nom"></div>'+
  '<input class="ai afull" type="text" id="sid" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="E-mail" aria-label="E-mail">'+
  '<div class="arow pw"><input class="ai" type="password" id="spw" autocomplete="new-password" placeholder="Mot de passe" aria-label="Mot de passe (8 caractères minimum)">'+eyeBtn("spw")+'</div>'+
  '<p class="aerr" id="serr" role="alert"></p>'+
  '<button class="abtn" id="sgo">Créer un compte</button>'+
  '<p class="aterms">'+(lg?"Vos classes déjà enregistrées sur cet appareil seront rattachées à ce compte.":"Mot de passe de 8 caractères minimum. Vos données sont sauvegardées en ligne et retrouvées sur tous vos appareils.")+'</p>'+
  '<p class="afoot">Déjà un compte ? <button class="alink" data-go="login">Connectez-vous ici</button></p>'+legacyNote()+guestLink());
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
  if(ME&&ME.id===u.id&&!GUEST)return;
  fresh=fresh||freshNext;freshNext=false;
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
  try{localStorage.removeItem(u.key);localStorage.removeItem(u.key+"-dirty");}catch(e){}
  ACC.users=ACC.users.filter(function(x){return x.id!==u.id});
  if(ACC.cur===u.id)ACC.cur=null;
  saveAcc();
  if(ME&&ME.id===u.id){stopSync();ME=null;D=blank();KEY="";}
}
function doLogout(forced){
  stopSync();ME=null;ACC.cur=null;saveAcc();D=blank();KEY="";view="login";render();window.scrollTo(0,0);
  if(!forced&&sb)sb.auth.signOut({scope:"local"}).then(function(){},function(){});
}

/* Supabase : erreurs, profil, session */
var freshNext=false;
function authErr(e){
  var m=String((e&&e.message)||"").toLowerCase(),c=String((e&&e.code)||"");
  if(c==="invalid_credentials"||m.indexOf("invalid login")>=0)return"E-mail ou mot de passe incorrect.";
  if(c==="email_not_confirmed"||m.indexOf("not confirmed")>=0)return"Adresse e-mail non confirmée. Ouvrez le message de confirmation reçu par e-mail.";
  if(c==="user_already_exists"||m.indexOf("already registered")>=0)return"Un compte existe déjà avec cet e-mail. Connectez-vous.";
  if(c==="weak_password")return"Mot de passe trop faible. Choisissez-en un plus long ou plus varié.";
  if(c==="same_password")return"Le nouveau mot de passe doit être différent de l’ancien.";
  if(c==="provider_disabled"||m.indexOf("provider is not enabled")>=0||m.indexOf("unsupported provider")>=0)return"La connexion avec Google n’est pas activée pour cette application.";
  if(c.indexOf("rate_limit")>=0||(e&&e.status===429))return"Trop de tentatives. Patientez un moment avant de réessayer.";
  if(!e||e.status===0||m.indexOf("fetch")>=0||m.indexOf("network")>=0)return"Connexion impossible. Vérifiez votre accès à internet.";
  return"Une erreur est survenue. Réessayez.";
}
function noSb(){if(sb)return"";if(typeof SUPABASE_KEY!=="undefined"&&SUPABASE_KEY.indexOf("COLLEZ")===0)return"Configuration incomplète : la clé publique Supabase n’a pas encore été ajoutée dans js/supabase.js.";return"Le service de connexion est indisponible. Vérifiez votre connexion internet puis rechargez la page.";}
function showDialog(title,txt,label,cb){
  var old=document.getElementById("adlg");if(old)old.remove();
  var o=document.createElement("div");o.className="adlg";o.id="adlg";o.setAttribute("role","alertdialog");o.setAttribute("aria-modal","true");o.setAttribute("aria-labelledby","adt");o.setAttribute("aria-describedby","adm");
  o.innerHTML='<div class="adbox"><div class="adico" aria-hidden="true">✓</div><h2 id="adt"></h2><p id="adm"></p><button type="button" class="abtn" id="adok"></button></div>';
  document.body.appendChild(o);
  o.querySelector("#adt").textContent=title;o.querySelector("#adm").textContent=txt;
  var b=o.querySelector("#adok");b.textContent=label||"OK";
  function close(){o.remove();if(cb)cb();}
  b.addEventListener("click",close);
  o.addEventListener("keydown",function(e){if(e.key==="Escape")close();});
  setTimeout(function(){b.focus();},30);
}
function amsg(el,txt,ok){if(!el)return;el.className=ok?"aerr aok":"aerr";el.textContent=txt;}
function redirectUrl(){return location.origin+location.pathname;}

/* Identifiants locaux : permettent de créer un compte et de se connecter sans internet */
function rnd(){var a=new Uint8Array(16),i;if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);else for(i=0;i<16;i++)a[i]=Math.floor(Math.random()*256);return Array.prototype.map.call(a,function(x){return("0"+x.toString(16)).slice(-2)}).join("");}
function hashPw(pw,salt){
  if(window.crypto&&crypto.subtle&&window.TextEncoder){
    var enc=new TextEncoder();
    return crypto.subtle.importKey("raw",enc.encode(pw),"PBKDF2",false,["deriveBits"]).then(function(k){
      return crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:enc.encode(salt),iterations:100000},k,256);
    }).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return("0"+x.toString(16)).slice(-2)}).join("");});
  }
  return Promise.resolve("x"+btoa(unescape(encodeURIComponent(salt+":"+pw))));
}
function setCred(u,pw){var s=rnd();return hashPw(pw,s).then(function(h){u.s2=s;u.h2=h;saveAcc();},function(){});}
function checkCred(u,pw){return hashPw(pw,u.s2||"").then(function(h){return!!u.h2&&h===u.h2;},function(){return false;});}
function netErr(e){return!navigator.onLine||!e||e.status===0||/fetch|network/i.test(String(e.message||""))||String(e.name||"")==="AuthRetryableFetchError";}

/* Compte créé hors ligne : enregistré sur l’appareil, envoyé à Supabase plus tard (voir finalizeDialog) */
function offlineSignup(nm,email,pw,er,btn){
  freshNext=false;
  if(ACC.users.some(function(x){return x.login===email&&!x.hash})){btn.disabled=false;amsg(er,"Un compte existe déjà sur cet appareil avec cet e-mail. Connectez-vous.");return;}
  var id=uid(),u={id:id,name:nm,school:"",login:email,key:ACC.users.length?"appel-matin-u-"+id:"appel-matin-v1",pending:true};
  setCred(u,pw).then(function(){
    btn.disabled=false;
    if(!u.h2){amsg(er,"Impossible de créer le compte sur cet appareil.");return;}
    ACC.users.push(u);saveAcc();
    enter(u,true);
    showDialog("Compte créé hors ligne","Vos données sont enregistrées sur cet appareil. Dès que vous serez connecté à internet, appuyez sur « Finaliser » pour les sauvegarder en ligne.","J’ai compris");
  });
}
function offlineLogin(email,pw,el,btn){
  var u=ACC.users.find(function(x){return x.login===email&&x.h2});
  if(!u){btn.disabled=false;amsg(el,"Pas de connexion internet. Hors ligne, seuls les comptes déjà utilisés sur cet appareil peuvent se connecter.");return;}
  checkCred(u,pw).then(function(ok){
    btn.disabled=false;
    if(!ok){fails++;if(fails>=5){until=Date.now()+30000;fails=0;}amsg(el,"E-mail ou mot de passe incorrect.");return;}
    fails=0;if(!u.pending)u.resync=true;saveAcc();enter(u);
  });
}

/* Bandeau : compte à finaliser / synchronisation à reprendre */
function needOnline(){return!!ME&&!!(ME.pending||ME.resync);}
function updPend(){
  var el=document.getElementById("pend");if(!el)return;
  if(!needOnline()||view==="reset"){el.innerHTML="";return;}
  if(!navigator.onLine){el.innerHTML=ME.pending?'<div class="gban"><span>Compte créé hors ligne : vos données sont sur cet appareil. Finalisez-le dès que vous avez internet.</span></div>':"";return;}
  el.innerHTML='<div class="gban"><span>'+(ME.pending?"Finalisez votre compte pour sauvegarder vos données en ligne.":"Reconnectez-vous pour reprendre la synchronisation.")+'</span><button class="btn ghost" id="pfin">'+(ME.pending?"Finaliser":"Reconnecter")+'</button></div>';
}
function closeDlg(){var o=document.getElementById("adlg");if(o)o.remove();}
function finalizeDialog(){
  var u=ME;if(!u||!sb)return;
  closeDlg();
  var o=document.createElement("div");o.className="adlg";o.id="adlg";o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");o.setAttribute("aria-labelledby","adt");
  o.innerHTML='<div class="adbox"><h2 id="adt"></h2><p id="adm"></p><div class="adrow"><input class="adi" type="password" id="fpw" autocomplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe">'+eyeBtn("fpw")+'</div><p class="aerr" id="ferr" role="alert"></p><button type="button" class="abtn" id="fgo">Continuer</button><p class="afoot"><button type="button" class="alink" id="fno">Plus tard</button></p></div>';
  document.body.appendChild(o);
  o.querySelector("#adt").textContent=u.pending?"Finaliser mon compte":"Reprendre la synchronisation";
  o.querySelector("#adm").textContent="Entrez le mot de passe de "+u.login+" pour "+(u.pending?"créer votre compte en ligne et y envoyer vos données.":"vous reconnecter et reprendre la sauvegarde en ligne.");
  var pw=o.querySelector("#fpw"),er=o.querySelector("#ferr"),go=o.querySelector("#fgo");
  o.querySelector("#fno").addEventListener("click",closeDlg);
  o.querySelector(".eye").addEventListener("click",function(){var sh=pw.type==="password";pw.type=sh?"text":"password";this.setAttribute("aria-pressed",String(sh));});
  pw.addEventListener("keydown",function(e){if(e.key==="Enter")go.click();if(e.key==="Escape")closeDlg();});
  function done(su){
    closeDlg();
    if(ME&&ME.id===su.id){delete ME.pending;delete ME.resync;saveAcc();initSync();updPend();render();}
    else{stopSync();ME=null;enter(userFrom(su),true);}
  }
  go.addEventListener("click",function(){
    var p=pw.value;if(!p){amsg(er,"Entrez votre mot de passe.");return;}
    go.disabled=true;amsg(er,"");
    checkCred(u,p).then(function(ok){
      if(!ok){go.disabled=false;amsg(er,"Mot de passe incorrect.");return;}
      return sb.auth.signInWithPassword({email:u.login,password:p}).then(function(r){
        if(!r.error){go.disabled=false;done(r.data.user);return;}
        if(r.error.code==="email_not_confirmed"||/not confirmed/i.test(r.error.message||"")){go.disabled=false;closeDlg();showDialog("Confirmez votre e-mail","Votre compte existe mais votre adresse e-mail n’est pas encore confirmée. Ouvrez le message de confirmation reçu par e-mail, puis appuyez de nouveau sur « Finaliser ».","J’ai compris");return;}
        if((r.error.code==="invalid_credentials"||/invalid login/i.test(r.error.message||""))&&u.pending){
          return sb.auth.signUp({email:u.login,password:p,options:{data:{name:u.name,school:u.school||""},emailRedirectTo:redirectUrl()}}).then(function(r2){
            go.disabled=false;
            if(r2.error){amsg(er,authErr(r2.error));return;}
            var nu=r2.data.user;
            if(nu&&nu.identities&&!nu.identities.length){amsg(er,"Un compte existe déjà avec cet e-mail et un autre mot de passe. Déconnectez-vous puis connectez-vous avec celui de ce compte.");return;}
            if(r2.data.session){done(nu);return;}
            closeDlg();showDialog("Compte créé","Un e-mail de confirmation vient de vous être envoyé. Ouvrez-le pour activer votre compte, puis appuyez de nouveau sur « Finaliser ».","J’ai compris");
          });
        }
        go.disabled=false;amsg(er,r.error.code==="invalid_credentials"?"E-mail ou mot de passe incorrect.":authErr(r.error));
      });
    }).catch(function(){go.disabled=false;amsg(er,authErr(null));});
  });
  setTimeout(function(){pw.focus();},30);
}
document.addEventListener("click",function(e){if(e.target.closest&&e.target.closest("#pfin"))finalizeDialog();});
window.addEventListener("online",updPend);window.addEventListener("offline",updPend);

/* Identité locale d’un utilisateur Supabase (reprend les données d’un ancien compte local de même e-mail) */
function userFrom(su){
  var md=su.user_metadata||{},email=(su.email||"").toLowerCase();
  var name=(md.name||md.full_name||email.split("@")[0]||"Enseignant").trim();
  var u=ACC.users.find(function(x){return x.id===su.id});
  if(!u&&email){u=ACC.users.find(function(x){return(x.hash||x.pending)&&x.login===email});if(u)u.id=su.id;}
  if(u){delete u.hash;delete u.salt;delete u.pending;delete u.resync;u.name=name;u.school=md.school||u.school||"";u.login=email||u.login;}
  else{u={id:su.id,name:name,school:md.school||"",login:email,key:ACC.users.length?"appel-matin-u-"+su.id:"appel-matin-v1"};ACC.users.push(u);}
  saveAcc();return u;
}
function pushProfile(){if(sb&&ME)sb.auth.updateUser({data:{name:ME.name,school:ME.school||""}}).then(function(){},function(){});}
function initAuth(){
  if(!sb)return;
  sb.auth.onAuthStateChange(function(ev,s){
    setTimeout(function(){   /* hors du rappel : évite tout blocage interne de la bibliothèque */
      if(ev==="PASSWORD_RECOVERY"){RECOVERY=true;view="reset";render();return;}
      if(ev==="SIGNED_OUT"){if(ME)doLogout(true);return;}
      if(!s||!s.user||RECOVERY)return;
      if(ME&&ME.id===s.user.id){if(!col)initSync();return;}
      if(ME){stopSync();ME=null;}
      enter(userFrom(s.user));
    },0);
  });
}
