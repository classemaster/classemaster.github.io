/* Utilitaires : dates, formats, calculs de présence */
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function uid(){return Math.random().toString(36).slice(2,9);}
function load(){
  try{var s=localStorage.getItem(KEY);if(s){var o=JSON.parse(s);if(o&&o.classes&&o.classes.length)return o;}}catch(e){}
  var id=uid();return{cur:id,classes:[{id:id,name:"Ma classe",students:[],records:{}}]};
}
function local(){if(!KEY)return;try{localStorage.setItem(KEY,JSON.stringify(D));}catch(e){}}
function save(){local();if(col){dirty[D.cur]=1;clearTimeout(timer);timer=setTimeout(pushNow,600);}}
function cl(){return D.classes.find(function(c){return c.id===D.cur})||D.classes[0];}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]});}
function fmt(k,long){var p=k.split("-");var d=new Date(+p[0],+p[1]-1,+p[2]);return d.toLocaleDateString("fr-FR",long?{weekday:"long",day:"numeric",month:"long",year:"numeric"}:{day:"numeric",month:"short"});}
function nrm(x){return String(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function hit(nm){var q=nrm(qs);return!q||q.split(/\s+/).every(function(w){return nrm(nm).indexOf(w)>=0;});}
function rec(c,k){if(!c.records[k])c.records[k]={};return c.records[k];}

function dstr(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function range(){
  var n=new Date(),t=dstr(n),a=new Date(n);
  if(flt.mode==="w"){a.setDate(a.getDate()-6);return[dstr(a),t];}
  if(flt.mode==="m")return[t.slice(0,8)+"01",t];
  if(flt.mode==="t"){a.setDate(a.getDate()-90);return[dstr(a),t];}
  if(flt.mode==="c")return[flt.from||"0000",flt.to||"9999"];
  return["0000","9999"];
}
function inRange(k){var r=range();return k>=r[0]&&k<=r[1];}
function filterUI(){
  var o=[["all","Tout l’historique"],["w","7 derniers jours"],["m","Ce mois-ci"],["t","3 derniers mois"],["c","Période choisie"]];
  var h='<div class="flt"><select id="fm" aria-label="Période">'+o.map(function(x){return'<option value="'+x[0]+'"'+(flt.mode===x[0]?" selected":"")+">"+x[1]+"</option>"}).join("")+"</select>";
  if(flt.mode==="c")h+='<input type="date" id="ff" value="'+flt.from+'" aria-label="Du"><input type="date" id="ft" value="'+flt.to+'" aria-label="Au">';
  return h+"</div>";
}

function th(c){var t=c.th||{};return{a:t.a===undefined?3:t.a,r:t.r===undefined?3:t.r,d:t.d===undefined?3:t.d};}
function cnt(c,id,keys){var o={a:0,r:0};keys.forEach(function(k){var v=(c.records[k]||{})[id];if(v==="a")o.a++;if(v==="r")o.r++;});return o;}
function alertTxt(c,o){var t=th(c),p=[];if(t.a>0&&o.a>=t.a)p.push(o.a+(o.a>1?" absences":" absence"));if(t.r>0&&o.r>=t.r)p.push(o.r+(o.r>1?" retards":" retard"));return p.join(", ");}
function badge(c,id){var x=alertTxt(c,cnt(c,id,Object.keys(c.records).filter(inRange)));return x?'<span class="al">⚠ '+x+"</span>":"";}

function rate(o){return o.n?Math.round((o.n-o.a)/o.n*1000)/10:null;}
function fr(x){return x===null?"–":String(x).replace(".",",")+" %";}

function dback(i){var d=new Date();d.setDate(d.getDate()-i);return dstr(d);}
function dayRate(c,k){var r=c.records[k]||{},n=0,a=0;c.students.forEach(function(s){var v=r[s.id];if(v){n++;if(v==="a")a++;}});return n?{n:n,a:a,p:(n-a)/n}:null;}
