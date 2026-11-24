/* Détails de présentation (v62) : initiales des élèves, aide repliable « ? », boutons de date rapide « Aujourd'hui / Hier ». */
function ini(name){
  var w=String(name||"").trim().split(/\s+/).filter(Boolean);
  if(!w.length)return"?";
  return(w[0].charAt(0)+(w.length>1?w[w.length-1].charAt(0):"")).toUpperCase();
}
/* Texte d'aide replié derrière un « ? » (au lieu d'un long paragraphe) */
function helpTip(title,html){return'<details class="hp"><summary>'+esc(title)+'</summary><p>'+html+'</p></details>';}
function dchipsUpdate(){
  var box=document.getElementById("dchips");if(!box)return;
  var on=view==="appel";box.hidden=!on;
  if(!on)return;
  var t=today(),y=dback(1);
  Array.prototype.forEach.call(box.querySelectorAll("[data-dchip]"),function(b){
    b.setAttribute("aria-pressed",String(date===(b.getAttribute("data-dchip")==="0"?t:y)));
  });
}
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("[data-dchip]");
  if(!b)return;
  var d=b.getAttribute("data-dchip")==="0"?today():dback(1);
  if(d&&d!==date){date=d;render();}
});
