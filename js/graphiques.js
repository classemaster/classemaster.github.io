/* Graphiques de la page Bilan, calculés à partir des données réelles (D : classes, élèves, appels, notes, devoirs, programme).
   Rapidité : chaque graphique n'est calculé et dessiné que lorsqu'il approche de l'écran, et les calculs sont partagés dans un cache (GR.m) vidé à chaque affichage. */
var GR={inst:[],io:null,m:{}};

/* ---------- Outils de calcul ---------- */
function grMean(a){return a.length?a.reduce(function(t,x){return t+x;},0)/a.length:null;}
function grR1(x){return x===null||x===undefined?null:Math.round(x*10)/10;}
function grMonth(k){return String(k).slice(0,7);}
function grMName(m){var p=m.split("-"),s=new Date(+p[0],+p[1]-1,1).toLocaleDateString("fr-FR",{month:"short"}).replace(".","");return s.charAt(0).toUpperCase()+s.slice(1);}
function grMonday(k){var p=k.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()-((d.getDay()+6)%7));return dstr(d);}
function grIsoWeek(k){var p=k.split("-"),d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2])),n=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-n);var y0=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil(((d-y0)/864e5+1)/7);}
function grAddDays(k,n){var p=k.split("-"),d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()+n);return dstr(d);}
/* moyenne /20 d'un élève sur les évaluations retenues par pred (pondérée par le coefficient) */
function grAvgOf(c,id,pred){
  var w=0,t=0;
  evs(c).forEach(function(e){
    if(pred&&!pred(e))return;
    var v=e.s&&e.s[id];
    if(typeof v==="number"&&e.m>0){var k=e.k===undefined?1:e.k;t+=v/e.m*20*k;w+=k;}
  });
  return w?t/w:null;
}
function grStuAvgs(c,pred){var v=[];c.students.forEach(function(s){var a=grAvgOf(c,s.id,pred);if(a!==null)v.push(a);});return v;}
/* présence (%) d'une classe sur les dates retenues par pred */
function grPres(c,pred){
  var n=0,a=0;
  Object.keys(c.records).forEach(function(k){
    if(pred&&!pred(k))return;
    var r=c.records[k];
    c.students.forEach(function(s){var v=r[s.id];if(v){n++;if(v==="a")a++;}});
  });
  return n?{n:n,a:a,p:(n-a)/n*100}:null;
}
/* devoirs rendus (%) : « rendu » ou « en retard » comptent comme rendus */
function grHw(c,pred){
  var ok=0,all=0;
  evs(c).forEach(function(e){
    if(!e.h||(pred&&!pred(e)))return;
    c.students.forEach(function(s){var v=rdOf(e,s.id);if(v==="r"||v==="l"){ok++;all++;}else if(v==="n")all++;});
  });
  return all?{ok:ok,all:all,p:ok/all*100}:null;
}
function grSuccess(vals){return vals.length?vals.filter(function(x){return x>=10;}).length/vals.length*100:null;}
function grMonths(cs){
  var s={};
  cs.forEach(function(c){
    Object.keys(c.records).forEach(function(k){if(Object.keys(c.records[k]).length)s[grMonth(k)]=1;});
    evs(c).forEach(function(e){if(e.d)s[grMonth(e.d)]=1;});
  });
  return Object.keys(s).sort().slice(-6);
}
function grDelta(arr){
  var a=arr.filter(function(x){return x!==null;});
  return a.length>=2?Math.round((a[a.length-1]-a[a.length-2])*10)/10:null;
}
/* Comble les trous (semaine ou mois sans évaluation) : la moyenne reste celle de la dernière évaluation connue */
function grFill(a){
  var o=a.slice(),last=null,i;
  for(i=0;i<o.length;i++){if(o[i]!==null)last=o[i];else o[i]=last;}
  var first=null;for(i=0;i<o.length;i++)if(o[i]!==null){first=o[i];break;}
  for(i=0;i<o.length;i++){if(o[i]===null)o[i]=first;else break;}
  return o;
}
/* Mois choisi pour les graphiques (null = tout) : prédicats sur une évaluation (e.d) ou sur une date (k) */
function grPE(){var m=GR.per;return m?function(e){return grMonth(e.d)===m;}:undefined;}
function grPK(){var m=GR.per;return m?function(k){return grMonth(k)===m;}:inRange;}
function grMLong(m){var p=m.split("-");return new Date(+p[0],+p[1]-1,1).toLocaleDateString("fr-FR",{month:"long"});}
function grMed(a){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y;}),n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;}
function grSg(x,d){var v=Math.round(Math.abs(x)*(d?10:1))/(d?10:1);return(x>0?"+":x<0?"−":"")+nf(v);}
/* Variation entre le mois i et le mois non vide qui le précède : {d, from} (from = indice du mois de référence) */
function grDeltaI(arr,i){
  if(i<0||arr[i]===null||arr[i]===undefined)return null;
  for(var j=i-1;j>=0;j--)if(arr[j]!==null&&arr[j]!==undefined)return{d:Math.round((arr[i]-arr[j])*10)/10,from:j};
  return null;
}
/* Archive la plus récente de la même classe (« Nom · archive 2025-2026 »), ou null */
function grArchOf(c){
  var a=D.classes.filter(function(x){return isArch(x)&&x.name.indexOf(c.name+" · archive ")===0;});
  a.sort(function(x,y){return String(y.th.ar).localeCompare(String(x.th.ar));});
  return a[0]||null;
}
/* Série « an passé » : même mois (ou même semaine ISO) de l'archive ; null si l'archive n'a pas assez de points */
function grPastSeries(c,keys,mode,color){
  var ar=grArchOf(c);if(!ar||!evs(ar).length)return null;
  var raw=keys.map(function(k){
    return grR1(grMean(grStuAvgs(ar,function(e){
      return mode==="m"?grMonth(e.d).slice(5)===k.slice(5):grIsoWeek(grMonday(e.d))===grIsoWeek(k);
    })));
  });
  if(raw.filter(function(v){return v!==null;}).length<2)return null;
  return{name:c.name+" (an passé)",color:color,dashed:true,values:grFill(raw)};
}
/* Calendrier d'assiduité : 22 semaines, élèves présents (présents + retards) par jour d'appel */
function grHeat(c){
  var weeks=22,start=grAddDays(grMonday(today()),-(weeks-1)*7),t=today(),values=[],keys=[];
  for(var i=0;i<weeks*7;i++){
    var k=grAddDays(start,i),r=c.records[k],v=null;
    if(k<=t&&r){var n=0,a=0;c.students.forEach(function(s){var x=r[s.id];if(x){n++;if(x==="a")a++;}});if(n)v=n-a;}
    values.push(v);keys.push(k);
  }
  return{start:start,values:values,keys:keys};
}
function grStats(c){
  var k="stats:"+c.id;if(GR.m[k])return GR.m[k];
  var ms=grMonths([c]);
  var perM=function(f){return ms.map(function(m){return f(m);});};
  var inM=function(m){return function(x){return grMonth(x.d||x)===m;};};
  var all=grStuAvgs(c);
  var o={
    ms:ms,
    avg:grMean(all),success:grSuccess(all),
    pres:grPres(c,inRange),hw:grHw(c),
    sMoy:perM(function(m){return grMean(grStuAvgs(c,inM(m)));}),
    sPres:perM(function(m){var p=grPres(c,inM(m));return p?p.p:null;}),
    sHw:perM(function(m){var p=grHw(c,inM(m));return p?p.p:null;}),
    sSucc:perM(function(m){return grSuccess(grStuAvgs(c,inM(m)));})
  };
  GR.m[k]=o;return o;
}

