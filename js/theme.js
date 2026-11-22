/* Mode jour / mode nuit : Automatique (suit le téléphone), Jour ou Nuit. Choix gardé sur l'appareil. */
var THK="classemaster-theme";
function themeGet(){try{var v=localStorage.getItem(THK);return v==="light"||v==="dark"?v:"auto";}catch(e){return"auto";}}
function themeApply(){
  var v=themeGet(),r=document.documentElement;
  if(v==="auto")r.removeAttribute("data-theme");else r.setAttribute("data-theme",v);
  var dark=v==="dark"||(v==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
  var m=document.querySelector('meta[name="theme-color"]');
  if(m)m.setAttribute("content",dark?"#0C1424":"#1E3F8A");
  themeNavSync(dark);
}
/* Bouton de la barre de navigation : montre le mode vers lequel on bascule (soleil en mode nuit, lune en mode jour) */
var TH_SUN='<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2 7 7M17 17l1.8 1.8M18.8 5.2 17 7M7 17l-1.8 1.8"/>',TH_MOON='<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';
function themeIsDark(){var v=themeGet();return v==="dark"||(v==="auto"&&!!window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);}
function themeNavSync(dark){
  var b=document.getElementById("thm");if(!b)return;
  if(dark===undefined)dark=themeIsDark();
  b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(dark?TH_SUN:TH_MOON)+'</svg><span>'+(dark?"Jour":"Nuit")+'</span>';
  b.setAttribute("aria-label",dark?"Passer en mode jour":"Passer en mode nuit");
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
  var tg=e.target.closest&&e.target.closest("[data-theme-toggle]");
  if(tg){
    try{localStorage.setItem(THK,themeIsDark()?"light":"dark");}catch(er){}
    themeApply();
    if(typeof view!=="undefined"&&view==="compte"&&typeof render==="function"){var y0=window.scrollY;render();window.scrollTo(0,y0);}
    return;
  }
  var b=e.target.closest&&e.target.closest("[data-theme-set]");
  if(!b)return;
  try{if(b.dataset.themeSet==="auto")localStorage.removeItem(THK);else localStorage.setItem(THK,b.dataset.themeSet);}catch(er){}
  themeApply();
  var y=window.scrollY;if(typeof render==="function")render();window.scrollTo(0,y);
});
