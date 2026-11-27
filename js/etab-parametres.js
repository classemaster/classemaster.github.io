/* Page « Paramètres » de l'établissement (v92) : nom et ville, code d'accès des enseignants (copier, nouveau code, inscriptions),
   seuils d'alerte, journal des actions.
   Reprise des blocs « code », « renommer », « seuils » et « journal » de l'ancienne page de gestion (remplacée par une redirection depuis la v94), sur le socle commun js/etab-core.js.
   Aucune écriture directe sur les tables : tout passe par les fonctions serveur réservées au chef
   (etab_renommer, etab_nouveau_code, etab_ouvrir, etab_seuils ; supabase/etablissements-v60.sql et gestion-v71.sql). Le journal est en lecture seule.
   Aucun code secret d'élève demandé. */
(function(){
  var E=Etab,esc=E.esc,jnl=null,D=null,S=null,jOpen=false,jN=10,kept=0;

  /* Libellés du journal des actions (supabase/gestion-v71.sql) */
  var JL={depart:"Départ d’un élève",transfert:"Transfert d’élèves",retrait_enseignant:"Enseignant retiré",role:"Rôle modifié",code:"Nouveau code",inscriptions:"Inscriptions",renommage:"Établissement renommé",seuils:"Seuils d’alerte",validation_enseignants:"Validation des enseignants",enseignant_demande:"Demande d’un enseignant",enseignant_accepte:"Enseignant accepté",enseignant_refuse:"Demande refusée",message:"Message envoyé",message_supprime:"Message retiré"};

  function reset(){jnl=null;D=null;S=null;jN=10;}
  /* brouillon du nom et de la ville : conservé quand la page se redessine */
  function draft(){return D||(D={nom:E.ET.nom||"",ville:E.ET.ville||""});}

  function loadJnl(){
    sb.rpc("etab_journal",{p_etab:E.ET.id,p_limit:60}).then(function(r){
      jnl=r.error?{err:E.frErr(r.error)}:(r.data||[]);E.render();
    },function(){jnl={err:"Pas d’internet."};E.render();});
  }
  function load(){reset();E.render();loadJnl();if(typeof EtabOffline!=="undefined")EtabOffline.saved().then(function(t){kept=t;E.render();});}

  /* ---------- Blocs ---------- */
  function ident(){
    var d=draft();
    return'<section class="card"><h2>Établissement</h2>'+
      '<label for="pnom">Nom de l’établissement</label><input id="pnom" type="text" maxlength="100" value="'+esc(d.nom)+'" autocomplete="off">'+
      '<label for="pville">Ville (facultatif)</label><input id="pville" type="text" maxlength="80" value="'+esc(d.ville)+'" autocomplete="off">'+
      '<div class="bs"><button class="btn" id="pren">Enregistrer</button></div></section>';
  }
  function acces(){
    var t=E.ET,n=E.MEM.filter(function(m){return m.role!=="admin"&&m.statut!=="en_attente";}).length,ferme=t.ouvert===false;
    return'<section class="card"><h2>Code d’accès des enseignants</h2>'+
      '<div class="cdb"><span class="cd" id="ecd">'+esc(E.etabCode(t.code))+'</span></div>'+
      '<div class="bs"><button class="btn" id="ecp">Copier le code</button><button class="btn ghost" id="enc">Nouveau code</button><button class="btn ghost" id="eop">'+(ferme?"Rouvrir":"Fermer")+' les inscriptions</button></div>'+
      '<p class="sub" style="margin:8px 0 0">'+E.plural(n,"enseignant inscrit","enseignants inscrits")+(ferme?" · inscriptions fermées : le code n’accepte plus de nouveaux enseignants":"")+'. Chaque enseignant s’inscrit dans l’application avec ce code ; vous lui donnez ensuite ses classes dans la rubrique « Enseignants ». Un nouveau code rend l’ancien inutilisable, sans retirer les enseignants déjà inscrits.</p>'+
      '<p class="sub" style="margin:8px 0 0">'+(t.valider_enseignants?"Les nouveaux enseignants doivent être acceptés par vous.":"Les nouveaux enseignants rejoignent directement avec le code.")+' Ce réglage se change dans <a href="'+esc(E.href("enseignants"))+'">Enseignants</a>.</p></section>';
  }
  function seuils(){
    var T=S||{moy:E.TH.moy,pres:E.TH.pres,abs:E.TH.abs};
    return'<section class="card"><h2>Seuils d’alerte</h2><p class="sub" style="margin:0 0 4px">Ils définissent les élèves « en difficulté » et « à risque » de l’Accueil, de Résultats et assiduité et des exports.</p>'+
      '<label for="sm">Moyenne en dessous de (sur 20)</label><input id="sm" type="number" inputmode="decimal" min="1" max="19" step="0.5" value="'+T.moy+'">'+
      '<label for="sp">Présence en dessous de (%)</label><input id="sp" type="number" inputmode="numeric" min="10" max="100" step="1" value="'+T.pres+'">'+
      '<label for="sa">Risque de décrochage : absences sur 14 jours à partir de</label><input id="sa" type="number" inputmode="numeric" min="1" max="14" step="1" value="'+T.abs+'">'+
      '<div class="bs"><button class="btn" id="eseuils">Enregistrer</button><button class="btn ghost" id="eseuils0">Valeurs d’origine (10 · 80 % · 3)</button></div></section>';
  }
  /* Journal replié par défaut : 10 actions, puis « Voir plus » par paquets de 20 (60 au plus) */
  function journal(){
    var h='<section class="card"><h2>Journal des actions</h2>';
    if(jnl===null)return h+'<p class="sub" style="margin:0">Chargement…</p></section>';
    if(jnl.err)return h+'<p class="sub" style="margin:0">Journal indisponible ('+esc(jnl.err)+'). Exécutez <b>supabase/gestion-v71.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.</p></section>';
    if(!jnl.length)return h+'<p class="sub" style="margin:0">Aucune action enregistrée pour le moment.</p></section>';
    var n=Math.min(jN,jnl.length);
    h='<details class="card" id="jnl"'+(jOpen?" open":"")+'><summary style="cursor:pointer;font-weight:700;font-size:1.1rem">Journal des actions <span class="sub" style="font-weight:400">· '+E.plural(jnl.length,"action","actions")+'</span></summary>';
    h+=jnl.slice(0,n).map(function(j){
      return'<div class="dr" style="display:block"><b>'+esc(JL[j.event]||j.event)+'</b>'+(j.name?' · '+esc(j.name):'')+(j.class_label?' · '+esc(j.class_label):'')+'<small>'+esc(E.fdt(j.created_at))+(j.detail?' · '+esc(j.detail):'')+(j.acteur?' · par '+esc(j.acteur):'')+'</small></div>';
    }).join("");
    h+='<p class="sub" style="margin-top:6px">'+n+' sur '+jnl.length+' · les 60 dernières actions sont gardées.</p><div class="bs">'+
      (n<jnl.length?'<button class="btn ghost" id="jmore">Voir plus</button>':(jN>10?'<button class="btn ghost" id="jless">Réduire</button>':""))+
      '<button class="btn ghost" id="xjnl">Exporter le journal (Excel)</button></div></details>';
    return h;
  }
  /* Consultation hors ligne (v99) : désactivée tant que le chef ne la coche pas, sur chaque appareil */
  function horsLigne(){
    if(typeof EtabOffline==="undefined")return"";
    var on=EtabOffline.enabled();
    return'<section class="card"><h2>Consultation hors ligne</h2>'+
      '<label for="koff" style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="koff" style="width:auto;min-height:0"'+(on?" checked":"")+(E.readOnly()?" disabled":"")+'> Garder les données sur cet appareil</label>'+
      '<p class="sub" style="margin:8px 0 0">'+(on?"Activée"+(kept?" · dernier enregistrement : "+esc(E.fdt(kept)):"")+". Ouvrez chaque rubrique (et chaque année utile dans « Fin d’année ») une fois avec internet : elle sera ensuite consultable sans réseau.":"Désactivée.")+'</p>'+
      '<p class="sub" style="margin:8px 0 0">Les noms, présences, notes et incidents restent alors sur l’appareil : ne l’activez pas sur un téléphone ou un ordinateur partagé. Les codes famille, les téléphones des parents et le code des enseignants ne sont pas enregistrés. Tout est effacé à la déconnexion, ou après 30 jours sans mise à jour.</p></section>';
  }
  function choisirHorsLigne(box){
    if(box.checked){
      if(!EtabOffline.enable()){box.checked=false;E.say("Impossible d’activer sur cet appareil.");return;}
      location.reload();   /* recharge pour enregistrer ce qui vient d'être lu */
    }else EtabOffline.disable().then(function(){kept=0;E.render();E.say("Données effacées de cet appareil.");});
  }
  function render(){return ident()+acces()+seuils()+horsLigne()+journal();}

  /* ---------- Actions ---------- */
  function copier(){
    var tx=E.etabCode(E.ET.code);
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(tx).then(function(){E.say("Code copié : "+tx);},function(){E.say("Code : "+tx);});
    else E.say("Code : "+tx);
  }
  function nouveauCode(){
    var old=E.etabCode(E.ET.code);
    if(!confirm("Créer un nouveau code ? L’ancien code ("+old+") ne fonctionnera plus ; les enseignants déjà inscrits restent membres. Notez l’ancien code si vous l’avez déjà distribué."))return;
    E.call("etab_nouveau_code",{p_etab:E.ET.id},function(d){
      if(!d.code){E.say("Le nouveau code n’a pas pu être lu : rechargez la page.");return;}
      E.ET.code=d.code;E.render();E.say("Nouveau code : "+E.etabCode(d.code)+" (l’ancien ne fonctionne plus).");loadJnl();
    });
  }
  function inscriptions(){
    var ouvre=E.ET.ouvert===false;
    E.call("etab_ouvrir",{p_etab:E.ET.id,p_ouvert:ouvre},function(){
      E.ET.ouvert=ouvre;E.render();E.say(ouvre?"Inscriptions rouvertes.":"Inscriptions fermées : le code n’accepte plus de nouveaux enseignants.");loadJnl();
    });
  }
  function renommer(){
    var d=draft(),nn=d.nom.trim(),vv=d.ville.trim().slice(0,80);
    if(!nn){E.say("Écrivez le nom de l’établissement.");return;}
    if(nn===(E.ET.nom||"")&&vv===(E.ET.ville||"")){E.say("Aucun changement à enregistrer.");return;}
    E.call("etab_renommer",{p_etab:E.ET.id,p_nom:nn,p_ville:vv},function(){
      E.ET.nom=nn;E.ET.ville=vv;D=null;E.reloadMem("Établissement renommé.");loadJnl();   /* redessine aussi l'en-tête */
    });
  }
  function enregistrerSeuils(m,p,a){
    E.call("etab_seuils",{p_etab:E.ET.id,p_moy:m,p_pres:p,p_abs:a},function(){
      E.ET.seuil_moy=m;E.ET.seuil_pres=p;E.ET.seuil_abs=a;E.setTh();S=null;E.render();E.say("Seuils enregistrés : les autres pages utilisent les nouvelles valeurs.");loadJnl();
    });
  }
  function lireSeuils(){
    var m=parseFloat(String((document.getElementById("sm")||{}).value).replace(",",".")),p=parseInt((document.getElementById("sp")||{}).value,10),a=parseInt((document.getElementById("sa")||{}).value,10);
    if(!(m>=1&&m<=19)||!(p>=10&&p<=100)||!(a>=1&&a<=14)){E.say("Valeurs hors limites (moyenne 1 à 19, présence 10 à 100 %, absences 1 à 14).");return;}
    enregistrerSeuils(m,p,a);
  }
  function exporter(){
    var body=(Array.isArray(jnl)?jnl:[]).map(function(j){return[j.created_at||"",JL[j.event]||j.event||"",j.name||"",j.class_label||"",j.detail||"",j.acteur||""];});
    E.download("journal-"+E.schoolYear()+".csv",E.tblCsv({head:["Date","Action","Nom","Classe","Détail","Par"],body:body}));
  }

  function after(v){
    function on(id,f){var b=document.getElementById(id);if(b)b.onclick=f;}
    var pn=document.getElementById("pnom"),pv=document.getElementById("pville");
    if(pn)pn.oninput=function(){draft().nom=pn.value;};
    if(pv)pv.oninput=function(){draft().ville=pv.value;};
    ["sm","sp","sa"].forEach(function(id){var i=document.getElementById(id);if(i)i.oninput=function(){var k={sm:"moy",sp:"pres",sa:"abs"}[id];S=S||{moy:E.TH.moy,pres:E.TH.pres,abs:E.TH.abs};S[k]=i.value;};});
    var k=document.getElementById("koff");if(k)k.onchange=function(){choisirHorsLigne(k);};
    on("pren",renommer);on("ecp",copier);on("enc",nouveauCode);on("eop",inscriptions);
    on("eseuils",lireSeuils);on("eseuils0",function(){enregistrerSeuils(10,80,3);});on("xjnl",exporter);on("jmore",function(){jN+=20;var y=window.scrollY;E.render();window.scrollTo(0,y);});on("jless",function(){jN=10;E.render();});
    var dj=document.getElementById("jnl");if(dj)dj.ontoggle=function(){jOpen=!!dj.open;};
  }

  E.start({page:"parametres",load:load,reset:reset,render:render,after:after,onMembres:function(){}});
})();
