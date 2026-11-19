/* Accueil, page de classe, liste des élèves */
function renderEleves(){
  var c=cl();
  var h='<h1>Gérer la classe</h1><div class="card"><h2>Nom et matière</h2><input type="text" id="cn" value="'+esc(c.name)+'" aria-label="Nom de la classe" style="width:100%;margin-bottom:8px"><input type="text" id="cs" value="'+esc(c.subj||"")+'" placeholder="Matière (ex. Français)" aria-label="Matière" style="width:100%"></div>';
  var q=th(c);
  h+='<div class="card"><h2>Alertes</h2><p class="sub" style="margin-top:0">Un badge signale l’élève qui atteint ces seuils sur la période choisie dans le bilan. Mettez 0 pour désactiver.</p><div style="display:flex;gap:14px;flex-wrap:wrap"><label>Absences <input type="number" min="0" id="tha" value="'+q.a+'" style="width:76px"></label><label>Retards <input type="number" min="0" id="thr" value="'+q.r+'" style="width:76px"></label><label>Devoirs non rendus <input type="number" min="0" id="thd" value="'+q.d+'" style="width:76px"></label></div></div>';
  h+='<div class="card"><h2>Ajouter des élèves</h2><p class="sub" style="margin-top:0">Un nom par ligne. Vous pouvez coller toute votre liste d’un coup.</p><textarea id="ta" placeholder="Camille Durand&#10;Lucas Martin"></textarea><select id="dg" aria-label="Sexe des élèves ajoutés" style="width:100%;margin-top:8px"><option value="">Sexe : non précisé</option><option value="F">Sexe : fille</option><option value="M">Sexe : garçon</option></select><div class="bar" style="margin:8px 0 0"><button class="btn" id="add">Ajouter à la liste</button></div></div>';
  h+='<div class="card"><h2>Liste ('+c.students.length+")</h2>";
  if(c.students.length>1)h+='<button class="btn ghost" id="sort" style="margin-bottom:8px">Trier de A à Z</button>';
  if(!c.students.length)h+='<p class="sub">Aucun élève.</p>';
  c.students.forEach(function(s){h+='<div class="li"><input type="text" data-n="'+s.id+'" value="'+esc(s.name)+'" aria-label="Nom de l’élève" style="flex:1;min-width:0"><select data-g="'+s.id+'" aria-label="Sexe de '+esc(s.name)+'" style="min-height:40px;padding:4px 8px"><option value="">Sexe</option><option value="F"'+(s.g==="F"?" selected":"")+'>Fille</option><option value="M"'+(s.g==="M"?" selected":"")+'>Garçon</option></select><button data-del="'+s.id+'" aria-label="Retirer '+esc(s.name)+'">Retirer</button></div>';});
  h+="</div>";
  if(D.classes.length>1)h+='<button class="btn ghost" id="delc">Supprimer cette classe</button>';
  return h;
}


function clsStats(c){
  var t=today(),o={n:0,a:0},calls=0,sp=[],i;
  for(i=29;i>=0;i--){var d=dayRate(c,dback(i));if(d){o.n+=d.n;o.a+=d.a;}}
  for(i=6;i>=0;i--)sp.push(dayRate(c,dback(i)));
  Object.keys(c.records).forEach(function(k){if(k.slice(0,7)===t.slice(0,7)&&dayRate(c,k))calls++;});
  var td=c.records[t]||{},cn={p:0,a:0,r:0};
  c.students.forEach(function(s){if(td[s.id])cn[td[s.id]]++;});
  return{rate:rate(o),calls:calls,sp:sp,cn:cn,done:cn.p+cn.a+cn.r>0,n:c.students.length};
}

