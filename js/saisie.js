/* Saisie rapide des notes : Entrée (ou ↓) passe à l'élève suivant, ↑ au précédent, le contenu se sélectionne au focus.
   Les notes sont enregistrées à chaque frappe (events.js) ; une note hors barème est signalée, puis annulée à la sortie du champ. */
(function(){
  var v=document.getElementById("view"),nav=false;
  function list(){return Array.prototype.slice.call(v.querySelectorAll("input[data-ns]"));}
  function revert(t){
    if(t.getAttribute("aria-invalid")!=="true")return;
    var c=cl(),e=evs(c).find(function(x){return x.id===evid;}),o=t.dataset.orig===""||t.dataset.orig===undefined?undefined:Number(t.dataset.orig);
    if(e){if(typeof o==="number")e.s[t.dataset.ns]=o;else delete e.s[t.dataset.ns];save();
      var st=document.getElementById("evs");if(st)st.textContent=evLine(e,c);var sx=document.getElementById("evst");if(sx)sx.innerHTML=evStatsHTML(e,c);}
    t.value=typeof o==="number"?nf(o):"";
    t.removeAttribute("aria-invalid");t.classList.remove("ns-bad");
  }
  v.addEventListener("focusin",function(e){
    if(!(e.target.dataset&&e.target.dataset.ns))return;
    var t=e.target,c0=cl(),e0=evs(c0).find(function(x){return x.id===evid;}),o0=e0&&e0.s[t.dataset.ns];
    if(t.getAttribute("aria-invalid")!=="true")t.dataset.orig=typeof o0==="number"?String(o0):"";   /* valeur avant modification */
    if(nav){nav=false;return;}
    setTimeout(function(){try{t.select();}catch(er){}},0);
  });
  v.addEventListener("focusout",function(e){if(e.target.dataset&&e.target.dataset.ns)revert(e.target);});
  v.addEventListener("keydown",function(e){
    var t=e.target;if(!t.dataset||!t.dataset.ns)return;
    var k=e.key;if(k!=="Enter"&&k!=="ArrowDown"&&k!=="ArrowUp")return;
    e.preventDefault();
    var a=list(),i=a.indexOf(t),j=k==="ArrowUp"?i-1:i+1;
    revert(t);
    if(a[j]){nav=true;a[j].focus();try{a[j].select();}catch(er){}nav=false;}
    else if(k==="Enter")t.blur();
  });
})();
