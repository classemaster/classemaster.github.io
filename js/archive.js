/* Fin d'année : archive l'année scolaire (appels, notes, devoirs…) dans une classe à part, puis repart à zéro */
function archLabel(){var d=new Date(),y=d.getFullYear();return d.getMonth()>=7?y+"-"+(y+1):(y-1)+"-"+y;}
function archCard(c){
  if(isArch(c))return'<div class="card"><h2>Archive '+esc(c.th.ar)+'</h2><p class="sub" style="margin:0">Cette classe est l’archive d’une année passée : tous les appels, notes et bilans restent consultables. Elle n’apparaît pas dans les statistiques de l’année en cours.</p></div>';
  return'<div class="card"><h2>Fin d’année</h2><p class="sub" style="margin-top:0">Rangez l’année écoulée dans une archive (classe « '+esc(c.name)+' · archive … ») puis repartez avec une classe vide. Rien n’est perdu : l’archive garde les élèves, appels, notes, devoirs, cahier de textes et carnet.</p><button class="btn" id="arch">Archiver l’année scolaire</button></div>';
}
function archiveYear(){
  var c=cl();
  if(isArch(c))return;
  if(!c.students.length&&!Object.keys(c.records).length&&!evs(c).length){alert("Cette classe est vide : il n’y a rien à archiver.");return;}
  var lab=prompt("Nom de l’année scolaire à archiver",archLabel());
  if(!lab||!lab.trim())return;
  lab=lab.trim();
  if(!confirm("Archiver l’année "+lab+" de « "+c.name+" » ?\n\nUne copie complète est rangée dans la classe « "+c.name+" · archive "+lab+" », puis les appels, notes, devoirs, cahier de textes et carnet de « "+c.name+" » sont remis à zéro."))return;
  var keep=confirm("Garder les mêmes élèves dans « "+c.name+" » pour la nouvelle année ?\n\nOK = garder la liste des élèves\nAnnuler = repartir avec une liste vide");
  /* Sauvegarde de sécurité avant de toucher aux données */
  try{saveFile("avant-archivage-"+c.name.replace(/[^\w-]+/g,"_")+".json",JSON.stringify({app:"appel-matin",version:1,classes:[c]}),"application/json");}catch(e){}
  var a=JSON.parse(JSON.stringify(c));
  a.id=uid();a.name=c.name+" · archive "+lab;a.th=Object.assign({},a.th||{a:3,r:3},{ar:lab});delete a.tt;
  c.records={};c.notes={};c.ev=[];c.ob=[];c.cr=[];c.ct=[];c.pg=[];c.bc={};c.pa={};
  if(!keep)c.students=[];
  D.classes.push(a);
  dirty[a.id]=Date.now();dirty[c.id]=Date.now();
  save();view="home";render();window.scrollTo(0,0);
}
document.getElementById("view").addEventListener("click",function(e){if(e.target.id==="arch")archiveYear();});