/* ---------- Données de chaque graphique (calculées à la demande) ---------- */
var GR_B={
  line:function(c,P){
    var wk=[],cur=grMonday(today());
    for(var i=11;i>=0;i--)wk.push(grAddDays(cur,-7*i));
    var cs=[c].concat(liveCls().filter(function(x){return x!==c&&x.students.length&&evs(x).length;})).slice(0,3);
    var raw=cs.map(function(x){return wk.map(function(w){return grR1(grMean(grStuAvgs(x,function(e){return grMonday(e.d)===w;})));});});
    var has=cs.map(function(x,j){return raw[j].some(function(v){return v!==null;});});
    if(has.some(Boolean)){cs=cs.filter(function(x,j){return has[j];});raw=raw.filter(function(x,j){return has[j];});}
    var keep=wk.map(function(w,i){return raw.some(function(r){return r[i]!==null;});});
    if(!keep.some(Boolean))keep=wk.map(function(){return true;});
    var vals=[];
    var series=cs.map(function(x,j){
      var v=grFill(raw[j].filter(function(y,i){return keep[i];}));
      v.forEach(function(y){if(y!==null)vals.push(y);});
      return{name:x.name,color:P[j],values:v};
    });
    var wk2=wk.filter(function(w,i){return keep[i];}),past=grPastSeries(c,wk2,"w",P[6]);
    if(past){past.values.forEach(function(y){if(y!==null)vals.push(y);});series.push(past);}
    var ob=th(c).o;
    if(ob!==null)vals.push(ob);
    var o={unit:"/20",label:"Moyenne hebdomadaire par classe",labels:wk.filter(function(w,i){return keep[i];}).map(function(w){return"S"+grIsoWeek(w);}),series:series,goal:ob!==null?{value:ob,label:"Objectif"}:{value:10,label:"Seuil"},extremes:true};
    if(vals.length){o.min=Math.max(0,Math.min(Math.floor(Math.min.apply(null,vals))-1,9));o.max=Math.min(20,Math.max(Math.ceil(Math.max.apply(null,vals))+1,11));}
    if(!vals.length)o.empty="Pas encore de notes : la courbe apparaîtra dès que des évaluations seront saisies.";
    else if(o.labels.length<2)o.empty="Pas assez de semaines pour tracer une courbe : il en faut au moins 2 avec une note (pour l’instant : "+o.labels[0]+").";
    return o;
  },
  months:function(c,P){
    var cs=[c].concat(liveCls().filter(function(x){return x!==c&&x.students.length&&evs(x).length;})).slice(0,3);
    var ms=grMonths(cs),vals=[];
    var series=cs.map(function(x,i){
      var v=grFill(ms.map(function(m){return grR1(grMean(grStuAvgs(x,function(e){return grMonth(e.d)===m;})));}));
      return{name:x.name,color:P[i],values:v};
    }).filter(function(x){return x.values.some(function(y){return y!==null;});});
    series.forEach(function(x,i){x.color=P[i];x.values.forEach(function(y){if(y!==null)vals.push(y);});});
    var past2=grPastSeries(c,ms,"m",P[6]);
    if(past2){past2.values.forEach(function(y){if(y!==null)vals.push(y);});series.push(past2);}
    var ob=th(c).o;
    if(ob!==null)vals.push(ob);
    var o={unit:"/20",label:"Moyenne par mois et par classe",labels:ms.map(grMName),series:series,goal:ob!==null?{value:ob,label:"Objectif"}:{value:10,label:"Seuil"},extremes:true};
    if(vals.length){o.min=Math.max(0,Math.min(Math.floor(Math.min.apply(null,vals))-1,9));o.max=Math.min(20,Math.max(Math.ceil(Math.max.apply(null,vals))+1,11));}
    if(!vals.length)o.empty="Pas encore de notes : la courbe apparaîtra dès que des évaluations seront saisies.";
    else if(ms.length<2)o.empty="Pas assez de mois pour tracer une courbe : il en faut au moins 2 avec une note (pour l’instant : "+ms.map(grMName).join(", ")+").";
    return o;
  },
  bars:function(c,P){
    var mon=grMonday(today()),on=[],late=[],full=["Lundi","Mardi","Mercredi","Jeudi","Vendredi"];
    for(var i=0;i<5;i++){
      var r=c.records[grAddDays(mon,i)]||{},p=0,l=0;
      c.students.forEach(function(s){var v=r[s.id];if(v==="p")p++;else if(v==="r")l++;});
      on.push(p);late.push(l);
    }
    var w=new Date().getDay();
    return{unit:"élèves",label:"Élèves présents par jour",labels:["L","M","M","J","V"],full:full,current:w>=1&&w<=5?w-1:4,
      series:[{name:"À l’heure",color:P[0],values:on},{name:"En retard",color:P[3],values:late}],
      goal:{value:c.students.length,label:"Effectif"}};
  },
  rings:function(c,P){
    var pg=pgStat(c),hw=grHw(c),E=evs(c),done=E.filter(function(e){return c.students.some(function(s){return e.s&&typeof e.s[s.id]==="number";});}).length;
    return{title:"Avancement",rings:[
      {label:"Leçons faites",value:pg.n,goal:pg.total,color:P[2]},
      {label:"Devoirs rendus",value:hw?hw.ok:0,goal:hw?hw.all:0,color:P[5]},
      {label:"Évaluations notées",value:done,goal:E.length,color:P[4]}]};
  },
  donut:function(c){
    var L=[["Excellent (16 et plus)","#35d6c9"],["Bien (14 à 16)","#8b7cff"],["Assez bien (12 à 14)","#38bdf8"],["Passable (10 à 12)","#ffc15a"],["Insuffisant (moins de 10)","#ff6b9a"]],n=[0,0,0,0,0];
    var v=grStuAvgs(c,grPE());
    v.forEach(function(a){n[a>=16?0:a>=14?1:a>=12?2:a>=10?3:4]++;});
    return{unit:"élèves",total:c.students.length,
      text:{label:"Répartition des moyennes",caption:"Élèves évalués",of:"sur",ofTotal:"des élèves",ofReference:"de l’effectif"},
      data:L.map(function(l,i){return{label:l[0],value:n[i],color:l[1]};})};
  },
  radar:function(c,P){
    var s=grStats(c),n=s.ms.length,pct=function(x){return x===null||x===undefined?0:Math.round(x);};
    var at=function(i){return[pct(s.sPres[i]),pct(s.sHw[i]),pct(s.sMoy[i]===null?null:s.sMoy[i]/20*100),pct(s.sSucc[i])];};
    var series=[];
    if(n>=1)series.push({name:grMName(s.ms[n-1]),color:P[0],values:at(n-1)});
    if(n>=2)series.push({name:grMName(s.ms[n-2]),color:P[1],values:at(n-2)});
    return{max:100,label:"Vue d’ensemble de la classe",axes:["Présence","Devoirs rendus","Moyenne","Réussite"],series:series};
  },
  gauge:function(c,P){
    var sc=grSuccess(grStuAvgs(c,grPE()));
    return{min:0,max:100,unit:" %",label:"Taux de réussite",value:sc===null?0:Math.round(sc),
      zones:[{to:50,color:P[2],label:"À renforcer"},{to:75,color:P[3],label:"En progrès"},{to:100,color:P[1],label:"Solide"}]};
  },
  heat:function(c,P){
    var h=grHeat(c),mn=null;
    h.values.forEach(function(v){if(v!==null&&(mn===null||v<mn))mn=v;});
    var p=h.start.split("-");
    return{unit:"élèves",summary:"avg",floor:Math.max(0,(mn||0)-2),color:P[1],label:"Assiduité sur 22 semaines",start:(+p[0])+"-"+(+p[1])+"-"+(+p[2]),values:h.values};
  },
  funnel:function(c,P){
    var v=grStuAvgs(c,grPE());
    return{color:P[0],label:"Parcours de la classe",stages:[
      {label:"Effectif",value:c.students.length},{label:"Élèves évalués",value:v.length},
      {label:"Moyenne ≥ 10",value:v.filter(function(x){return x>=10;}).length},{label:"Moyenne ≥ 14",value:v.filter(function(x){return x>=14;}).length}]};
  },
  bubble:function(c,P){
    var pts=[];
    liveCls().forEach(function(x){
      var a=grMean(grStuAvgs(x)),p=grPres(x);
      if(x.students.length&&a!==null&&p)pts.push({label:x.name,group:"Classes",x:grR1(p.p),y:grR1(a),size:x.students.length});
    });
    var o={xTitle:"Assiduité",xUnit:"\u00a0%",yTitle:"Moyenne",sizeTitle:"Effectif",pointsName:"classes",label:"Assiduité, moyenne et effectif par classe",groups:[{name:"Classes",color:P[0]}],points:pts};
    if(pts.length){
      var xs=pts.map(function(p){return p.x;}),ys=pts.map(function(p){return p.y;});
      o.xMin=Math.max(0,Math.floor(Math.min.apply(null,xs))-4);o.xMax=Math.min(100,Math.max(Math.ceil(Math.max.apply(null,xs))+2,o.xMin+6));
      o.yMin=Math.max(0,Math.floor(Math.min.apply(null,ys))-2);o.yMax=Math.min(20,Math.max(Math.ceil(Math.max.apply(null,ys))+2,o.yMin+4));
    }
    return o;
  },
  waterfall:function(c){
    var n=0,a=0,j=0;
    Object.keys(c.records).forEach(function(k){
      if(!grPK()(k))return;
      var r=c.records[k];
      c.students.forEach(function(s){var v=r[s.id];if(v){n++;if(v==="a"){a++;if(gn(c,k,s.id).j===true)j++;}}});
    });
    return{unit:"",label:GR.per?"Présences de "+grMLong(GR.per):"Présences de la période",steps:[
      {label:"Attendues",full:"Présences attendues",value:n,total:true},
      {label:"Justifiées",full:"Absences justifiées",value:-j},
      {label:"Injustifiées",full:"Absences non justifiées",value:-(a-j)},
      {label:"Présences",full:"Présences réelles",total:true}]};
  },
  hist:function(c){
    return{unit:"élèves",label:"Distribution des moyennes",values:grStuAvgs(c,grPE()).map(grR1),min:0,max:20,bins:10,threshold:10,thresholdLabel:"Seuil",xUnit:""};
  },
  box:function(c,P){
    var g=[];
    liveCls().forEach(function(x){var v=grStuAvgs(x,grPE()).map(grR1);if(v.length)g.push({label:x.name,color:P[g.length%7],values:v});});
    return{unit:"/20",label:"Moyennes par classe",min:0,max:20,groups:g.slice(0,6)};
  },
  prog:function(c,P){
    var it=[];
    liveCls().forEach(function(x){var s=pgStat(x);if(s.total)it.push({label:x.name,value:s.n,goal:s.total,color:P[it.length%7]});});
    return{label:"Avancement du programme",unit:"leçons",items:it};
  },
  pgm:function(c,P){
    var B=cxBilan(c);
    if(!B.length)return{empty:"Donnez un mois à vos leçons (Cahier de textes, section Programme) pour voir ici les mois en avance et les mois en retard."};
    var now=cxIdxNow(),cur=-1;
    B.forEach(function(x,k){if(x.i===now)cur=k;});
    return{unit:"leçons",label:"Leçons du programme, mois par mois",labels:B.map(function(x){return CX_ABR[x.m];}),full:B.map(function(x){return CX_NOM[x.m];}),current:cur>=0?cur:undefined,
      series:[{name:"Faites",color:P[0],values:B.map(function(x){return x.done;})},{name:"Restantes",color:P[3],values:B.map(function(x){return x.left;})}]};
  }
};

