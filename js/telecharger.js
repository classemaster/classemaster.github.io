/* Téléchargement robuste, commun à toute l’application (index, admin).
   cmSave(nom, données, type, rappel) :
     1. capacité « downloads » de la plateforme (aperçu publié) quand elle existe ;
     2. partage de fichier natif sur iPhone/iPad ;
     3. téléchargement classique (lien « download ») ailleurs, Android compris ;
     4. dans tous les cas, un bandeau de secours reste affiché ~25 s avec :
        Enregistrer (vrai lien), Partager, Ouvrir, Copier le texte.
   « données » peut être une chaîne, un Blob, un Uint8Array ou une fonction qui les produit
   (les erreurs de génération sont alors affichées au lieu d’échouer en silence). */
var CM_DL={cap:null,done:false,p:null,box:null,timer:0};

function cmDlInit(){
  if(CM_DL.p)return CM_DL.p;
  if(!(window.claude&&window.claude.use)){CM_DL.done=true;CM_DL.p=Promise.resolve();return CM_DL.p;}
  var fin=function(x){CM_DL.cap=x&&typeof x.save==="function"?x:null;CM_DL.done=true;};
  var t=new Promise(function(r){setTimeout(function(){r(null);},4000);});
  CM_DL.p=Promise.race([Promise.resolve().then(function(){return window.claude.use("downloads");}),t]).then(fin,function(){fin(null);});
  return CM_DL.p;
}
cmDlInit();

