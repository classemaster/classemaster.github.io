/* Écran d’appel (présents, absents, retards, motifs) */
function nt(c,k,id){if(!c.notes)c.notes={};if(!c.notes[k])c.notes[k]={};if(!c.notes[k][id])c.notes[k][id]={};return c.notes[k][id];}
function gn(c,k,id){return(c.notes&&c.notes[k]&&c.notes[k][id])||{};}
function tag(c,k,id,abs){var n=gn(c,k,id),p=[];if(abs&&n.j===true)p.push("justifiée");if(abs&&n.j===false)p.push("non justifiée");if(n.m)p.push(n.m);return p.length?" ("+p.join(", ")+")":"";}
function noteUI(c,id,v){
  if(v!=="a"&&v!=="r")return"";
  var n=gn(c,date,id),h='<div class="mot">';
  if(v==="a")h+='<select data-j="'+id+'" aria-label="Justification"><option value="">Justification ?</option><option value="1"'+(n.j===true?" selected":"")+'>Justifiée</option><option value="0"'+(n.j===false?" selected":"")+'>Non justifiée</option></select>';
  return h+'<input type="text" data-m="'+id+'" placeholder="Motif (facultatif)" value="'+esc(n.m||"")+'" aria-label="Motif"></div>'+pmButton(c,id,v);
}

function summary(c,k){
  var r=c.records[k]||{},ab=[],re=[];
  c.students.forEach(function(s){if(r[s.id]==="a")ab.push(s.name+tag(c,k,s.id,true));if(r[s.id]==="r")re.push(s.name+tag(c,k,s.id,false));});
  var t="Appel du "+fmt(k,true)+" – "+c.name+(c.subj?" ("+c.subj+")":"")+"\n";
  t+="Absents : "+(ab.length?ab.join(" ; "):"aucun")+"\n";
  t+="Retards : "+(re.length?re.join(" ; "):"aucun");
  return t;
}

function renderAppel(){
  var c=cl(),r=c.records[date]||{},n={p:0,a:0,r:0,x:0};
  if(!c.students.length){return'<div class="empty">Cette classe n’a pas encore d’élèves.<br><br><button class="btn" data-go="eleves">Ajouter des élèves</button></div>';}
  c.students.forEach(function(s){var v=r[s.id];n[v||"x"]++;});
  var h='<h1>'+esc(fmt(date,true))+'</h1><p class="sub">'+esc(c.name)+(c.subj?" · "+esc(c.subj):"")+" · "+c.students.length+" élèves</p>";
  h+='<div class="count"><div class="cp"><b>'+n.p+'</b>présents</div><div class="ca"><b>'+n.a+'</b>absents</div><div class="cr"><b>'+n.r+'</b>retards</div><div class="cn"><b>'+n.x+'</b>à faire</div></div>';
  h+='<div class="bar"><button class="btn" id="allp">Tous présents</button><button class="btn ghost" id="rst">Effacer</button></div>';
  h+=pmBatchButton(c,date);
  if(c.students.length>5)h+='<div class="qb"><input type="search" id="q" placeholder="Rechercher un élève…" aria-label="Rechercher un élève" autocomplete="off" value="'+esc(qs)+'"><button class="btn ghost" id="qx"'+(qs?"":" hidden")+' aria-label="Effacer la recherche">✕</button></div><p class="sub" id="qm" role="status"></p>';
  c.students.forEach(function(s){
    var v=r[s.id]||"";
    h+='<div class="row '+v+'" data-nm="'+esc(nrm(s.name))+'"'+(hit(s.name)?"":" hidden")+'><div class="nm">'+esc(s.name)+badge(c,s.id)+'</div><div class="seg" data-s="'+s.id+'">'+
    ["p:Présent","a:Absent","r:Retard"].map(function(x){var q=x.split(":");return'<button class="'+q[0]+'" data-v="'+q[0]+'" aria-pressed="'+(v===q[0])+'">'+q[1]+"</button>"}).join("")+"</div>"+noteUI(c,s.id,v)+"</div>";
  });
  h+='<div class="card"><h2>Message pour la vie scolaire</h2><div class="sum" id="sum">'+esc(summary(c,date))+'</div><button class="btn ghost" id="cp">Copier le message</button></div>';
  return h;
}