/* ---------- Phrases de lecture sous chaque graphique (calculées sur les données affichées) ---------- */
function grB(t){return{b:t};}
function grGoalTxt(d,l){
  if(!d.goal||d.goal.label!=="Objectif")return"";
  return" Objectif de "+nf(d.goal.value)+" : "+(l>=d.goal.value?"atteint.":"encore "+nf(Math.round((d.goal.value-l)*10)/10)+" pt à gagner.");
}
var GR_R={
  pgm:function(c,d){
    var B=cxBilan(c),late=B.filter(function(x){return x.st==="past"&&x.left>0;}),ahead=B.filter(function(x){return x.st==="next"&&x.done>0;}),now=B.filter(function(x){return x.st==="now";})[0],o=[];
    var pl=function(n,w){return n+" "+w+(n>1?"s":"");};
    if(late.length)o.push(grB("En retard : "),late.map(function(x){return CX_NOM[x.m]+" ("+pl(x.left,"leçon")+" non faite"+(x.left>1?"s":"")+")";}).join(", ")+". ");
    else if(B.some(function(x){return x.st==="past";}))o.push(grB("Aucun retard : "),"les mois passés sont terminés. ");
    if(now)o.push(grB(CX_NOM[now.m]+" (en cours) : "),now.done+" sur "+now.total+" faites. ");
    if(ahead.length)o.push(grB("En avance : "),ahead.map(function(x){return CX_NOM[x.m]+" ("+pl(x.done,"leçon")+" déjà faite"+(x.done>1?"s":"")+")";}).join(", ")+". ");
    if(B.sans)o.push(pl(B.sans,"leçon")+" sans mois non comptée"+(B.sans>1?"s":"")+".");
    return o.length?o:null;
  },
  line:function(c,d){
    var s=d.series[0];if(!s||!s.values.length)return null;
    var v=s.values,n=v.length,l=v[n-1];if(l===null||l===undefined)return null;
    var o=[grB(s.name),' est à ',grB(nf(l)+"/20")];
    if(n>=2&&v[n-2]!==null)o.push(' ('+grSg(l-v[n-2],1)+' sur la semaine'+(n>2&&v[0]!==null?', '+grSg(l-v[0],1)+' depuis '+d.labels[0]:"")+').');else o.push(".");
    o.push(grGoalTxt(d,l));
    return o;
  },
  months:function(c,d){
    var s=d.series[0];if(!s||s.values.length<2)return null;
    var v=s.values,n=v.length,up=d.series.filter(function(x){return!x.dashed&&x.values[n-1]>=10;}).length,tot=d.series.filter(function(x){return!x.dashed;}).length;
    return[grB(s.name),' passe de ',grB(nf(v[0])),' à ',grB(nf(v[n-1])),' entre '+d.labels[0].toLowerCase()+' et '+d.labels[n-1].toLowerCase()+' ('+grSg(v[n-1]-v[0],1)+' pt). ',tot>1?up+' classe(s) sur '+tot+' au-dessus de 10 en '+d.labels[n-1].toLowerCase()+'.':"",grGoalTxt(d,v[n-1])];
  },
  bars:function(c,d){
    var on=d.series[0].values,lt=d.series[1].values,best=-1,bi=-1,L=0;
    on.forEach(function(x,i){L+=lt[i];if(x+lt[i]>best){best=x+lt[i];bi=i;}});
    if(best<=0)return["Aucun appel enregistré cette semaine."];
    return['Jour le plus complet : ',grB(d.full[bi].toLowerCase()),' ('+best+' présents). ',L+' retard(s) sur la semaine.'];
  },
  rings:function(c,d){
    var r=d.rings;if(!r[0].goal)return null;
    return[grB(r[0].value+" leçons sur "+r[0].goal),' faites ('+Math.round(r[0].value/r[0].goal*100)+' %). ',r[1].goal?'Devoirs rendus : '+Math.round(r[1].value/r[1].goal*100)+' %.':""];
  },
  donut:function(c,d){
    var t=0,m=null;d.data.forEach(function(x){t+=x.value;if(!m||x.value>m.value)m=x;});
    if(!t)return null;
    var low=d.data[4].value;
    return['Tranche la plus fréquente : ',grB(m.label),' ('+m.value+' élève(s) sur '+t+'). ',low?low+' élève(s) sous 10.':"Personne sous 10."];
  },
  gauge:function(c,d){
    var v=grStuAvgs(c,grPE());if(!v.length)return null;
    var n=v.filter(function(x){return x>=10;}).length;
    return[grB(n+" élève(s) sur "+v.length),' ont au moins 10 de moyenne ('+d.value+' %).'];
  },
  hist:function(c,d){
    var m=grMed(d.values);if(m===null)return null;
    return['Médiane de la classe : ',grB(nf(Math.round(m*10)/10)+"/20"),'. '+d.values.filter(function(x){return x<10;}).length+' moyenne(s) sous 10.'];
  },
  waterfall:function(c,d){
    var n=d.steps[0].value,j=-d.steps[1].value,u=-d.steps[2].value;
    if(!n)return null;
    return[grB((j+u)+" absence(s)"),' sur '+n+' présences attendues, dont '+j+' justifiée(s).'];
  },
  prog:function(c,d){
    if(!d.items.length)return null;
    var b=d.items.reduce(function(m,x){return x.value/x.goal>m.value/m.goal?x:m;});
    return['La plus avancée : ',grB(b.label),' ('+Math.round(b.value/b.goal*100)+' %, '+b.value+' leçons sur '+b.goal+').'];
  }
};
function grReadFill(host,key,c,d){
  var p=host.parentNode&&host.parentNode.querySelector(".gr-read");
  if(!p||!GR_R[key])return;
  var parts=null;try{parts=GR_R[key](c,d);}catch(e){}
  if(!parts){p.hidden=true;return;}
  p.textContent="";
  parts.forEach(function(x){
    if(!x)return;
    if(typeof x==="string")p.appendChild(document.createTextNode(x));
    else{var b=document.createElement("b");b.textContent=x.b;p.appendChild(b);}
  });
  p.hidden=false;
}

