/* Suivi parent : lien secret en lecture seule vers le résumé d'un seul élève (voir supabase/partage-parents.sql) */
function shTok(){
  var a=new Uint8Array(24);crypto.getRandomValues(a);
  var s="";for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function shUrl(t){return new URL("parent.html?t="+encodeURIComponent(t),location.href).href;}
function shOn(){return!!(sb&&col);}

/* ---- Liaison avec le dossier de l'établissement (page admin.html) ----
   L'administrateur crée chaque élève et son code secret. L'enseignant ne reçoit qu'une référence aléatoire non secrète (« Réf ») :
   elle sert à rattacher son résumé au dossier de l'élève, mais ne permet de rien lire. Le code ne quitte jamais la page administrateur. */
var SH_RMIN=10;
function shRefNorm(v){return String(v==null?"":v).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,40);}
/* Clé de comparaison de noms indépendante de l'ordre (« Jean K. » = « K. Jean ») */
function shNameKey(n){return nrm(n).replace(/[^a-z0-9]+/g," ").trim().split(" ").sort().join(" ");}

/* Résumé publié : uniquement ce qui concerne cet élève (pas les observations privées, pas les autres élèves) */
function shSnap(c,s){
  var ks=Object.keys(c.records).sort(),n=0,a=0,r=0,j=0,L=[];
  ks.forEach(function(k){
    var v=c.records[k][s.id];if(!v)return;
    n++;
    if(v==="a"){a++;var q=gn(c,k,s.id);if(q.j===true)j++;L.push({d:k,v:"a",j:q.j===true,m:q.m||""});}
    else if(v==="r"){r++;L.push({d:k,v:"r",m:gn(c,k,s.id).m||""});}
  });
  L.sort(function(x,y){return x.d<y.d?1:-1;});
  var N=[],H={r:0,l:0,n:0};
  evs(c).slice().sort(function(x,y){return(x.d||"")<(y.d||"")?1:-1;}).forEach(function(e){
    var v=e.s&&e.s[s.id];
    if(typeof v==="number"&&e.m>0){
      var all=[];c.students.forEach(function(x){var w=e.s[x.id];if(typeof w==="number")all.push(w);});
      N.push({t:e.t||"Évaluation",d:e.d||"",n:v,m:e.m,k:e.k===undefined?1:e.k,c:all.length?Math.round(grMean(all)*100)/100:null});
    }
    if(e.h){var h=rdOf(e,s.id);if(h)H[h]++;}
  });
  var me=grAvgOf(c,s.id),cm=grMean(grStuAvgs(c));
  return{v:1,name:s.name,cls:c.name,subj:c.subj||"",teacher:(ME&&ME.name)||"",school:(ME&&ME.school)||"",
    pres:{n:n,a:a,r:r,j:j,p:n?Math.round((n-a)/n*1000)/10:null},abs:L.slice(0,200),
    avg:me===null?null:Math.round(me*100)/100,cavg:cm===null?null:Math.round(cm*100)/100,notes:N.slice(0,100),hw:H};
}
/* Empreinte d'un résumé : sert à ne renvoyer que les liens dont le contenu a changé */
function shHash(str){
  var h1=0xdeadbeef,h2=0x41c6ce57,i,ch;
  for(i=0;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}
/* Empreintes des résumés déjà publiés, gardées sur l'appareil : un envoi raté ou fait hors ligne sera donc rattrapé */
var shH=null,shHK="",shPend=true,shBusy=false,shAgain=false,shFail=0,shNext=0,shTimer=null;
function shHKey(){return KEY?KEY+"-shh":"";}
function shHLoad(){
  if(shH&&shHK===KEY)return;
  shHK=KEY;shH={};
  try{var o=JSON.parse(localStorage.getItem(shHKey())||"{}");if(o&&typeof o==="object"&&!Array.isArray(o))shH=o;}catch(e){}
}
function shHSave(){var k=shHKey();if(!k)return;try{localStorage.setItem(k,JSON.stringify(shH));}catch(e){}}
function shRow(c,s){
  var snap=shSnap(c,s);
  var row={token:s.sh,user_id:col.uid,class_id:c.id,student_id:s.id,snapshot:snap,updated_at:new Date().toISOString()};
  if(s.ref)row.ref=s.ref;   /* la colonne n'est envoyée que pour les élèves liés : les liens simples marchent même avant la mise à jour SQL */
  return{row:row,h:shHash(c.id+"|"+s.id+"|"+(s.ref||"")+"|"+JSON.stringify(snap))};
}
/* Envoi immédiat d'un seul résumé (création du lien, « Mettre à jour maintenant ») */
function shPush(c,s){
  var x=shRow(c,s);
  return sb.from("parent_shares").upsert(x.row,{onConflict:"token"}).then(function(r){
    if(!r.error){shHLoad();shH[s.sh]=x.h;shHSave();}
    return r;
  });
}
/* Envoi des seuls résumés modifiés, en une requête par paquet de 40 */
function shSweep(){
  if(!ME||!shOn()||!navigator.onLine)return;
  if(shBusy){shAgain=true;return;}
  shHLoad();
  var rows=[],hs=[],i,mk=false;
  liveCls().forEach(function(c){c.students.forEach(function(s){
    if(!s.sh&&s.ref){s.sh=shTok();mk=true;}   /* référence reçue par import : le jeton technique est créé ici */
    if(!s.sh)return;
    var x=shRow(c,s);
    if(shH[s.sh]===x.h)return;
    rows.push(x.row);hs.push([s.sh,x.h]);
  });});
  if(mk)save();
  if(!rows.length){shPend=false;shFail=0;return;}
  shBusy=true;
  function done(ok){
    shBusy=false;
    if(ok){shFail=0;shPend=false;shNext=0;}
    else{shFail++;shPend=true;shNext=Date.now()+Math.min(shFail,5)*60000;}
    if(shAgain){shAgain=false;shSweep();}
  }
  (function next(a){
    if(a>=rows.length){done(true);return;}
    sb.from("parent_shares").upsert(rows.slice(a,a+40),{onConflict:"token"}).then(function(r){
      if(r.error){done(false);return;}
      hs.slice(a,a+40).forEach(function(p){shH[p[0]]=p[1];});shHSave();
      next(a+40);
    },function(){done(false);});
  })(0);
}
function shKick(d,force){
  shPend=true;if(force)shNext=0;
  clearTimeout(shTimer);shTimer=setTimeout(shSweep,d===undefined?4000:d);
}
function shCard(s){
  var h='<div class="card" id="shc"><h2>Suivi parent (lien)</h2>';
  if(!shOn())return h+'<p class="sub" style="margin:0">Connectez-vous à votre compte (avec internet) pour créer un lien de suivi en lecture seule à envoyer au parent.</p></div>';
  if(s.ref)return h+'<p class="sub" style="margin:0 0 8px">✓ Élève lié au dossier de l’établissement : le résumé de votre matière apparaît dans le lien unique que l’administration remet à la famille. Vous n’avez rien à envoyer.</p>'+
    '<div class="pm-b"><button class="btn ghost" data-sh="up" data-sid="'+s.id+'">Mettre à jour maintenant</button><button class="btn ghost" data-sh="off" data-sid="'+s.id+'">Retirer la liaison</button></div><p class="sub" id="sh-msg" role="status" style="margin:8px 0 0"></p></div>';
  if(!s.sh)return h+'<p class="sub" style="margin-top:0">Créez un lien secret : le parent y voit uniquement les présences, notes et devoirs de '+esc(s.name)+' dans votre matière. Rien d’autre sur la classe.</p><button class="btn" data-sh="new" data-sid="'+s.id+'">Créer le lien</button><p class="sub" id="sh-msg" role="status" style="margin:8px 0 0"></p></div>';
  return h+'<input type="text" readonly id="sh-url" value="'+esc(shUrl(s.sh))+'" aria-label="Lien de suivi" style="width:100%"><div class="pm-b" style="margin-top:8px"><button class="btn" data-sh="wa" data-sid="'+s.id+'">WhatsApp</button><button class="btn ghost" data-sh="cp" data-sid="'+s.id+'">Copier</button></div>'+
    '<div class="pm-b" style="margin-top:8px"><button class="btn ghost" data-sh="up" data-sid="'+s.id+'">Mettre à jour maintenant</button><button class="btn ghost" data-sh="off" data-sid="'+s.id+'">Désactiver le lien</button></div>'+
    '<p class="sub" id="sh-msg" role="status" style="margin:8px 0 0">Le résumé se met à jour tout seul quand vous modifiez la classe, et dès que la connexion revient si vous étiez hors ligne. Quiconque a le lien peut le voir : ne l’envoyez qu’au parent.</p></div>';
}
/* Code famille : récupéré à la demande auprès de Supabase (jamais enregistré sur l’appareil ni dans les sauvegardes).
   Réservé aux enseignants dont l’élève est lié au dossier de l’établissement (voir supabase/code-enseignant.sql). */
function shFmtCode(k){return String(k).replace(/(.{4})(?=.)/g,"$1-");}
function shFamUrl(code){return new URL("parent.html?c="+encodeURIComponent(code),location.href).href;}
function shCodeCard(s){
  if(!s.ref)return"";
  var h='<div class="card" id="shcode"><h2>Code famille</h2>';
  if(!shOn())return h+'<p class="sub" style="margin:0">Connectez-vous (avec internet) pour afficher le code à remettre au parent.</p></div>';
  return h+'<p class="sub" style="margin:0 0 8px">Code donné par l’administration pour '+esc(s.name)+'. Remettez-le au parent : il ouvre le lien unique avec toutes les matières.</p>'+
    '<div id="shcode-out"></div><div class="pm-b"><button class="btn ghost" data-shc="show" data-sid="'+s.id+'">Afficher le code</button></div><p class="sub" id="shcode-msg" role="status" style="margin:8px 0 0"></p></div>';
}
document.getElementById("view").addEventListener("click",function(e){
  var b=e.target.closest("[data-shc]");if(!b)return;
  var s=cl().students.find(function(x){return x.id===b.dataset.sid;});if(!s||!s.ref)return;
  var msg=document.getElementById("shcode-msg"),out=document.getElementById("shcode-out");
  var say=function(t){if(msg)msg.textContent=t;};
  var act=b.dataset.shc;
  if(act==="show"){
    if(!shOn()){say("Connexion impossible pour le moment : vérifiez internet puis réessayez.");return;}
    say("Chargement…");
    sb.rpc("get_family_code",{p_ref:s.ref}).then(function(r){
      if(r.error){say("Échec : "+r.error.message+(/get_family_code|function/i.test(r.error.message||"")?" — exécutez d’abord supabase/code-enseignant.sql dans Supabase.":""));return;}
      if(!r.data){say("Code indisponible : l’administrateur ne vous a pas encore affecté cet élève. Demandez-lui de vous l’affecter (page administrateur, « Enseignants »).");return;}
      var code=String(r.data);
      out.innerHTML='<div style="margin:0 0 10px"><span class="cd" style="font:700 1.15rem/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;background:var(--soft,#e6ecf8);border-radius:8px;padding:6px 10px;display:inline-block">'+esc(shFmtCode(code))+'</span></div>'+
        '<div class="pm-b" style="margin-bottom:8px"><button class="btn" data-shc="wa" data-code="'+esc(code)+'" data-sid="'+s.id+'">WhatsApp</button><button class="btn ghost" data-shc="cp" data-code="'+esc(code)+'" data-sid="'+s.id+'">Copier le lien</button><button class="btn ghost" data-shc="hide" data-sid="'+s.id+'">Masquer</button></div>';
      b.hidden=true;say("Quiconque a ce code ou ce lien voit les résultats de l’élève : ne le remettez qu’à son parent.");
    },function(){say("Échec : pas d’internet.");});
  }else if(act==="hide"){
    if(out)out.innerHTML="";var sb2=document.querySelector('[data-shc="show"]');if(sb2)sb2.hidden=false;say("");
  }else if(act==="cp"){
    var u=shFamUrl(b.dataset.code);
    try{navigator.clipboard.writeText(u).then(function(){say("Lien copié.");},function(){say("Copie impossible : "+u);});}catch(er){say(u);}
  }else if(act==="wa"){
    var tel=pmIntl(s.p||""),code=b.dataset.code;
    var txt="Bonjour, voici le code pour suivre les présences et les notes de "+s.name+" : "+shFmtCode(code)+"\nLien : "+shFamUrl(code);
    window.open("https://wa.me/"+(tel||"")+"?text="+encodeURIComponent(txt),"_blank","noopener");
  }
});
function shErr(e){var m=(e&&e.message)||"erreur";return"Échec : "+(/row-level security|violates/i.test(m)&&/./.test(m)?"cet élève ne vous est pas affecté. Demandez à l’administrateur de vous l’affecter.":m);}
function shMsg(t){var e=document.getElementById("sh-msg");if(e)e.textContent=t;}
document.getElementById("view").addEventListener("click",function(e){
  var b=e.target.closest("[data-sh]");if(!b)return;
  var c=cl(),s=c.students.find(function(x){return x.id===b.dataset.sid;});if(!s)return;
  var act=b.dataset.sh;
  if(!shOn()){shMsg("Connexion impossible pour le moment : vérifiez internet puis réessayez.");return;}
  if(act==="new"){
    s.sh=shTok();shMsg("Création du lien…");
    shPush(c,s).then(function(r){
      if(r.error){delete s.sh;shMsg(shErr(r.error)+(/parent_shares|relation|schema/i.test(r.error.message||"")?" — exécutez d’abord supabase/partage-parents.sql dans Supabase.":""));return;}
      save();render();
    },function(){delete s.sh;shMsg("Échec : pas d’internet.");});
  }else if(act==="up"){
    shMsg("Mise à jour…");
    shPush(c,s).then(function(r){shMsg(r.error?shErr(r.error):"Résumé mis à jour.");},function(){shMsg("Échec : pas d’internet.");});
  }else if(act==="off"){
    if(!confirm(s.ref?"Retirer la liaison ? Cette matière disparaîtra du lien famille de l’établissement.":"Désactiver ce lien ? Le parent ne pourra plus l’ouvrir."))return;
    sb.from("parent_shares").delete().eq("token",s.sh).then(function(r){
      if(r.error){shMsg("Échec : "+r.error.message);return;}
      shHLoad();delete shH[s.sh];shHSave();delete s.sh;delete s.ref;save();render();
    },function(){shMsg("Échec : pas d’internet.");});
  }else if(act==="cp"){
    var u=shUrl(s.sh),ok=function(){shMsg("Lien copié.");};
    try{navigator.clipboard.writeText(u).then(ok,function(){var i=document.getElementById("sh-url");i.select();document.execCommand("copy");ok();});}catch(er){var i2=document.getElementById("sh-url");i2.select();}
  }else if(act==="wa"){
    var tel=pmIntl(s.p||"");
    var txt="Bonjour, voici le lien pour suivre les présences et les notes de "+s.name+" : "+shUrl(s.sh);
    window.open("https://wa.me/"+(tel||"")+"?text="+encodeURIComponent(txt),"_blank","noopener");
  }
});
/* Carte « Liaison avec l'établissement » de la page Gérer la classe */
function shRefCard(c){
  var n=c.students.filter(function(s){return s.ref;}).length,t=c.students.length;
  return'<div class="card"><h2>Lien parent unique (établissement)</h2><p class="sub" style="margin-top:0">L’administration crée un code secret pour chaque élève et vous remet une liste <b>Nom;Classe;Réf</b>. Importez-la avec « Importer un fichier Excel ou CSV » : vos élèves sont liés à leur dossier, et le parent reçoit de l’administration un seul lien pour toutes les matières. Vous ne voyez jamais le code.</p>'+
    '<p class="sub" style="margin:0">'+n+' élève'+(n>1?"s":"")+' sur '+t+' '+(n>1?"sont liés":"est lié")+'.</p>'+
    '<div class="pm-b" style="margin-top:10px"><button class="btn ghost" id="rflink">Lier automatiquement (compte administrateur)</button></div><p class="sub" id="rfmsg" role="status" style="margin:8px 0 0">Si vous êtes aussi l’administrateur, ce bouton lie tous vos élèves à leurs dossiers, sans fichier. Le code n’est jamais lu.</p></div>';
}
function shRfMsg(t){var e=document.getElementById("rfmsg");if(e)e.textContent=t;}
document.getElementById("view").addEventListener("click",function(e){
  if(!e.target.closest("#rflink"))return;
  if(!shOn()){shRfMsg("Connectez-vous à votre compte (avec internet) pour lier vos élèves.");return;}
  shRfMsg("Lecture des dossiers…");
  var reg=[];
  (function page(from){
    /* seules les colonnes nom, classe et référence sont demandées : jamais le code */
    sb.from("registry_students").select("name,class_label,ref").range(from,from+999).then(function(r){
      if(r.error){shRfMsg("Échec : "+r.error.message+(/registry_students|relation|schema/i.test(r.error.message||"")?" — exécutez d’abord supabase/partage-admin.sql dans Supabase.":""));return;}
      reg=reg.concat(r.data||[]);
      if((r.data||[]).length===1000){page(from+1000);return;}
      var ok=0,no=0;
      liveCls().forEach(function(c){
        var used={};c.students.forEach(function(s){if(s.ref)used[s.ref]=1;});
        c.students.forEach(function(s){
          if(s.ref)return;
          var k=shNameKey(s.name),m=reg.filter(function(x){return shNameKey(x.name)===k&&!used[x.ref];});
          if(m.length>1)m=m.filter(function(x){return nrm(x.class_label||"")===nrm(c.name);});
          if(m.length===1){s.ref=m[0].ref;used[s.ref]=1;if(!s.sh)s.sh=shTok();ok++;}else no++;
        });
      });
      if(ok){save();shKick(0,true);}
      render();shRfMsg(ok+" élève"+(ok>1?"s":"")+" lié"+(ok>1?"s":"")+(no?", "+no+" sans dossier correspondant (nom différent ou dossier absent).":"."));
    },function(){shRfMsg("Échec : pas d’internet.");});
  })(0);
});
/* Mise à jour automatique : quelques secondes après chaque enregistrement, au retour d'internet, et par reprise toutes les minutes si un envoi est en attente */
(function(){
  var base=save;
  save=function(){var r=base.apply(this,arguments);shKick(4000);return r;};
})();
window.addEventListener("online",function(){shKick(2000,true);});
document.addEventListener("visibilitychange",function(){if(!document.hidden&&shPend)shKick(3000);});
setInterval(function(){if(shPend&&!shBusy&&Date.now()>=shNext)shSweep();},60000);
shKick(8000);
