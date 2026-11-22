/* Recherche globale */
function renderSearch(){
  return'<h1 style="text-transform:none">Recherche</h1><div class="qb"><input type="search" id="gq" placeholder="Élève, classe, date ou motif…" aria-label="Recherche" autocomplete="off" value="'+esc(gqs)+'"></div><div id="sres" role="status"></div>';
}
function drawSearch(){
  var el=document.getElementById("sres");if(!el)return;
  var q=nrm(gqs);
  if(!q){el.innerHTML='<div class="empty">Tapez un nom d’élève, une classe, une date ou un motif d’absence.</div>';return;}
  var words=q.split(/\s+/),MD=["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche","janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
  var m=function(t){var x=nrm(t);return words.every(function(w){return x.indexOf(w)>=0;});};
  var useD=words.some(function(w){return/\d/.test(w)||MD.indexOf(w)>=0;});
  var st=[],cs=[],ds=[],ms=[];
  liveCls().forEach(function(c){
    if(m(c.name+" "+(c.subj||"")))cs.push(c);
    c.students.forEach(function(s){if(m(s.name))st.push([c,s]);});
    Object.keys(c.records).sort().reverse().forEach(function(k){
      var r=c.records[k];if(!Object.keys(r).length)return;
      var p=k.split("-");
      if(useD&&m(fmt(k,true)+" "+p[2]+"/"+p[1]+"/"+p[0]+" "+k))ds.push([c,k]);
      var nk=(c.notes&&c.notes[k])||{};
      Object.keys(nk).forEach(function(id){
        var n=nk[id],s=c.students.find(function(x){return x.id===id});
        if(s&&n.m&&r[id]&&m(n.m))ms.push([c,k,s,n.m]);
      });
    });
  });
  var h="",cap=20;
  function sec(t,a,f){if(!a.length)return;h+='<h2 style="font-size:1.05rem;margin:14px 0 8px">'+t+" ("+a.length+")</h2>"+a.slice(0,cap).map(f).join("")+(a.length>cap?'<p class="sub">Affinez la recherche pour voir les '+(a.length-cap)+" autres.</p>":"");}
  sec("Élèves",st,function(x){return'<button class="hist" data-sf="'+x[0].id+"|"+x[1].id+'"><span>'+esc(x[1].name)+"</span><span>"+esc(x[0].name)+"</span></button>";});
  sec("Classes",cs,function(c){return'<button class="hist" data-sc="'+c.id+'"><span>'+esc(c.name)+"</span><span>"+c.students.length+" élèves</span></button>";});
  sec("Appels",ds,function(x){var v=Object.keys(x[0].records[x[1]]).map(function(i){return x[0].records[x[1]][i]});return'<button class="hist" data-sd="'+x[0].id+"|"+x[1]+'"><span>'+esc(fmt(x[1],true))+" · "+esc(x[0].name)+"</span><span>"+v.filter(function(z){return z==="a"}).length+" abs. · "+v.filter(function(z){return z==="r"}).length+" ret.</span></button>";});
  sec("Motifs",ms,function(x){return'<button class="hist" data-sd="'+x[0].id+"|"+x[1]+'"><span>'+esc(x[2].name)+" · "+esc(fmt(x[1]))+"</span><span>"+esc(x[3])+"</span></button>";});
  el.innerHTML=h||'<div class="empty">Aucun résultat pour « '+esc(gqs.trim())+" ».</div>";
}