/* Boutons CSV / SVG / PNG dans l'angle de chaque carte */
function grAddTools(host,inst){
  var card=host.closest(".gr-card");
  if(!card||card.querySelector(".gr-tools")||!inst||typeof inst.export!=="function")return;
  var bar=document.createElement("div"),h=card.querySelector("h2"),t=(window.Charts&&Charts.config&&Charts.config().texts)||{};
  bar.className="gr-tools no-prt";bar.setAttribute("role","group");bar.setAttribute("aria-label","Exporter ce graphique");
  [["csv","CSV","exportCsv"],["svg","SVG","exportSvg"],["png","PNG","exportPng"]].forEach(function(f){
    var b=document.createElement("button");
    b.type="button";b.textContent=f[1];b.title=t[f[2]]||"";
    b.setAttribute("aria-label",(t[f[2]]||f[1])+" : "+(h?h.textContent:""));
    b.addEventListener("click",function(){var bad=function(){if(typeof toast==="function")toast("Export impossible pour ce graphique. Réessayez, ou rechargez la page.");};try{var r=inst.export(f[0],h?h.textContent:"");if(r&&r.catch)r.catch(bad);}catch(e){bad();}});
    bar.appendChild(b);
  });
  card.insertBefore(bar,card.firstChild);
}

/* Cartes : clé, titre, légende, classe du graphique */
var GR_CARDS=[
  ["line","Moyenne par classe","Évolution hebdomadaire · notes sur 20","LineChart"],
  ["months","Évolution mois par mois","Moyenne de chaque classe depuis la rentrée","LineChart"],
  ["bars","Présence de la semaine","Élèves présents par jour · semaine en cours","BarChart"],
  ["rings","Avancement","Leçons, devoirs rendus et évaluations notées","RingsChart"],
  ["donut","Répartition des moyennes","Élèves par niveau de moyenne","DonutChart"],
  ["radar","Vue d’ensemble","Ce mois et le mois précédent, en %","RadarChart"],
  ["gauge","Taux de réussite","Élèves ayant au moins 10 de moyenne","GaugeChart"],
  ["heat","Assiduité","Élèves présents chaque jour · 22 semaines","HeatmapChart"],
  ["funnel","Parcours de la classe","De l’effectif aux mentions","FunnelChart"],
  ["bubble","Classes comparées","Assiduité, moyenne et effectif · toutes les classes","BubbleChart"],
  ["waterfall","Présences de la période","Des présences attendues aux présences réelles · période du Bilan","WaterfallChart"],
  ["hist","Distribution des moyennes","Nombre d’élèves par tranche de 2 points","HistogramChart"],
  ["box","Moyennes par classe","Médiane, quartiles et valeurs atypiques","BoxPlotChart"],
  ["prog","Avancement du programme","Leçons faites par classe","ProgressChart"],
  ["pgm","Programme mois par mois","Leçons faites et restantes · avance et retard","BarChart"]
];