function cmIOS(){
  var u=navigator.userAgent||"";
  return /iP(hone|ad|od)/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1);
}
function cmName(n){
  n=String(n||"fichier").replace(/[\\\/:*?"<>|\u0000-\u001f]+/g,"_").replace(/\s+/g," ").trim();
  return n||"fichier";
}
function cmBlob(data,type){
  if(typeof Blob!=="undefined"&&data instanceof Blob)return data;
  return new Blob([data],{type:type||"application/octet-stream"});
}
function cmIsText(type,name){return /^text\/|json|svg/.test(type||"")||/\.(csv|json|txt|svg)$/i.test(name||"");}

/* Bandeau de secours : actions réelles déclenchées par un geste de l’utilisateur */
function cmPanel(blob,name,url,type,note){
  try{
    cmPanelClose();
    var b=document.createElement("div");
    b.setAttribute("role","status");
    b.style.cssText="position:fixed;left:8px;right:8px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:99999;background:#16202e;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto";
    var t=document.createElement("div");t.style.cssText="font-weight:700;margin-bottom:4px;word-break:break-all";t.textContent="Fichier prêt : "+name;b.appendChild(t);
    if(note){var n=document.createElement("div");n.style.cssText="opacity:.85;margin-bottom:6px";n.textContent=note;b.appendChild(n);}
    var r=document.createElement("div");r.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px";
    function btn(label,el){el.textContent=label;el.style.cssText="background:#fff;color:#16202e;border:0;border-radius:10px;padding:9px 13px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer;min-height:40px;display:inline-flex;align-items:center";r.appendChild(el);return el;}
    var a=document.createElement("a");a.href=url;a.download=name;a.rel="noopener";btn("Enregistrer",a);
    var o=document.createElement("a");o.href=url;o.target="_blank";o.rel="noopener";btn("Ouvrir",o);
    try{
      var f=new File([blob],name,{type:blob.type||type});
      if(navigator.canShare&&navigator.share&&navigator.canShare({files:[f]})){
        var s=document.createElement("button");s.type="button";btn("Partager",s);
        s.addEventListener("click",function(){navigator.share({files:[f],title:name}).catch(function(){});});
      }
    }catch(e){}
    if(cmIsText(blob.type||type,name)&&navigator.clipboard&&blob.text){
      var cp=document.createElement("button");cp.type="button";btn("Copier le texte",cp);
      cp.addEventListener("click",function(){blob.text().then(function(x){cmCopy(x.replace(/^\ufeff/,""),function(g){cp.textContent=g?"Copié ✓":"Copie impossible";});});});
    }
    var x=document.createElement("button");x.type="button";x.setAttribute("aria-label","Fermer");btn("✕",x);x.style.background="transparent";x.style.color="#fff";x.addEventListener("click",cmPanelClose);
    b.appendChild(r);document.body.appendChild(b);CM_DL.box=b;
    CM_DL.timer=setTimeout(cmPanelClose,25000);
  }catch(e){}
}
function cmPanelClose(){
  try{clearTimeout(CM_DL.timer);if(CM_DL.box&&CM_DL.box.parentNode)CM_DL.box.parentNode.removeChild(CM_DL.box);}catch(e){}
  CM_DL.box=null;
}

function cmAnchor(url,name){
  var a=document.createElement("a");
  a.href=url;a.download=name;a.rel="noopener";a.style.display="none";
  document.body.appendChild(a);a.click();
  setTimeout(function(){try{a.remove();}catch(e){}},500);
}

function cmFallback(blob,name,type,cb,why){
  var url;
  try{url=URL.createObjectURL(blob);}catch(e){cb("Le navigateur ne permet pas de créer ce fichier.");return;}
  setTimeout(function(){try{URL.revokeObjectURL(url);}catch(e){}},300000);
  var sandbox=!!(window.claude&&!CM_DL.cap);
  function classic(){
    if(!sandbox){try{cmAnchor(url,name);}catch(e){}}   /* dans l’aperçu, un lien « download » peut faire quitter la page : on laisse le bandeau */
    if(sandbox){
      cmPanel(blob,name,url,type,"Aperçu : le téléchargement direct n’est pas disponible ici.");
      cb("Le téléchargement n’est pas disponible dans cet aperçu : ouvrez l’application depuis son adresse web."+(cmIsText(type,name)?" Vous pouvez aussi copier le texte ci-dessous.":""));
      return;
    }
    cmPanel(blob,name,url,type,why||"Si rien ne s’est enregistré, appuyez sur « Enregistrer ».");
    cb("Téléchargement lancé. S’il n’apparaît pas dans vos téléchargements, utilisez le bandeau « Fichier prêt » en bas de l’écran.");
  }
  if(cmIOS()&&!sandbox){
    try{
      var f=new File([blob],name,{type:blob.type||type});
      if(navigator.canShare&&navigator.share&&navigator.canShare({files:[f]})){
        navigator.share({files:[f],title:name}).then(function(){cb("Fichier partagé ou enregistré.");},function(e){
          if(e&&e.name==="AbortError"){cb("Partage annulé.");cmPanel(blob,name,url,type,"");}
          else classic();
        });
        return;
      }
    }catch(e){}
  }
  classic();
}

function cmSave(name,data,type,cb){
  cb=cb||function(){};
  name=cmName(name);
  var blob;
  try{
    if(typeof data==="function")data=data();
    if(data===null||data===undefined)throw new Error("aucune donnée");
    blob=cmBlob(data,type);
  }catch(e){cb("Impossible de créer le fichier. Fermez les autres onglets pour libérer de la mémoire, puis réessayez.");return;}
  if(!blob.size){cb("Le fichier est vide : rien à télécharger.");return;}
  function go(){
    if(CM_DL.cap){
      CM_DL.cap.save({filename:name,data:blob}).then(function(){
        cb("Fichier proposé : acceptez le téléchargement dans la fenêtre qui s’affiche.");
      },function(e){
        var c=e&&e.code;
        if(c==="declined"){cb("Téléchargement annulé.");return;}
        if(c==="rate_limited"){cb("Une demande de téléchargement est déjà ouverte : répondez-y puis réessayez.");return;}
        /* tout autre refus : on tente les autres stratégies plutôt que d’abandonner */
        cmFallback(blob,name,type,cb,"Le téléchargement automatique a échoué"+(c?" ("+c+")":"")+" : utilisez « Enregistrer ».");
      });
      return;
    }
    cmFallback(blob,name,type,cb);
  }
  if(CM_DL.done)go();else cmDlInit().then(go,go);
}

/* Copie robuste : execCommand dans le geste de l’utilisateur (marche partout), puis API presse-papiers,
   puis champ sélectionné à copier à la main. cmCopy(texte, rappel(ok:boolean)) */
function cmCopy(text,cb){
  cb=cb||function(){};
  text=String(text);
  var done=false;
  try{
    var ta=document.createElement("textarea");
    ta.value=text;ta.setAttribute("readonly","");
    ta.style.cssText="position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
    document.body.appendChild(ta);try{ta.focus({preventScroll:true});}catch(e){ta.focus();}ta.select();ta.setSelectionRange(0,text.length);
    done=!!document.execCommand("copy");
    ta.remove();
  }catch(e){done=false;}
  if(done){cb(true);return;}
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){cb(true);},function(){cb(false);});
      return;
    }
  }catch(e){}
  cb(false);
}

/* Filet de sécurité : une erreur inattendue affiche un message au lieu de laisser l’écran figé sans explication.
   Au plus un message toutes les 8 s ; les alertes sans danger du navigateur sont ignorées. */
(function(){
  var last=0;
  function say(msg){
    var m=String(msg||"");
    if(/ResizeObserver|Script error|Non-Error promise rejection|AbortError|NotAllowedError/i.test(m))return;
    var t=Date.now();if(t-last<8000)return;last=t;
    try{if(typeof toast==="function")toast("Un problème est survenu. Si l’écran semble déformé, rechargez la page (⟳).");}catch(e){}
  }
  window.addEventListener("error",function(e){say(e&&e.message);});
  window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;say(r&&r.message?r.message:r);});
})();
