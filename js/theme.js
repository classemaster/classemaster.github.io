/* Mode jour / mode nuit : Automatique (suit le téléphone), Jour ou Nuit. Choix gardé sur l'appareil. */
var THK="classemaster-theme";
function themeGet(){try{var v=localStorage.getItem(THK);return v==="light"||v==="dark"?v:"auto";}catch(e){return"auto";}}
function themeApply(){
  var v=themeGet(),r=document.documentElement;
  if(v==="auto")r.removeAttribute("data-theme");else r.setAttribute("data-theme",v);
  var dark=v==="dark"||(v==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
  var m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute("content",dark?"#0C1424":"#1E3F8A");
}
function themeCard(){
  var v=themeGet();
  return'<div class="card"><h2>Apparence</h2><p class="sub" style="margin-top:0">Mode jour, mode nuit, ou automatique selon le réglage de votre téléphone.</p><div class="seg3" role="group" aria-label="Apparence">'+
    [["auto","Automatique"],["light","☀ Jour"],["dark","☾ Nuit"]].map(function(x){return'<button type="button" data-theme-set="'+x[0]+'" aria-pressed="'+(v===x[0])+'">'+x[1]+'</button>';}).join("")+'</div></div>';
}
themeApply();
document.addEventListener("DOMContentLoaded",themeApply);
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",themeApply);}catch(e){}
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("[data-theme-set]");
  if(!b)return;
  try{if(b.dataset.themeSet==="auto")localStorage.removeItem(THK);else localStorage.setItem(THK,b.dataset.themeSet);}catch(er){}
  themeApply();
  var y=window.scrollY;if(typeof render==="function")render();window.scrollTo(0,y);
});
