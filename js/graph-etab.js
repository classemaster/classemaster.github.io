/* Graphiques du tableau de bord de l'établissement (etablissement.html).
   Une carte par graphique, placée sous les indicateurs de chaque onglet. Les données sont celles déjà calculées par la page. */
var GE={inst:[]};
function geClear(){GE.inst.forEach(function(i){try{i.destroy();}catch(e){}});GE.inst=[];}
function geR1(x){return x===null||x===undefined||isNaN(x)?null:Math.round(x*10)/10;}
function geBand(a){return a>=16?0:a>=14?1:a>=12?2:a>=10?3:4;}

/* Chaque constructeur de carte renvoie [{k:"BarChart", t:"Titre", s:"Sous-titre", o:{options}}] ; une carte sans données est ignorée */
function geCards(x){
  var P=Charts.palette,M=x.M,TH=x.TH,out=[],byCls=function(){return Object.keys(M.C).sort(x.sortCls);};
  if(x.t==="apercu"&&M){
    var p=x.pc(M.N,M.A);
    if(p!==null)out.push({k:"GaugeChart",t:"Présence",s:"Toutes classes · seuil d’alerte "+TH.pres+" %",o:{min:0,max:100,unit:" %",label:"Présence",value:Math.round(p),
      zones:[{to:TH.pres,color:P[2],label:"Sous le seuil"},{to:100,color:P[1],label:"Satisfaisant"}]}});
    var n=[0,0,0,0,0],L=[["Excellent (16 et plus)","#35d6c9"],["Bien (14 à 16)","#8b7cff"],["Assez bien (12 à 14)","#38bdf8"],["Passable (10 à 12)","#ffc15a"],["Insuffisant (moins de 10)","#ff6b9a"]];
    M.means.forEach(function(a){n[geBand(a)]++;});
    if(M.means.length)out.push({k:"DonutChart",t:"Répartition des moyennes",s:"Élèves suivis, par niveau de moyenne",o:{unit:"élèves",total:x.rows.length,
      text:{label:"Répartition des moyennes",caption:"Élèves suivis",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},data:L.map(function(l,i){return{label:l[0],value:n[i],color:l[1]};})}});
    var ks=byCls().filter(function(k){return x.mean(M.C[k].m)!==null;});
    if(ks.length)out.push({k:"BarChart",t:"Moyenne par classe",s:"Sur 20 · trait = seuil de réussite",o:{unit:"/20",label:"Moyenne par classe",labels:ks.map(function(k){return k||"?";}),values:ks.map(function(k){return geR1(x.mean(M.C[k].m));}),goal:{value:TH.moy,label:"Seuil"}}});
  }
  if(x.t==="eff"){
    var C={},G={};
    x.rows.forEach(function(r){var k=r.class_label||"",l=x.lvl(k);C[k]=(C[k]||0)+1;G[l]=(G[l]||0)+1;});
    var cs=Object.keys(C).sort(x.sortCls),gs=Object.keys(G).sort(function(a,b){return x.lvlRank(a)-x.lvlRank(b)||a.localeCompare(b,"fr");});
    out.push({k:"BarChart",t:"Élèves par classe",s:"Effectif de chaque classe",o:{unit:"élèves",label:"Élèves par classe",labels:cs.map(function(k){return k||"?";}),values:cs.map(function(k){return C[k];})}});
    out.push({k:"DonutChart",t:"Répartition par niveau",s:"Part de chaque niveau dans l’établissement",o:{unit:"élèves",total:x.rows.length,
      text:{label:"Répartition par niveau",caption:"Élèves",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},data:gs.map(function(l,i){return{label:l,value:G[l],color:P[i%P.length]};})}});
  }
  if(x.t==="ass"&&M){
    var ka=byCls().filter(function(k){return M.C[k].n>0;});
    if(ka.length){
      out.push({k:"BarChart",t:"Présence par classe",s:"En % · trait = seuil d’alerte",o:{unit:"%",label:"Présence par classe",labels:ka.map(function(k){return k||"?";}),values:ka.map(function(k){return geR1(x.pc(M.C[k].n,M.C[k].a));}),goal:{value:TH.pres,label:"Seuil"}}});
      out.push({k:"BarChart",t:"Absences et retards",s:"Cumul par classe",o:{unit:"",label:"Absences et retards par classe",labels:ka.map(function(k){return k||"?";}),series:[
        {name:"Justifiées",color:P[1],values:ka.map(function(k){return M.C[k].j;})},
        {name:"Non justifiées",color:P[4],values:ka.map(function(k){return Math.max(0,M.C[k].a-M.C[k].j);})},
        {name:"Retards",color:P[3],values:ka.map(function(k){return M.C[k].r;})}]}});
    }
  }
  if(x.t==="res"&&M){
    if(M.means.length){
      out.push({k:"HistogramChart",t:"Distribution des moyennes",s:"Nombre d’élèves par tranche de 2 points",o:{unit:"élèves",label:"Distribution des moyennes",values:M.means.map(geR1),min:0,max:20,bins:10,threshold:TH.moy,thresholdLabel:"Seuil",xUnit:""}});
      var g=[];byCls().forEach(function(k){if(M.C[k].m.length)g.push({label:k||"?",color:P[g.length%P.length],values:M.C[k].m.map(geR1)});});
      if(g.length)out.push({k:"BoxPlotChart",t:"Moyennes par classe",s:"Médiane, quartiles et valeurs atypiques",o:{unit:"/20",label:"Moyennes par classe",min:0,max:20,groups:g.slice(0,8)}});
    }
    var ev=byCls().filter(function(k){return M.C[k].t.filter(function(a){return a.length;}).length>1;}).slice(0,5),vals=[];
    if(ev.length){
      var se=ev.map(function(k,i){var v=M.C[k].t.map(function(a){return geR1(x.mean(a));});v.forEach(function(y){if(y!==null)vals.push(y);});return{name:k||"?",color:P[i%P.length],values:v};});
      out.push({k:"LineChart",t:"Évolution par trimestre",s:"Moyenne des évaluations, T1 à T3",o:{unit:"/20",label:"Évolution par trimestre",labels:["T1","T2","T3"],series:se,goal:{value:TH.moy,label:"Seuil"},
        min:Math.max(0,Math.min(Math.floor(Math.min.apply(null,vals))-1,TH.moy-1)),max:Math.min(20,Math.max(Math.ceil(Math.max.apply(null,vals))+1,TH.moy+1))}});
    }
    var sk=Object.keys(M.SJ).sort(function(a,b){return x.mean(M.SJ[b].v)-x.mean(M.SJ[a].v);}).slice(0,12);
    if(sk.length)out.push({k:"BarChart",t:"Moyenne par matière",s:"Sur 20 · trait = seuil de réussite",o:{unit:"/20",label:"Moyenne par matière",labels:sk,values:sk.map(function(k){return geR1(x.mean(M.SJ[k].v));}),goal:{value:TH.moy,label:"Seuil"}}});
  }
  if(x.t==="ens"&&x.tch&&x.tch.length&&!x.tch.err){
    var cn={ok:0,miss:0,soon:0,none:0,unk:0},T={};
    x.tch.forEach(function(g){cn[x.stat(g)]++;var k=x.tname(g);T[k]=(T[k]||0)+(g.n_students||0);});
    var LB=[["ok","Appels faits","#35d6c9"],["miss","Appels non faits","#ff6b9a"],["soon","À venir","#38bdf8"],["none","Sans séance aujourd’hui","#9aa8bc"],["unk","Sans emploi du temps","#ffc15a"]];
    out.push({k:"DonutChart",t:"Appel du jour",s:"État des appels de la journée",o:{unit:"séances",total:x.tch.length,
      text:{label:"Appel du jour",caption:"Séances",of:"sur",ofTotal:"des séances",ofReference:"des séances"},data:LB.map(function(l){return{label:l[1],value:cn[l[0]],color:l[2]};})}});
    var tk=Object.keys(T).sort(function(a,b){return T[b]-T[a];}).slice(0,10);
    out.push({k:"BarChart",t:"Élèves par enseignant",s:"Élèves suivis, toutes matières confondues",o:{unit:"élèves",label:"Élèves par enseignant",labels:tk,values:tk.map(function(k){return T[k];})}});
  }
  if(x.t==="dis"&&x.dsc&&x.dsc.length&&!x.dsc.err){
    var lim=x.dstrOf(Date.now()-30*864e5),D={};
    x.dsc.forEach(function(r){if(!x.get(r.student_id)||r.d<lim)return;var k=x.get(r.student_id).class_label||"",o=D[k]||(D[k]={g:0,a:0});if(r.k==="grv")o.g++;else o.a++;});
    var kd=Object.keys(D).sort(function(a,b){return D[b].g+D[b].a-D[a].g-D[a].a;}).slice(0,10);
    if(kd.length)out.push({k:"BarChart",t:"Incidents par classe",s:"30 derniers jours",o:{unit:"incidents",label:"Incidents par classe",labels:kd.map(function(k){return k||"?";}),series:[
      {name:"Autres",color:P[3],values:kd.map(function(k){return D[k].a;})},{name:"Graves",color:P[4],values:kd.map(function(k){return D[k].g;})}]}});
  }
  if(x.t==="fin"&&x.fin){
    var F=x.fin,LF=[["p","Passe","#35d6c9"],["x","À examiner","#ffc15a"],["r","Redoublement","#ff6b9a"],["n","Non évalué","#9aa8bc"]],tot=x.rows.length;
    out.push({k:"DonutChart",t:"Passages proposés",s:"Décision proposée d’après les moyennes",o:{unit:"élèves",total:tot,
      text:{label:"Passages proposés",caption:"Élèves",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},data:LF.map(function(l){return{label:l[1],value:F.cnt[l[0]],color:l[2]};})}});
    var kf=Object.keys(F.PC).sort(x.sortCls);
    if(kf.length)out.push({k:"BarChart",t:"Passages par classe",s:"Élèves par décision proposée",o:{unit:"élèves",label:"Passages par classe",labels:kf.map(function(k){return k||"?";}),
      series:LF.map(function(l){return{name:l[1],color:l[2],values:kf.map(function(k){return F.PC[k][l[0]];})};})}});
  }
  return out;
}