/* ---------- Affichage ---------- */
function grPeriodChips(ms){
  var h='<div class="gr-per no-prt" role="group" aria-label="Mois des graphiques"><button type="button" data-grp="" aria-pressed="'+(GR.per?"false":"true")+'">Tout</button>';
  ms.forEach(function(m){h+='<button type="button" data-grp="'+m+'" aria-pressed="'+(GR.per===m?"true":"false")+'">'+esc(grMName(m))+'</button>';});
  return h+"</div>";
}
function grKpis(c,s){
  var i=GR.per?s.ms.indexOf(GR.per):s.ms.length-1,pe=grPE(),av,su,pr,hw;
  if(GR.per){av=grMean(grStuAvgs(c,pe));su=grSuccess(grStuAvgs(c,pe));pr=grPres(c,grPK());hw=grHw(c,pe);}
  else{av=s.avg;su=s.success;pr=s.pres;hw=s.hw;}
  var f1=function(x){return nf(Math.abs(x))+" pt";},f2=function(x){return nf(Math.abs(x))+" pts";};
  return[
    {l:"Moyenne de la classe",v:av===null?"–":nf(Math.round(av*10)/10),u:av===null?"":"/ 20",dd:grDeltaI(s.sMoy,i),f:f1,ser:s.sMoy},
    {l:GR.per?"Présence du mois":"Présence (période)",v:pr?String(Math.round(pr.p)):"–",u:pr?"%":"",dd:grDeltaI(s.sPres,i),f:f2,ser:s.sPres},
    {l:"Devoirs rendus",v:hw?String(Math.round(hw.p)):"–",u:hw?"%":"",dd:grDeltaI(s.sHw,i),f:f2,ser:s.sHw},
    {l:"Taux de réussite",v:su===null?"–":String(Math.round(su)),u:su===null?"":"%",dd:grDeltaI(s.sSucc,i),f:f2,ser:s.sSucc}
  ];
}
function bilanChartsInner(){
  GR.m={};
  var c=cl(),s=grStats(c);
  if(GR.per&&s.ms.indexOf(GR.per)<0)GR.per=null;
  var K=grKpis(c,s);
  GR.k=K;GR.ms=s.ms;
  var h='<p class="sub gr-note">Classe « '+esc(c.name)+' »</p>'+helpTip("Comment lire ces graphiques ?","Calculés à partir de vos appels, notes, devoirs et programme. Touchez une barre, une part, un jour ou une boîte pour voir les élèves concernés.");
  if(s.ms.length>1)h+=grPeriodChips(s.ms);
  h+='<div class="gr-kpis">'+K.map(function(k,i){
    var dl=k.dd===null?(k.v==="–"?"":'<span class="gr-kpi-d none">Pas encore de comparaison</span>'):'<span class="gr-kpi-d'+(k.dd.d<0?" neg":"")+'">'+(k.dd.d<0?"▼ ":k.dd.d>0?"▲ ":"= ")+esc(k.f(k.dd.d))+" vs "+esc(grMLong(s.ms[k.dd.from]))+'</span>';
    return'<div class="gr-kpi"><div class="gr-kpi-l">'+esc(k.l)+'</div><div class="gr-kpi-v"><span>'+esc(k.v)+'</span><small>'+esc(k.u)+'</small></div><div class="gr-kpi-f">'+dl+'<div class="gr-kpi-s" data-grk="'+i+'"></div></div></div>';
  }).join("")+'</div>';
  h+=GR_CARDS.map(function(x){return'<section class="hm-card gr-card"><h2 class="hm-h">'+esc(x[1])+'</h2><p class="sub">'+esc(x[2])+'</p><div data-gr="'+x[0]+'"></div><p class="gr-read" hidden></p></section>';}).join("");
  return h;
}
function bilanCharts(){
  return'<h2 class="hm-h" style="margin:14px 0 -4px">Graphiques</h2><div class="gr">'+bilanChartsInner()+'</div>';
}
/* Change le mois des graphiques sans recharger la page du Bilan */
function grSetPeriod(m){
  var root=document.querySelector(".gr");if(!root)return;
  GR.per=m||null;
  var y=window.pageYOffset;
  grClear();
  root.innerHTML=bilanChartsInner();
  drawBilanCharts();
  window.scrollTo(0,y);
}

