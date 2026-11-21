/* Bilan, vue du mois et fiche élève */
function renderMois(){
  var c=cl(),y=+mo.slice(0,4),m=+mo.slice(5,7),last=new Date(y,m,0).getDate();
  var title=new Date(y,m-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"}),days=[];
  for(var d=1;d<=last;d++){var wd=new Date(y,m-1,d).getDay();if(wd!==0&&wd!==6)days.push(d);}
  var h='<div class="bar" style="align-items:center;justify-content:space-between;flex-wrap:nowrap"><button class="btn ghost" data-mo="-1" aria-label="Mois précédent">‹</button><h1 style="font-size:1.2rem">'+esc(title)+'</h1><button class="btn ghost" data-mo="1" aria-label="Mois suivant">›</button></div>';
  if(!c.students.length)return h+'<div class="empty">Aucun élève dans cette classe.</div>';
  h+='<div class="scroll"><table class="mt"><tr><th class="sk">Élève</th>'+days.map(function(d){return"<th>"+"DLMMJVS"[new Date(y,m-1,d).getDay()]+"<br>"+d+"</th>"}).join("")+"</tr>";
  c.students.forEach(function(s){
    h+='<tr><td class="sk"><button class="lnk" data-fiche="'+s.id+'">'+esc(s.name)+"</button></td>";
    days.forEach(function(d){
      var k=mo+"-"+String(d).padStart(2,"0"),v=(c.records[k]||{})[s.id];
      h+='<td class="'+(v?"c"+v:"")+'" data-open="'+k+'">'+(v==="p"?"✓":v==="a"?"A":v==="r"?"R":"")+"</td>";
    });
    h+="</tr>";
  });
  return h+'</table></div><p class="sub">✓ présent · A absent · R retard. Touchez une case pour ouvrir l’appel de ce jour, ou un nom pour voir sa fiche.</p>';
}
function renderFiche(){
  var c=cl(),s=c.students.find(function(x){return x.id===sel});
  if(!s)return'<div class="empty">Élève introuvable.<br><br><button class="btn" data-go="hist">Retour au bilan</button></div>';
  var ks=Object.keys(c.records).filter(inRange).sort().reverse(),o={a:0,r:0,j:0,n:0},rows="";
  ks.forEach(function(k){
    var v=c.records[k][s.id];if(!v)return;
    o.n++;if(v==="p")return;
    o[v]++;var n=gn(c,k,s.id);if(v==="a"&&n.j===true)o.j++;
    rows+='<div class="li"><span><b>'+esc(fmt(k,true))+'</b><br><span class="sub">'+(v==="a"?"Absent"+(n.j===true?" · justifiée":n.j===false?" · non justifiée":""):"Retard")+(n.m?" · "+esc(n.m):"")+'</span></span><button style="color:var(--accent)" data-open="'+k+'">Voir</button></div>';
  });
  var al=alertTxt(c,o);
  return'<button class="btn ghost" data-go="'+fb+'" style="margin-bottom:10px">← '+(fb==="classe"?"Retour à la classe":fb==="notes"?"Retour aux notes":fb==="suivi"?"Retour aux élèves à suivre":fb==="carnet"?"Retour au carnet":"Retour au bilan")+'</button><h1>'+esc(s.name)+'</h1><p class="sub">'+esc(c.name)+(c.subj?" · "+esc(c.subj):"")+(s.g==="F"?" · Fille":s.g==="M"?" · Garçon":"")+'</p>'+filterUI()+
  '<div class="card"><h2>Taux de fréquentation</h2><div class="rate">'+fr(rate(o))+'</div><p class="sub" style="margin:0">'+o.n+" appel(s) · "+o.a+" absence(s) dont "+o.j+" justifiée(s) · "+o.r+" retard(s)</p>"+(al?'<p style="margin:8px 0 0"><span class="al" style="margin:0">⚠ '+al+"</span></p>":"")+"</div>"+
  '<div class="card"><h2>Absences et retards</h2>'+(rows||'<p class="sub" style="margin:0">Aucune absence ni aucun retard sur cette période.</p>')+"</div>"+ficheNotes(c,s)+ficheDevoirs(c,s)+ficheObs(c,s)+ficheCarnet(c,s);
}

function renderHist(){
  var c=cl(),ks=Object.keys(c.records).filter(function(k){return Object.keys(c.records[k]).length}).filter(inRange).sort().reverse();
  var fh=filterUI();if(!ks.length)return fh+'<div class="empty">Aucun appel enregistré sur cette période.</div>';
  var tot={};c.students.forEach(function(s){tot[s.id]={a:0,r:0,j:0,n:0}});
  ks.forEach(function(k){Object.keys(c.records[k]).forEach(function(id){var v=c.records[k][id];if(tot[id]&&v)tot[id].n++;if(tot[id]&&(v==="a"||v==="r")){tot[id][v]++;if(v==="a"&&gn(c,k,id).j===true)tot[id].j++;}});});
  var al=c.students.filter(function(s){return alertTxt(c,tot[s.id])}).map(function(s){return esc(s.name)+" ("+alertTxt(c,tot[s.id])+")"});
  var gs=[["F","Filles"],["M","Garçons"],["","Non précisé"]].map(function(x){var o={n:0,a:0,r:0,e:0};c.students.forEach(function(s){if((s.g||"")===x[0]){var t2=tot[s.id];o.e++;o.n+=t2.n;o.a+=t2.a;o.r+=t2.r;}});return{l:x[1],o:o};}).filter(function(x){return x.o.e});
  var gcard=c.students.some(function(s){return s.g})?'<div class="card"><h2>Par sexe</h2><div class="scroll"><table><tr><th>Groupe</th><th class="n">Élèves</th><th class="n">Abs.</th><th class="n">Ret.</th><th class="n">Présence</th></tr>'+gs.map(function(x){return"<tr><td>"+x.l+'</td><td class="n">'+x.o.e+'</td><td class="n">'+x.o.a+'</td><td class="n">'+x.o.r+'</td><td class="n">'+fr(rate(x.o))+"</td></tr>"}).join("")+"</table></div></div>":"";
  var N=0,A=0;c.students.forEach(function(s){N+=tot[s.id].n;A+=tot[s.id].a;});
  var g=N?Math.round((N-A)/N*1000)/10:null;
  var h=fh+'<div class="card"><h2>Taux de fréquentation</h2><div class="rate">'+fr(g)+'</div><p class="sub" style="margin:0">'+ks.length+" appel(s) sur la période. Un retard compte comme une présence.</p></div>"+gcard+(al.length?'<div class="card"><h2>⚠ Alertes sur cette période</h2>'+al.join("<br>")+"</div>":"")+'<div class="card"><h2>Total par élève</h2><div class="bar"><button class="btn ghost" id="exp">Exporter en CSV</button></div><div class="scroll"><table><tr><th>Élève</th><th class="n">Absences</th><th class="n">Justifiées</th><th class="n">Retards</th><th class="n">Présence</th></tr>';
  c.students.slice().sort(function(a,b){return tot[b.id].a-tot[a.id].a||tot[b.id].r-tot[a.id].r}).forEach(function(s){
    h+='<tr><td><button class="lnk" data-fiche="'+s.id+'">'+esc(s.name)+"</button>"+(alertTxt(c,tot[s.id])?'<span class="al">⚠</span>':"")+'</td><td class="n">'+tot[s.id].a+'</td><td class="n">'+tot[s.id].j+'</td><td class="n">'+tot[s.id].r+'</td><td class="n">'+fr(rate(tot[s.id]))+"</td></tr>";});
  h+="</table></div></div><h2 style=\"font-size:1.05rem\">Appels passés</h2>";
  ks.forEach(function(k){
    var v=Object.keys(c.records[k]).map(function(id){return c.records[k][id]});
    var a=v.filter(function(x){return x==="a"}).length,r=v.filter(function(x){return x==="r"}).length;
    h+='<button class="hist" data-open="'+k+'"><span>'+esc(fmt(k,true))+"</span><span>"+a+" abs. · "+r+" ret.</span></button>";});
  return h;
}