function renderClasse(){
  var c=cl(),st=clsStats(c),i;
  var ks=Object.keys(c.records).filter(function(k){return dayRate(c,k)}).filter(inRange).sort().reverse();
  var tot={},N=0,A=0,R=0,J=0;
  c.students.forEach(function(s){tot[s.id]={a:0,r:0,j:0,n:0}});
  ks.forEach(function(k){c.students.forEach(function(s){var v=c.records[k][s.id];if(!v)return;var t=tot[s.id];t.n++;N++;if(v==="a"){t.a++;A++;if(gn(c,k,s.id).j===true){t.j++;J++;}}if(v==="r"){t.r++;R++;}});});
  var h='<h1>'+esc(c.name)+'</h1><p class="sub">'+(c.subj?esc(c.subj)+' · ':'')+st.n+' élève'+(st.n>1?'s':'')+(st.n?' · '+(st.done?'appel d’aujourd’hui fait':'appel d’aujourd’hui à faire'):'')+'</p>';
  h+='<div class="cl-act"><button class="btn" data-go="'+(st.n?'appel':'eleves')+'">'+(!st.n?'Ajouter des élèves':st.done?'Modifier l’appel':'Faire l’appel')+'</button><button class="btn ghost" data-go="eleves">Gérer la classe</button><button class="btn ghost" data-go="notes">Notes</button><button class="btn ghost" data-go="suivi">Élèves à suivre</button><button class="btn ghost" data-go="hist">Bilan détaillé</button></div>';
  h+=filterUI();
  if(!st.n)return h+'<div class="empty">Cette classe n’a pas encore d’élèves.</div>';
  h+='<div class="cl-t"><div><b style="color:var(--p)">'+fr(rate({n:N,a:A}))+'</b><span>Présence</span></div><div><b>'+ks.length+'</b><span>Appel'+(ks.length>1?'s':'')+'</span></div><div><b>'+st.n+'</b><span>Élève'+(st.n>1?'s':'')+'</span></div></div>';
  h+='<div class="cl-t"><div><b style="color:var(--a)">'+A+'</b><span>Absence'+(A>1?'s':'')+'</span></div><div><b style="color:var(--p)">'+J+'</b><span>Justifiée'+(J>1?'s':'')+'</span></div><div><b style="color:var(--r)">'+R+'</b><span>Retard'+(R>1?'s':'')+'</span></div></div>';
  var sp='';for(i=13;i>=0;i--){var d=dayRate(c,dback(i));sp+=d?'<i style="height:'+Math.max(14,Math.round(d.p*100))+'%"></i>':'<i class="e"></i>';}
  h+='<div class="card"><h2>Présence, 14 derniers jours</h2><div class="cl-sp" role="img" aria-label="Présence par jour sur 14 jours">'+sp+'</div><div class="cl-ax"><span>'+esc(fmt(dback(13)))+'</span><span>Aujourd’hui</span></div></div>';
  var gs=[["F","Filles"],["M","Garçons"],["","Non précisé"]].map(function(x){var o={n:0,a:0,r:0,e:0};c.students.forEach(function(s){if((s.g||"")===x[0]){var t=tot[s.id];o.e++;o.n+=t.n;o.a+=t.a;o.r+=t.r;}});return{l:x[1],o:o};}).filter(function(x){return x.o.e});
  if(c.students.some(function(s){return s.g}))h+='<div class="card"><h2>Par sexe</h2><div class="scroll"><table><tr><th>Groupe</th><th class="n">Élèves</th><th class="n">Abs.</th><th class="n">Ret.</th><th class="n">Présence</th></tr>'+gs.map(function(x){return'<tr><td>'+x.l+'</td><td class="n">'+x.o.e+'</td><td class="n">'+x.o.a+'</td><td class="n">'+x.o.r+'</td><td class="n">'+fr(rate(x.o))+'</td></tr>'}).join('')+'</table></div></div>';
  var al=c.students.filter(function(s){return alertTxt(c,tot[s.id])});
  if(al.length)h+='<div class="card"><h2>⚠ À surveiller</h2>'+al.map(function(s){return'<button class="hist" data-fiche="'+s.id+'"><span>'+esc(s.name)+'</span><span>'+esc(alertTxt(c,tot[s.id]))+'</span></button>'}).join('')+'</div>';
  h+='<div class="card"><h2>Élèves ('+st.n+')</h2><div class="scroll"><table><tr><th>Élève</th><th class="n">Abs.</th><th class="n">Ret.</th><th class="n">Présence</th></tr>';
  c.students.slice().sort(function(a,b){return a.name.localeCompare(b.name,"fr")}).forEach(function(s){var t=tot[s.id];h+='<tr><td><button class="lnk" data-fiche="'+s.id+'">'+esc(s.name)+'</button>'+(alertTxt(c,t)?'<span class="al">⚠</span>':'')+'</td><td class="n">'+t.a+'</td><td class="n">'+t.r+'</td><td class="n">'+fr(rate(t))+'</td></tr>';});
  h+='</table></div></div>';
  h+=classeHoraires(c)+classeObs(c)+classeDevoirs(c);
  h+='<h2 style="font-size:1.05rem">Derniers appels</h2>'+(ks.length?ks.slice(0,8).map(function(k){var v=c.students.map(function(s){return c.records[k][s.id]});return'<button class="hist" data-open="'+k+'"><span>'+esc(fmt(k,true))+'</span><span>'+v.filter(function(z){return z==="a"}).length+' abs. · '+v.filter(function(z){return z==="r"}).length+' ret.</span></button>';}).join(''):'<p class="sub">Aucun appel sur cette période.</p>');
  return h;
}
function renderHome(){
  var c=cl(),t=today(),H=new Date().getHours(),st=clsStats(c),i;
  var first=ME?ME.name.split(/\s+/)[0]:"";
  var hi=(H<12?"Bonjour":H<18?"Bon après-midi":"Bonsoir")+(first?", "+first:"");
  var pct=st.done?Math.round((st.cn.p+st.cn.r)/(st.cn.p+st.cn.a+st.cn.r)*100):null;
  var C=2*Math.PI*34,off=pct===null?C:C*(1-pct/100);
  var ring='<svg class="rg" viewBox="0 0 84 84" aria-hidden="true"><circle class="rt" cx="42" cy="42" r="34"/><circle class="rp" cx="42" cy="42" r="34" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 42 42)"/></svg><span class="rv">'+(pct===null?"–":pct+"%")+'</span>';
  var h='<div class="hm"><section class="hm-hero"><div class="hm-top"><div><div class="hm-date">'+esc(fmt(t,true))+'</div><h1 class="hm-hi">'+esc(hi)+'</h1><div class="hm-cl">'+esc(c.name)+(c.subj?" · "+esc(c.subj):"")+'</div></div><div class="hm-ring" role="img" aria-label="Présence aujourd’hui : '+(pct===null?"appel non fait":pct+" %")+'">'+ring+'</div></div>'+
  '<div class="hm-st">'+(!st.n?"Aucun élève dans cette classe pour le moment.":st.done?st.cn.p+" présent(s) · "+st.cn.a+" absent(s) · "+st.cn.r+" retard(s)":"L’appel d’aujourd’hui n’est pas encore fait.")+'</div>'+
  '<button class="hm-cta" data-go="'+(st.n?"appel":"eleves")+'">'+(!st.n?"Ajouter des élèves":st.done?"Modifier l’appel":"Faire l’appel")+'</button></section>';
  h+=homeToday();
  // semaine
  var d0=new Date(),dw=(d0.getDay()+6)%7,wk="",L=["L","M","M","J","V"];
  for(i=0;i<5;i++){
    var dd=new Date(d0);dd.setDate(d0.getDate()-dw+i);
    var k=dstr(dd),dn=!!dayRate(c,k),cs=dn?"dn":k===t?"td":k>t?"fu":"mi";
    wk+='<button class="wd '+cs+'" data-open="'+k+'" aria-label="'+esc(fmt(k,true))+(dn?" : appel fait":"")+'"><span>'+L[i]+'</span><i>'+(dn?"✓":dd.getDate())+'</i></button>';
  }
  h+='<section class="hm-card"><h2 class="hm-h">Cette semaine</h2><div class="hm-week">'+wk+'</div></section>';
  // chiffres clés
  h+='<div class="hm-tiles"><div class="hm-tile"><b style="color:var(--p)">'+fr(st.rate)+'</b><span>Présence, 30 jours</span></div><div class="hm-tile"><b>'+st.n+'</b><span>Élève'+(st.n>1?"s":"")+'</span></div><div class="hm-tile"><b style="color:var(--r)">'+st.calls+'</b><span>Appel'+(st.calls>1?"s":"")+' du mois</span></div></div>';
  // classes
  var cc="";
  D.classes.forEach(function(x){
    var q=clsStats(x);
    cc+='<button class="cc'+(x.id===c.id?" on":"")+'" data-pick="'+x.id+'" aria-pressed="'+(x.id===c.id)+'"><b>'+esc(x.name)+'</b><small>'+(x.subj?esc(x.subj)+" · ":"")+q.n+" élève"+(q.n>1?"s":"")+'</small><div class="sp" aria-hidden="true">'+q.sp.map(function(d){return d?'<i style="height:'+Math.max(14,Math.round(d.p*100))+'%"></i>':'<i class="e"></i>';}).join("")+'</div><em class="'+(q.done?"ok":"todo")+'">'+(q.done?"Appel fait":"À faire")+'</em></button>';
  });
  cc+='<button class="cc add" data-newclass="1"><b>+</b><small>Nouvelle classe</small></button>';
  h+='<h2 class="hm-h hm-h2">Mes classes</h2><div class="hm-cls">'+cc+'</div>';
  // élèves à surveiller
  var al=[],ks=[];
  for(i=29;i>=0;i--)ks.push(dback(i));
  D.classes.forEach(function(x){x.students.forEach(function(s){var tx=alertTxt(x,cnt(x,s.id,ks));if(tx)al.push([x,s,tx]);});});
  h+='<section class="hm-card"><h2 class="hm-h">À surveiller</h2>'+(al.length?al.slice(0,5).map(function(a){return'<button class="hist" data-sf="'+a[0].id+"|"+a[1].id+'"><span>'+esc(a[1].name)+' <small>'+esc(a[0].name)+'</small></span><span>⚠ '+esc(a[2])+'</span></button>';}).join("")+(al.length>5?'<p class="sub" style="margin:0">+ '+(al.length-5)+' autre(s)</p>':""):'<p class="sub" style="margin:0">Rien à signaler sur les 30 derniers jours.</p>')+'</section>';
  return h+'<button class="lnk" data-go="suivi" style="justify-self:center">Élèves à suivre : détail de la classe</button><button class="lnk" data-go="part" style="justify-self:center">Importer ou sauvegarder mes données</button></div>';
}