function grClear(){
  if(GR.io){try{GR.io.disconnect();}catch(e){}GR.io=null;}
  GR.inst.forEach(function(x){try{x.destroy();}catch(e){}});
  GR.inst=[];
  grCloseSheet();
}

function drawBilanCharts(){
  grClear();
  if(!window.Charts||!Charts.Chart)return;
  var root=document.querySelector(".gr");
  if(!root)return;
  var c=cl(),P=Charts.palette,ctor={};
  grWire(root,c);
  root.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-grp]");if(b&&b.getAttribute("aria-pressed")!=="true")grSetPeriod(b.dataset.grp);});
  GR_CARDS.forEach(function(x){ctor[x[0]]=x[3];});
  function build(el){
    if(el.dataset.grDone)return;
    el.dataset.grDone="1";
    try{
      if(el.dataset.grk!==undefined){
        var k=GR.k[+el.dataset.grk],lab=[],val=[];
        k.ser.forEach(function(v,i){if(v!==null){val.push(grR1(v));lab.push(grMName(GR.ms[i]));}});
        if(val.length>=2)GR.inst.push(new SparklineChart(el,{values:val,labels:lab,color:k.dd&&k.dd.d<0?Charts.colors.down:P[0],label:"Tendance : "+k.l}));
        return;
      }
      var key=el.dataset.gr,C=window[ctor[key]];
      if(C){var d=GR_B[key](c,P);
        if(d.empty){var m=document.createElement("p");m.className="sub gr-empty";m.textContent=d.empty;el.appendChild(m);grReadFill(el,key,c,null);return;}
        var inst=new C(el,d);GR.inst.push(inst);grReadFill(el,key,c,d);grAddTools(el,inst);}
    }catch(e){el.textContent="Graphique indisponible.";}
  }
  var els=Array.prototype.slice.call(root.querySelectorAll("[data-gr],[data-grk]"));
  if(GR.all||!("IntersectionObserver" in window)){els.forEach(build);return;}
  GR.io=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){GR.io.unobserve(e.target);build(e.target);}});
  },{rootMargin:"300px 0px"});
  els.forEach(function(el){GR.io.observe(el);});
  /* Filet de sécurité : certains navigateurs n'envoient jamais l'événement de visibilité, les graphiques resteraient vides */
  setTimeout(function(){els.forEach(function(el){if(el.isConnected&&!el.dataset.grDone){try{GR.io.unobserve(el);}catch(e){}build(el);}});},1800);
}


