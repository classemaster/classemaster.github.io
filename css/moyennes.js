/* Trimestres, moyennes pondérées, rangs et appréciations (barème sur 20) */
/* Année scolaire : de septembre à août. T1 = sept.–déc., T2 = janv.–mars, T3 = avril–août. */
function schoolYear(d){var y=+String(d).slice(0,4),m=+String(d).slice(5,7);return m>=9?y:y-1;}
function syLabel(d){var y=schoolYear(d);return y+"-"+(y+1);}
function autoTr(d){var m=+String(d).slice(5,7);return m>=9?1:m<=3?2:3;}
function trOf(e){return e.tr||autoTr(e.d);}
function trName(p){return p===""||p===undefined?"Toutes les évaluations":p==="A"?"Moyenne annuelle":"Trimestre "+p;}
function trOpts(sel,all){
  var o=(all?[["","Toutes les évaluations"]]:[]).concat([[1,"Trimestre 1"],[2,"Trimestre 2"],[3,"Trimestre 3"],["A","Moyenne annuelle"]]);
  return o.map(function(x){return'<option value="'+x[0]+'"'+(x[0]===sel?" selected":"")+">"+x[1]+"</option>";}).join("");
}
function trParse(v){return v==="A"?"A":v?+v:"";}

/* Moyenne /20 d’un élève. p : "" (tout), 1, 2, 3 ou "A" (moyenne des trimestres notés). */
function sAvg(c,id,p){
  if(p==="A"){
    var a=[1,2,3].map(function(t){return sAvg(c,id,t);}).filter(function(x){return x!==null;});
    return a.length?a.reduce(function(t,x){return t+x;},0)/a.length:null;
  }
  var w=0,t=0;
  evs(c).forEach(function(e){
    if(typeof p==="number"&&trOf(e)!==p)return;
    var v=e.s&&e.s[id];
    if(typeof v==="number"&&e.m>0){var k=e.k===undefined?1:e.k;t+=v/e.m*20*k;w+=k;}
  });
  return w?t/w:null;
}

/* Rang de chacun (ex æquo : même rang). Renvoie {id:{a,r,n}} ; r est null sans moyenne. */
function rankMap(c,p){
  var L=c.students.map(function(s){return{id:s.id,a:sAvg(c,s.id,p)};});
  var ok=L.filter(function(x){return x.a!==null;}).sort(function(x,y){return Math.round(y.a*100)-Math.round(x.a*100);});
  var m={},n=ok.length;
  ok.forEach(function(x,i){
    var same=i&&Math.round(x.a*100)===Math.round(ok[i-1].a*100);
    m[x.id]={a:x.a,r:same?m[ok[i-1].id].r:i+1,n:n};
  });
  L.forEach(function(x){if(!m[x.id])m[x.id]={a:null,r:null,n:n};});
  return m;
}
function rkTxt(o){return o&&o.r?o.r+(o.r===1?"er":"e")+" / "+o.n:"–";}
function clsAvgStat(rm){
  var v=Object.keys(rm).map(function(k){return rm[k].a;}).filter(function(x){return x!==null;});
  if(!v.length)return{avg:null,max:null,min:null,n:0};
  return{avg:v.reduce(function(t,x){return t+x;},0)/v.length,max:Math.max.apply(null,v),min:Math.min.apply(null,v),n:v.length};
}
function apprec(a){
  if(a===null||a===undefined)return"";
  return a>=16?"Très bien":a>=14?"Bien":a>=12?"Assez bien":a>=10?"Passable":a>=8?"Insuffisant":"Faible";
}
/* Note d’une évaluation ramenée sur 20 */
function n20(e,v){return e.m>0?v/e.m*20:null;}
function evAvg20(e,c){var x=evStat(e,c);return x.n?x.avg/e.m*20:null;}

/* Absences et retards d’un élève sur une période (trimestre ou année) */
function absPer(c,id,p){
  var ks=Object.keys(c.records).filter(function(k){return typeof p!=="number"||autoTr(k)===p;});
  var o=cnt(c,id,ks),j=0;
  ks.forEach(function(k){if((c.records[k]||{})[id]==="a"&&gn(c,k,id).j===true)j++;});
  return{a:o.a,r:o.r,j:j};
}
