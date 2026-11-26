/* Page « Matières » de l'établissement (v90) : liste des matières, ajout, suppression, liste de départ.
   S'appuie sur le socle js/etab-core.js ; fonctions serveur : supabase/classes-matieres-v87.sql. */
(function(){
  var E=Etab,esc=E.esc,list=null,aff=[],loadErr="";

  function load(){
    list=null;aff=[];loadErr="";E.render();
    sb.rpc("etab_matieres_liste",{p_etab:E.ET.id}).then(function(r){
      if(r.error){loadErr=E.fail(r.error);list=[];}else list=r.data||[];
      E.render();
    },function(){loadErr="Pas d’internet.";list=[];E.render();});
    sb.rpc("etab_affectations_liste",{p_etab:E.ET.id}).then(function(r){aff=r.error?[]:(r.data||[]);E.render();},function(){});
  }

  /* classes où chaque matière est enseignée : « 6e A, 5e B » */
  function classesOf(id){
    var o={};aff.forEach(function(a){if(a.matiere_id===id)o[a.classe]=1;});
    return Object.keys(o).sort(E.sortCls);
  }

  function render(){
    if(list===null)return'<p class="sub" style="text-align:center;margin-top:30px">Chargement…</p>';
    var h='';
    if(loadErr)h+='<div class="card"><p class="sub" style="margin:0">'+esc(loadErr)+'</p></div>';
    h+='<div class="card"><h2>Matières de l’établissement</h2><p class="sub" style="margin:0 0 6px">Ces matières sont proposées quand vous donnez une classe à un enseignant (rubrique « Enseignants »).</p>'+
      '<label for="mn">Nouvelle matière</label><input id="mn" type="text" maxlength="60" autocomplete="off" placeholder="ex. Lingala">'+
      '<div class="bs"><button class="btn" id="madd">Ajouter</button>'+(list.length?'':'<button class="btn ghost" id="minit">Proposer une liste de départ</button>')+'</div></div>';
    if(!list.length)return h+'<p class="sub">Aucune matière pour le moment. Ajoutez-en une, ou chargez la liste de départ (Français, Mathématiques, Histoire-Géographie…) que vous pourrez ensuite modifier.</p>';
    h+='<h3 class="dh">'+E.plural(list.length,"matière","matières")+'</h3>';
    list.forEach(function(m){
      var cl=classesOf(m.id),n=+m.enseignants||0;
      h+='<div class="st mrow"><div class="mi"><b>'+esc(m.nom)+'</b> · <span class="tg '+(n?"ok":"bad")+'">'+(n?E.plural(n,"enseignant","enseignants"):"personne")+'</span>'+
        '<br><span class="sub" style="margin:0">'+(cl.length?esc(cl.join(", ")):"Pas encore affectée à une classe")+'</span></div>'+
        '<div class="mb"><button class="btn warn" data-del="'+esc(m.id)+'">Supprimer</button></div></div>';
    });
    return h;
  }

  function add(){
    var i=document.getElementById("mn"),v=i.value.trim();
    if(!v){E.say("Écrivez le nom de la matière.");return;}
    E.call("etab_matiere_ajouter",{p_etab:E.ET.id,p_nom:v},function(){E.say("Matière ajoutée.");load();});
  }

  function after(v){
    var a=document.getElementById("madd"),n=document.getElementById("mn"),ini=document.getElementById("minit");
    if(a)a.onclick=add;
    if(n)n.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();add();}};
    if(ini)ini.onclick=function(){E.call("etab_matieres_initiales",{p_etab:E.ET.id},function(d){load();E.say((d.ajoutees||0)+" matières ajoutées.");});};
    v.querySelectorAll("[data-del]").forEach(function(b){
      b.onclick=function(){
        var m=list.filter(function(x){return x.id===b.getAttribute("data-del");})[0];if(!m)return;
        if(!confirm("Supprimer la matière « "+m.nom+" » ?"))return;
        E.call("etab_matiere_supprimer",{p_etab:E.ET.id,p_matiere:m.id},function(){E.say("Matière supprimée.");load();});
      };
    });
  }

  E.start({page:"matieres",load:load,render:render,after:after,reset:function(){list=null;aff=[];}});
})();