/* ---------- Vue par élève : toucher une barre, une part, un jour… ouvre la liste des élèves concernés ---------- */
function grBand(a){return a>=16?0:a>=14?1:a>=12?2:a>=10?3:4;}
function grAvgTxt(a){return a===null?"–":nf(Math.round(a*10)/10)+" / 20";}
/* Renvoie {title, sub, rows:[{c,s,r}]} pour l'élément touché, ou null */
function grWho(key,idx,c){
  var ST=c.students,rows=[],title="",sub="";
  var byAvg=function(cls,pred){
    var o=[];cls.students.forEach(function(s){var a=grAvgOf(cls,s.id,grPE());if(a!==null&&(!pred||pred(a)))o.push({c:cls,s:s,a:a});});
    o.sort(function(x,y){return y.a-x.a;});
    return o.map(function(x){return{c:x.c,s:x.s,r:grAvgTxt(x.a)};});
  };
  var day=function(k){
    var r=c.records[k]||{},o=[];
    ST.forEach(function(s){var v=r[s.id];if(v==="a"||v==="r")o.push({c:c,s:s,r:v==="a"?(gn(c,k,s.id).j===true?"Absent (justifié)":"Absent"):"En retard",w:v==="a"?0:1});});
    o.sort(function(x,y){return x.w-y.w||x.s.name.localeCompare(y.s.name,"fr");});
    return{title:fmt(k,true),sub:o.length?o.length+" absent(s) ou en retard":"Aucun absent ni retard ce jour-là.",rows:o};
  };
  if(key==="donut"){
    var L=["Excellent (16 et plus)","Bien (14 à 16)","Assez bien (12 à 14)","Passable (10 à 12)","Insuffisant (moins de 10)"],cnt=[0,0,0,0,0],nz=[];
    grStuAvgs(c,grPE()).forEach(function(a){cnt[grBand(a)]++;});
    cnt.forEach(function(n,i){if(n)nz.push(i);});
    var b=nz[idx];if(b===undefined)return null;
    return{title:L[b],rows:byAvg(c,function(a){return grBand(a)===b;}),sub:cnt[b]+" élève(s) de "+c.name};
  }
  if(key==="hist"){
    var lo=idx*2,hi=lo+2,last=idx===9;
    return{title:"Moyennes de "+lo+" à "+hi,rows:byAvg(c,function(a){a=grR1(a);return a>=lo&&(last?a<=hi:a<hi);}),sub:"Élèves de "+c.name};
  }
  if(key==="funnel"){
    var T=["Effectif","Élèves évalués","Moyenne ≥ 10","Moyenne ≥ 14"][idx];if(!T)return null;
    if(idx===0){ST.forEach(function(s){rows.push({c:c,s:s,r:grAvgTxt(grAvgOf(c,s.id,grPE()))});});rows.sort(function(x,y){return x.s.name.localeCompare(y.s.name,"fr");});}
    else rows=byAvg(c,idx===1?null:function(a){return a>=(idx===2?10:14);});
    return{title:T,rows:rows,sub:rows.length+" élève(s) de "+c.name};
  }
  if(key==="box"){
    var cls=liveCls().filter(function(x){return grStuAvgs(x,grPE()).length;}).slice(0,6)[idx];if(!cls)return null;
    return{title:"Moyennes de "+cls.name,rows:byAvg(cls),sub:"Classement de la classe"};
  }
  if(key==="bars"){
    if(idx<0||idx>4)return null;
    return day(grAddDays(grMonday(today()),idx));
  }
  if(key==="heat"){
    var h=grHeat(c),ks=[];h.values.forEach(function(v,i){if(v!==null)ks.push(h.keys[i]);});
    return ks[idx]?day(ks[idx]):null;
  }
  if(key==="gauge"){
    rows=byAvg(c,function(a){return a<10;}).reverse();
    return{title:"Moyenne sous 10",rows:rows,sub:rows.length?rows.length+" élève(s) à soutenir dans "+c.name:"Aucun élève sous 10 dans "+c.name};
  }
  return null;
}