/* Dessine les cartes dans l'emplacement #ge ; chaque graphique n'est construit que lorsqu'il approche de l'écran (rapidité) */
function geDraw(x){
  geClear();
  var root=document.getElementById("ge");
  if(!root||!window.Charts||!Charts.Chart)return;
  var cards;try{cards=geCards(Object.assign({t:root.dataset.t},x));}catch(e){cards=[];}
  if(!cards.length){root.remove();return;}
  root.innerHTML=cards.map(function(c,i){return'<section class="card ge-card"><h2>'+c.t+'</h2><p class="sub">'+c.s+'</p><div data-ge="'+i+'"></div></section>';}).join("");
  function build(el){
    if(el.dataset.done)return;el.dataset.done="1";
    var c=cards[+el.dataset.ge],C=window[c.k];
    try{GE.inst.push(new C(el,c.o));}catch(e){el.textContent="Graphique indisponible.";}
  }
  var els=Array.prototype.slice.call(root.querySelectorAll("[data-ge]"));
  if(!("IntersectionObserver" in window)){els.forEach(build);return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);build(e.target);}});},{rootMargin:"300px 0px"});
  els.forEach(function(el){io.observe(el);});
  setTimeout(function(){els.forEach(function(el){if(el.isConnected&&!el.dataset.done){try{io.unobserve(el);}catch(e){}build(el);}});},1800);
}
