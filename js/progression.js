/* Graphiques de progression (SVG) : notes sur 20 au fil des évaluations */
/* pts : liste de {l: étiquette, v: valeur /20 ou null, t: infobulle}. series : [{n:nom, cls:classe CSS, pts:[...]}] */
function lineChart(labels,series,alt){
  var W=320,H=190,L=30,R=12,T=14,B=34,pw=W-L-R,ph=H-T-B,n=labels.length;
  function X(i){return L+(n>1?pw*i/(n-1):pw/2);}
  function Y(v){return T+ph*(1-Math.max(0,Math.min(20,v))/20);}
  var o='<svg class="gx" viewBox="0 0 '+W+" "+H+'" role="img" aria-label="'+esc(alt)+'" preserveAspectRatio="xMidYMid meet">';
  [0,5,10,15,20].forEach(function(g){
    o+='<line class="'+(g===10?"g10":"gl")+'" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(g).toFixed(1)+'" y2="'+Y(g).toFixed(1)+'"/><text class="gt" x="'+(L-5)+'" y="'+(Y(g)+3.5).toFixed(1)+'" text-anchor="end">'+g+"</text>";
  });
  var step=n>6?Math.ceil(n/5):1;
  labels.forEach(function(lb,i){
    if(i%step&&i!==n-1)return;
    o+='<text class="gt" x="'+X(i).toFixed(1)+'" y="'+(H-B+15)+'" text-anchor="'+(i===0&&n>1?"start":i===n-1&&n>1?"end":"middle")+'">'+esc(lb)+"</text>";
  });
  series.forEach(function(s){
    var d="",pen=false;
    s.pts.forEach(function(p,i){
      if(p.v===null||p.v===undefined){pen=false;return;}
      d+=(pen?"L":"M")+X(i).toFixed(1)+" "+Y(p.v).toFixed(1)+" ";pen=true;
    });
    if(d)o+='<path class="gp '+s.cls+'" d="'+d+'"/>';
    s.pts.forEach(function(p,i){
      if(p.v===null||p.v===undefined)return;
      o+='<circle class="gd '+s.cls+'" cx="'+X(i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="3.6"><title>'+esc(p.t||"")+"</title></circle>";
      if(s.lab&&n<=8)o+='<text class="gv" x="'+X(i).toFixed(1)+'" y="'+(Y(p.v)-8).toFixed(1)+'" text-anchor="middle">'+nf(p.v)+"</text>";
    });
  });
  return o+"</svg>";
}
function chartLegend(series){
  return'<div class="gleg">'+series.map(function(s){return'<span><i class="'+s.cls+'"></i>'+esc(s.n)+"</span>";}).join("")+"</div>";
}

/* Graphique de la bibliothèque (js/graphiques/) : parcours au clavier, tableau de données, export CSV et PNG.
   Si la bibliothèque n'est pas chargée, l'ancien dessin ci-dessus sert de repli. */
var PG={opts:{},n:0};
function pgClear(){
  Object.keys(PG.opts).forEach(function(k){var r=PG.opts[k];if(r.chart){try{r.chart.destroy();}catch(e){}}});
  PG.opts={};
}
/* S : séries au format {n, cls, pts:[{v,t}]} ; la série « s2 » (moyenne de la classe) est tracée en pointillés */
function pgChart(labels,S,alt,name){
  if(!window.LineChart||!window.Charts||!Charts.Chart)return lineChart(labels,S,alt)+(S.length>1?chartLegend(S):"");
  var id="pg"+(++PG.n);
  PG.opts[id]={name:name,chart:null,o:{
    label:alt,unit:"/20",min:0,max:20,goal:{value:10,label:"Seuil"},labels:labels,
    series:S.map(function(s,k){return{name:s.n,dashed:s.cls==="s2",color:k===0?Charts.palette[0]:undefined,values:s.pts.map(function(p){return p.v===null||p.v===undefined?0:Math.round(p.v*10)/10;})};})
  }};
  return'<div class="pg" data-pg="'+id+'"></div><div class="pg-x"><button type="button" class="lnk" data-pgx="csv:'+id+'">Tableau (CSV)</button><button type="button" class="lnk" data-pgx="png:'+id+'">Image (PNG)</button></div>';
}
function pgDraw(){
  if(!window.LineChart)return;
  document.querySelectorAll("[data-pg]").forEach(function(el){
    var r=PG.opts[el.dataset.pg];if(!r||r.chart)return;
    try{r.chart=new LineChart(el,r.o);}catch(e){el.textContent="Graphique indisponible.";}
  });
}
document.getElementById("view").addEventListener("click",function(e){
  var b=e.target.closest("[data-pgx]");if(!b)return;
  var a=b.dataset.pgx.split(":"),r=PG.opts[a[1]];
  if(!r||!r.chart)return;
  var nm=fname(r.name||"progression");
  if(a[0]==="csv"){var t="";try{t=r.chart.toCSV();}catch(x){}if(t)saveFile(nm+".csv","\ufeff"+t,"text/csv",toast);else toast("Rien à exporter pour ce graphique.");}
  else if(a[0]==="png"){r.chart.toPNG().then(function(bl){saveFile(nm+".png",bl,"image/png",toast);},function(){toast("Export de l’image impossible ici.");});}
});

/* Fiche élève : sa courbe comparée à la moyenne de la classe */
function ficheProg(c,s){
  var E=evs(c).filter(function(e){return e.s&&typeof e.s[s.id]==="number"&&e.m>0;}).sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0;});
  if(E.length<2)return'<div class="card"><h2>Progression</h2><p class="sub" style="margin:0">Le graphique apparaît à partir de deux notes.</p></div>';
  var lab=E.map(function(e){return fmt(e.d);});
  var me=E.map(function(e){var v=n20(e,e.s[s.id]);return{v:v,t:e.t+" : "+nf(v)+" / 20"};});
  var cl2=E.map(function(e){var v=evAvg20(e,c);return{v:v,t:"Classe, "+e.t+" : "+nf(v)+" / 20"};});
  var S=[{n:s.name,cls:"s1",pts:me,lab:true},{n:"Moyenne de la classe",cls:"s2",pts:cl2}];
  var first=me[0].v,last=me[me.length-1].v,tr=stTrend(me.map(function(p){return p.v;}));
  var alt="Notes sur 20 de "+s.name+" : "+me.map(function(p,i){return lab[i]+" "+nf(p.v);}).join(", ");
  return'<div class="card"><h2>Progression</h2>'+pgChart(lab,S,alt,"progression-"+s.name)+'<p class="sub" style="margin:8px 0 0">'+stTrendTxt(tr)+" ("+stSg(tr.d)+" pt sur l’année, d’après toutes les notes). Première note "+nf(first)+", dernière "+nf(last)+" sur 20.</p></div>";
}

/* Page Notes : moyenne de la classe évaluation après évaluation */
function classeProg(c,E){
  var L=E.filter(function(e){return evStat(e,c).n>0;}).sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:0;});
  if(L.length<2)return"";
  var pts=L.map(function(e){var v=evAvg20(e,c);return{v:v,t:e.t+" : "+nf(v)+" / 20"};});
  var S=[{n:"Moyenne de la classe",cls:"s1",pts:pts,lab:true}];
  return'<div class="card"><h2>Progression de la classe</h2>'+pgChart(L.map(function(e){return fmt(e.d);}),S,"Moyenne de la classe sur 20 : "+pts.map(function(p,i){return fmt(L[i].d)+" "+nf(p.v);}).join(", "),"progression-"+c.name)+'<p class="sub" style="margin:8px 0 0">Moyenne de chaque évaluation, ramenée sur 20.</p></div>';
}