function grCloseSheet(){
  var e=document.getElementById("gr-sh");
  if(e)e.remove();
  document.removeEventListener("keydown",grSheetKey);
}
function grSheetKey(e){if(e.key==="Escape")grCloseSheet();}
function grOpenSheet(w){
  grCloseSheet();
  var h='<div class="gr-sh" id="gr-sh"><div class="gr-sh-b" data-grx="1"></div><div class="gr-sh-p" role="dialog" aria-modal="true" aria-label="'+esc(w.title)+'"><div class="gr-sh-h"><h3>'+esc(w.title)+'</h3><button type="button" class="gr-sh-x" data-grx="1" aria-label="Fermer">✕</button></div><p class="sub" style="margin:0 0 8px">'+esc(w.sub||"")+'</p><div class="gr-sh-l">'+
    (w.rows.length?w.rows.map(function(x){return'<button type="button" class="hist" data-grs="'+esc(x.c.id)+"|"+esc(x.s.id)+'"><span>'+esc(x.s.name)+'</span><span>'+esc(x.r)+'</span></button>';}).join(""):'<p class="sub">Aucun élève.</p>')+
    '</div></div></div>';
  document.body.insertAdjacentHTML("beforeend",h);
  var sh=document.getElementById("gr-sh");
  sh.addEventListener("click",function(e){
    if(e.target.closest("[data-grx]")){grCloseSheet();return;}
    var b=e.target.closest("[data-grs]");
    if(!b)return;
    var p=b.dataset.grs.split("|");
    grCloseSheet();
    D.cur=p[0];sel=p[1];fb="hist";view="fiche";render();window.scrollTo(0,0);
  });
  document.addEventListener("keydown",grSheetKey);
  var x=sh.querySelector(".gr-sh-x");if(x)x.focus();
}

/* Branche le clic (et Entrée / Espace) sur les éléments des graphiques concernés */
function grWire(root,c){
  var SEL={donut:".dc-seg,.dc-item",hist:".ch-hit",funnel:".ch-hit",box:".ch-hit",bars:".ch-hit",heat:".ch-cell",gauge:"svg"};
  function go(e,fromKey){
    var host=e.target.closest("[data-gr]");
    if(!host)return;
    var key=host.dataset.gr,sel=SEL[key];
    if(!sel)return;
    var t=e.target.closest(sel);
    if(!t||!host.contains(t))return;
    var one=t.matches(".dc-seg")?".dc-seg":t.matches(".dc-item")?".dc-item":sel;
    var idx=key==="gauge"?0:Array.prototype.indexOf.call(host.querySelectorAll(one),t);
    if(idx<0)return;
    var w=grWho(key,idx,c);
    if(!w)return;
    if(fromKey)e.preventDefault();
    grOpenSheet(w);
  }
  root.addEventListener("click",function(e){go(e,false);});
  root.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches(".ch-hit"))go(e,true);});
  root.classList.add("gr-tap");
}


/* ---------- Impression du Bilan en PDF (graphiques compris) ----------
   On passe en thème clair, on dessine tous les graphiques d'un coup et sans animation,
   puis on ouvre la fenêtre d'impression (« Enregistrer au format PDF »). */
function bilanPrint(){
  var root=document.documentElement,prev=root.getAttribute("data-theme"),mm=window.matchMedia;
  function restore(){
    window.removeEventListener("afterprint",restore);
    if(prev===null)root.removeAttribute("data-theme");else root.setAttribute("data-theme",prev);
    GR.all=false;if(view==="hist")drawBilanCharts();
  }
  root.setAttribute("data-theme","light");
  GR.all=true;
  window.matchMedia=function(q){
    if(/prefers-reduced-motion/.test(q))return{matches:true,media:q,addEventListener:function(){},removeEventListener:function(){},addListener:function(){},removeListener:function(){}};
    return mm.call(window,q);
  };
  try{drawBilanCharts();}finally{window.matchMedia=mm;}
  window.addEventListener("afterprint",restore);
  setTimeout(function(){window.print();},700);
}
