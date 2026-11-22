/* Comparaison de deux mois au choix (page Bilan) */
var CM={a:"",b:"",mode:"m"};   /* mode : "m" = mois, "t" = trimestres (clés T1, T2, T3) */
function cmIsT(k){return k.charAt(0)==="T";}
/* Mois ayant des appels ou des notes */
function cmMonthsData(c){
  var s={};
  Object.keys(c.records).forEach(function(k){if(Object.keys(c.records[k]).length)s[grMonth(k)]=1;});
  evs(c).forEach(function(e){if(e.d)s[grMonth(e.d)]=1;});
  return Object.keys(s).sort();
}
/* Tous les mois proposés : toute l'année scolaire (septembre à juin) + les autres mois ayant des données */
function cmMonthsAll(c){
  var s={},t=new Date(),y=t.getMonth()>=8?t.getFullYear():t.getFullYear()-1,i,d;
  cmMonthsData(c).forEach(function(m){s[m]=1;});
  var first=Object.keys(s).sort()[0];
  if(first&&+first.slice(0,4)<y||(first&&+first.slice(0,4)===y&&+first.slice(5)<9))y=+first.slice(5)>=9?+first.slice(0,4):+first.slice(0,4)-1;
  for(i=0;i<10;i++){d=new Date(y,8+i,1);s[d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")]=1;}
  return Object.keys(s).sort();
}
var CM_TR={T1:"Trimestre 1 (sept. – déc.)",T2:"Trimestre 2 (janv. – mars)",T3:"Trimestre 3 (avr. – juin)"};
function cmTrData(c){
  var s={};
  Object.keys(c.records).forEach(function(k){if(Object.keys(c.records[k]).length)s["T"+autoTr(k)]=1;});
  evs(c).forEach(function(e){if(e.d||e.tr)s["T"+trOf(e)]=1;});
  return Object.keys(s).sort();
}
function cmLabel(m){if(CM_TR[m])return CM_TR[m];var p=m.split("-"),t=new Date(+p[0],+p[1]-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});return t.charAt(0).toUpperCase()+t.slice(1);}
function cmStats(c,m){
  var per={},n=0,a=0,r=0,calls=0;
  c.students.forEach(function(s){per[s.id]={a:0,r:0};});
  Object.keys(c.records).forEach(function(k){
    if(cmIsT(m)?"T"+autoTr(k)!==m:grMonth(k)!==m)return;
    var rec=c.records[k],any=false;
    c.students.forEach(function(s){var v=rec[s.id];if(!v)return;any=true;n++;if(v==="a"){a++;per[s.id].a++;}if(v==="r"){r++;per[s.id].r++;}});
    if(any)calls++;
  });
  var inM=function(e){return cmIsT(m)?"T"+trOf(e)===m:grMonth(e.d||"")===m;},av=grStuAvgs(c,inM),hw=grHw(c,inM);
  return{per:per,pres:n?(n-a)/n*100:null,a:n?a:null,r:n?r:null,calls:calls||null,
    avg:grMean(av),succ:grSuccess(av),hw:hw?hw.p:null,ne:evs(c).filter(inM).length||null};
}
function cmFmt(v,u){
  if(v===null||v===undefined)return"–";
  var x=Math.round(v*10)/10;
  return String(x).replace(".",",")+(u||"");
}
function cmpCard(){
  var c=cl(),T=CM.mode==="t",ms=T?["T1","T2","T3"]:cmMonthsAll(c);
  if(ms.indexOf(CM.a)<0||ms.indexOf(CM.b)<0){
    var dm=T?cmTrData(c):cmMonthsData(c);
    if(dm.length>=2){CM.b=dm[dm.length-1];CM.a=dm[dm.length-2];}
    else{var cur=T?"T"+autoTr(today()):grMonth(today()),i=ms.indexOf(cur);if(i<1)i=ms.length-1;CM.b=ms[i];CM.a=ms[Math.max(0,i-1)];}
  }
  var dd=T?cmTrData(c):cmMonthsData(c),empty=[CM.a,CM.b].filter(function(m){return dd.indexOf(m)<0;});
  var A=cmStats(c,CM.a),B=cmStats(c,CM.b);
  var opt=function(sel){return(T?ms.slice():ms.slice().reverse()).map(function(m){return'<option value="'+m+'"'+(m===sel?" selected":"")+'>'+esc(cmLabel(m))+'</option>';}).join("");};
  /* [libellé, clé, unité, échelle des barres, true = plus haut = mieux, false = plus bas = mieux, null = neutre] */
  var M=[["Présence","pres"," %",100,true],["Absences","a","",0,false],["Retards","r","",0,false],["Appels faits","calls","",0,null],
         ["Moyenne de la classe","avg"," / 20",20,true],["Taux de réussite","succ"," %",100,true],["Devoirs rendus","hw"," %",100,true],["Évaluations","ne","",0,null]];
  var rows=M.map(function(x){
    var a=A[x[1]],b=B[x[1]],d=(a===null||b===null)?null:Math.round((b-a)*10)/10;
    var sc=x[3]||Math.max(a||0,b||0,1);
    var cls=d===null||d===0||x[4]===null?"cm-n":((x[4]?d>0:d<0)?"cm-g":"cm-b");
    var dt=d===null?"–":(d>0?"▲ +":d<0?"▼ ":"= ")+cmFmt(d===0?0:d).replace("-","−");
    var bar=function(v,k){return'<i class="cm-bar '+k+'" style="width:'+(v===null?0:Math.max(2,Math.min(100,v/sc*100)))+'%"></i>';};
    return'<div class="cm-r"><div class="cm-h"><b>'+x[0]+'</b><span class="cm-d '+cls+'">'+dt+(d!==null&&x[2]&&d!==0?" "+x[2].trim().replace("/ 20","pt"):"")+'</span></div>'+
      '<div class="cm-l"><span>'+cmFmt(a,x[2])+'</span><div class="cm-t">'+bar(a,"a")+'</div></div>'+
      '<div class="cm-l"><span>'+cmFmt(b,x[2])+'</span><div class="cm-t">'+bar(b,"b")+'</div></div></div>';
  }).join("");
  var st=c.students.map(function(s){
    var pa=A.per[s.id],pb=B.per[s.id];
    return{s:s,da:pb.a-pa.a,dr:pb.r-pa.r,pa:pa,pb:pb};
  }).filter(function(x){return x.da||x.dr;}).sort(function(x,y){return(y.da+y.dr)-(x.da+x.dr);});
  var tb=st.length?'<h3 class="cm-s">Élèves dont l’assiduité a changé</h3><div class="scroll"><table><tr><th>Élève</th><th class="n">Abs.</th><th class="n">Ret.</th></tr>'+
    st.slice(0,8).map(function(x){
      var f=function(a,b,d){return a+' → '+b+(d?' <span class="'+(d>0?'cm-b':'cm-g')+'">'+(d>0?"▲":"▼")+'</span>':"");};
      return'<tr><td><button class="lnk" data-fiche="'+x.s.id+'">'+esc(x.s.name)+'</button></td><td class="n">'+f(x.pa.a,x.pb.a,x.da)+'</td><td class="n">'+f(x.pa.r,x.pb.r,x.dr)+'</td></tr>';
    }).join("")+'</table></div>'+(st.length>8?'<p class="sub" style="margin:6px 0 0">+ '+(st.length-8)+' autre(s)</p>':""):"";
  return'<div class="card cm"><h2>Comparer deux périodes</h2><div class="seg3 cm-mode" style="grid-template-columns:1fr 1fr;margin-bottom:10px" role="group" aria-label="Type de période"><button type="button" data-cmmode="m" aria-pressed="'+(!T)+'">Mois</button><button type="button" data-cmmode="t" aria-pressed="'+T+'">Trimestres</button></div><div class="cm-sel"><label>Période A<select id="cma" aria-label="Première période">'+opt(CM.a)+'</select></label><label>Période B<select id="cmb" aria-label="Seconde période">'+opt(CM.b)+'</select></label></div>'+
    '<p class="sub" style="margin:8px 0 10px"><span class="cm-k a"></span>'+esc(cmLabel(CM.a))+' &nbsp; <span class="cm-k b"></span>'+esc(cmLabel(CM.b))+' · l’écart est calculé de la période A vers la période B.</p>'+(empty.length?'<p class="sub" style="margin:0 0 8px">Aucun appel ni note en '+empty.map(function(m){return esc(cmLabel(m));}).join(" et en ")+' : les valeurs sont affichées « – ».</p>':'')+rows+tb+'</div>';
}
document.getElementById("view").addEventListener("change",function(e){
  var t=e.target;
  if(t.id!=="cma"&&t.id!=="cmb")return;
  if(t.id==="cma")CM.a=t.value;else CM.b=t.value;
  var y=window.scrollY;render();window.scrollTo(0,y);
});

document.getElementById("view").addEventListener("click",function(e){
  var b=e.target.closest("[data-cmmode]");if(!b)return;
  CM.mode=b.dataset.cmmode;CM.a=CM.b="";
  var y=window.scrollY;render();window.scrollTo(0,y);
});
