/* Page « Programmes » de l'établissement (v139, étape 38 ; v142 : corrections de détail) : les leçons prévues, classées par niveau, matière et mois (de septembre à juin).
   Le chef y ajoute des leçons (v140, étape 39 : une leçon par ligne, tout le programme d'un mois d'un coup), en modifie le titre et le mois,
   et les retire une par une ou un mois entier (v141, étape 40, avec confirmation). Aucune écriture directe : uniquement les fonctions serveur ci-dessous.
   S'appuie sur le socle js/etab-core.js ; fonctions serveur : etab_programmes_liste, etab_programme_ajouter, etab_programme_modifier,
   etab_programme_retirer, etab_programme_retirer_mois (supabase/programmes-v106.sql),
   et, pour proposer les niveaux et les matières, etab_classes_liste et etab_matieres_liste (supabase/classes-matieres-v87.sql).
   Une leçon ajoutée par un enseignant porte le repère « ajoutée par un enseignant », avec le nom de son auteur (jamais son adresse e-mail). */
(function(){
  var E=Etab,esc=E.esc,pl=E.plural,list=null,loadErr="",seq=0,open={},all={},cls=[],mats=[],edit={id:"",t:"",mo:""},fm={niv:"",mat:"",mo:"",txt:""};
  var MOIS=["09","10","11","12","01","02","03","04","05","06"];
  var NOMS={"09":"Septembre","10":"Octobre","11":"Novembre","12":"Décembre","01":"Janvier","02":"Février","03":"Mars","04":"Avril","05":"Mai","06":"Juin"};
  var SHOW=4;   /* leçons visibles par mois avant « Voir tout » */

  function reset(){seq++;list=null;loadErr="";open={};all={};cls=[];mats=[];edit={id:"",t:"",mo:""};fm={niv:"",mat:"",mo:"",txt:""};}

  function errText(e){
    if(E.frErr(e)==="élément absent côté serveur (installation incomplète)")return"Les programmes ne sont pas encore installés côté serveur : exécutez <b>supabase/programmes-v106.sql</b> dans Supabase (SQL Editor), puis rechargez cette page.";
    return esc(E.fail(e));
  }

  /* quiet : on garde la liste affichée pendant le rechargement (après un ajout ou une modification) */
  function load(quiet){
    var me=++seq;if(!quiet){list=null;loadErr="";}E.render();
    sb.rpc("etab_programmes_liste",{p_etab:E.ET.id}).then(function(r){
      if(me!==seq)return;   /* l'établissement a changé entre-temps */
      if(r.error){loadErr=errText(r.error);list=[];}else{loadErr="";list=Array.isArray(r.data)?r.data:[];}
      E.render();
    },function(){if(me!==seq)return;loadErr="Pas d’internet.";list=[];E.render();});
    /* propositions de niveaux et de matières pour le formulaire : sans elles, la saisie libre reste possible */
    sb.rpc("etab_classes_liste",{p_etab:E.ET.id}).then(function(r){if(me!==seq)return;cls=r.error||!Array.isArray(r.data)?[]:r.data;refreshOpts();},function(){});
    sb.rpc("etab_matieres_liste",{p_etab:E.ET.id}).then(function(r){if(me!==seq)return;mats=r.error||!Array.isArray(r.data)?[]:r.data;refreshOpts();},function(){});
  }
  function clean(v){return String(v==null?"":v).trim().replace(/\s+/g," ");}   /* le serveur réduit les espaces multiples : on fait pareil */
  function keyOf(n,m){return clean(n).toLowerCase()+"|"+clean(m).toLowerCase();}
  function monthNow(){var m=String(new Date().getMonth()+1);m=m.length<2?"0"+m:m;return MOIS.indexOf(m)>=0?m:"09";}

  /* ---------- Regroupement : niveau > matière > mois ----------
     Le serveur trie par niveau, matière, puis « septembre à décembre » avant « janvier à juin » et par ordre : les mois sont donc regroupés et triés ici.
     Les clés sont comparées sans majuscules ni espaces superflus, comme l'index d'unicité du serveur. */
  function group(rows){
    var N=Object.create(null);
    rows.forEach(function(x){
      if(!x)return;
      var nv=String(x.niveau==null?"":x.niveau).trim(),mt=String(x.matiere==null?"":x.matiere).trim(),nk=nv.toLowerCase(),mk=mt.toLowerCase();
      var n=N[nk]||(N[nk]={nom:nv,M:Object.create(null),n:0,ens:0});
      var m=n.M[mk]||(n.M[mk]={key:nk+"|"+mk,nom:mt,mo:Object.create(null),n:0,ens:0});
      var mo=String(x.mois==null?"":x.mois);
      (m.mo[mo]=m.mo[mo]||[]).push(x);
      n.n++;m.n++;
      if(x.origine==="enseignant"){n.ens++;m.ens++;}
    });
    return N;
  }
  function fr(a,b){return String(a).localeCompare(String(b),"fr",{numeric:true});}
  function moisRank(k){var i=MOIS.indexOf(k);return i<0?99:i;}
  function sortedNiveaux(N){return Object.keys(N).map(function(k){return N[k];}).sort(function(a,b){return E.lvlRank(a.nom)-E.lvlRank(b.nom)||fr(a.nom,b.nom);});}
  function sortedMatieres(n){return Object.keys(n.M).map(function(k){return n.M[k];}).sort(function(a,b){return fr(a.nom,b.nom);});}
  function sortedMois(m){return Object.keys(m.mo).sort(function(a,b){return moisRank(a)-moisRank(b)||fr(a,b);});}
  function sortedLecons(a){return a.slice().sort(function(x,y){return(+x.ordre||0)-(+y.ordre||0)||fr(x.titre,y.titre);});}

  /* ---------- Dessin ---------- */
  function moisOpts(cur){return MOIS.map(function(m){return'<option value="'+m+'"'+(m===cur?" selected":"")+'>'+NOMS[m]+'</option>';}).join("");}
  function lecon(x){
    if(edit.id===x.id)return'<div class="dr" style="display:block"><label for="pe-t">Titre de la leçon</label><input id="pe-t" type="text" maxlength="200" autocomplete="off" value="'+esc(edit.t)+'">'+
      '<label for="pe-m">Mois</label><select id="pe-m">'+moisOpts(edit.mo)+'</select>'+
      '<div class="bs"><button type="button" class="btn" data-esave="'+esc(x.id)+'">Enregistrer</button><button type="button" class="btn ghost" data-ecancel="1">Annuler</button></div></div>';
    var ens=x.origine==="enseignant",au=String(x.auteur||"").trim();
    return'<div class="dr"><span><b>'+esc(x.titre)+'</b><small>'+esc(ens&&au?"Par "+au:"")+'</small></span>'+(ens?'<span class="tg">ajoutée par un enseignant</span>':"")+
      '<span class="pg-act"><button type="button" class="btn ghost pg-b" data-edit="'+esc(x.id)+'" aria-label="Modifier la leçon « '+esc(x.titre)+' »">Modifier</button>'+
      '<button type="button" class="btn warn pg-b" data-del="'+esc(x.id)+'" aria-label="Retirer la leçon « '+esc(x.titre)+' »">Retirer</button></span></div>';
  }
  function moisBloc(m,mo){
    var L=sortedLecons(m.mo[mo]),key=m.key+"|"+mo,full=!!all[key],vis=full?L:L.slice(0,SHOW);
    var h='<div class="pg-mois"><span>'+esc(NOMS[mo]||(mo?"Mois "+mo:"Sans mois"))+'</span><span class="pg-nb">'+pl(L.length,"leçon","leçons")+'</span></div>'+vis.map(lecon).join("");
    var bt=(L.length>SHOW?'<button type="button" class="btn ghost" data-all="'+esc(key)+'">'+(full?"Réduire":"Voir tout ("+L.length+")")+'</button>':"")+
      (MOIS.indexOf(mo)>=0?'<button type="button" class="btn warn" data-delmois="'+esc(key)+'">Retirer ce mois ('+L.length+')</button>':"");
    if(bt)h+='<div class="bs">'+bt+'</div>';
    return h;
  }
  function matiereBloc(m){
    var ms=sortedMois(m);
    var h='<details class="card pg" data-pg="'+esc(m.key)+'"'+(open[m.key]?" open":"")+'><summary><span><b>'+esc(m.nom||"(sans matière)")+'</b><small>'+pl(m.n,"leçon","leçons")+' · '+pl(ms.length,"mois","mois")+(m.ens?' · '+m.ens+' ajoutée'+(m.ens>1?"s":"")+' par un enseignant':"")+'</small></span></summary>';
    return h+ms.map(function(mo){return moisBloc(m,mo);}).join("")+'</details>';
  }

  function optList(id,a){return'<datalist id="'+id+'">'+a.map(function(v){return'<option value="'+esc(v)+'">';}).join("")+'</datalist>';}
  function uniqSorted(a){var o=Object.create(null),r=[];a.forEach(function(v){v=String(v==null?"":v).trim();if(v&&!o[v.toLowerCase()]){o[v.toLowerCase()]=1;r.push(v);}});return r.sort(fr);}
  function nivOpts(){return uniqSorted(cls.filter(function(c){return c&&!c.archivee;}).map(function(c){return c.niveau;}).concat((list||[]).map(function(x){return x&&x.niveau;}))).sort(function(a,b){return E.lvlRank(a)-E.lvlRank(b)||fr(a,b);});}
  function matOpts(){return uniqSorted(mats.map(function(m){return m&&m.nom;}).concat((list||[]).map(function(x){return x&&x.matiere;})));}
  function optHtml(a){return a.map(function(v){return'<option value="'+esc(v)+'">';}).join("");}
  /* les propositions arrivent parfois après l'affichage : on remplit les listes sans redessiner (ce qui est tapé n'est pas touché) */
  function refreshOpts(){var a=$("pnl"),b=$("pml");if(a)a.innerHTML=optHtml(nivOpts());if(b)b.innerHTML=optHtml(matOpts());}
  function addForm(){
    var nv=nivOpts(),mt=matOpts();
    return'<div class="card"><h2>Ajouter des leçons</h2><p class="sub" style="margin:0 0 6px">Écrivez une leçon par ligne : vous pouvez coller tout le programme d’un mois. Une leçon déjà présente est ignorée.</p>'+
      '<label for="pn">Niveau</label><input id="pn" type="text" list="pnl" maxlength="40" autocomplete="off" placeholder="ex. 6e" value="'+esc(fm.niv)+'">'+optList("pnl",nv)+
      '<label for="pm">Matière</label><input id="pm" type="text" list="pml" maxlength="60" autocomplete="off" placeholder="ex. Français" value="'+esc(fm.mat)+'">'+optList("pml",mt)+
      '<label for="pmo">Mois</label><select id="pmo">'+moisOpts(fm.mo||monthNow())+'</select>'+
      '<label for="pt">Leçons (une par ligne)</label><textarea id="pt" rows="5" placeholder="Le nom et le groupe nominal&#10;Le présent de l’indicatif&#10;Le récit au passé" aria-label="Leçons à ajouter">'+esc(fm.txt)+'</textarea>'+
      '<div class="bs"><button type="button" class="btn" id="padd">Ajouter</button></div></div>';
  }

  function render(){
    if(list===null)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    var h='<div class="card"><h2>Programmes</h2><p class="sub" style="margin:0">Les leçons prévues chaque mois, de septembre à juin, par niveau et par matière. Vous les ajoutez, les modifiez et les retirez ici ; une leçon ajoutée par un enseignant est signalée.</p></div>';
    if(loadErr)h+='<div class="card"><p class="sub" style="margin:0">'+loadErr+'</p></div>';
    else h+=addForm();
    if(!list.length)return h+(loadErr?"":'<p class="sub">Aucune leçon pour le moment. Ajoutez la première ci-dessus.</p>');
    var N=group(list),NV=sortedNiveaux(N),ens=0;
    NV.forEach(function(n){ens+=n.ens;});
    h+='<div class="kpis">'+E.kp(list.length,"leçons")+E.kp(NV.length,NV.length>1?"niveaux":"niveau")+E.kp(ens,"ajoutées par des enseignants")+'</div>';
    NV.forEach(function(n){
      var ms=sortedMatieres(n);
      h+='<h3 class="lvl">'+esc(n.nom||"(sans niveau)")+' <span class="sub">· '+pl(ms.length,"matière","matières")+' · '+pl(n.n,"leçon","leçons")+'</span></h3>';
      h+=ms.map(matiereBloc).join("");
    });
    return h;
  }

  function $(id){return document.getElementById(id);}
  function lines(){return($("pt").value||"").split(/\r?\n/);}
  function add(){
    var n=($("pn").value||"").trim(),m=($("pm").value||"").trim(),mo=$("pmo").value,L=lines().filter(function(x){return x.trim();});
    if(!n){E.say("Écrivez le niveau (ex. 6e).");return;}
    if(!m){E.say("Écrivez la matière.");return;}
    if(!L.length){E.say("Écrivez au moins une leçon.");return;}
    E.call("etab_programme_ajouter",{p_etab:E.ET.id,p_niveau:n,p_matiere:m,p_mois:mo,p_titres:L},function(d){
      var a=+d.ajoutees||0,i=+d.ignorees||0;
      fm.niv=n;fm.mat=m;fm.mo=mo;fm.txt="";open[keyOf(n,m)]=true;
      E.say((a?pl(a,"leçon ajoutée","leçons ajoutées"):"Aucune leçon ajoutée")+(i?" · "+(i>1?i+" déjà présentes, ignorées":"1 déjà présente, ignorée"):"")+".");
      load(true);
    });
  }
  function save(id){
    var t=($("pe-t").value||"").trim(),mo=$("pe-m").value;
    if(!t){E.say("Le titre de la leçon est vide.");return;}
    E.call("etab_programme_modifier",{p_etab:E.ET.id,p_lecon:id,p_titre:t,p_mois:mo},function(){
      var l=(list||[]).filter(function(x){return x.id===id;})[0];if(l)open[keyOf(l.niveau,l.matiere)]=true;
      edit={id:"",t:"",mo:""};E.say("Leçon modifiée.");load(true);
    });
  }

  /* Retrait d'une leçon : définitif, d'où la confirmation */
  function del(id){
    var l=(list||[]).filter(function(x){return x.id===id;})[0];if(!l)return;
    if(!confirm("Retirer la leçon « "+l.titre+" » ("+l.niveau+" · "+l.matiere+") ? Cette action est définitive."))return;
    E.call("etab_programme_retirer",{p_etab:E.ET.id,p_lecon:id},function(){
      if(edit.id===id)edit={id:"",t:"",mo:""};
      E.say("Leçon retirée.");load(true);
    });
  }
  /* Retrait de toutes les leçons d'un mois (celles des enseignants comprises) : la confirmation les compte */
  function delMois(key){
    var p=String(key).split("|"),mo=p[p.length-1],L=(list||[]).filter(function(x){return keyOf(x.niveau,x.matiere)+"|"+x.mois===key;});
    if(!L.length||MOIS.indexOf(mo)<0)return;
    var ens=L.filter(function(x){return x.origine==="enseignant";}).length;
    if(!confirm("Retirer "+(L.length>1?"les "+L.length+" leçons":"la leçon")+" de "+NOMS[mo]+" ("+L[0].niveau+" · "+L[0].matiere+") ?"+(ens?" "+pl(ens,"notion ajoutée par un enseignant sera retirée aussi","notions ajoutées par des enseignants seront retirées aussi")+".":"")+" Cette action est définitive."))return;
    E.call("etab_programme_retirer_mois",{p_etab:E.ET.id,p_niveau:L[0].niveau,p_matiere:L[0].matiere,p_mois:mo},function(d){
      var n=+d.retirees||0;if(L.some(function(x){return x.id===edit.id;}))edit={id:"",t:"",mo:""};
      E.say((n?pl(n,"leçon retirée","leçons retirées"):"Aucune leçon retirée")+".");load(true);
    });
  }

  function after(v){
    v.querySelectorAll("[data-all]").forEach(function(b){
      b.onclick=function(){
        var k=b.getAttribute("data-all"),y=window.scrollY;
        all[k]=!all[k];E.render();window.scrollTo(0,y);
      };
    });
    /* une matière ouverte le reste quand on touche « Voir tout » */
    v.querySelectorAll("[data-pg]").forEach(function(d){
      d.ontoggle=function(){open[d.getAttribute("data-pg")]=!!d.open;};
    });
    /* le formulaire garde ce qui est écrit quand la page est redessinée */
    var f=[["pn","niv"],["pm","mat"],["pt","txt"]];
    f.forEach(function(p){var e=$(p[0]);if(e)e.oninput=function(){fm[p[1]]=e.value;};});
    var mo=$("pmo");if(mo)mo.onchange=function(){fm.mo=mo.value;};
    var a=$("padd");if(a)a.onclick=add;
    v.querySelectorAll("[data-edit]").forEach(function(b){
      b.onclick=function(){
        var id=b.getAttribute("data-edit"),l=(list||[]).filter(function(x){return x.id===id;})[0],y=window.scrollY;if(!l)return;
        edit={id:id,t:String(l.titre||""),mo:MOIS.indexOf(l.mois)>=0?l.mois:monthNow()};E.render();window.scrollTo(0,y);
      };
    });
    v.querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){del(b.getAttribute("data-del"));};});
    v.querySelectorAll("[data-delmois]").forEach(function(b){b.onclick=function(){delMois(b.getAttribute("data-delmois"));};});
    v.querySelectorAll("[data-esave]").forEach(function(b){b.onclick=function(){save(b.getAttribute("data-esave"));};});
    v.querySelectorAll("[data-ecancel]").forEach(function(b){b.onclick=function(){var y=window.scrollY;edit={id:"",t:"",mo:""};E.render();window.scrollTo(0,y);};});
    var et=$("pe-t");if(et)et.oninput=function(){edit.t=et.value;};
    var em=$("pe-m");if(em)em.onchange=function(){edit.mo=em.value;};
  }

  E.start({page:"programmes",load:load,render:render,after:after,reset:reset});
})();
