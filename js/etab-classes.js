/* Page « Classes » de l'établissement (v90, complétée en v93) : création et archivage des classes, effectifs, élèves (ajout, modification, codes famille),
   cartes de codes (QR) et listes à imprimer, transfert d'élèves, nouveaux codes, effectifs et mouvements des 30 derniers jours.
   S'appuie sur le socle js/etab-core.js ; fonctions serveur : supabase/classes-matieres-v87.sql et supabase/gestion-v71.sql (transfert).
   C'est la seule page qui demande les codes secrets des élèves. */
(function(){
  var E=Etab,esc=E.esc,nrm=E.nrm,AL="ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var cl=null,loaded=false,loadErr="",cur=null,qtxt="",ed={},shown={},showArch=false,showExp=false,showEff=false,showImp=false,sending=false,mov=null,mv=null;

  function gen(n){var o="",a=new Uint8Array(32),i;while(o.length<n){crypto.getRandomValues(a);for(i=0;i<a.length&&o.length<n;i++)if(a[i]<248)o+=AL.charAt(a[i]%31);}return o;}
  function fmt(k){return String(k).replace(/(.{4})(?=.)/g,"$1-");}
  function link(code){return new URL("parent.html?c="+encodeURIComponent(code),location.href).href;}
  function intl(v){var d=String(v||"").replace(/[^\d+]/g,""),plus=d.charAt(0)==="+";d=d.replace(/\D/g,"");if(!d)return"";if(!plus){if(d.slice(0,2)==="00")d=d.slice(2);else if(d.slice(0,3)!=="242"||d.length<11)d="242"+d;}return d.length>=8&&d.length<=15?d:"";}
  function cnt(n){return E.plural(n,"élève","élèves");}
  function readHash(){var m=/^#c=(.*)$/.exec(location.hash);cur=m?decodeURIComponent(m[1]):null;mv=null;}
  function fnm(s){return nrm(s||"sans-classe").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"classe";}

  /* ---------- Chargement : classes puis élèves (avec codes) ---------- */
  function load(){
    loaded=false;loadErr="";cl=null;mov=null;E.render();
    var k=0,errs="";function done(){if(++k===3){loaded=true;E.render();if(errs)E.say(errs);}}
    sb.rpc("etab_classes_liste",{p_etab:E.ET.id}).then(function(r){
      if(r.error){errs=E.fail(r.error);cl=[];}else cl=r.data||[];done();
    },function(){errs="Pas d’internet.";cl=[];done();});
    E.loadStudents("id,name,class_label,ref,code,phone,created_at,classe_id",function(rows,err){if(err){loadErr=E.fail(err);}done();});
    /* départs (dossiers supprimés) : journal tenu par supabase/tableau-bord-admin.sql ; s'il manque, la page marche sans */
    sb.from("registry_log").select("name,class_label,created_at").eq("etab_id",E.ET.id).eq("event","depart").order("created_at",{ascending:false}).limit(500).then(function(r){mov=r.error?null:(r.data||[]);done();},function(){mov=null;done();});
  }

  /* un élève appartient à la classe c : par son lien d'abord, par son libellé à défaut */
  function inClass(r,c){return r.classe_id?r.classe_id===c.id:nrm(r.class_label||"")===nrm(c.nom);}
  function studentsOf(c){return E.rows.filter(function(r){return inClass(r,c);});}
  function noClass(){return E.rows.filter(function(r){return!r.classe_id&&!nrm(r.class_label||"");});}
  function byName(n){return(cl||[]).filter(function(c){return nrm(c.nom)===nrm(n);})[0]||null;}
  function effectif(c){return studentsOf(c).length;}

  /* ---------- Sélection : la classe ouverte (en entier, la recherche ne change pas ce qui est imprimé ou renouvelé) ou tous les élèves ---------- */
  function scope(){
    if(cur===null)return E.rows;
    if(cur==="")return noClass();
    var c=byName(cur);return c?studentsOf(c):[];
  }

  /* ---------- Cartes de codes (QR) : une carte par élève, à imprimer ou enregistrer en PDF ---------- */
  function printCards(L){
    if(!L.length)return;
    var pr=document.getElementById("pr");
    if(!pr||typeof QR==="undefined"){E.say("L’impression n’est pas disponible sur cette page.");return;}
    if(L.length>300&&!confirm(L.length+" cartes : l’impression peut être longue. Continuer ?"))return;
    var h='<div class="cards-grid">';
    L.forEach(function(r){
      var svg="";try{svg=QR.svg(link(r.code),150);}catch(e){}
      h+='<div class="card-p"><div class="cp-t">Classe Master · Suivi parent</div><div class="cp-q">'+svg+'</div><div class="cp-i"><b>'+esc(r.name)+'</b><br><span>'+esc(r.class_label||"")+'</span><div class="cp-c">'+esc(fmt(r.code))+'</div><small>Scannez le QR code pour voir les présences, notes et devoirs de votre enfant.</small></div></div>';
    });
    pr.innerHTML=h+'</div>';
    E.say("Cartes prêtes : choisissez « Enregistrer en PDF » dans la fenêtre d’impression. Ces cartes contiennent des codes secrets : ne les montrez qu’aux parents concernés.");
    setTimeout(function(){window.print();},150);
  }
  /* les cartes ne restent pas dans la page une fois imprimées */
  window.addEventListener("afterprint",function(){var pr=document.getElementById("pr");if(pr)pr.innerHTML="";});

  /* ---------- Listes à enregistrer : sans code (pour les enseignants) ou confidentielle (avec codes) ---------- */
  function exTeachers(L){
    if(!L.length)return;
    var X=[E.csvLine(["Nom","Classe","Réf"])];
    L.forEach(function(r){X.push(E.csvLine([r.name,r.class_label||"",r.ref]));});
    E.download("liste-enseignants"+(cur?"-"+fnm(cur):"")+".csv",X.join("\r\n"));
  }
  function exSecret(L){
    if(!L.length)return;
    var X=[E.csvLine(["Nom","Classe","Code","Lien"])];
    L.forEach(function(r){X.push(E.csvLine([r.name,r.class_label||"",fmt(r.code),link(r.code)]));});
    E.download("liste-confidentielle"+(cur?"-"+fnm(cur):"")+".csv",X.join("\r\n"),"Liste confidentielle : ne la transmettez pas aux enseignants.");
  }

  /* ---------- Nouveaux codes pour toute une classe (les anciens liens cessent de fonctionner) ---------- */
  function rotAll(L){
    if(!L.length||sending)return;
    if(!confirm("Créer de nouveaux codes pour "+cnt(L.length)+" ? Tous leurs anciens liens et codes cesseront de fonctionner : il faudra renvoyer les nouveaux aux parents."))return;
    sending=true;E.say("Création des nouveaux codes…");
    var done=0,bad=0,why="";
    function one(r,tries){
      var nc=gen(12);
      return sb.from("registry_students").update({code:nc}).eq("id",r.id).then(function(x){
        if(x.error){if(x.error.code==="23505"&&tries<3)return one(r,tries+1);return E.fail(x.error);}
        r.code=nc;return true;
      },function(){return "Pas d’internet.";});
    }
    (function chunk(a){
      if(a>=L.length||bad){
        sending=false;load();
        setTimeout(function(){E.say(bad?(why+" — "+E.plural(done,"code renouvelé","codes renouvelés")+", "+bad+" à refaire."):E.plural(done,"nouveau code créé","nouveaux codes créés")+". Imprimez ou exportez les cartes pour les redistribuer.");},500);
        return;
      }
      Promise.all(L.slice(a,a+10).map(function(r){return one(r,0);})).then(function(res){
        res.forEach(function(x){if(x===true)done++;else{bad++;why=x;}});
        chunk(a+10);
      });
    })(0);
  }

  /* ---------- Transfert d'élèves : par la fonction serveur, qui retire aussi les accès des enseignants et tient le journal ---------- */
  function mvPanel(from){
    var opts=(cl||[]).filter(function(c){return!c.archivee&&nrm(c.nom)!==nrm(from||"");}).sort(function(a,b){return E.sortCls(a.nom,b.nom);});
    if(from)opts.push({nom:""});
    if(!opts.length)return'<div class="al" role="status">Créez d’abord une autre classe pour y déplacer des élèves. <button class="btn ghost" data-mvno="1">Fermer</button></div>';
    return'<div class="card"><label for="mvs">Nouvelle classe</label><select id="mvs">'+opts.map(function(c){return'<option value="'+esc(c.nom)+'">'+esc(c.nom||"(sans classe)")+'</option>';}).join("")+'</select>'+
      '<p class="sub" style="margin:8px 0 0">Les enseignants qui avaient accès à ces élèves le perdent : redonnez-leur ensuite la nouvelle classe (rubrique « Enseignants »).</p>'+
      '<div class="bs"><button class="btn" data-mvgo="1">Déplacer</button><button class="btn ghost" data-mvno="1">Annuler</button></div></div>';
  }
  function doMove(){
    var s=document.getElementById("mvs");if(!s||mv===null)return;
    var to=s.value,ids,from,key=mv;
    if(key==="*"){ids=scope().map(function(r){return r.id;});from=cur||"";}
    else{var r=E.get(key);if(!r)return;ids=[r.id];from=r.class_label||"";}
    if(!ids.length){E.say("Aucun élève à déplacer.");return;}
    if(nrm(to)===nrm(from)){E.say("Choisissez une autre classe.");return;}
    if(!confirm("Déplacer "+cnt(ids.length)+" vers « "+(to||"(sans classe)")+" » ? Les enseignants qui avaient accès à ces élèves le perdent : redonnez-leur la nouvelle classe dans la rubrique « Enseignants ».")) return;
    E.call("etab_deplacer_eleves",{p_etab:E.ET.id,p_ids:ids,p_classe:to},function(d){
      mv=null;
      if(key==="*"){qtxt="";location.hash="";}
      load();
      setTimeout(function(){E.say(d.n?E.plural(d.n,"élève transféré","élèves transférés")+" vers « "+(to||"(sans classe)")+" ». Redonnez la nouvelle classe aux enseignants (rubrique « Enseignants »).":"Aucun élève à déplacer.");},400);
    });
  }

  /* ---------- Reprendre les classes de ce compte : un dossier avec son code pour chaque élève déjà saisi dans l'application ---------- */
  function importMine(){
    if(sending)return;
    sending=true;E.say("Lecture de vos classes…");
    sb.from("classes").select("id,name,students,th").then(function(r){
      if(r.error){sending=false;E.say(E.fail(r.error));return;}
      var have={},list=[],dup=0;
      E.rows.forEach(function(x){have[nrm(x.name)+"|"+nrm(x.class_label||"")]=1;});
      (r.data||[]).forEach(function(c){
        if(c.th&&c.th.ar)return;
        if(c.th&&c.th.x&&c.th.x.et&&c.th.x.et!==E.ET.id)return;   /* classe d'un autre établissement */
        (c.students||[]).forEach(function(st){
          if(!st||!st.name)return;
          var k=nrm(st.name)+"|"+nrm(c.name||"");
          if(have[k]){dup++;return;}
          have[k]=1;list.push({name:String(st.name).slice(0,120),class_label:String(c.name||"").slice(0,80),phone:String(st.p||"").slice(0,30)});
        });
      });
      if(!list.length){sending=false;E.say(dup?"Tous vos élèves ont déjà un dossier ("+dup+").":"Aucun élève trouvé dans les classes de ce compte.");return;}
      if(!confirm(E.plural(list.length,"élève recevra","élèves recevront")+" un code"+(dup?" ("+dup+" déjà existant"+(dup>1?"s":"")+")":"")+". Continuer ?")){sending=false;E.say("");return;}
      E.say("Attribution des codes…");
      (function chunk(a){
        if(a>=list.length){sending=false;load();setTimeout(function(){E.say(E.plural(list.length,"élève a","élèves ont")+" reçu un code. Vous pouvez maintenant exporter la liste, imprimer les cartes ou envoyer les liens.");},600);return;}
        var part=list.slice(a,a+200),tries=0;
        (function send(){
          var recs=part.map(function(x){return{etab_id:E.ET.id,name:x.name,class_label:x.class_label,phone:x.phone,ref:gen(10),code:gen(12)};});
          sb.from("registry_students").insert(recs).then(function(w){
            if(w.error){if(w.error.code==="23505"&&tries++<3){send();return;}sending=false;load();setTimeout(function(){E.say(E.fail(w.error));},400);return;}
            chunk(a+200);
          },function(){sending=false;E.say("Pas d’internet.");});
        })();
      })(0);
    },function(){sending=false;E.say("Pas d’internet.");});
  }

  /* ---------- Effectifs : niveaux, arrivées et départs des 30 derniers jours ---------- */
  function effHtml(){
    var lim=Date.now()-30*864e5,
        arr=E.rows.filter(function(r){return r.created_at&&new Date(r.created_at).getTime()>=lim;}),
        dep=mov?mov.filter(function(x){return new Date(x.created_at).getTime()>=lim;}):null,
        G={},nl=0,withCls=0;
    E.rows.forEach(function(r){
      var k=r.class_label||"";if(!k)return;
      var l=E.lvl(k),g=G[l]||(G[l]={n:0,c:{}});
      g.n++;withCls++;if(!g.c[k]){g.c[k]=0;nl++;}g.c[k]++;
    });
    var h='<div class="kpis">'+E.kp(E.rows.length,"élèves")+E.kp(nl,"classes")+E.kp(nl?E.nf1(withCls/nl):"–","élèves par classe")+E.kp("+"+arr.length,"ajoutés (30 j)")+E.kp(dep===null?"–":"−"+dep.length,"départs (30 j)")+'</div>';
    h+='<h3 class="dh">Par niveau</h3>';
    var LV=Object.keys(G).sort(function(a,b){return E.lvlRank(a)-E.lvlRank(b)||a.localeCompare(b,"fr");});
    if(!LV.length)h+='<p class="sub">Aucun élève rangé dans une classe.</p>';
    LV.forEach(function(l){var o=G[l],nc=Object.keys(o.c).length;h+=E.dr(l,E.plural(nc,"classe","classes")+" · "+E.nf1(o.n/nc)+" par classe en moyenne",cnt(o.n));});
    h+='<h3 class="dh">Mouvements des 30 derniers jours</h3>';
    var byC={};arr.forEach(function(r){var k=r.class_label||"(sans classe)";byC[k]=(byC[k]||0)+1;});
    var ks=Object.keys(byC).sort(E.sortCls);
    h+=ks.length?ks.map(function(k){return E.dr(k,E.plural(byC[k],"élève ajouté","élèves ajoutés"),"+"+byC[k],undefined,false);}).join(""):'<p class="sub">Aucun élève ajouté ces 30 derniers jours.</p>';
    if(dep===null)h+='<p class="sub" style="margin-top:8px">Départs indisponibles : exécutez <b>supabase/tableau-bord-admin.sql</b> dans Supabase pour les enregistrer.</p>';
    else if(!dep.length)h+='<p class="sub" style="margin-top:8px">Aucun départ enregistré ces 30 derniers jours.</p>';
    else{
      h+='<p class="sub" style="margin-top:8px">Départs (dossiers supprimés) :</p>';
      dep.slice(0,10).forEach(function(x){h+=E.dr(x.name,(x.class_label||"(sans classe)")+" · "+E.ago(x.created_at),"parti",undefined,true);});
      if(dep.length>10)h+='<p class="sub">+ '+E.plural(dep.length-10,"autre","autres")+'.</p>';
    }
    return h+'<p class="sub" style="margin-top:8px">« Ajoutés » compte les dossiers créés ; un dossier supprimé compte comme un départ. Supprimez donc un dossier seulement quand l’élève quitte l’établissement.</p>';
  }

  /* ---------- Cartes d'élèves ---------- */
  function stHtml(r){
    var open=shown[r.id]===true;
    return'<div class="stc">'+(ed[r.id]?
      '<label for="en'+r.id+'">Nom</label><input id="en'+r.id+'" type="text" value="'+esc(r.name)+'" maxlength="120"><label for="ec'+r.id+'">Classe</label><input id="ec'+r.id+'" type="text" list="cll" value="'+esc(r.class_label||"")+'" maxlength="80"><div class="bs"><button class="btn" data-act="save" data-id="'+r.id+'">Enregistrer</button><button class="btn ghost" data-act="cancel" data-id="'+r.id+'">Annuler</button></div>':
      '<b style="font-size:1.08rem">'+esc(r.name)+'</b> <span class="sub">'+esc(r.class_label||"")+'</span> <button class="btn ghost" style="min-height:30px;padding:3px 9px;font-size:.8rem" data-act="edit" data-id="'+r.id+'">Modifier</button>')+
      (open?'<div class="cdb"><span class="sub">Code</span><span class="cd">'+esc(fmt(r.code))+'</span></div>':"")+
      '<label for="ph'+r.id+'">Téléphone du parent (facultatif)</label><input id="ph'+r.id+'" type="tel" inputmode="tel" data-ph="'+r.id+'" value="'+esc(r.phone||"")+'" placeholder="06 123 45 67">'+
      '<div class="bs"><button class="btn" data-act="wa" data-id="'+r.id+'">WhatsApp</button><button class="btn ghost" data-act="show" data-id="'+r.id+'">'+(open?"Masquer le code":"Afficher le code")+'</button></div>'+
      '<details class="more"><summary>Plus d’actions</summary><div class="bs"><button class="btn ghost" data-act="cp" data-id="'+r.id+'">Copier le lien</button><button class="btn ghost" data-act="mv" data-id="'+r.id+'">Déplacer</button><button class="btn warn" data-act="rot" data-id="'+r.id+'">Nouveau code</button><button class="btn warn" data-act="del" data-id="'+r.id+'">Supprimer</button></div></details>'+(mv===r.id?mvPanel(r.class_label||""):"")+'</div>';
  }

  /* ---------- Vue d'ensemble : une tuile par classe, rangées par niveau ---------- */
  function listHtml(){
    var act=cl.filter(function(c){return!c.archivee;}),arch=cl.filter(function(c){return c.archivee;}),nc=noClass();
    var h='<div class="card"><h2>Nouvelle classe</h2><p class="sub" style="margin:0 0 6px">Créez les classes de l’établissement, puis donnez-les aux enseignants (rubrique « Enseignants »).</p>'+
      '<label for="cn">Nom de la classe</label><input id="cn" type="text" maxlength="120" autocomplete="off" placeholder="ex. 6e A">'+
      '<label for="cv">Niveau (facultatif)</label><input id="cv" type="text" maxlength="40" autocomplete="off" placeholder="ex. 6e">'+
      '<div class="bs"><button class="btn" id="ccre">Créer la classe</button></div></div>';
    h+='<details class="card" id="imp0"'+(showImp?" open":"")+'><summary>Reprendre mes classes existantes</summary><p class="sub" style="margin:8px 0 0">Crée automatiquement un dossier, avec son code, pour chaque élève déjà présent dans les classes de ce compte (classes archivées exclues). Les élèves déjà créés sont ignorés.</p><div class="bs"><button class="btn" id="imp">Attribuer un code à tous mes élèves</button></div></details>';
    var q=qtxt.trim()?nrm(qtxt):"";
    h+='<div class="card"><h2>Élèves par classe</h2><p class="sub" style="margin:0">'+cnt(E.rows.length)+' · '+E.plural(act.length,"classe","classes")+'</p>'+
      '<label for="qs">Rechercher un élève (nom ou classe)</label><input id="qs" type="search" autocomplete="off" value="'+esc(qtxt)+'" placeholder="ex. Kimbembe"></div>';
    if(q){
      var V=E.rows.filter(function(r){return nrm(r.name).indexOf(q)>=0||nrm(r.class_label||"").indexOf(q)>=0;});
      if(!V.length)return h+'<p class="sub" style="margin-top:12px">Aucun élève.</p>';
      V.slice(0,40).forEach(function(r){h+=stHtml(r);});
      if(V.length>40)h+='<p class="sub">40 premiers résultats : précisez la recherche.</p>';
      return h+'<datalist id="cll">'+cl.map(function(c){return'<option value="'+esc(c.nom)+'">';}).join("")+'</datalist>';
    }
    if(!act.length&&!nc.length)h+='<p class="sub">Aucune classe pour le moment. Créez-en une ci-dessus, puis ajoutez ses élèves.</p>';
    var G={};act.forEach(function(c){var l=E.lvl(c.nom);(G[l]=G[l]||[]).push(c);});
    Object.keys(G).sort(function(a,b){return E.lvlRank(a)-E.lvlRank(b)||a.localeCompare(b,"fr");}).forEach(function(l){
      var L=G[l].sort(function(a,b){return E.sortCls(a.nom,b.nom);}),tot=0;L.forEach(function(c){tot+=effectif(c);});
      h+='<h3 class="lvl">'+esc(l)+' <span class="sub">· '+E.plural(L.length,"classe","classes")+' · '+cnt(tot)+'</span></h3><div class="tiles">';
      L.forEach(function(c){var n=+c.enseignants||0;h+='<button class="tile" data-cls="'+esc(c.nom)+'"><span class="tn">'+esc(c.nom)+'</span><span class="sub">'+cnt(effectif(c))+(n?"":" · sans enseignant")+'</span></button>';});
      h+='</div>';
    });
    if(nc.length)h+='<h3 class="lvl">Sans classe</h3><div class="tiles"><button class="tile" data-cls=""><span class="tn">(sans classe)</span><span class="sub">'+cnt(nc.length)+'</span></button></div>';
    if(arch.length)h+='<details class="dd" id="arch"'+(showArch?" open":"")+'><summary>Classes archivées ('+arch.length+')</summary><div class="tiles">'+arch.map(function(c){return'<button class="tile" data-cls="'+esc(c.nom)+'"><span class="tn">'+esc(c.nom)+'</span><span class="sub">'+cnt(effectif(c))+'</span></button>';}).join("")+'</div></details>';
    h+='<details class="dd" id="exp"'+(showExp?" open":"")+'><summary>Cartes de codes et listes à imprimer</summary>'+
      '<div class="bs"><button class="btn" id="cards"'+(E.rows.length?"":" disabled")+'>Imprimer les cartes de codes (QR) de toutes les classes</button></div>'+
      '<div class="bs"><button class="btn ghost" id="ex1"'+(E.rows.length?"":" disabled")+'>Liste pour les enseignants (sans code)</button><button class="btn ghost" id="ex2"'+(E.rows.length?"":" disabled")+'>Liste confidentielle (avec codes)</button></div>'+
      '<p class="sub" style="margin-top:8px">La liste enseignants contient Nom, Classe et Réf : la Réf ne permet rien lire. Chaque enseignant l’importe dans sa classe.</p></details>';
    h+='<details class="dd" id="eff"'+(showEff?" open":"")+'><summary>Effectifs et mouvements (30 jours)</summary>'+effHtml()+'</details>';
    return h;
  }

  /* ---------- Page d'une classe ---------- */
  function classHtml(){
    var c=cur===""?{id:"",nom:"",archivee:false,enseignants:0}:byName(cur);
    if(!c)return'<div class="card"><button class="btn ghost" id="back">← Toutes les classes</button><p class="sub" style="margin-top:10px">Cette classe n’existe pas (ou plus).</p></div>';
    var base=cur===""?noClass():studentsOf(c),q=nrm(qtxt),V=q?base.filter(function(r){return nrm(r.name).indexOf(q)>=0;}):base;
    var n=+c.enseignants||0,
    h='<div class="card"><button class="btn ghost" id="back">← Toutes les classes</button><h1 style="margin:12px 0 2px">'+esc(c.nom||"(sans classe)")+(c.archivee?' <span class="tg">archivée</span>':"")+'</h1>'+
      '<p class="sub">'+cnt(base.length)+(c.id?" · "+(n?E.plural(n,"enseignant","enseignants"):"aucun enseignant")+(n?"":' · <a href="'+esc(E.href("enseignants"))+'">en donner un</a>'):"")+'</p>'+
      '<label for="qs">Rechercher dans cette classe</label><input id="qs" type="search" autocomplete="off" value="'+esc(qtxt)+'" placeholder="ex. Kimbembe">'+
      '<div class="bs"><button class="btn" id="cards"'+(base.length?"":" disabled")+'>Imprimer les cartes de codes (QR)</button><button class="btn ghost" id="ex1"'+(base.length?"":" disabled")+'>Liste pour les enseignants (sans code)</button><button class="btn ghost" id="ex2"'+(base.length?"":" disabled")+'>Liste confidentielle (avec codes)</button></div>'+
      '<details class="more"><summary>Autres actions sur la classe</summary><div class="bs"><button class="btn ghost" id="mvall"'+(base.length?"":" disabled")+'>Transférer vers une autre classe</button><button class="btn warn" id="rotall"'+(base.length?"":" disabled")+'>Nouveaux codes pour cette classe</button>'+(c.id?'<button class="btn ghost" id="carch">'+(c.archivee?"Réactiver la classe":"Archiver la classe")+'</button>':"")+'</div></details>'+(mv==="*"?mvPanel(cur):"")+'</div>';
    if(!c.archivee)h+='<details class="card"'+(base.length?"":" open")+'><summary style="font-weight:700;cursor:pointer">Ajouter des élèves</summary><p class="sub" style="margin:8px 0 6px">Un élève par ligne : <b>Nom</b> ou <b>Nom;Classe</b>. Chaque élève reçoit son code secret.</p>'+
      '<label for="dc">Classe pour les lignes sans classe</label><input id="dc" type="text" value="'+esc(c.nom)+'" autocomplete="off">'+
      '<label for="ta">Liste</label><textarea id="ta" placeholder="Jean Kimbembe&#10;Marie Ngoma"></textarea>'+
      '<div class="bs"><button class="btn" id="add">Créer les dossiers</button><label class="btn ghost" style="margin:0;display:inline-block" for="fl">Charger un fichier CSV</label><input id="fl" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" style="display:none"></div></details>';
    if(!V.length)h+='<p class="sub" style="margin-top:12px">Aucun élève.</p>';
    V.forEach(function(r){h+=stHtml(r);});
    return h+'<datalist id="cll">'+cl.map(function(x){return'<option value="'+esc(x.nom)+'">';}).join("")+'</datalist>';
  }

  function render(){
    if(!loaded)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    if(loadErr)return'<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>';
    return cur===null?listHtml():classHtml();
  }

  /* ---------- Ajout d'élèves ---------- */
  function addStudents(){
    if(sending)return;
    var dc=document.getElementById("dc").value.trim(),txt=document.getElementById("ta").value,have={},list=[],dup=0;
    E.rows.forEach(function(r){have[nrm(r.name)+"|"+nrm(r.class_label||"")]=1;});
    txt.split(/\r?\n/).forEach(function(l,i){
      var p=l.split(/\t|;/).map(function(x){return x.replace(/^"|"$/g,"").trim();});
      if(!p[0])return;
      if(i===0&&/^(nom|noms|eleve|eleves)$/.test(nrm(p[0])))return;
      var c=p[1]||dc,k=nrm(p[0])+"|"+nrm(c);
      if(have[k]){dup++;return;}
      have[k]=1;list.push({name:p[0],class_label:c});
    });
    if(!list.length){E.say(dup?"Aucun nouvel élève : "+dup+" déjà dans la liste.":"Aucun nom trouvé.");return;}
    if(!confirm(E.plural(list.length,"dossier","dossiers")+" à créer"+(dup?" ("+dup+" déjà existant"+(dup>1?"s":"")+", ignoré"+(dup>1?"s":"")+")":"")+". Continuer ?"))return;
    sending=true;E.say("Création…");
    (function chunk(a){
      if(a>=list.length){sending=false;load();setTimeout(function(){E.say(E.plural(list.length,"dossier créé","dossiers créés")+".");},400);return;}
      var part=list.slice(a,a+200),tries=0;
      (function send(){
        var recs=part.map(function(x){return{etab_id:E.ET.id,name:x.name,class_label:x.class_label,ref:gen(10),code:gen(12)};});
        sb.from("registry_students").insert(recs).then(function(r){
          if(r.error){
            if(r.error.code==="23505"&&tries++<3){send();return;}
            sending=false;load();setTimeout(function(){E.say(E.fail(r.error));},400);return;
          }
          chunk(a+200);
        },function(){sending=false;E.say("Pas d’internet.");});
      })();
    })(0);
  }

  /* ---------- Boutons ---------- */
  function after(v){
    var g=function(id){return document.getElementById(id);},b;
    /* chaque réaction garde son propre élément : « b » change à chaque ligne ci-dessous */
    function on(id,ev,fn){var el=g(id);if(el)el[ev]=function(e){return fn(el,e);};}
    if((b=g("ccre")))b.onclick=function(){
      var n=g("cn").value.trim();if(!n){E.say("Écrivez le nom de la classe.");return;}
      E.call("etab_classe_creer",{p_etab:E.ET.id,p_nom:n,p_niveau:g("cv").value.trim()},function(){E.say("Classe créée.");location.hash="#c="+encodeURIComponent(n);load();});
    };
    if((b=g("cn")))b.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();g("ccre").click();}};
    on("qs","oninput",function(el){qtxt=el.value;E.render();var q=g("qs");if(q){q.focus();var L=q.value.length;try{q.setSelectionRange(L,L);}catch(e){}}});
    on("arch","ontoggle",function(el){showArch=el.open;});
    on("exp","ontoggle",function(el){showExp=el.open;});
    on("eff","ontoggle",function(el){showEff=el.open;});
    on("imp0","ontoggle",function(el){showImp=el.open;});
    if((b=g("imp")))b.onclick=importMine;
    if((b=g("cards")))b.onclick=function(){printCards(scope());};
    if((b=g("ex1")))b.onclick=function(){exTeachers(scope());};
    if((b=g("ex2")))b.onclick=function(){exSecret(scope());};
    if((b=g("rotall")))b.onclick=function(){rotAll(scope());};
    if((b=g("mvall")))b.onclick=function(){mv="*";E.render();};
    v.querySelectorAll("[data-mvgo]").forEach(function(x){x.onclick=doMove;});
    v.querySelectorAll("[data-mvno]").forEach(function(x){x.onclick=function(){mv=null;E.render();};});
    if((b=g("back")))b.onclick=function(){qtxt="";location.hash="";};
    v.querySelectorAll("[data-cls]").forEach(function(t){t.onclick=function(){qtxt="";location.hash="#c="+encodeURIComponent(t.getAttribute("data-cls"));};});
    if((b=g("carch")))b.onclick=function(){
      var c=byName(cur);if(!c)return;
      if(!c.archivee&&!confirm("Archiver la classe « "+c.nom+" » ? Rien n’est effacé : elle disparaît des listes de travail et ne peut plus être donnée à un enseignant."))return;
      E.call("etab_classe_archiver",{p_etab:E.ET.id,p_classe:c.id,p_on:!c.archivee},function(){E.say(c.archivee?"Classe réactivée.":"Classe archivée.");load();});
    };
    if((b=g("add")))b.onclick=addStudents;
    on("fl","onchange",function(el){var f=el.files&&el.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){g("ta").value=String(rd.result||"").replace(/^\uFEFF/,"");};rd.readAsText(f);});
    v.querySelectorAll("[data-ph]").forEach(function(i){i.onchange=function(){
      var r=E.get(i.getAttribute("data-ph")),val=i.value.trim();if(!r)return;
      if(val&&!intl(val)){E.say("Ce numéro ne semble pas valide.");return;}
      sb.from("registry_students").update({phone:val}).eq("id",r.id).then(function(x){if(x.error)E.say(E.fail(x.error));else{r.phone=val;E.say("Numéro enregistré.");}},function(){E.say("Pas d’internet.");});
    };});
    v.querySelectorAll("[data-act]").forEach(function(a){a.onclick=function(){act(a.getAttribute("data-act"),E.get(a.getAttribute("data-id")));};});
  }

  function act(k,r){
    if(!r)return;
    if(k==="edit"){ed[r.id]=true;E.render();return;}
    if(k==="cancel"){delete ed[r.id];E.render();return;}
    if(k==="show"){shown[r.id]=!shown[r.id];E.render();return;}
    if(k==="save"){
      var nn=document.getElementById("en"+r.id).value.trim(),nc=document.getElementById("ec"+r.id).value.trim();
      if(!nn){E.say("Le nom ne peut pas être vide.");return;}
      var kk=nrm(nn)+"|"+nrm(nc);
      if(E.rows.some(function(y){return y.id!==r.id&&nrm(y.name)+"|"+nrm(y.class_label||"")===kk;})){E.say("Un élève de même nom existe déjà dans cette classe.");return;}
      var chName=nn!==r.name,chCls=nc!==(r.class_label||"");
      if(!chName&&!chCls){delete ed[r.id];E.render();return;}
      if(chCls&&nc&&!byName(nc)&&!confirm("La classe « "+nc+" » n’existe pas encore : elle sera créée. Continuer ?"))return;
      if(chCls&&!confirm("Déplacer "+r.name+" vers « "+(nc||"(sans classe)")+" » ? Les enseignants qui avaient accès à cet élève le perdent : redonnez-leur la classe dans la rubrique « Enseignants ».")) return;
      /* le changement de classe passe par la fonction de transfert : elle retire les accès des enseignants de l'ancienne classe et tient le journal */
      var fin=function(){
        if(!chCls){delete ed[r.id];load();setTimeout(function(){E.say("Élève modifié.");},400);return;}
        E.call("etab_deplacer_eleves",{p_etab:E.ET.id,p_ids:[r.id],p_classe:nc},function(){delete ed[r.id];load();setTimeout(function(){E.say("Élève modifié et déplacé. Redonnez la classe aux enseignants (rubrique « Enseignants »).");},400);});
      };
      if(!chName){fin();return;}
      sb.from("registry_students").update({name:nn}).eq("id",r.id).then(function(x){if(x.error){E.say(E.fail(x.error));return;}r.name=nn;fin();},function(){E.say("Pas d’internet.");});
      return;
    }
    if(k==="mv"){mv=r.id;E.render();return;}
    if(k==="cp"){var u=link(r.code);cmCopy(u,function(ok){E.say(ok?"Lien copié pour "+r.name+".":"Copie impossible. Maintenez le doigt sur le lien : "+u);});return;}
    if(k==="wa"){
      var t=intl(r.phone),txt="Bonjour, voici le lien unique pour suivre les présences, les notes et les devoirs de "+r.name+" dans toutes les matières : "+link(r.code);
      window.open("https://wa.me/"+(t||"")+"?text="+encodeURIComponent(txt),"_blank","noopener");return;
    }
    if(k==="rot"){
      if(!confirm("Créer un nouveau code pour "+r.name+" ? L’ancien lien cessera de fonctionner : il faudra renvoyer le nouveau au parent."))return;
      var nc2=gen(12);
      sb.from("registry_students").update({code:nc2}).eq("id",r.id).then(function(x){if(x.error){E.say(E.fail(x.error));return;}r.code=nc2;E.render();E.say("Nouveau code créé pour "+r.name+".");},function(){E.say("Pas d’internet.");});
      return;
    }
    if(k==="del"){
      if(!confirm("Supprimer le dossier de "+r.name+" ? Son lien famille cessera de fonctionner."))return;
      sb.from("registry_students").delete().eq("id",r.id).then(function(x){if(x.error){E.say(E.fail(x.error));return;}E.rows=E.rows.filter(function(y){return y.id!==r.id;});load();setTimeout(function(){E.say("Dossier supprimé.");},400);},function(){E.say("Pas d’internet.");});
    }
  }

  readHash();
  window.addEventListener("hashchange",function(){readHash();if(loaded)E.render();window.scrollTo(0,0);});
  E.start({page:"classes",load:load,render:render,after:after,reset:function(){cl=null;loaded=false;cur=null;qtxt="";ed={};shown={};mov=null;readHash();}});
})();
