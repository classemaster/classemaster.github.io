/* Page « Enseignants » de l'établissement (v90, complétée en v93) : demandes à valider, équipe, affectations classes + matières,
   anciens accès par e-mail et classe (accordés avant la v87).
   Étape 12 (v114) : panneau « Donner plusieurs classes » dans la fiche de chaque enseignant : cases à cocher groupées par niveau, « Tout cocher »
   (tout, ou un niveau), compteur. La sélection reste en mémoire pendant la visite de la page.
   Étape 13 (v115) : une matière pour tout le lot (ou aucune) et le bouton « Affecter N classes » : une demande etab_affecter par classe, l'une après l'autre ;
   les classes déjà reçues avec la même matière sont sautées, une classe en échec ne bloque pas les suivantes, la sélection réussie est vidée.
   Étape 14 (v116) : bouton « Retirer N classes » : une demande etab_desaffecter par classe cochée, après confirmation ; avec une matière choisie on ne retire que celle-ci,
   sans matière on retire toutes les affectations de la classe ; les classes non reçues sont sautées, un échec ne bloque pas les suivantes.
   S'appuie sur le socle js/etab-core.js ; fonctions serveur : etablissements-v60.sql (membres, anciens accès) et classes-matieres-v87.sql (affectations). */
(function(){
  var E=Etab,esc=E.esc,aff=null,cls=[],mat=[],loadErr="",old=null,showOld=false,SEL={},LOTOPEN={},LOTMAT={},LOTBUSY=false;

  function load(){
    aff=null;cls=[];mat=[];loadErr="";old=null;E.render();
    var k=0;function done(){if(++k===4)E.render();}
    sb.rpc("etab_affectations_liste",{p_etab:E.ET.id}).then(function(r){if(r.error){loadErr=E.fail(r.error);aff=[];}else aff=r.data||[];done();},function(){loadErr="Pas d’internet.";aff=[];done();});
    sb.rpc("etab_classes_liste",{p_etab:E.ET.id}).then(function(r){cls=r.error?[]:(r.data||[]).filter(function(c){return!c.archivee;}).sort(function(a,b){return E.sortCls(a.nom,b.nom);});done();},function(){done();});
    sb.rpc("etab_matieres_liste",{p_etab:E.ET.id}).then(function(r){mat=r.error?[]:(r.data||[]);done();},function(){done();});
    sb.rpc("admin_assignments",{p_etab:E.ET.id}).then(function(r){old=r.error?[]:(r.data||[]);done();},function(){old=[];done();});
  }
  /* recharge seulement la liste des anciens accès */
  function loadOld(){
    sb.rpc("admin_assignments",{p_etab:E.ET.id}).then(function(r){old=r.error?old:(r.data||[]);E.render();},function(){});
  }

  function ofUser(id){return(aff||[]).filter(function(a){return a.user_id===id;});}

  function pendingHtml(L){
    if(!L.length)return"";
    return'<div class="al" role="status"><b>'+E.plural(L.length,"demande en attente","demandes en attente")+'</b> : acceptez ou refusez ci-dessous.</div>'+
      L.map(function(m){return'<div class="st mrow"><div class="mi"><b>'+esc(m.nom||m.email)+'</b> · <span class="tg bad">en attente</span><br><span class="sub" style="margin:0">'+esc(m.email)+'</span></div>'+
        '<div class="mb"><button class="btn" data-acc="'+esc(m.user_id)+'">Accepter</button><button class="btn warn" data-ref="'+esc(m.user_id)+'">Refuser</button></div></div>';}).join("");
  }

  function affectForm(m){
    if(!cls.length)return'<p class="sub" style="margin:8px 0 0">Créez d’abord une classe dans la rubrique « Classes ».</p>';
    return'<div class="af"><label for="ac'+esc(m.user_id)+'">Donner une classe</label><select id="ac'+esc(m.user_id)+'">'+cls.map(function(c){return'<option value="'+esc(c.id)+'">'+esc(c.nom)+'</option>';}).join("")+'</select>'+
      '<label for="am'+esc(m.user_id)+'">Matière</label><select id="am'+esc(m.user_id)+'"><option value="">Sans matière précise</option>'+mat.map(function(x){return'<option value="'+esc(x.id)+'">'+esc(x.nom)+'</option>';}).join("")+'</select>'+
      '<div class="bs"><button class="btn" data-give="'+esc(m.user_id)+'">Affecter</button></div></div>';
  }

  /* ---- Étape 12 : sélection de plusieurs classes ---- */
  function selOf(uid){return SEL[uid]||(SEL[uid]={});}
  /* classes regroupées par niveau (« 6e », « 5e »… dans l'ordre des niveaux), puis « Sans classe » en dernier */
  function groups(){
    var g={},ks=[];
    cls.forEach(function(c){var k=E.lvl(c.nom);if(!g[k]){g[k]=[];ks.push(k);}g[k].push(c);});
    ks.sort(function(a,b){return E.lvlRank(a)-E.lvlRank(b)||a.localeCompare(b,"fr",{numeric:true});});
    return ks.map(function(k){return{k:k,L:g[k]};});
  }
  function nSel(uid){var S=selOf(uid);return cls.filter(function(c){return S[c.id];}).length;}
  function lotPanel(m){
    if(!cls.length)return"";
    var uid=m.user_id,S=selOf(uid),n=nSel(uid),had={};
    ofUser(uid).forEach(function(a){had[a.classe_id]=1;});
    var all=n===cls.length;
    var h='<details class="lot" data-lotp="'+esc(uid)+'" style="margin-top:10px"'+(LOTOPEN[uid]?" open":"")+'><summary>Donner plusieurs classes</summary>'+
      '<div class="bs" style="margin:8px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button class="btn ghost" data-lotall="'+esc(uid)+'">'+(all?"Tout décocher":"Tout cocher")+'</button>'+
      '<span class="sub" style="margin:0" role="status">'+(n?E.plural(n,"classe sélectionnée","classes sélectionnées"):"Aucune classe sélectionnée")+'</span></div>'+
      '<label for="lm'+esc(uid)+'">Matière pour ces classes</label><select id="lm'+esc(uid)+'" data-lotm="'+esc(uid)+'"><option value="">Sans matière précise</option>'+mat.map(function(x){return'<option value="'+esc(x.id)+'"'+(LOTMAT[uid]===x.id?" selected":"")+'>'+esc(x.nom)+'</option>';}).join("")+'</select>'+
      '<p class="sub" style="margin:4px 0 0">Pour retirer : « Sans matière précise » retire toutes les matières de la classe.</p>'+
      '<div class="bs" style="margin:8px 0;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-lotgo="'+esc(uid)+'"'+(n?"":" disabled")+'>'+(n?"Affecter "+E.plural(n,"classe","classes"):"Affecter")+'</button>'+
      '<button class="btn warn" data-lotrm="'+esc(uid)+'"'+(n?"":" disabled")+'>'+(n?"Retirer "+E.plural(n,"classe","classes"):"Retirer")+'</button></div>';
    groups().forEach(function(g){
      var k=g.k,ns=g.L.filter(function(c){return S[c.id];}).length,full=ns===g.L.length;
      h+='<div class="st" style="padding:6px 0"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>'+esc(k)+'</b> <span class="sub" style="margin:0">'+ns+' / '+g.L.length+'</span>'+
        '<button class="btn ghost" style="min-height:34px;padding:4px 10px" data-lotniv="'+esc(uid)+'|'+esc(k)+'">'+(full?"Décocher":"Cocher")+'</button></div>'+
        g.L.map(function(c){return'<label for="lc'+esc(uid)+esc(c.id)+'" style="display:flex;gap:10px;align-items:center;margin:4px 0"><input type="checkbox" id="lc'+esc(uid)+esc(c.id)+'" data-lotc="'+esc(uid)+'|'+esc(c.id)+'" style="width:auto;min-height:0"'+(S[c.id]?" checked":"")+'> '+esc(c.nom)+(had[c.id]?' <span class="tg">déjà reçue</span>':"")+'</label>';}).join("")+'</div>';
    });
    return h+'</details>';
  }
  var SOFT={not_member:"cet enseignant n’est plus membre",class_not_found:"classe introuvable ou archivée",subject_not_found:"matière introuvable"};
  /* Envoie une demande par classe, l'une après l'autre (affectation ou retrait) ; une classe en échec ne bloque pas les suivantes, une coupure réseau arrête l'envoi.
     W = {fn, ok:[singulier,pluriel], prep:"à"|"de", args(c)} ; skip = classes écartées d'avance ; la sélection réussie est vidée. */
  function runLot(uid,todo,skip,nom,W){
    var S=selOf(uid),okL=[],koL=[],i=0;
    LOTBUSY=true;E.busy=true;
    function fin(rest){
      LOTBUSY=false;E.busy=false;
      okL.forEach(function(c){delete S[c.id];});
      var t=okL.length?E.plural(okL.length,W.ok[0],W.ok[1])+" "+W.prep+" "+nom:W.none;
      if(skip)t+=" ("+E.plural(skip,W.skip[0],W.skip[1])+")";
      if(koL.length)t+=", "+E.plural(koL.length,"échec","échecs")+" : "+koL.map(function(k){return k.c.nom+" ("+k.m+")";}).join(", ");
      if(rest)t+=", "+E.plural(rest,"classe non envoyée","classes non envoyées");
      E.say(t+".");
      if(okL.length)load();else redraw();
    }
    (function next(){
      if(i>=todo.length){fin(0);return;}
      var c=todo[i++];
      E.say(W.step+" "+i+" / "+todo.length+"…");
      sb.rpc(W.fn,W.args(c)).then(function(r){
        if(r.error)koL.push({c:c,m:E.fail(r.error).replace(/^Échec : /,"")});
        else if(r.data&&r.data.ok===false)koL.push({c:c,m:SOFT[r.data.err]||"refusée"});
        else okL.push(c);
        next();
      },function(){koL.push({c:c,m:"pas d’internet"});fin(todo.length-i);});
    })();
  }
  function lotCtx(uid){
    var S=selOf(uid),m=E.MEM.filter(function(x){return x.user_id===uid;})[0],xe=document.getElementById("lm"+uid);
    return{sel:cls.filter(function(c){return S[c.id];}),nom:m?(m.nom||m.email):"l’enseignant",x:xe?xe.value:(LOTMAT[uid]||"")};
  }
  /* Affecte les classes cochées (fonction serveur etab_affecter, comme « Donner une classe ») */
  function giveLot(uid){
    var K=lotCtx(uid),sel=K.sel,nom=K.nom,x=K.x;
    if(!sel.length){E.say("Cochez au moins une classe.");return;}
    if(E.readOnly()){E.say("Hors ligne : modification impossible. Reconnectez-vous puis actualisez la page.");return;}
    if(LOTBUSY||E.busy)return;
    var have=ofUser(uid).filter(function(a){return(a.matiere_id||"")===x;}).map(function(a){return a.classe_id;});
    var todo=sel.filter(function(c){return have.indexOf(c.id)<0;}),skip=sel.length-todo.length;
    if(!todo.length){E.say(sel.length>1?"Ces classes sont déjà affectées à "+nom+" avec cette matière.":"Cette classe est déjà affectée à "+nom+" avec cette matière.");return;}
    runLot(uid,todo,skip,nom,{fn:"etab_affecter",ok:["classe affectée","classes affectées"],prep:"à",none:"Aucune classe affectée",skip:["déjà reçue","déjà reçues"],step:"Affectation",
      args:function(c){var a={p_etab:E.ET.id,p_user:uid,p_classe:c.id};if(x)a.p_matiere=x;return a;}});
  }
  /* Retire les classes cochées (fonction serveur etab_desaffecter, comme « Retirer »). Avec une matière choisie, seule cette matière est retirée ;
     sans matière, toutes les affectations de la classe le sont. L'accès aux élèves n'est coupé par le serveur que si plus rien ne reste sur la classe. */
  function removeLot(uid){
    var K=lotCtx(uid),sel=K.sel,nom=K.nom,x=K.x;
    if(!sel.length){E.say("Cochez au moins une classe.");return;}
    if(E.readOnly()){E.say("Hors ligne : modification impossible. Reconnectez-vous puis actualisez la page.");return;}
    if(LOTBUSY||E.busy)return;
    var A=ofUser(uid),has=function(c){return A.some(function(a){return a.classe_id===c.id&&(!x||a.matiere_id===x);});};
    var todo=sel.filter(has),skip=sel.length-todo.length;
    if(!todo.length){E.say(sel.length>1?nom+" n’a reçu aucune de ces classes"+(x?" avec cette matière":"")+".":nom+" n’a pas reçu cette classe"+(x?" avec cette matière":"")+".");return;}
    var mn=(mat.filter(function(y){return y.id===x;})[0]||{}).nom;
    if(!confirm("Retirer "+E.plural(todo.length,"classe","classes")+" ("+todo.map(function(c){return c.nom;}).join(", ")+") à "+nom+(x?", pour la matière « "+mn+" » seulement":", toutes matières confondues")+" ? Sans autre affectation sur une classe, "+nom+" perd l’accès à ses élèves."))return;
    runLot(uid,todo,skip,nom,{fn:"etab_desaffecter",ok:["classe retirée","classes retirées"],prep:"de",none:"Aucune classe retirée",skip:["non reçue","non reçues"],step:"Retrait",
      args:function(c){var a={p_etab:E.ET.id,p_user:uid,p_classe:c.id};if(x)a.p_matiere=x;return a;}});
  }
  function redraw(){var y=window.scrollY;E.render();window.scrollTo(0,y);}

  function teacherHtml(m,dup){
    var moi=E.me&&m.user_id===E.me.id,A=ofUser(m.user_id).sort(function(x,y){return E.sortCls(x.classe,y.classe)||String(x.matiere||"").localeCompare(String(y.matiere||""),"fr");});
    return'<div class="card"><div class="mi"><b>'+esc(m.nom||m.email)+'</b>'+(m.role==="admin"?' · <span class="tg ok">chef</span>':"")+(moi?" · vous":"")+(dup[(m.nom||"").trim().toLowerCase()]>1?' · <span class="tg bad" title="Plusieurs comptes portent ce nom">même nom</span>':"")+
      '<br><span class="sub" style="margin:0">'+esc(m.email)+'</span></div>'+
      (A.length?A.map(function(a){return'<div class="st" style="padding:8px 0;display:flex;justify-content:space-between;align-items:center;gap:8px"><span><b>'+esc(a.classe)+'</b> · '+(a.matiere?esc(a.matiere):'<span class="sub">sans matière</span>')+(a.origine==="reprise"?' <span class="tg">reprise</span>':"")+'</span>'+
        '<button class="btn warn" style="min-height:36px;padding:6px 10px" data-un="'+esc(a.user_id)+'|'+esc(a.classe_id)+'|'+esc(a.matiere_id||"")+'">Retirer</button></div>';}).join(""):'<p class="sub" style="margin:8px 0 0">Aucune classe reçue pour le moment.</p>')+
      affectForm(m)+lotPanel(m)+
      (moi?"":'<div class="mb" style="margin-top:10px"><button class="btn ghost" data-role="'+esc(m.user_id)+'|'+(m.role==="admin"?"enseignant":"admin")+'">'+(m.role==="admin"?"Retirer chef":"Nommer chef")+'</button><button class="btn warn" data-rm="'+esc(m.user_id)+'">Retirer</button></div>')+'</div>';
  }


  /* Un accès « ancien » est un accès aux élèves d'une classe (ou de tous) donné par e-mail avant la v87.
     La liste serveur montre aussi les accès créés par les nouvelles affectations : ceux-là se retirent dans la fiche de l'enseignant, pas ici. */
  function viaAff(a){return(aff||[]).some(function(f){return E.nrm(f.email)===E.nrm(a.email)&&E.nrm(f.classe)===E.nrm(a.class_label||"");});}
  function oldHtml(){
    var L=(old||[]).filter(function(a){return!viaAff(a);}),team=E.MEM.filter(function(m){return m.statut!=="en_attente";});
    var h='<details class="card" id="oldacc"'+(showOld?" open":"")+'><summary>Anciens accès (par e-mail et classe)'+(L.length?" · "+L.length:"")+'</summary>'+
      '<p class="sub" style="margin:8px 0 6px">Accès aux élèves donnés avant la v87 : ils restent valables. Pour un nouvel accès, utilisez plutôt « Donner une classe » dans la fiche de l’enseignant.</p>';
    h+=L.length?L.map(function(a){var i=old.indexOf(a),all=!(a.class_label||"");
      return'<div class="st" style="padding:8px 0;display:flex;justify-content:space-between;align-items:center;gap:8px"><span><b>'+esc(a.email)+'</b><br><span class="sub">'+esc(a.class_label||"(sans classe)")+' · '+E.plural(+a.n||0,"élève","élèves")+'</span></span><button class="btn warn" style="min-height:36px;padding:6px 10px" data-oun="'+i+'">'+(all?"Retirer tout":"Retirer")+'</button></div>';}).join(""):'<p class="sub" style="margin:8px 0">Aucun ancien accès.</p>';
    h+='<label for="oe">E-mail de l’enseignant</label><input id="oe" type="email" autocomplete="off" list="oel" placeholder="enseignant@exemple.com"><datalist id="oel">'+team.map(function(m){return'<option value="'+esc(m.email)+'">'+esc(m.nom||"")+'</option>';}).join("")+'</datalist>'+
      '<label for="oc">Classe</label><select id="oc"><option value="">Tous les élèves</option>'+cls.map(function(c){return'<option value="'+esc(c.nom)+'">'+esc(c.nom)+'</option>';}).join("")+'</select>'+
      '<div class="bs"><button class="btn" id="oadd">Affecter</button></div></details>';
    return h;
  }

  function render(){
    if(aff===null||old===null)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    var MEM=E.MEM,pend=MEM.filter(function(m){return m.statut==="en_attente";}),team=MEM.filter(function(m){return m.statut!=="en_attente";}),dup={};
    MEM.forEach(function(m){var k=(m.nom||"").trim().toLowerCase();if(k)dup[k]=(dup[k]||0)+1;});
    var h=loadErr?'<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>':"";
    h+=pendingHtml(pend);
    h+='<div class="card"><h2>Validation des nouveaux enseignants</h2><p class="sub" style="margin:0 0 6px">Les nouveaux enseignants doivent être acceptés par vous : <b>'+(E.ET.valider_enseignants?"oui":"non")+'</b></p>'+
      '<div class="bs" style="margin-top:0"><button class="btn ghost" id="evalid">'+(E.ET.valider_enseignants?"Ne plus exiger de validation":"Exiger ma validation")+'</button></div></div>';
    h+='<h3 class="dh">Équipe ('+team.length+')</h3>';
    if(!mat.length&&team.length)h+='<p class="sub">Aucune matière définie : ouvrez la rubrique « Matières » pour en ajouter. Vous pouvez aussi affecter une classe sans matière.</p>';
    if(!team.length)h+='<p class="sub">Aucun enseignant pour le moment. Donnez-leur le code de l’établissement (rubrique « Paramètres ») : ils apparaîtront ici.</p>';
    team.forEach(function(m){h+=teacherHtml(m,dup);});
    h+=oldHtml();
    return h;
  }

  function after(v){
    afterOld(v);
    function mem(id){return E.MEM.filter(function(x){return x.user_id===id;})[0];}
    v.querySelectorAll("[data-acc],[data-ref]").forEach(function(b){b.onclick=function(){
      var acc=b.hasAttribute("data-acc"),id=b.getAttribute(acc?"data-acc":"data-ref");
      E.call("etab_decider_membre",{p_etab:E.ET.id,p_user:id,p_accepter:acc},function(){E.reloadMem(acc?"Enseignant accepté : vous pouvez maintenant lui donner des classes.":"Demande refusée.");});
    };});
    var ev=document.getElementById("evalid");
    if(ev)ev.onclick=function(){var on=!E.ET.valider_enseignants;
      E.call("etab_valider_enseignants",{p_etab:E.ET.id,p_on:on},function(){E.ET.valider_enseignants=on;E.render();E.say(on?"Les nouveaux enseignants devront être acceptés par vous.":"Les nouveaux enseignants rejoignent directement avec le code.");});};
    v.querySelectorAll("[data-give]").forEach(function(b){b.onclick=function(){
      var id=b.getAttribute("data-give"),c=document.getElementById("ac"+id).value,x=document.getElementById("am"+id).value;
      if(!c){E.say("Choisissez une classe.");return;}
      var a={p_etab:E.ET.id,p_user:id,p_classe:c};if(x)a.p_matiere=x;
      E.call("etab_affecter",a,function(){E.say("Classe affectée.");load();});
    };});
    v.querySelectorAll("[data-lotp]").forEach(function(d){d.ontoggle=function(){LOTOPEN[d.getAttribute("data-lotp")]=!!d.open;};});
    v.querySelectorAll("[data-lotc]").forEach(function(b){b.onchange=function(){
      var p=b.getAttribute("data-lotc").split("|"),S=selOf(p[0]);
      if(b.checked)S[p[1]]=true;else delete S[p[1]];
      LOTOPEN[p[0]]=true;
      redraw();
    };});
    v.querySelectorAll("[data-lotm]").forEach(function(b){b.onchange=function(){LOTMAT[b.getAttribute("data-lotm")]=b.value;};});
    v.querySelectorAll("[data-lotgo]").forEach(function(b){b.onclick=function(){giveLot(b.getAttribute("data-lotgo"));};});
    v.querySelectorAll("[data-lotrm]").forEach(function(b){b.onclick=function(){removeLot(b.getAttribute("data-lotrm"));};});
    v.querySelectorAll("[data-lotall]").forEach(function(b){b.onclick=function(){
      var uid=b.getAttribute("data-lotall"),S=selOf(uid),all=nSel(uid)===cls.length;
      cls.forEach(function(c){if(all)delete S[c.id];else S[c.id]=true;});
      LOTOPEN[uid]=true;redraw();
    };});
    v.querySelectorAll("[data-lotniv]").forEach(function(b){b.onclick=function(){
      var p=b.getAttribute("data-lotniv").split("|"),S=selOf(p[0]),L=cls.filter(function(c){return E.lvl(c.nom)===p[1];}),all=L.every(function(c){return S[c.id];});
      L.forEach(function(c){if(all)delete S[c.id];else S[c.id]=true;});
      LOTOPEN[p[0]]=true;redraw();
    };});
    v.querySelectorAll("[data-un]").forEach(function(b){b.onclick=function(){
      var p=b.getAttribute("data-un").split("|"),a={p_etab:E.ET.id,p_user:p[0],p_classe:p[1]};
      if(p[2])a.p_matiere=p[2];
      if(!confirm("Retirer cette affectation ? L’enseignant perd l’accès à la classe si c’était la dernière."))return;
      E.call("etab_desaffecter",a,function(){E.say("Affectation retirée.");load();});
    };});
    v.querySelectorAll("[data-role]").forEach(function(b){b.onclick=function(){
      var p=b.getAttribute("data-role").split("|");
      if(p[1]==="enseignant"&&!confirm("Retirer les droits de chef à cette personne ?"))return;
      E.call("etab_definir_role",{p_etab:E.ET.id,p_user:p[0],p_role:p[1]},function(){E.reloadMem(p[1]==="admin"?"Nouveau chef nommé.":"Droits de chef retirés.");});
    };});
    v.querySelectorAll("[data-rm]").forEach(function(b){b.onclick=function(){
      var id=b.getAttribute("data-rm"),m=mem(id);
      if(!confirm("Retirer "+((m&&(m.nom||m.email))||"cet enseignant")+" de l’établissement ? Ses affectations seront retirées."))return;
      E.call("etab_retirer",{p_etab:E.ET.id,p_user:id},function(){E.reloadMem("Enseignant retiré.");load();});
    };});
  }

  function afterOld(v){
    var b=document.getElementById("oldacc");if(b)b.ontoggle=function(){showOld=b.open;};
    var add=document.getElementById("oadd");
    if(add)add.onclick=function(){
      var em=document.getElementById("oe").value.trim(),cs=document.getElementById("oc").value;
      if(!/^\S+@\S+\.\S+$/.test(em)){E.say("Entrez l’e-mail du compte de l’enseignant.");return;}
      E.call("admin_assign",E.ep({p_email:em,p_class:cs}),function(n){
        n=typeof n==="number"?n:0;
        E.say(n?E.plural(n,"élève affecté","élèves affectés")+" à "+em+".":"Aucun nouvel élève : cet enseignant avait déjà accès à tous ceux-là.");loadOld();
      },function(err){
        var m=String((err&&err.message)||"");
        if(/unknown teacher/i.test(m)){E.say("Aucun compte avec cet e-mail : l’enseignant doit d’abord créer son compte Classe Master.");return true;}
        if(/not member/i.test(m)){E.say("Cet enseignant n’a pas encore rejoint votre établissement : donnez-lui le code d’accès (rubrique « Paramètres »).");return true;}
        return false;
      });
    };
    v.querySelectorAll("[data-oun]").forEach(function(x){x.onclick=function(){
      var a=old[+x.getAttribute("data-oun")];if(!a)return;
      var all=!(a.class_label||"");
      if(!confirm(all?"Retirer TOUS les anciens accès de "+a.email+" dans cet établissement ? (Ses élèves sans classe ne peuvent pas être retirés seuls.)":"Retirer "+a.email+" de "+a.class_label+" ?"))return;
      E.call("admin_unassign",E.ep({p_email:a.email,p_class:a.class_label||""}),function(){E.say("Accès retiré : "+a.email+".");loadOld();});
    };});
  }

  E.start({page:"enseignants",load:load,render:render,after:after,reset:function(){aff=null;cls=[];mat=[];old=null;SEL={};LOTOPEN={};LOTMAT={};LOTBUSY=false;}});
})();
