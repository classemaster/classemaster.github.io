/* Socle commun des pages de l'établissement (v89).
   Fournit : la connexion, le contrôle d'accès, l'établissement courant, le menu commun, les messages à l'écran,
   le chargement des élèves et des suivis, et le calcul des indicateurs. Chaque page (js/etab-*.js) s'appuie dessus :
     Etab.start({page:"accueil", load:function(){…}, render:function(){return "<html>";}, after:function(){…}})
   Un seul nom global : « Etab ». */
var Etab=(function(){
  var E={me:null,ET:null,ETS:[],MEM:[],rows:[],TH:{moy:10,pres:80,abs:3},busy:false,cfg:null};
  var app=null;

  /* ---------- Outils ---------- */
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function nrm(x){return String(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
  function plural(n,a,b){return n+" "+(n>1?b:a);}
  function nf1(x){return x===null||x===undefined||isNaN(x)?"–":String(Math.round(x*10)/10).replace(".",",");}
  function pc(n,a){return n>0?Math.round((n-a)/n*1000)/10:null;}
  function mean(a){return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;}
  function ago(u){if(!u)return"jamais";var d=Math.floor((Date.now()-new Date(u).getTime())/864e5);return d<=0?"aujourd’hui":d===1?"hier":"il y a "+d+" jours";}
  function dstrOf(ms){var d=new Date(ms);return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2);}
  function todayS(){return dstrOf(Date.now());}
  function hmm(t){var p=String(t||"").split(":");return(+p[0]||0)*60+(+p[1]||0);}
  function schoolYear(){var d=new Date(),y=d.getFullYear();return d.getMonth()>=8?y+"-"+(y+1):(y-1)+"-"+y;}
  function etabCode(c){c=String(c||"");return c.length===8?c.slice(0,4)+"-"+c.slice(4):c;}
  /* « 2026-11-20 » donne « 20/11 » ; une date et une heure donnent « 20 nov. 14:05 » */
  function fd(s){return s?String(s).slice(8,10)+"/"+String(s).slice(5,7):"";}
  function fdt(v){if(!v)return"";var d=new Date(v);return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});}
  /* CSV pour Excel : séparateur « ; », virgule décimale, guillemets doublés */
  function csvNum(x){return x===null||x===undefined||isNaN(x)?"":String(Math.round(x*100)/100).replace(".",",");}
  function csvQ(x){return'"'+String(x).replace(/"/g,'""')+'"';}
  function csvLine(a){return a.map(function(x){return x===null||x===undefined?"":typeof x==="number"?csvNum(x):csvQ(x);}).join(";");}
  function tblCsv(T){return[csvLine(T.head)].concat(T.body.map(csvLine)).join("\r\n");}
  /* Enregistre un fichier CSV (js/telecharger.js doit être chargé par la page) */
  function download(name,txt,note){
    if(typeof cmSave!=="function"){say("Le téléchargement n’est pas disponible sur cette page.");return;}
    cmSave(name,"\ufeff"+txt,"text/csv",function(m){say(m+(note?" "+note:""));});
  }
  function kp(v,l){return'<div class="kpi"><b>'+v+'</b><span>'+l+'</span></div>';}
  function pbar(p,bad){return p===null?"":'<div class="pb"><i style="width:'+Math.max(2,Math.min(100,p))+'%'+(bad?";background:var(--a)":"")+'"></i></div>';}
  /* Ligne de liste : bouton (ou lien si href) quand la ligne est cliquable */
  function dr(t,s,tag,href,bad){
    var inner='<span><b>'+esc(t)+'</b><small>'+esc(s)+'</small></span>'+(tag?'<span class="tg'+(bad===true?" bad":bad===false?" ok":"")+'">'+esc(tag)+'</span>':"");
    return href?'<a class="dr" href="'+esc(href)+'">'+inner+'</a>':'<div class="dr">'+inner+'</div>';
  }
  /* Niveau d'une classe : « 5e A » et « 5eA » donnent « 5e », « Terminale D » donne « Terminale » */
  function lvl(c){
    c=String(c||"").trim();if(!c)return"Sans classe";
    var t=c.split(/[\s\-_\/]+/)[0],m=t.match(/^(\d{1,2}(?:ème|eme|è|e|ère|ere|er|nde))[A-Za-z]$/i);
    return m?m[1]:t;
  }
  function lvlRank(l){
    var m=l.match(/^(\d{1,2})/);
    if(m)return({6:1,5:2,4:3,3:4,2:5,1:6})[+m[1]]||50+ +m[1];
    if(/^t(erm|le)/i.test(l))return 7;
    return l==="Sans classe"?200:99;
  }
  function sortCls(a,b){return lvlRank(lvl(a))-lvlRank(lvl(b))||a.localeCompare(b,"fr",{numeric:true});}

  /* ---------- Messages d'erreur et message à l'écran ---------- */
  function frErr(e){var m=String((e&&e.message)||e||"").toLowerCase(),c=String((e&&e.code)||""),st=e&&e.status;
    if(navigator.onLine===false||st===0||/failed to fetch|networkerror|load failed|network request/.test(m))return"pas de connexion internet";
    if(st===401||c==="PGRST301"||/jwt|not authenticated|invalid token/.test(m))return"votre session a expiré, reconnectez-vous";
    if(c==="42501"||/row-level security|permission denied|violates|not admin/.test(m))return"action réservée à l’administrateur";
    if(st===429||/rate limit|too many/.test(m))return"trop de tentatives, patientez un moment";
    if(c==="23505"||/duplicate key/.test(m))return"cet élément existe déjà";
    if(c==="PGRST202"||c==="42883"||c==="42P01"||/does not exist|could not find the|schema cache/.test(m))return"élément absent côté serveur (installation incomplète)";
    if(st===408||st===504||/timeout|timed out/.test(m))return"le serveur met trop de temps à répondre";
    if(st>=500)return"le service est momentanément indisponible";
    return"erreur inattendue";}
  function fail(e){return"Échec : "+frErr(e)+(/registry_students|relation|schema/i.test((e&&e.message)||"")?" — exécutez d’abord supabase/partage-admin.sql dans Supabase.":"");}
  function say(t){
    var e=document.getElementById("msg");if(!e)return;
    e.textContent=t;
    /* le message est tout en bas de la page : on l'amène à l'écran pour qu'on le voie */
    if(t){e.style.cssText="position:sticky;bottom:12px;z-index:30;background:var(--surface,#fff);border:1px solid var(--line,#d6deea);border-radius:12px;padding:12px 14px;box-shadow:0 8px 24px rgba(10,18,34,.18);font-weight:600";try{e.scrollIntoView({block:"nearest",behavior:"smooth"});}catch(x){}}
    else e.style.cssText="";
  }

  /* ---------- Les rubriques de l'établissement ----------
     done:true  = la rubrique a sa propre page ; sinon elle s'ouvre encore dans l'ancienne page (legacy), ou n'existe pas encore (href vide).
     Quand une page est terminée (étapes 3B et 3C), on met done:true et son href ici : tout le menu suit. */
  var PAGES=[
    {id:"accueil",label:"Accueil",href:"etab-accueil.html",done:true},
    {id:"classes",label:"Classes",href:"etab-classes.html",done:true},
    {id:"enseignants",label:"Enseignants",href:"etab-enseignants.html",done:true},
    {id:"matieres",label:"Matières",href:"etab-matieres.html",done:true},
    {id:"programmes",label:"Programmes",href:"etab-programmes.html",done:true},
    {id:"resultats",label:"Résultats et assiduité",href:"etab-resultats.html",done:true},
    {id:"vie",label:"Vie scolaire",href:"etab-vie.html",done:true},
    {id:"fin",label:"Fin d’année",href:"etab-fin.html",done:true},
    {id:"parametres",label:"Paramètres",href:"etab-parametres.html",done:true}
  ];
  function pageOf(id){return PAGES.filter(function(p){return p.id===id;})[0]||null;}
  /* Adresse d'une rubrique ; pour une classe précise : Etab.href("classes",{c:"6e A"}) */
  function href(id,o){
    var p=pageOf(id);if(!p||!p.href)return"";
    if(id==="classes"&&o&&o.c!==undefined)return p.href+"#c="+encodeURIComponent(o.c);
    return p.href;
  }
  function pending(){return E.MEM.filter(function(m){return m.statut==="en_attente";}).length;}
  function menuHtml(cur){
    var n=pending(),legacy=PAGES.some(function(p){return!p.done&&p.href;});
    return'<nav class="pills etab-menu" aria-label="Rubriques de l’établissement">'+PAGES.map(function(p){
      var on=p.id===cur,badge=p.id==="enseignants"&&n?'<span class="tg bad">'+n+'</span>':"";
      if(!p.href)return'<span class="pill soon" aria-disabled="true" title="Disponible à l’étape suivante">'+esc(p.label)+'</span>';
      return'<a class="pill'+(on?" on":"")+'" href="'+esc(p.href)+'"'+(on?' aria-current="page"':"")+'>'+esc(p.label)+badge+'</a>';
    }).join("")+'</nav>'+(legacy?'<p class="sub etab-note">Les rubriques qui ne sont pas encore séparées s’ouvrent dans l’ancienne page de gestion.</p>':"");
  }

  /* ---------- Connexion ---------- */
  function login(note){
    app.innerHTML='<h1>Gestion de l’établissement</h1><p class="sub">Classe Master</p><div class="card"><h2>Connexion</h2><label for="em">E-mail</label><input id="em" type="email" autocomplete="username"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password"><div class="bs"><button class="btn" id="in">Se connecter</button></div><p class="sub" id="msg" role="status">'+esc(note||"")+'</p></div><p class="sub">Gardez ce mot de passe pour vous seul. Pas encore de compte ? Créez-le dans <a href="./">l’application</a> en choisissant « Chef d’établissement ».</p>';
    function go(){
      var em=document.getElementById("em").value.trim(),pw=document.getElementById("pw").value;
      if(!em||!pw){say("Entrez l’e-mail et le mot de passe.");return;}
      say("Connexion…");
      sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
        if(r.error){say(r.error.code==="invalid_credentials"?"E-mail ou mot de passe incorrect.":"Échec de la connexion : "+frErr(r.error));return;}
        if(!r.data||!r.data.session){say("Connexion impossible : réessayez.");return;}
        E.me=r.data.session.user;guard();
      },function(){say("Pas d’internet.");});
    }
    document.getElementById("in").onclick=go;
    document.getElementById("pw").onkeydown=function(e){if(e.key==="Enter")go();};
  }
  function logout(){
    var O=off();
    if(O&&(O.used||navigator.onLine===false)){
      if(!confirm("Se déconnecter sans internet ? Les données gardées sur cet appareil seront effacées et il faudra du réseau pour vous reconnecter."))return;
      O.disable().then(function(){cmEffacerHorsLigne();try{localStorage.removeItem("appel-supabase-auth");}catch(e){}location.reload();});return;
    }
    sb.auth.signOut().then(function(){E.me=null;E.rows=[];E.ET=null;E.ETS=[];E.MEM=[];login("Déconnecté.");});
  }

  /* ---------- Hors ligne (v99) : bandeau d'état et blocage des modifications ---------- */
  function off(){return typeof EtabOffline!=="undefined"?EtabOffline:null;}
  function readOnly(){var O=off();return!!(O&&(O.used||(O.enabled()&&navigator.onLine===false)));}
  /* Hors ligne, seuls restent actifs les contrôles qui ne font qu'afficher ou exporter sans code secret */
  var LIBRE='[role="tab"],[data-per],[data-fcl],[data-cls],#thr,#fsel,#rtay,#qs,#back,#jmore,#jless,#xjnl,#ex1,#rfilt select,#rfilt button,[id^="x-"],[id^="rf-"],[data-vue],#koff,[data-all]';
  function lock(v){
    if(!readOnly()||!v||!v.querySelectorAll)return;
    v.querySelectorAll("button,input,select,textarea").forEach(function(x){if(x.matches&&!x.matches(LIBRE)){x.disabled=true;x.title="Indisponible hors ligne";}});
  }
  function banner(){
    var b=document.getElementById("offb"),O=off();if(!b||!O)return;
    if(!readOnly()){b.innerHTML="";return;}
    var back=O.used&&navigator.onLine!==false;
    b.innerHTML='<div class="al" role="status"><b>Hors ligne : consultation seule</b><span>'+
      (O.since?"Données enregistrées le "+esc(fdt(O.since))+".":"Les données affichées viennent de cet appareil.")+
      (O.missing?" Certaines parties n’ont pas été enregistrées : ouvrez cette rubrique une fois avec internet.":"")+'</span>'+
      (back?'<button type="button" class="btn ghost" id="offr">Actualiser avec internet</button>':"")+'</div>';
    var r=document.getElementById("offr");if(r)r.onclick=function(){location.reload();};
  }

  /* ---------- Contrôle d'accès : seuls les administrateurs d'un établissement entrent ---------- */
  function guard(){
    sb.rpc("is_admin").then(function(r){
      if(r.error||r.data===true){loadEtab();return;}
      app.innerHTML='<div style="text-align:center;padding:40px 10px"><h1>Accès réservé</h1><p class="sub">Le compte '+esc((E.me&&E.me.email)||"")+' n’a pas accès à la gestion d’un établissement. Si vous venez de créer votre établissement, il doit d’abord être validé par un administrateur de Classe Master ; s’il a été suspendu, contactez-le.</p><div class="bs" style="justify-content:center"><a class="btn ghost" href="./" style="text-decoration:none">← Retour à l’application</a><a class="btn ghost" href="contact.html" style="text-decoration:none">Contacter un administrateur</a><button class="btn ghost" id="out2">Se déconnecter</button></div></div>';
      document.getElementById("out2").onclick=logout;
    },function(){login("Pas d’internet.");});
  }

  /* ---------- Établissement courant ---------- */
  function setTh(){var t=E.ET;E.TH.moy=+(t&&t.seuil_moy)||10;E.TH.pres=+(t&&t.seuil_pres)||80;E.TH.abs=+(t&&t.seuil_abs)||3;}
  E.setTh=setTh;
  /* paramètres RPC + établissement actif */
  function ep(o){var r={},k;if(E.ET)r.p_etab=E.ET.id;for(k in(o||{}))r[k]=o[k];return r;}
  function loadMembres(then){
    sb.rpc("etab_membres_liste",{p_etab:E.ET.id}).then(function(m){E.MEM=m.error?E.MEM:(m.data||[]);then();},function(){then();});
  }
  function loadEtab(){
    sb.rpc("mes_etablissements").then(function(r){
      /* une panne de réseau n'est pas une absence d'établissement */
      if(r.error&&frErr(r.error)==="pas de connexion internet"){unreachable();return;}
      var l=r.error?[]:(Array.isArray(r.data)?r.data:[]);
      E.ETS=l.filter(function(e){return e.role==="admin";});
      if(!E.ETS.length){
        app.innerHTML='<div style="text-align:center;padding:40px 10px"><h1>Aucun établissement</h1><p class="sub">Ce compte ne gère aucun établissement pour le moment. Créez ou rejoignez-en un depuis l’application.</p><div class="bs" style="justify-content:center"><a class="btn ghost" href="./" style="text-decoration:none">← Retour à l’application</a></div></div>';
        return;
      }
      var sv="";try{sv=localStorage.getItem("cm-admin-etab")||"";}catch(e){}
      E.ET=E.ETS.filter(function(e){return e.id===sv;})[0]||E.ETS[0];setTh();
      loadMembres(enter);
    },unreachable);
  }
  function unreachable(){
    app.innerHTML='<div style="text-align:center;padding:40px 10px"><h1>Pas de connexion</h1><p class="sub">Aucune donnée de l’établissement n’est disponible sur cet appareil. Connectez-vous à internet, puis réessayez. Pour consulter hors ligne la prochaine fois, cochez « Garder les données sur cet appareil » dans Paramètres.</p><div class="bs" style="justify-content:center"><button class="btn" id="retry">Réessayer</button><a class="btn ghost" href="./" style="text-decoration:none">← Retour à l’application</a></div></div>';
    document.getElementById("retry").onclick=function(){location.reload();};
  }
  function switchEtab(id){
    var e=E.ETS.filter(function(x){return x.id===id;})[0];if(!e)return;
    E.ET=e;setTh();E.rows=[];E.MEM=[];try{localStorage.setItem("cm-admin-etab",id);}catch(x){}
    if(E.cfg&&E.cfg.reset)E.cfg.reset();
    loadMembres(enter);
  }
  /* Recharge la liste des membres puis redessine (après une acceptation, un retrait…) */
  function reloadMem(msg){loadMembres(function(){shell();E.render();if(msg)say(msg);if(E.cfg&&E.cfg.onMembres)E.cfg.onMembres();});}

  /* Appel d'une fonction d'écriture de l'établissement : un seul à la fois, message clair en cas de refus */
  var ERR={last_admin:"Vous êtes le seul chef : nommez d’abord un autre chef.",not_member:"Cet enseignant n’est plus membre, ou sa demande a déjà été traitée.",bad_threshold:"Valeurs hors limites (moyenne 1 à 19, présence 10 à 100 %, absences 1 à 14).",bad_message:"Écrivez un titre (100 caractères max.) et un message (1 000 max.).",too_many_messages:"Limite atteinte : 20 messages par jour.",no_students:"Aucun élève à déplacer.",too_many_students:"Trop d’élèves à la fois (1 000 max.).",bad_name:"Le nom est vide ou trop long.",exists:"Cet élément existe déjà.",in_use:"Cette matière est encore donnée à un enseignant : retirez d’abord ses affectations.",not_found:"Élément introuvable : il a peut-être déjà été supprimé.",class_not_found:"Cette classe n’existe plus ou est archivée.",subject_not_found:"Cette matière n’existe plus.",already_applied:"Ce passage a déjà été appliqué. Annulez-le d’abord si vous voulez le refaire.",bad_year:"Année invalide.",bad_moves:"Passage invalide.",nothing:"Aucun passage à annuler.",bad_niveau:"Le niveau est vide ou trop long (40 caractères au plus).",bad_matiere:"La matière est vide ou trop longue (60 caractères au plus).",bad_mois:"Choisissez un mois de septembre à juin.",no_titles:"Écrivez au moins une leçon.",too_many:"Trop de leçons : 200 à la fois, et 300 au plus pour un même niveau, une matière et un mois.",title_too_long:"Une leçon dépasse 200 caractères : raccourcissez-la.",bad_title:"Le titre de la leçon est vide ou dépasse 200 caractères.",out_of_scope:"Ce niveau ou cette matière n’est pas celui de vos classes.",not_yours:"Cette leçon n’est pas la vôtre : vous ne pouvez pas la modifier."};
  /* ok(d) reçoit la réponse (objet, nombre ou liste) ; bad(erreur) peut renvoyer true pour écrire elle-même le message d'échec */
  /* messages propres à une fonction du serveur (clé « fonction:code »), prioritaires sur ERR */
  var ERR_FN={
    "etab_programme_modifier:exists":"Une autre leçon de ce mois porte déjà ce titre.",
    "etab_programme_modifier:not_found":"Cette leçon n’existe plus : elle a été retirée entre-temps.",
    "etab_programme_retirer:not_found":"Cette leçon n’existe plus : elle a déjà été retirée.",
    "etab_programme_retirer_mois:not_found":"Ce mois n’a plus de leçons : elles ont déjà été retirées."
  };
  function call(fn,args,ok,bad){
    if(readOnly()){say("Hors ligne : modification impossible. Reconnectez-vous puis actualisez la page.");return;}
    if(E.busy)return;E.busy=true;
    sb.rpc(fn,args).then(function(r){
      E.busy=false;
      if(r.error){if(bad&&bad(r.error)===true)return;say(fail(r.error));return;}
      var d=r.data;
      if(d&&d.ok===false){say(ERR_FN[fn+":"+d.err]||ERR[d.err]||"Action impossible pour le moment.");return;}
      ok(d===null||d===undefined?{}:d);
    },function(){E.busy=false;say("Pas d’internet.");});
  }

  /* ---------- Cadre commun : en-tête, menu, zone de la page, pied ---------- */
  function shell(){
    var t=E.ET,cur=E.cfg.page;
    app.innerHTML='<a class="back" href="./">← Application</a>'+
      '<div class="etab-head"><h1>'+esc(t.nom)+'</h1><p class="sub">'+(t.ville?esc(t.ville)+' · ':"")+esc((E.me&&E.me.email)||"")+'</p></div>'+
      (E.ETS.length>1?'<div class="etab-sw"><label for="esw">Établissement</label><select id="esw">'+E.ETS.map(function(e){return'<option value="'+esc(e.id)+'"'+(e.id===t.id?" selected":"")+'>'+esc(e.nom)+'</option>';}).join("")+'</select></div>':"")+
      menuHtml(cur)+
      '<div id="offb"></div>'+
      '<div id="view" aria-live="polite"></div>'+
      '<div class="pills etab-foot"><a class="pill" href="aide-etablissement.html">Guide</a><a class="pill" href="contact.html">Contacter un administrateur</a><button type="button" class="pill" id="out">Se déconnecter</button></div>'+
      '<p class="sub" id="msg" role="status"></p>';
    var sw=document.getElementById("esw");if(sw)sw.onchange=function(){switchEtab(sw.value);};
    document.getElementById("out").onclick=logout;
    banner();
  }
  /* Dessine la page : le contenu vient de cfg.render(), puis cfg.after() branche les boutons */
  E.render=function(){
    var v=document.getElementById("view");if(!v||!E.cfg)return;
    v.innerHTML=E.cfg.render();
    if(E.cfg.after)try{E.cfg.after(v);}catch(e){}
    lock(v);banner();
  };
  function enter(){shell();E.render();if(E.cfg.load)E.cfg.load();}

  /* ---------- Chargement des données (pages de 1 000 lignes) ---------- */
  /* Élèves de l'établissement. fields : colonnes voulues (les codes secrets ne sont demandés que par la page Classes). */
  E.loadStudents=function(fields,done){
    var out=[];
    (function page(from){
      var q=sb.from("registry_students").select(fields+",etab_id").eq("etab_id",E.ET.id);
      q.order("class_label").order("name").range(from,from+999).then(function(r){
        if(r.error){done(null,r.error);return;}
        out=out.concat(r.data||[]);
        if((r.data||[]).length===1000)page(from+1000);else{E.rows=out;done(out);}
      },function(){done(null,{message:"failed to fetch"});});
    })(0);
  };
  /* Suivis publiés par les enseignants (présences, moyennes) : un résultat par élève et par matière */
  E.loadDash=function(done){
    var out=[];
    (function page(from){
      sb.rpc("admin_dashboard",ep()).range(from,from+999).then(function(r){
        if(r.error){done(null,r.error);return;}
        out=out.concat(r.data||[]);
        if((r.data||[]).length===1000)page(from+1000);else done(out);
      },function(){done(null,{message:"failed to fetch"});});
    })(0);
  };
  E.loadTeaching=function(done){
    sb.rpc("admin_teaching",ep()).then(function(r){if(r.error)done(null,r.error);else done(r.data||[]);},function(){done(null,{message:"failed to fetch"});});
  };
  E.loadDiscipline=function(done){
    sb.rpc("admin_discipline",ep()).then(function(r){if(r.error)done(null,r.error);else done((Array.isArray(r.data)?r.data:[]).filter(function(x){return x&&x.k!=="avt";}));   /* les avertissements se lisent dans la fiche de l'élève (v134) */},function(){done(null,{message:"failed to fetch"});});
  };

  /* ---------- Indicateurs : un cumul par élève, par classe, par enseignant et par matière ---------- */
  E.model=function(rows,dash){
    var TH=E.TH,byId={},S={},T={},C={},SJ={},last="",n0=0,a0=0;
    rows.forEach(function(r){byId[r.id]=r;var k=r.class_label||"";(C[k]=C[k]||{eff:0,fol:0,n:0,a:0,j:0,r:0,m:[],t:[[],[],[]]}).eff++;});
    dash.forEach(function(d){
      var r=byId[d.student_id];if(!r)return;
      var k=r.class_label||"",c=C[k],st=S[d.student_id]||(S[d.student_id]={n:0,a:0,j:0,r:0,ra:0,av:[],bs:{},t:[[],[],[]]});
      st.n+=d.n||0;st.a+=d.a||0;st.j+=d.j||0;st.r+=d.r||0;st.ra+=d.recent_a||0;
      if(d.avg!==null&&d.avg!==undefined){st.av.push(+d.avg);var sj=d.subj||"—";(st.bs[sj]=st.bs[sj]||[]).push(+d.avg);var o=SJ[sj]||(SJ[sj]={v:[],ok:0});o.v.push(+d.avg);if(+d.avg>=TH.moy)o.ok++;}
      ["t1","t2","t3"].forEach(function(q,i){if(d[q]!==null&&d[q]!==undefined){c.t[i].push(+d[q]);st.t[i].push(+d[q]);}});
      var tk=d.teacher||"(enseignant sans nom)",t=T[tk]||(T[tk]={name:tk,subj:{},cls:{},last:""});
      t.subj[d.subj||"—"]=1;t.cls[k||"(sans classe)"]=1;if(d.updated_at&&d.updated_at>t.last)t.last=d.updated_at;
      if(d.updated_at&&d.updated_at>last)last=d.updated_at;
    });
    var ids=Object.keys(S).filter(function(i){return byId[i];}),means=[];
    ids.forEach(function(i){var s=S[i],c=C[byId[i].class_label||""];s.m=mean(s.av);n0+=s.n;a0+=s.a;c.fol++;c.n+=s.n;c.a+=s.a;c.j+=s.j;c.r+=s.r;if(s.m!==null){c.m.push(s.m);means.push(s.m);}});
    return{byId:byId,S:S,T:T,C:C,SJ:SJ,last:last,ids:ids,means:means,N:n0,A:a0,gm:mean(means)};
  };
  /* Appel du jour d'une classe : ok = fait, miss = séance terminée sans appel, soon = séance à venir, none = pas de séance, unk = pas d'emploi du temps */
  E.tstat=function(g){
    var now=new Date(),nm=now.getHours()*60+now.getMinutes(),tt=Array.isArray(g.tt)?g.tt:[],S=tt.filter(function(x){return x[0]===now.getDay();});
    if(g.lc===todayS())return"ok";
    if(S.length)return S.some(function(x){return hmm(x[2])<=nm;})?"miss":"soon";
    return tt.length?"none":"unk";
  };
  /* Évaluations vieilles de plus de 7 jours dont moins de la moitié de la classe a une note */
  E.evLate=function(g){var ev=g.ev;if(!ev||!Array.isArray(ev.l))return[];var lim=dstrOf(Date.now()-7*864e5),ne=+ev.ne||0;return ev.l.filter(function(x){return x[0]<=lim&&x[1]<ne/2;});};
  E.tname=function(g){return g.teacher||"(enseignant sans nom)";};
  E.get=function(id){return E.rows.filter(function(r){return r.id===id;})[0];};

  /* ---------- Filtres classe / matière / enseignant (v98 : partagés par l'Accueil et Résultats) ----------
     La classe filtre les élèves ; la matière et l'enseignant filtrent les suivis publiés. Les moyennes se recalculent sur ce qui reste. */
  E.filters=function(getDash){
    var NOCLS="~",NOTCH="(enseignant sans nom)",F={c:"",s:"",t:""},V=null,me={F:F,NOCLS:NOCLS,NOTCH:NOTCH};
    function uniq(a){var o={};a.forEach(function(x){o[x]=1;});return Object.keys(o);}
    function fr(a,b){return String(a).localeCompare(String(b),"fr");}
    me.fr=fr;
    me.options=function(){
      var d=getDash()||[];
      return{c:uniq(E.rows.map(function(r){return r.class_label||NOCLS;})).sort(function(a,b){return a===NOCLS?1:b===NOCLS?-1:E.sortCls(a,b);}),
        s:uniq(d.map(function(x){return x.subj||"—";})).sort(fr),t:uniq(d.map(function(x){return x.teacher||NOTCH;})).sort(fr)};
    };
    /* un filtre dont la valeur n'existe plus (rechargement) est effacé */
    me.check=function(o){["c","s","t"].forEach(function(k){if(F[k]&&o[k].indexOf(F[k])<0){F[k]="";V=null;}});};
    me.active=function(){return!!(F.c||F.s||F.t);};
    me.reset=function(){V=null;};
    function sel(id,label,list,val,fmt){
      return'<label class="rf" for="'+id+'"><span>'+label+'</span><select id="'+id+'"><option value="">Tous</option>'+list.map(function(v){return'<option value="'+esc(v)+'"'+(v===val?" selected":"")+'>'+esc(fmt?fmt(v):v)+'</option>';}).join("")+'</select></label>';
    }
    me.bar=function(o){
      return'<section class="card" id="rfilt" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end"><p class="sub" style="width:100%;margin:0"><b>Filtrer</b></p>'+
        sel("rf-c","Classe",o.c,F.c,function(v){return v===NOCLS?"(sans classe)":v;})+sel("rf-s","Matière",o.s,F.s,function(v){return v==="—"?"(sans matière)":v;})+sel("rf-t","Enseignant",o.t,F.t)+
        (me.active()?'<button type="button" class="btn ghost" id="rf-x">Effacer les filtres</button>':"")+'</section>';
    };
    me.view=function(){
      if(V)return V;
      var dash=getDash()||[],rows=E.rows.filter(function(r){return!F.c||(r.class_label||NOCLS)===F.c;}),keep={};
      rows.forEach(function(r){keep[r.id]=1;});
      V={rows:rows,dash:dash.filter(function(x){return keep[x.student_id]&&(!F.s||(x.subj||"—")===F.s)&&(!F.t||(x.teacher||NOTCH)===F.t);})};return V;
    };
    me.note=function(){
      var a=[];if(F.c)a.push(F.c===NOCLS?"(sans classe)":F.c);if(F.s)a.push(F.s==="—"?"(sans matière)":F.s);if(F.t)a.push(F.t);
      return a.length?'<p class="sub" id="rf-note">Filtres : '+esc(a.join(" · "))+'.</p>':"";
    };
    /* « Toutes classes » ou la classe choisie, suivie de la matière et de l'enseignant s'ils sont filtrés (sous-titre des graphiques) */
    me.scope=function(){
      var a=[F.c?(F.c===NOCLS?"(sans classe)":F.c):"Toutes classes"];if(F.s)a.push(F.s==="—"?"(sans matière)":F.s);if(F.t)a.push(F.t);
      return a.join(" · ");
    };
    /* matières ayant au moins une moyenne dans la sélection : la « moyenne générale » repose sur elles */
    me.subjects=function(){
      var o={};me.view().dash.forEach(function(x){if(x.avg!==null&&x.avg!==undefined)o[x.subj||"—"]=1;});
      return Object.keys(o).sort(fr);
    };
    me.generalNote=function(){
      var L=me.subjects();if(!L.length)return"";
      var nm=function(x){return x==="—"?"(sans matière)":x;};
      if(L.length===1&&!F.s)return'<p class="sub" id="rf-gen">Une seule matière a publié des moyennes (<b>'+esc(nm(L[0]))+'</b>) : la moyenne affichée est celle de cette matière, pas encore une moyenne générale. Elle se complète à mesure que les autres enseignants publient.</p>';
      if(F.s)return'<p class="sub" id="rf-gen">Moyenne de la matière <b>'+esc(nm(F.s))+'</b> seulement.</p>';
      return'<p class="sub" id="rf-gen">Moyenne générale : moyenne des matières de chaque élève ('+L.length+' matières publiées : '+esc(L.map(nm).join(", "))+'), chaque matière comptant pour une.</p>';
    };
    me.bind=function(cb){
      [["rf-c","c"],["rf-s","s"],["rf-t","t"]].forEach(function(p){var e=document.getElementById(p[0]);if(e)e.onchange=function(){F[p[1]]=e.value;V=null;var y=window.scrollY;cb();window.scrollTo(0,y);};});
      var x=document.getElementById("rf-x");if(x)x.onclick=function(){F.c=F.s=F.t="";V=null;cb();};
    };
    return me;
  };

  /* ---------- Démarrage d'une page ---------- */
  E.start=function(cfg){
    E.cfg=cfg;app=document.getElementById("app");
    if(typeof sb==="undefined"||!sb){app.innerHTML='<div style="text-align:center;padding:40px 10px"><h1>Indisponible</h1><p class="sub">La connexion au serveur n’est pas configurée.</p></div>';return;}
    var O=off();
    if(O){
      O.onchange=banner;
      window.addEventListener("online",function(){banner();});
      window.addEventListener("offline",function(){E.render();});
      O.session(function(u){if(u){E.me=u;guard();}else login(navigator.onLine===false?"Pas d’internet.":"");});
      return;
    }
    sb.auth.getSession().then(function(r){
      var s=r&&r.data&&r.data.session;
      if(s){E.me=s.user;guard();}else login();
    },function(){login("Pas d’internet.");});
  };

  E.esc=esc;E.nrm=nrm;E.plural=plural;E.nf1=nf1;E.pc=pc;E.mean=mean;E.ago=ago;E.kp=kp;E.dr=dr;E.stu=function(id,t,s,tag,bad){return id&&typeof EtabFiche!=="undefined"?EtabFiche.row(id,t,s,tag,bad):dr(t,s,tag,undefined,bad);};E.pbar=pbar;
  E.fd=fd;E.fdt=fdt;E.csvNum=csvNum;E.csvLine=csvLine;E.tblCsv=tblCsv;E.download=download;
  E.dstrOf=dstrOf;E.todayS=todayS;E.schoolYear=schoolYear;E.etabCode=etabCode;
  E.lvl=lvl;E.lvlRank=lvlRank;E.sortCls=sortCls;
  E.readOnly=readOnly;E.frErr=frErr;E.fail=fail;E.say=say;E.ep=ep;E.call=call;E.reloadMem=reloadMem;E.pending=pending;
  E.href=href;E.pages=PAGES;E.pageOf=pageOf;
  return E;
})();
