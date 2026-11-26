/* Page « Enseignants » de l'établissement (v90, complétée en v93) : demandes à valider, équipe, affectations classes + matières,
   anciens accès par e-mail et classe (accordés avant la v87).
   S'appuie sur le socle js/etab-core.js ; fonctions serveur : etablissements-v60.sql (membres, anciens accès) et classes-matieres-v87.sql (affectations). */
(function(){
  var E=Etab,esc=E.esc,aff=null,cls=[],mat=[],loadErr="",old=null,showOld=false;

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

  function teacherHtml(m,dup){
    var moi=E.me&&m.user_id===E.me.id,A=ofUser(m.user_id).sort(function(x,y){return E.sortCls(x.classe,y.classe)||String(x.matiere||"").localeCompare(String(y.matiere||""),"fr");});
    return'<div class="card"><div class="mi"><b>'+esc(m.nom||m.email)+'</b>'+(m.role==="admin"?' · <span class="tg ok">chef</span>':"")+(moi?" · vous":"")+(dup[(m.nom||"").trim().toLowerCase()]>1?' · <span class="tg bad" title="Plusieurs comptes portent ce nom">même nom</span>':"")+
      '<br><span class="sub" style="margin:0">'+esc(m.email)+'</span></div>'+
      (A.length?A.map(function(a){return'<div class="st" style="padding:8px 0;display:flex;justify-content:space-between;align-items:center;gap:8px"><span><b>'+esc(a.classe)+'</b> · '+(a.matiere?esc(a.matiere):'<span class="sub">sans matière</span>')+(a.origine==="reprise"?' <span class="tg">reprise</span>':"")+'</span>'+
        '<button class="btn warn" style="min-height:36px;padding:6px 10px" data-un="'+esc(a.user_id)+'|'+esc(a.classe_id)+'|'+esc(a.matiere_id||"")+'">Retirer</button></div>';}).join(""):'<p class="sub" style="margin:8px 0 0">Aucune classe reçue pour le moment.</p>')+
      affectForm(m)+
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

  E.start({page:"enseignants",load:load,render:render,after:after,reset:function(){aff=null;cls=[];mat=[];old=null;}});
})();
