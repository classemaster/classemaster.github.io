/* Synchronisation */

function setSync(t){document.getElementById("sync").textContent=(who?"Connecté : "+who+" · ":"")+t;}
function pushNow(){
  if(!col)return;
  Object.keys(dirty).forEach(function(id){
    delete dirty[id];
    var c=D.classes.find(function(x){return x.id===id}),ref=col.doc(id);
    var p=c?ref.set({name:c.name,students:c.students,records:c.records,notes:c.notes||{},ev:c.ev||[],ob:c.ob||[],th:c.th||{a:3,r:3},subj:c.subj||"",updatedAt:Date.now()}):ref.delete();
    p.then(function(){setSync("Synchronisé entre vos appareils");},function(){dirty[id]=1;setSync("Synchronisation impossible : vos données restent sur cet appareil");});
  });
}
function startSync(){
  var first=true,mine=col;
  unsub=col.onSnapshot(function(snap){
    if(col!==mine)return;
    var ids={},ch=false;
    snap.docs.forEach(function(d){ids[d.id]=1;});
    if(first){
      first=false;
      D.classes.forEach(function(c){if(!ids[c.id]&&(c.students.length||Object.keys(c.records).length))dirty[c.id]=1;});
      if(Object.keys(dirty).length)pushNow();
      if(snap.empty){setSync("Synchronisé entre vos appareils");return;}
      D.classes=D.classes.filter(function(c){return ids[c.id]||c.students.length||Object.keys(c.records).length;});
      ch=true;
    }
    snap.docChanges().forEach(function(x){
      var id=x.doc.id;if(dirty[id])return;
      var i=D.classes.findIndex(function(c){return c.id===id});
      if(x.type==="removed"){if(i>=0){D.classes.splice(i,1);ch=true;}return;}
      var v=x.doc.data(),n={id:id,name:v.name||"Classe",students:v.students||[],records:v.records||{},notes:v.notes||{},ev:v.ev||[],ob:v.ob||[],th:v.th||{a:3,r:3},subj:v.subj||""};
      if(i<0){D.classes.push(n);ch=true;}
      else{var o=D.classes[i];if(JSON.stringify([o.name,o.students,o.records,o.notes||{},o.ev||[],o.ob||[],th(o),o.subj||""])!==JSON.stringify([n.name,n.students,n.records,n.notes,n.ev,n.ob,th(n),n.subj])){D.classes[i]=n;ch=true;}}
    });
    if(!D.classes.length)D.classes.push({id:uid(),name:"Ma classe",students:[],records:{},notes:{}});
    if(!D.classes.some(function(c){return c.id===D.cur}))D.cur=D.classes[0].id;
    if(ch){local();var a=document.activeElement;if(!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))render();}
    setSync("Synchronisé entre vos appareils");
  },function(){setSync("Synchronisation impossible : vos données restent sur cet appareil");});
}
document.getElementById("view").addEventListener("keydown",function(e){
  if(e.key!=="Enter"||e.target.tagName!=="INPUT")return;
  var m={li:"lgin",lw:"lgin",sfn:"sgo",sln:"sgo",sid:"sgo",spw:"sgo",cp0:"cpw",cp1:"cpw",cp2:"cpw"},b=m[e.target.id];
  if(b){e.preventDefault();var x=document.getElementById(b);if(x)x.click();}
});
var sgen=0,unsub=null;
function stopSync(){sgen++;if(typeof unsub==="function"){try{unsub();}catch(e){}}unsub=null;col=null;dirty={};clearTimeout(timer);who="";}
function initSync(){
  stopSync();var g=sgen;
  setSync("Enregistrement sur cet appareil uniquement");
  if(window.claude&&claude.use){
    Promise.all([claude.use("db"),claude.use("user")]).then(function(r){
      if(g!==sgen||!r[0]||!r[1])return null;
      return r[1].me().then(function(m){who=m.name||"";return r[1].id();}).then(function(id){if(g!==sgen||!id)return;col=r[0].collection("data/users/"+id);setSync("Connexion en cours…");startSync();});
    }).catch(function(){});
  }
}
