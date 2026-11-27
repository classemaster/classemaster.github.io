/* Tests automatiques des calculs et de la fusion — à lancer avant chaque publication :  node outils/tests.js
   Charge les vrais scripts de l'application (sans navigateur) et vérifie les résultats attendus. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");

function stub() { const f = function () { return stub(); }; return new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : k === "length" ? 0 : k === "then" ? undefined : stub()), set: () => true, apply: () => stub(), construct: () => stub() }); }
const store = {};
const ctx = {
  console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, Date, Math, JSON, Promise, Uint8Array, Intl, String, Number, Array, Object, RegExp, Error, isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  Blob: class { constructor(p, o) { this.p = p; this.type = o && o.type; } }, File: class {}, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  navigator: { userAgent: "test" }, location: { hash: "", search: "", protocol: "https:", href: "https://x/" }, history: {}, indexedDB: undefined,
  document: new Proxy({ getElementById: () => stub(), addEventListener() {}, querySelector: () => stub(), querySelectorAll: () => [], createElement: () => stub(), body: stub(), documentElement: stub() }, { get: (t, k) => (k in t ? t[k] : stub()) }),
  matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, requestAnimationFrame() {},
};
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/vendor|graphiques\//.test(s));
files.forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx, { filename: f }));
const run = code => vm.runInContext(code, ctx);

let ok = 0, ko = 0;
const pending = [];   /* tests qui rendent une promesse (pages jouées dans un faux navigateur) : on attend leur fin avant le bilan */
function t(name, fn) {
  const fin = (r) => { if (r === true) { ok++; } else { ko++; console.log("ÉCHEC :", name, "→", JSON.stringify(r)); } };
  try { const r = fn(); if (r && typeof r.then === "function") pending.push(r.then(fin, (e) => { ko++; console.log("ERREUR :", name, "→", e.message); })); else fin(r); } catch (e) { ko++; console.log("ERREUR :", name, "→", e.message); }
}
const J = x => JSON.stringify(x);
ctx.__j = J;

/* ---- Trimestres et année scolaire ---- */
t("T3 au 31 août", () => run('autoTr("2026-08-31")') === 3);
t("T1 au 1er septembre", () => run('autoTr("2026-09-01")') === 1);
t("T1 au 31 décembre", () => run('autoTr("2026-12-31")') === 1);
t("T2 au 1er janvier", () => run('autoTr("2027-01-01")') === 2);
t("T2 au 31 mars", () => run('autoTr("2027-03-31")') === 2);
t("T3 au 1er avril", () => run('autoTr("2027-04-01")') === 3);
t("année scolaire d'octobre 2026", () => run('syLabel("2026-10-05")') === "2026-2027");
t("année scolaire de février 2027", () => run('syLabel("2027-02-05")') === "2026-2027");
t("trimestre choisi par l'enseignant prioritaire", () => run('trOf({tr:3,d:"2026-10-05"})') === 3);

/* ---- Moyennes ---- */
const cls = `({id:"c",name:"6e A",subj:"Maths",students:[{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C"},{id:"d",name:"D"}],records:{},
  ev:[{id:"e1",d:"2026-10-05",n:"DS1",m:20,s:{a:10,b:10,c:20}},
      {id:"e2",d:"2026-10-20",n:"DS2",m:10,k:2,s:{a:10,b:5,c:"abs"}},
      {id:"e3",d:"2027-01-10",n:"DS3",m:20,s:{a:20}}]})`;
t("moyenne pondérée T1 (coef 1 et 2)", () => Math.abs(run(`sAvg(${cls},"a",1)`) - (10 * 1 + 20 * 2) / 3) < 1e-9);
t("note ramenée sur 20", () => Math.abs(run(`sAvg(${cls},"b",1)`) - (10 * 1 + 10 * 2) / 3) < 1e-9);
t("absence (texte) ignorée", () => run(`sAvg(${cls},"c",1)`) === 20);
t("élève sans note → null", () => run(`sAvg(${cls},"d",1)`) === null);
t("moyenne annuelle = moyenne des trimestres notés", () => Math.abs(run(`sAvg(${cls},"a","A")`) - ((50 / 3 + 20) / 2)) < 1e-9);
t("barème 0 ignoré (pas de division par zéro)", () => run('sAvg({students:[],ev:[{d:"2026-10-01",m:0,s:{a:5}}]},"a","")') === null);
t("rang : ex æquo même rang", () => { const m = run(`rankMap(({id:"x",students:[{id:"a"},{id:"b"},{id:"c"},{id:"d"}],ev:[{d:"2026-10-01",m:20,s:{a:15,b:15,c:10}}]}),1)`); return m.a.r === 1 && m.b.r === 1 && m.c.r === 3 && m.d.r === null && m.a.n === 3; });

/* ---- Présences ---- */
t("taux de présence", () => run("rate({n:20,a:5})") === 75);
t("taux de présence sans appel → null", () => run("rate({n:0,a:0})") === null);
t("comptage absences/retards", () => { const o = run('cnt({records:{"2026-10-01":{a:"a"},"2026-10-02":{a:"r"},"2026-10-03":{a:"a"}}},"a",["2026-10-01","2026-10-02","2026-10-03","2026-10-04"])'); return o.a === 2 && o.r === 1; });
t("alerte au seuil par défaut (3)", () => run('alertTxt({},{a:3,r:0})') === "3 absences" && run('alertTxt({},{a:2,r:2})') === "");
t("seuil 0 = alerte désactivée", () => run('alertTxt({th:{a:0,r:0}},{a:9,r:9})') === "");

/* ---- Fusion entre appareils (aucune perte de données) ---- */
t("seul l'autre appareil a modifié", () => run('m3({x:1},{x:1},{x:2}).x') === 2);
t("seul cet appareil a modifié", () => run('m3({x:1},{x:5},{x:1}).x') === 5);
t("champs différents des deux côtés : tout est gardé", () => { const r = run('m3({a:1,b:1},{a:2,b:1},{a:1,b:3})'); return r.a === 2 && r.b === 3; });
t("même champ des deux côtés : cet appareil gagne + compteur", () => { const n0 = run("MG.n"); const r = run("m3({a:1},{a:2},{a:3})"); return r.a === 2 && run("MG.n") === n0 + 1; });
t("ajouts des deux côtés dans une liste à identifiants", () => { const r = run('m3([{id:"a"}],[{id:"a"},{id:"l"}],[{id:"a"},{id:"r"}])'); return r.length === 3; });
t("supprimé d'un côté, modifié de l'autre : conservé", () => { const r = run('m3([{id:"a",v:1}],[],[{id:"a",v:2}])'); return r.length === 1 && r[0].v === 2; });
t("supprimé d'un côté, inchangé de l'autre : supprimé", () => run('m3([{id:"a",v:1}],[],[{id:"a",v:1}])').length === 0);
t("dEq profond", () => run('dEq({a:[1,{b:2}]},{a:[1,{b:2}]})') === true && run('dEq({a:[1]},{a:[2]})') === false);

/* ---- Échappement HTML ---- */
t("esc neutralise < > & \" '", () => run(`esc("<img src='x' onerror=\\"y\\">&")`) === "&lt;img src=&#39;x&#39; onerror=&quot;y&quot;&gt;&amp;");

/* ---- PDF : fichiers valides ---- */
const cPdf = `({id:"c",name:"6e A",subj:"Maths",students:[{id:"a",name:"Élève Œuvre"},{id:"b",name:"Sans note"}],records:{},th:{a:3,r:3},
  ev:[{id:"e1",d:"2026-10-05",n:"DS1",m:20,s:{a:15}}]})`;
["1", "2", "3", '"A"', '""'].forEach(p => t("relevé PDF valide (période " + p + ")", () => { const b = run(`relevePDF(${cPdf},${p})`); const s = Buffer.from(b).toString("latin1"); return s.startsWith("%PDF-") && s.trimEnd().endsWith("%%EOF"); }));
t("bulletins PDF valides", () => { const s = Buffer.from(run(`bulletinsPDF(${cPdf},1)`)).toString("latin1"); return s.startsWith("%PDF-") && s.trimEnd().endsWith("%%EOF"); });

/* ---- Copie de secours à la fermeture (idb.js) ---- */
t("copie de secours puis restauration", () => {
  run('IDB.ok=true;IDB.c={};IDB.q={"k1":"v1","k2":function(){return "v2";},"k3":null};');
  run("idbEmergency()");
  const saved = JSON.parse(store["cm-idb-pending"]);
  if (saved.k1 !== "v1" || saved.k2 !== "v2" || saved.k3 !== null) return J(saved);
  run('IDB.c={};IDB.q={};');
  const restored = run("idbRestorePending()");
  return restored === true && run("IDB.c.k1") === "v1" && run("IDB.c.k2") === "v2" && run("IDB.q.k3") === null;
});
t("copie de secours illisible ignorée", () => { store["cm-idb-pending"] = "{pas du json"; run("IDB.c={};IDB.q={};"); return run("idbRestorePending()") === false; });

/* Messages d'erreur : jamais de texte anglais brut à l'écran */
t("erreur réseau traduite", () => run('frErr({message:"Failed to fetch"})') === "pas de connexion internet");
t("erreur de droits traduite", () => run('frErr({code:"42501",message:"new row violates row-level security policy"})') === "action non autorisée pour votre compte");
t("session expirée traduite", () => run('frErr({status:401,message:"JWT expired"})') === "votre session a expiré, reconnectez-vous");
t("fonction absente traduite", () => /absent côté serveur/.test(run('frErr({code:"PGRST202",message:"Could not find the function"})')));
t("erreur inconnue : message neutre en français", () => run('frErr({message:"Some weird English thing"})') === "erreur inattendue");
t("frErr ne plante pas sans argument", () => run("frErr()") === "erreur inattendue");

/* Aide intégrée */
t("aide : toutes les rubriques sont affichées", () => { const h = run("renderAide()"); return /Premiers pas/.test(h) && /Ça ne marche pas/.test(h) && (h.match(/<details/g) || []).length === run("AIDE.length"); });
t("aide : aucune rubrique vide", () => run("AIDE.every(function(r){return r[0]&&r[1].length>0;})") === true);
t("carte Aide du compte ouvre l'écran aide", () => /data-go="aide"/.test(run("aideCard()")));

/* Visite guidée */
t("visite : 6 étapes complètes", () => run("TOUR.length") === 6 && run("TOUR.every(function(s){return s.t&&s.x;})") === true);
t("visite : vue une fois, mémorisée par compte", () => { run('ME={id:"u1"};'); const a = run("tourSeen()"); run("tourMark()"); const b = run("tourSeen()"); run('ME={id:"u2"};'); return a === false && b === true && run("tourSeen()") === false; });
t("visite : pas de lancement automatique sans compte", () => { run("ME=null;tourI=-1;"); run("tourAuto()"); return run("tourI") === -1; });

/* ---- Établissements (v60) : code d'accès, rattachement des classes, script SQL ---- */
t("code établissement : espaces, tirets et minuscules ignorés", () => run('etabNorm(" k7m2-qx4p ")') === "K7M2QX4P");
t("code établissement : affichage XXXX-XXXX", () => run('etabFmt("k7m2qx4p")') === "K7M2-QX4P");
t("code établissement : valide", () => run('etabCodeOk("K7M2-QX4P")') === true);
t("code établissement : refuse 0, 1, I, O et les longueurs fausses", () => run('etabCodeOk("K7M2QX40")') === false && run('etabCodeOk("K7M2QXIP")') === false && run('etabCodeOk("K7M2QX4")') === false && run('etabCodeOk("")') === false);
t("code établissement : messages d'erreur clairs", () => /8 caractères/.test(run('etabCodeMsg("AB")')) && /0, 1, I ni O/.test(run('etabCodeMsg("K7M2QX40")')) && /inconnu/i.test(run('etabMsg("unknown_code")')));
t("établissement : la classe garde son établissement à l'envoi et au retour", () => run('fromRow(toRow({id:"a",name:"6e B",students:[],records:{},et:"e1"},"u",0)).et') === "e1");
t("établissement : un compte sans établissement est dirigé vers l'écran de rattachement", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.list=[];ETAB.loaded=true;view="home";etabGate();');
  const a = run("view"); run('ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",code:null}];ETAB.cur="e1";etabGate();');
  const b = run("view"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;"); return a === "etab" && b === "home";
});
t("établissement : l'administrateur voit le code, l'enseignant non", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:"K7M2QX4P",membres:2,ouvert:true}];ETAB.cur="e1";');
  const adm = run("etabCard()"); run('ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",code:null,membres:2}];');
  const ens = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /K7M2-QX4P/.test(adm) && !/K7M2/.test(ens) && /Quitter/.test(ens);
});
t("v63 : l'inscription ne propose plus enseignant / chef d'établissement", () => {
  run('sb={};ACC={users:[]};');
  const h = run("renderSignup()"); run("sb=null;ACC=null;");
  return !/Chef d’établissement|emode|Code de l’établissement/.test(h) && /id="sgo"/.test(h);
});
t("v63 : après la création du compte, l'écran de choix propose les deux types", () => {
  const h = run("renderEtab()"); return /Enseignant/.test(h) && /Chef d’établissement/.test(h) && /validé par un administrateur/.test(h);
});
t("v63 : établissement en attente : pas de code, bouton de vérification", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:null,statut:"en_attente"}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /En attente de validation/.test(h) && /etchk/.test(h) && !/ecode/.test(h);
});
t("v63 : établissement validé : le code s'affiche", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:"K7M2QX4P",statut:"valide",membres:1}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /K7M2-QX4P/.test(h);
});
const chefSrc = () => fs.readdirSync(path.join(root, "js")).filter((f) => /^etab-.*\.js$/.test(f) && f !== "etab-redirect.js").map((f) => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
t("v69 : page de l'administrateur du site (admin.html) distincte de celle du chef (pages etab-*), sans aucun lien dans l'application", () => {
  const adm = fs.readFileSync(path.join(root, "admin.html"), "utf8"), chef = chefSrc();
  const src = ["etab.js", "auth.js", "nav.js", "events.js"].map(f => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
  return /est_admin_plateforme/.test(adm) && /sa_etablissements/.test(adm) && /sa_changer_statut/.test(adm) && !/signUp/.test(adm) && !/signUp/.test(chef) && !/Créer le compte administrateur/.test(chef) &&
    !/admin_dashboard|registry_students/.test(adm) &&
    /is_admin/.test(chef) && /admin_dashboard/.test(chef) && !/est_admin_plateforme/.test(chef) &&
    /location\.href="etab-accueil\.html"/.test(src) && !/etablissement\.html/.test(src) && !/admin\.html/.test(src) && !/plateforme/.test(src);
});
const sqlV63 = fs.readFileSync(path.join(root, "supabase", "validation-etablissements-v63.sql"), "utf8");
t("SQL v63 : statut, administrateurs de plateforme, blocage serveur tant que non validé", () =>
  ["plateforme_admins", "est_admin_plateforme", "sa_etablissements", "sa_decider_etablissement", "etab_annuler_demande"].every(n => sqlV63.includes(n)) &&
  /is_etab_admin[\s\S]*x\.statut = 'valide'/.test(sqlV63) && /'err', 'pending'/.test(sqlV63));
t("SQL v63 : l'administrateur du site ne reçoit ni classes, ni élèves, ni salles", () => {
  const f = sqlV63.slice(sqlV63.indexOf("function public.sa_etablissements"), sqlV63.indexOf("function public.sa_decider_etablissement"));
  return f.length > 100 && !/registry_|classes|eleves|salles/i.test(f);
});
const sqlV60 = fs.readFileSync(path.join(root, "supabase", "etablissements-v60.sql"), "utf8");
t("SQL v60 : toutes les fonctions et tables prévues", () => ["etablissements", "etab_membres", "etab_essais", "creer_etablissement", "rejoindre_etablissement", "mes_etablissements", "etab_membres_liste", "etab_retirer", "etab_definir_role", "etab_nouveau_code", "etab_ouvrir", "etab_renommer", "etab_quitter", "is_etab_admin", "can_admin_student", "gen_etab_code", "admin_assign", "admin_unassign", "admin_assignments"].every(n => sqlV60.includes(n)));
t("SQL v60 : plus aucun filtre « mon compte seul » sur les dossiers", () => !/g\.user_id = \(select auth\.uid\(\)\)/.test(sqlV60));
t("SQL v60 : les tableaux de bord filtrent par établissement", () => ["admin_dashboard", "admin_teaching", "admin_discipline"].every(n => new RegExp("function public\\." + n + "\\(p_etab uuid default null\\)").test(sqlV60)) && (sqlV60.match(/is_etab_admin\(g\.etab_id\)/g) || []).length >= 5);
t("SQL v60 : parenthèses et blocs $$ équilibrés", () => (sqlV60.match(/\(/g) || []).length === (sqlV60.match(/\)/g) || []).length && (sqlV60.match(/\$\$/g) || []).length % 2 === 0);
t("SQL v60 : chaque fonction d'établissement a ses droits (grant) et aucune n'est ouverte au public", () => ["creer_etablissement(text, text)", "rejoindre_etablissement(text)", "mes_etablissements()", "etab_quitter(uuid)"].every(n => sqlV60.includes("grant execute on function") && sqlV60.includes("public." + n)));

/* ---- Rentrée (v61) : niveaux, assistant de nouvelle année, script SQL ---- */
const nx = (n, o) => JSON.stringify(run("nivNext(" + JSON.stringify(n) + "," + (o || "null") + ")"));
t("niveaux : 6e B → 5e B, 6ème A → 5ème A, 6eme → 5eme, 6B → 5B", () => run('nivNext("6e B").next') === "5e B" && run('nivNext("6ème A").next') === "5ème A" && run('nivNext("6eme 2").next') === "5eme 2" && run('nivNext("6B").next') === "5B");
t("niveaux : 3e → 2nde, 2nde C → 1ère C, 1ère S → Tle S, CM2 → 6e", () => run('nivNext("3e 2").next') === "2nde 2" && run('nivNext("2nde C").next') === "1ère C" && run('nivNext("1ère S").next') === "Tle S" && run('nivNext("CM2").next') === "6e");
t("niveaux : dernière classe (Tle, ou 3e si demandé) sans suivante", () => run('nivNext("Tle D").last') === true && run('nivNext("3e B").last') === false && run('nivNext("3e B",{last3:true}).last') === true && run('nivNext("Terminale S").last') === true);
t("niveaux : un nom non reconnu n'est pas deviné", () => run('nivNext("Club théâtre").known') === false && run('nivNext("30 élèves").known') === false && run('nivNext("").known') === false);
t("niveaux : le lycée est reconnu, l'année suivante calculée", () => run('nivIsLycee("2nde C")') === true && run('nivIsLycee("5e A")') === false && run('nivNextYear("2025-2026")') === "2026-2027");
t("rentrée : carte d'accueil seulement si des données d'une année terminée restent", () => {
  run('ME={id:"u1"};GUEST=false;D={cur:"a",classes:[{id:"a",name:"6e B",students:[],records:{"2020-10-05":{}},ev:[]}]};');
  const a = run("rentreeCard()").includes("Préparer la rentrée");
  run('D.classes[0].records={};D.classes[0].ev=[];'); const b = run("rentreeCard()") === "";
  run('D.classes[0].records={};D.classes[0].ev=[{d:"2020-11-02"}];rtMark(rtNowLabel());'); const c = run("rentreeCard()") === "";
  run("try{localStorage.removeItem(rtKey())}catch(e){};ME=null;"); return a && b && c;
});
t("rentrée : passage des classes (reconduite, même classe, terminée) avec archive de l'année", () => {
  run('ME={id:"u9"};GUEST=false;uid=function(){return "N"+Math.random().toString(36).slice(2,7)};' +
    'D={cur:"a",classes:[{id:"a",name:"6e B",students:[{id:"s1",name:"A"},{id:"s2",name:"B"}],records:{"2020-10-05":{s1:"p"}},ev:[{d:"2020-11-02"}]},{id:"b",name:"Tle D",students:[{id:"s3",name:"C"}],records:{"2020-10-05":{}},ev:[]},{id:"c",name:"Club",students:[{id:"s4",name:"D"}],records:{"2020-10-05":{}},ev:[]}]};' +
    'view="rentree";RT=null;rtInit();RT.items[0].out={s2:true};' +
    'confirm=function(){return true};saveFile=function(){};toast=function(){};save=function(){};render=function(){};window.scrollTo=function(){};rtRun();');
  const names = run("D.classes.map(function(c){return c.name})");
  const live = run("liveCls().map(function(c){return c.name})");
  const stud = run("liveCls().filter(function(c){return c.name==='5e B'})[0].students.map(function(s){return s.id}).join()");
  const reset = run("liveCls().filter(function(c){return c.name==='5e B'})[0].ev.length") === 0;
  const club = run("liveCls().filter(function(c){return c.name==='Club'})[0].students.length") === 0;
  run("try{localStorage.removeItem(rtKey())}catch(e){};ME=null;D=null;");
  return names.some(n => /^6e B · archive 2020-2021$/.test(n)) && names.some(n => /^Tle D · archive 2020-2021$/.test(n)) && live.length === 2 && live.includes("5e B") && live.includes("Club") && stud === "s1" && reset && club;
});
const sqlV61 = fs.readFileSync(path.join(root, "supabase", "rentree-v61.sql"), "utf8");
t("SQL v61 : fonctions de rentrée, protection des dossiers et du dernier administrateur", () => ["appliquer_rentree", "annuler_rentree", "rentrees_liste", "etab_rentrees", "on delete set null", "last admin", "etab_rentrees_actif_idx"].every(n => sqlV61.includes(n)));
t("SQL v61 : parenthèses et blocs $$ équilibrés", () => (sqlV61.match(/\(/g) || []).length === (sqlV61.match(/\)/g) || []).length && (sqlV61.match(/\$\$/g) || []).length % 2 === 0);

/* ---- v70 : décisions réversibles, page du chef ---- */
const sqlV70 = fs.readFileSync(path.join(root, "supabase", "validation-reversible-v70.sql"), "utf8");
t("SQL v70 : statut « suspendu », changement de statut réservé à l'administrateur du site, décision affichée", () =>
  /'suspendu'/.test(sqlV70) && /sa_changer_statut/.test(sqlV70) && /est_admin_plateforme/.test(sqlV70) && /decide_par_email/.test(sqlV70) &&
  /not \(s = 'suspendu' and x\.statut <> 'valide'\)/.test(sqlV70));
t("SQL v70 : la liste du site ne reçoit ni classes, ni élèves, ni salles", () => {
  const f = sqlV70.slice(sqlV70.indexOf("function public.sa_etablissements"), sqlV70.indexOf("function public.mes_etablissements"));
  return f.length > 100 && !/registry_|classes|eleves|salles/i.test(f);
});
t("SQL v70 : parenthèses et blocs $$ équilibrés", () => (sqlV70.match(/\(/g) || []).length === (sqlV70.match(/\)/g) || []).length && (sqlV70.match(/\$\$/g) || []).length % 2 === 0);
t("v70 : un établissement suspendu : message clair, aucun code affiché", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:null,statut:"suspendu",motif:"Doublon"}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /Suspendu/.test(h) && /Doublon/.test(h) && !/ecode/.test(h) && /etchk/.test(h);
});
t("v70 : la gestion des enseignants est sur la page du chef, plus dans l'onglet Compte", () => {
  const chef = chefSrc(), e = fs.readFileSync(path.join(root, "js", "etab.js"), "utf8");
  return /etab_retirer/.test(chef) && /etab_definir_role/.test(chef) && /etab_renommer/.test(chef) && !/etab_retirer|etab_definir_role|etab_renommer/.test(e);
});

/* ---- v71 : validation des enseignants, transferts, seuils, messages, journal ---- */
const sqlV71 = fs.readFileSync(path.join(root, "supabase", "gestion-v71.sql"), "utf8");
t("SQL v71 : toutes les fonctions prévues", () => ["etab_valider_enseignants", "etab_decider_membre", "etab_deplacer_eleves", "etab_seuils", "etab_message_envoyer", "etab_messages_liste", "etab_message_supprimer", "mes_messages_etab", "get_messages_famille", "etab_journal", "journaliser", "seuil_moy", "valider_enseignants", "en_attente"].every(n => sqlV71.includes(n)));
t("SQL v71 : un enseignant en attente n'a aucun accès (membre, accès aux dossiers, affectation)", () =>
  /is_etab_member[\s\S]*m\.statut = 'actif'/.test(sqlV71) && /can_use_ref[\s\S]*m\.statut = 'actif'/.test(sqlV71) && /admin_assign[\s\S]*m\.statut = 'actif'/.test(sqlV71));
t("SQL v71 : le journal n'est pas appelable depuis l'application, les fonctions du chef vérifient is_etab_admin", () => {
  const rev = sqlV71.slice(sqlV71.indexOf("-- 11. Droits"));
  return !/grant execute on function[\s\S]*journaliser/.test(rev) && (sqlV71.match(/is_etab_admin\(p_etab\)/g) || []).length >= 14;
});
t("SQL v71 : parenthèses et blocs $$ équilibrés", () => (sqlV71.match(/\(/g) || []).length === (sqlV71.match(/\)/g) || []).length && (sqlV71.match(/\$\$/g) || []).length % 2 === 0);
t("v71 : un enseignant en attente voit un message clair, pas un accès", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",code:null,statut:"valide",membre_statut:"en_attente",membres:2}];ETAB.cur="e1";');
  const h = run("etabCard()"); run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return /En attente d’acceptation/.test(h) && /etchk/.test(h);
});
t("v71 : messages du chef : « lu » gardé sur l'appareil", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};ETAB.msgs=[{id:"m1",titre:"A",corps:"b"},{id:"m2",titre:"C",corps:"d"}];');
  const a = run("etabMsgsNew().length"); run('etabReadAdd("m1")'); const b = run("etabMsgsNew().map(function(m){return m.id}).join()");
  run('try{localStorage.removeItem(etabReadKey())}catch(e){};ETAB.msgs=[];ME=null;'); return a === 2 && b === "m2";
});
t("v71 : seuils d'alerte réglables sur la page du chef, plus de valeur fixe", () => {
  const chef = chefSrc();
  return /etab_seuils/.test(chef) && /etab_deplacer_eleves/.test(chef) && /etab_journal/.test(chef) && /etab_message_envoyer/.test(chef) && /etab_decider_membre/.test(chef) &&
    !/m>=10|m<10|ra>=3|p<80/.test(chef) && /eq\("event","depart"\)/.test(chef);
});
t("v71 : l'espace parents lit les messages avec le code famille", () => /get_messages_famille/.test(fs.readFileSync(path.join(root, "parent.html"), "utf8")));

/* ---- v87 : classes, matières et affectations (SQL additif) ---- */
const sqlV87 = fs.readFileSync(path.join(root, "supabase", "classes-matieres-v87.sql"), "utf8");
const sqlV87Code = sqlV87.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
t("SQL v87 : toutes les fonctions prévues", () => ["etab_classes_liste", "etab_classe_creer", "etab_classe_archiver", "etab_matieres_liste", "etab_matiere_ajouter", "etab_matiere_supprimer", "etab_matieres_initiales", "etab_affecter", "etab_desaffecter", "etab_affectations_liste", "mes_affectations", "registry_lier_classe", "etab_membre_nettoyer"].every((f) => new RegExp("create or replace function public\\." + f + "\\(").test(sqlV87Code)));
t("SQL v87 : additif — ne redéfinit aucune fonction ni règle de sécurité existante", () =>
  !/create or replace function public\.(admin_assign|admin_unassign|admin_assignments|can_use_ref|is_etab_admin|is_etab_member|rejoindre_etablissement|etab_retirer|etab_deplacer_eleves)\(/.test(sqlV87Code) &&
  !/(drop|create) policy/i.test(sqlV87Code) && !/drop (table|function)/i.test(sqlV87Code) && !/alter table[^;]*drop column/i.test(sqlV87Code));
t("SQL v87 : la reprise n'efface rien et ne retire aucun accès existant", () => {
  const rep = sqlV87Code.slice(sqlV87Code.indexOf("insert into public.etab_classes (etab_id, nom)"), sqlV87Code.indexOf("create or replace function public.registry_lier_classe"));
  return rep.length > 200 && !/\b(delete|truncate|drop)\b/i.test(rep) && !/update public\.registry_access/i.test(rep) && !/insert into public\.registry_access/i.test(rep);
});
t("SQL v87 : les enseignants déjà actifs gardent leurs accès (reprise seulement si accès à toute la classe)", () => /having count\(\*\) = \(select count\(\*\) from public\.registry_students s where s\.classe_id = g\.classe_id\)/.test(sqlV87Code) && /'reprise'/.test(sqlV87Code));
t("SQL v87 : le déclencheur ne bloque jamais l'ajout d'un élève", () => /exception when others then\s+new\.classe_id := null/.test(sqlV87Code) && /before insert or update of class_label on public\.registry_students/.test(sqlV87Code));
t("SQL v87 : seul le chef crée, archive, affecte ; l'enseignant doit être actif ; l'enseignant ne voit que ses classes", () =>
  ["etab_classe_creer", "etab_classe_archiver", "etab_matiere_ajouter", "etab_matiere_supprimer", "etab_matieres_initiales", "etab_affecter", "etab_desaffecter", "etab_affectations_liste"].every((f) => {
    const i = sqlV87Code.indexOf("function public." + f + "("); const b = sqlV87Code.slice(i, sqlV87Code.indexOf("end $$;", i));
    return /is_etab_admin\(p_etab\)/.test(b);
  }) && /m\.user_id = p_user and m\.statut = 'actif'/.test(sqlV87Code) && /adm or exists \(select 1 from public\.etab_affectations f where f\.classe_id = c\.id and f\.teacher_id = uid\)/.test(sqlV87Code));
t("SQL v87 : une matière utilisée ne peut pas être supprimée ; une classe archivée n'efface rien", () => /'in_use'/.test(sqlV87Code) && /on delete restrict/.test(sqlV87Code) && /set archivee = coalesce\(p_on, false\)/.test(sqlV87Code));
t("SQL v87 : droits (revoke public, grant authenticated) et parenthèses / blocs $$ équilibrés", () =>
  /revoke all on function[\s\S]*mes_affectations\(\)\s+from public/.test(sqlV87Code) && /grant execute on function[\s\S]*mes_affectations\(\)\s+to authenticated/.test(sqlV87Code) &&
  (sqlV87Code.match(/\(/g) || []).length === (sqlV87Code.match(/\)/g) || []).length && (sqlV87Code.match(/\$\$/g) || []).length % 2 === 0);

/* ---- v72 : aider un chef, chiffres d'usage anonymes (administrateur du site) ---- */
const sqlV72 = fs.readFileSync(path.join(root, "supabase", "aide-chefs-v72.sql"), "utf8");
t("SQL v72 : trois fonctions réservées à l'administrateur du site, droits accordés", () =>
  ["sa_nouveau_code", "sa_definir_chef", "sa_usage"].every(n => sqlV72.includes("function public." + n) && new RegExp("grant execute on function[\\s\\S]*public\\." + n).test(sqlV72)) &&
  (sqlV72.match(/est_admin_plateforme\(\)/g) || []).length >= 3);
t("SQL v72 : un code n'est généré que pour un établissement validé, et l'action est journalisée", () =>
  /x\.statut = 'valide'/.test(sqlV72) && (sqlV72.match(/journaliser\(/g) || []).length === 2 && !/grant execute on function[\s\S]*journaliser/.test(sqlV72));
t("SQL v72 : les chiffres d'usage ne lisent ni élèves, ni classes, ni contenu des liens", () => {
  const f = sqlV72.slice(sqlV72.indexOf("function public.sa_usage"), sqlV72.indexOf("-- 4. Droits"));
  return f.length > 200 && !/registry_|snapshot|classe|eleve|class_label|notes/i.test(f);
});
t("SQL v72 : parenthèses et blocs $$ équilibrés", () => (sqlV72.match(/\(/g) || []).length === (sqlV72.match(/\)/g) || []).length && (sqlV72.match(/\$\$/g) || []).length % 2 === 0);
t("v72 : admin.html propose nouveau code, changement de chef et chiffres d'usage, sans accès aux élèves", () => {
  const adm = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  return /sa_nouveau_code/.test(adm) && /sa_definir_chef/.test(adm) && /sa_usage/.test(adm) && /data-snc/.test(adm) && /data-sch/.test(adm) &&
    !/admin_dashboard|registry_students|signUp/.test(adm);
});
t("v72 : le script de admin.html n'a pas d'erreur de syntaxe", () => {
  const adm = fs.readFileSync(path.join(root, "admin.html"), "utf8"), m = adm.match(/<script>([\s\S]*?)<\/script>/);
  try { new vm.Script(m[1]); return true; } catch (e) { return e.message; }
});

/* ---- v73 : contacter les administrateurs du site ---- */
const sqlV73 = fs.readFileSync(path.join(root, "supabase", "contact-v73.sql"), "utf8");
t("SQL v73 : toutes les fonctions prévues, droits accordés", () =>
  ["contact_envoyer", "contact_repondre", "contact_mes_demandes", "contact_marquer_lu", "sa_contact_liste", "sa_contact_repondre", "sa_contact_statut"]
    .every(n => sqlV73.includes("function public." + n) && new RegExp("grant execute on function[\\s\\S]*public\\." + n).test(sqlV73)));
t("SQL v73 : les fonctions de l'administrateur du site vérifient le droit côté serveur (3 fonctions)", () => {
  const sa = sqlV73.slice(sqlV73.indexOf("function public.sa_contact_liste"), sqlV73.indexOf("-- 4. Droits"));
  return (sa.match(/est_admin_plateforme\(\)/g) || []).length === 3;
});
t("SQL v73 : l'expéditeur ne voit pas l'adresse de l'administrateur, l'administrateur ne lit ni élèves ni classes", () => {
  const user = sqlV73.slice(sqlV73.indexOf("function public.contact_mes_demandes"), sqlV73.indexOf("function public.contact_marquer_lu"));
  const sa = sqlV73.slice(sqlV73.indexOf("function public.sa_contact_liste"), sqlV73.indexOf("-- 4. Droits"));
  return user.length > 200 && !/email|auth\.users/.test(user) && !/registry_|snapshot|class_label|parent_shares/.test(sa);
});
t("SQL v73 : limites contre les abus et expéditeur membre de l'établissement cité", () =>
  /interval '24 hours'\) >= 5/.test(sqlV73) && /interval '1 hour'\) >= 10/.test(sqlV73) && /'not_member'/.test(sqlV73) && /enable row level security/.test(sqlV73));
t("SQL v73 : parenthèses et blocs $$ équilibrés", () => (sqlV73.match(/\(/g) || []).length === (sqlV73.match(/\)/g) || []).length && (sqlV73.match(/\$\$/g) || []).length % 2 === 0);
t("v73 : contact.html écrit, lit et marque lu ; aucun accès aux élèves", () => {
  const c = fs.readFileSync(path.join(root, "contact.html"), "utf8");
  return /contact_envoyer/.test(c) && /contact_repondre/.test(c) && /contact_mes_demandes/.test(c) && /contact_marquer_lu/.test(c) && !/admin_dashboard|registry_students|signUp/.test(c);
});
t("v73 : admin.html a la rubrique Demandes (répondre, clore, marquer lu)", () => {
  const a = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  return /sa_contact_liste/.test(a) && /sa_contact_repondre/.test(a) && /sa_contact_statut/.test(a) && /data-dr=/.test(a) && /data-dst=/.test(a);
});
t("v73 : les scripts de contact.html et admin.html n'ont pas d'erreur de syntaxe", () => {
  for (const f of ["contact.html", "admin.html"]) { const h = fs.readFileSync(path.join(root, f), "utf8"); try { new vm.Script(h.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { return f + " : " + e.message; } }
  return true;
});
t("v73 : l'application propose « Écrire à un administrateur » à tout compte connecté, y compris un établissement suspendu", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"admin",code:null,statut:"suspendu",motif:"Doublon"}];ETAB.cur="e1";');
  const h1 = run("etabCard()");
  run('ETAB.list=[];ETAB.cur=null;'); const h2 = run("etabCard()");
  run('GUEST=true;'); const h3 = run("etabCard()");
  run("sb=null;ME=null;GUEST=false;ETAB.list=[];ETAB.loaded=false;");
  return /contactbtn/.test(h1) && /contactbtn/.test(h2) && h3 === "" && /contact\.html/.test(fs.readFileSync(path.join(root, "js", "events.js"), "utf8"));
});
t("v73 : le chef a un lien de contact sur sa page et sur l'écran « Accès réservé »", () =>
  (chefSrc().match(/href=\\?"contact\.html/g) || []).length >= 2);
/* ---- v74 : plus de confirmation d'e-mail, synchronisation sans écrasement, pages d'administration hors cache ---- */
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
t("v84 : le cache hors ligne est versionné (cm-vNN)", () => /VERSION="cm-v\d+"/.test(rd("sw.js")));
t("v80 : « Vérifier la validation » ouvre une boîte de dialogue avec bouton de contact", () => { const e = rd("js/etab.js"); return /function etabCheck\(/.test(e) && /b\.id==="etchk"\)\{etabCheck\(\)/.test(e) && /Contacter l’administrateur/.test(e) && /contact\.html\?c=etablissement/.test(e) && /Pas encore validé/.test(e) && /Établissement validé/.test(e); });
t("v80 : la page de contact préremplit le formulaire", () => { const c = rd("contact.html"); return /URLSearchParams/.test(c) && /set\("sj",P\.s\)/.test(c); });
t("v80 : le bouton Détails du bandeau reste branché", () => /getElementById\("pend"\)\.addEventListener\("click"/.test(rd("js/etab.js")));
t("v74 : plus aucune trace de la confirmation d'e-mail dans l'application ni les guides", () =>
  !/email_not_confirmed|not confirmed|e-mail de confirmation|Confirmez votre e-mail/i.test(rd("js", "auth.js") + rd("js", "events.js") + rd("js", "etab.js") + rd("aide-etablissement.html")) &&
  !/Si « Confirm email » est activé/.test(rd("supabase", "LISEZ-MOI.md")));
t("v74 : l'inscription n'envoie pas de lien de confirmation (pas d'emailRedirectTo)", () => !/emailRedirectTo:redirectUrl\(\)\}\}\)/.test(rd("js", "events.js") + rd("js", "auth.js")) || !/signUp\([^)]*emailRedirectTo/.test(rd("js", "events.js") + rd("js", "auth.js")));
t("v74 : la synchronisation ne force jamais l'envoi (aucun upsert de classe)", () => !/upsert\(/.test(rd("js", "sync.js")) && !/on force/.test(rd("js", "sync.js")));
t("v74 : l'envoi d'une classe déjà connue reste conditionnel à sa version en ligne", () => /\.eq\("updated_at",rv\[id\]\)/.test(rd("js", "sync.js")));
t("v74 : admin.html, etablissement.html et contact.html ne sont pas gardés dans le cache hors ligne", () => {
  const sw = rd("sw.js"), core = (sw.match(/var CORE=\[([\s\S]*?)\];/) || ["", ""])[1];
  return !/"(admin|etablissement|contact)\.html"/.test(core) && /admin\|etablissement\|contact/.test(sw);
});

/* ---- v75 : rappels d'appel ---- */
const rpClasse = (rec) => `D={cur:"a",classes:[{id:"a",name:"6e A",students:[{id:"s1",name:"A"}],records:${rec},tt:[{id:"t1",d:1,s:"08:00",e:"10:00",r:""},{id:"t2",d:2,s:"14:00",e:"16:00",r:""}],ev:[]}]};`;
const rpAt = (h, m) => { ctx.__d = new Date(2026, 10, 23, h, m); return run("rpDue(__d)"); }; /* lundi 23 novembre 2026 */
run(rpClasse("{}"));
t("rappel : 5 minutes avant la séance → « start »", () => { const r = rpAt(7, 55); return r.length === 1 && r[0].kind === "start" && r[0].min === 5; });
t("rappel : 10 minutes avant la séance → rien", () => rpAt(7, 50).length === 0);
t("rappel : séance en cours → rien", () => rpAt(8, 30).length === 0);
t("rappel : séance terminée sans appel → « missed »", () => { const r = rpAt(10, 12); return r.length === 1 && r[0].kind === "missed" && r[0].min === 12; });
t("rappel : une séance d'un autre jour n'est pas signalée", () => rpAt(15, 0).every(o => o.x.id !== "t2"));
run(rpClasse('{"2026-11-23":{s1:"p"}}'));
t("rappel : appel déjà fait → rien", () => rpAt(7, 57).length === 0 && rpAt(10, 30).length === 0);
run(rpClasse("{}"));
run('Notification={permission:"granted"};var __n=[];rpNotify=function(a,b,c){__n.push(c);};localStorage.setItem("classemaster-rappels","1");localStorage.removeItem("classemaster-rappels-vus");');
const rpTickAt = (h, m) => { ctx.__d = new Date(2026, 10, 23, h, m); return run("rpTick(__d)"); };
t("rappel : une notification avant la séance, une seule fois", () => rpTickAt(7, 57) === 1 && rpTickAt(7, 58) === 0);
t("rappel : appel oublié → notification après 10 min seulement", () => rpTickAt(10, 5) === 0 && rpTickAt(10, 12) === 1 && rpTickAt(10, 13) === 0);
t("rappel : pas de notification pour une séance finie depuis plus de 2 h", () => { run('localStorage.removeItem("classemaster-rappels-vus")'); return rpTickAt(13, 0) === 0; });
t("rappel : réglage désactivé → aucune notification", () => { run('localStorage.removeItem("classemaster-rappels");localStorage.removeItem("classemaster-rappels-vus")'); return rpTickAt(7, 57) === 0; });
t("rappel : permission refusée → aucune notification", () => { run('localStorage.setItem("classemaster-rappels","1");Notification={permission:"denied"};'); return rpTickAt(7, 57) === 0; });
t("rappel : la carte de réglage propose d'activer, de désactiver ou explique le blocage", () => {
  run('localStorage.removeItem("classemaster-rappels");Notification={permission:"default"};');
  const a = run("rappelsCard()");
  run('localStorage.setItem("classemaster-rappels","1");Notification={permission:"granted"};');
  const b = run("rappelsCard()");
  run('Notification={permission:"denied"};');
  const c = run("rappelsCard()");
  return /data-rp="on"/.test(a) && /data-rp="off"/.test(b) && /data-rp="test"/.test(b) && /bloquées/.test(c) && !/data-rp="on"/.test(c);
});
t("rappel : le bandeau est vide sans séance enregistrée", () => { run('D={cur:"a",classes:[{id:"a",name:"6e A",students:[],records:{},ev:[]}]};'); return run("rappelBanner()") === ""; });
t("rappel : l'accueil, Compte, le cache et le service worker sont branchés", () => /rappelBanner/.test(rd("js", "horaires.js")) && (rd("js", "auth.js").match(/rappelsCard\(\)/g) || []).length >= 2 && /js\/rappels\.js/.test(rd("index.html")) && /"js\/rappels\.js"/.test(rd("sw.js")) && /notificationclick/.test(rd("sw.js")));
run("D=null;ME=null;localStorage.removeItem('classemaster-rappels');localStorage.removeItem('classemaster-rappels-vus');");

t("v76 : les boutons des bandeaux de l'accueil (Détails, Lu) ont leur propre écouteur", () => {
  const e = fs.readFileSync(path.join(root, "js", "etab.js"), "utf8");
  return /getElementById\("pend"\)\.addEventListener\("click"/.test(e) && /data-go="compte">Détails/.test(e) && /dataset\.go==="compte"/.test(e);
});

t("v77 : sur l'écran de rattachement, le retour de l'appareil remonte l'historique au lieu de rester piégé", () => {
  run('ME={id:"u1",name:"T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.list=[];view="etab";var __b=0;history={back:function(){__b++;},pushState:function(){},replaceState:function(){}};');
  run('onPop({state:{view:"signup"}})');
  const skipped = run("__b===1&&view===\"etab\"");
  run('onPop({state:{view:"etab"}})'); const kept = run("__b===1");   /* une entrée « rattachement » s'affiche normalement */
  run('ETAB.list=[{id:"e1",nom:"X",role:"admin"}];view="home";onPop({state:{view:"home"}})'); const normal = run("__b===1&&view===\"home\"");
  run("sb=null;ME=null;ETAB.list=[];ETAB.loaded=false;");
  return skipped && kept && normal;
});

const sqlV78 = fs.readFileSync(path.join(root, "supabase", "suppression-v78.sql"), "utf8");
t("SQL v78 : suppression réservée à l'administrateur du site, établissement suspendu ou refusé, nom retapé, archive", () =>
  (sqlV78.match(/est_admin_plateforme/g) || []).length >= 2 && /not in \('suspendu', 'refuse'\)/.test(sqlV78) && /bad_name/.test(sqlV78) && /plateforme_suppressions/.test(sqlV78) &&
  !/grant execute on function[^;]*to anon/.test(sqlV78) && (sqlV78.match(/\(/g) || []).length === (sqlV78.match(/\)/g) || []).length);
t("SQL v78 : le journal est nettoyé APRÈS la suppression des dossiers (qui inscrit des départs)", () => sqlV78.indexOf("delete from public.etablissements") < sqlV78.indexOf("delete from public.registry_log"));
t("v78 : admin.html propose Supprimer sur un établissement suspendu ou refusé, avec aperçu et nom à retaper", () => {
  const a = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  return /sa_apercu_suppression/.test(a) && /sa_supprimer_etablissement/.test(a) && /data-sdel/.test(a) && /retapez le nom exact/.test(a);
});

/* ---- v79 : nettoyage du cahier de textes (par mois, ou en entier), annulable ---- */
function cxSetup() {
  run('KEY="test-cx";D={classes:[{id:"c1",name:"5e",ct:[{id:"s1",d:"2026-11-03",t:"a",p:"l1"},{id:"s2",d:"2026-11-10",t:"b",p:""},{id:"s3",d:"2026-12-01",t:"c",p:""}],pg:[{id:"l1",t:"L1",m:"11"},{id:"l2",t:"L2",m:"12"},{id:"l3",t:"L3"},{id:"l4",t:"L4",m:"11"}]}],cur:"c1"};save=function(){};toast=function(){};try{kvDel(tkey())}catch(e){}');
  return run("D.classes[0]");
}
t("v79 cahier : vider un mois de séances ne touche ni les autres mois ni le programme", () => {
  cxSetup();
  const r = run('cxApply(D.classes[0],"s|2026-11")');
  return r.s === 2 && r.p === 0 && run("D.classes[0].ct.map(function(s){return s.id}).join()") === "s3" && run("D.classes[0].pg.length") === 4;
});
t("v79 cahier : retirer les leçons d'un mois détache le lien des séances mais garde leur texte", () => {
  cxSetup();
  const r = run('cxApply(D.classes[0],"p|11")');
  return r.p === 2 && r.s === 0 && run("D.classes[0].pg.map(function(l){return l.id}).join()") === "l2,l3" && run('D.classes[0].ct[0].p===""&&D.classes[0].ct[0].t==="a"&&D.classes[0].ct.length===3');
});
t("v79 cahier : « tout effacer » vide séances et programme ; « toutes les séances » garde le programme", () => {
  cxSetup(); const a = run('cxApply(D.classes[0],"all-s")'); const keep = run("D.classes[0].pg.length") === 4 && run("D.classes[0].ct.length") === 0;
  cxSetup(); const b = run('cxApply(D.classes[0],"all")');
  return a.s === 3 && keep && b.s === 3 && b.p === 4 && run("D.classes[0].ct.length+D.classes[0].pg.length") === 0;
});
t("v79 cahier : rien à effacer → aucune entrée, pas d'erreur", () => { cxSetup(); run('D.classes[0].ct=[];'); return run('cxApply(D.classes[0],"s|2030-01")') === null; });
t("v79 cahier : annuler rétablit séances, leçons, ordre et liens", () => {
  cxSetup(); const r = run('cxApply(D.classes[0],"p|11")');
  const msg = run('trashRestore(tLoad().filter(function(e){return e.id==="' + r.id + '"})[0])');
  const ids = run("D.classes[0].pg.map(function(l){return l.id}).join()"), lien = run("D.classes[0].ct[0].p");
  const again = run('trashRestore(tLoad().filter(function(e){return e.id==="' + r.id + '"})[0])');
  return msg === "" && ids === "l1,l2,l3,l4" && lien === "l1" && again === "Déjà rétabli.";
});
t("v79 cahier : un effacement demande confirmation (aucun effacement au premier clic)", () => {
  const src = fs.readFileSync(path.join(root, "js", "cahier.js"), "utf8");
  return /data-cxc/.test(src) && /data-cxok/.test(src) && /Oui, effacer/.test(src) && /cxConf=cc\.dataset\.cxc;/.test(src) && !/cxConf=cc\.dataset\.cxc;[^}]*cxApply/.test(src);
});
t("v79 cahier : l'écran affiche les boutons par mois et la carte « Nettoyer le cahier »", () => {
  cxSetup(); run('view="cahier";cxConf="";');
  const h = run("renderCahier()"), conf = (run('cxConf="s|2026-11";'), run("renderCahier()")); run('cxConf="";');
  return /Vider ce mois/.test(h) && /Nettoyer le cahier/.test(h) && /Tout effacer : séances et programme/.test(h) && /Oui, effacer/.test(conf) && /Effacer les 2 séances de Novembre 2026/.test(conf) && !/Oui, effacer/.test(h) && /Tout effacer : 3 séances et 4 leçons/.test((run('cxConf="all";'), run("renderCahier()")));
});

/* ---- v81 : retirer tout le programme du cahier d'un seul geste, depuis le haut de la liste ---- */
function cxBig(n, faites) {
  run('KEY="test-cx";D={classes:[{id:"c1",name:"5e",ct:[],pg:[],cur:"c1"}],cur:"c1"};save=function(){};toast=function(){};try{kvDel(tkey())}catch(e){}');
  run('var P=[];for(var i=0;i<' + n + ';i++){var o={id:"l"+i,t:"Leçon "+i};if(i<' + faites + ')o.x=true;P.push(o);}D.classes[0].pg=P;');
}
t("v81 cahier : « Retirer tout le programme » vide 391 leçons d'un coup, et « Annuler » les rétablit", () => {
  cxBig(391, 2);
  const r = run('cxApply(D.classes[0],"top-p")');
  const vide = run("D.classes[0].pg.length") === 0 && r && r.p === 391;
  const msg = run('trashRestore(tLoad().filter(function(e){return e.id==="' + r.id + '"})[0])');
  return vide && msg === "" && run("D.classes[0].pg.length") === 391 && run("D.classes[0].pg[0].id") === "l0";
});
t("v81 cahier : « Retirer les leçons non faites » garde les leçons cochées faites", () => {
  cxBig(391, 2);
  const r = run('cxApply(D.classes[0],"p-undone")');
  return r.p === 389 && run("D.classes[0].pg.length") === 2 && run("D.classes[0].pg.every(function(l){return l.x})") === true;
});
t("v81 cahier : les boutons du haut s'affichent avec le nombre de leçons, et demandent confirmation", () => {
  cxBig(391, 2); run('view="cahier";cxConf="";');
  const a = run("renderCahier()"); run('cxConf="top-p";');
  const b = run("renderCahier()"); run('cxConf="";');
  const iTop = a.indexOf("Retirer tout le programme (391)"), iList = a.indexOf("data-pgx=");
  return iTop > 0 && iTop < iList && /Retirer les leçons non faites \(389\)/.test(a) && /Oui, effacer/.test(b) && /Retirer les 391 leçons du programme/.test(b);
});
t("v81 cahier : le bouton du mois est en haut du mois, avant les leçons", () => {
  cxBig(5, 0); run('view="cahier";cxConf="";');
  const a = run("renderCahier()"); const i = a.indexOf("Retirer les leçons sans mois"), j = a.indexOf('data-pgx="l0"');
  return i > 0 && j > i;
});

t("v81 corbeille : en mode invité aussi, « Annuler » rétablit ce qui vient d'être retiré", () => {
  cxBig(30, 0); run('KEY="";TMEM=[];');
  const r = run('cxApply(D.classes[0],"top-p")');
  const vide = run("D.classes[0].pg.length") === 0;
  run("undoTrash('" + r.id + "')");
  const ok2 = run("D.classes[0].pg.length") === 30; run('KEY="test-cx";TMEM=[];'); return vide && ok2;
});

/* ---- v82 : relevé d'un devoir précis, relevé « tous les trimestres », liste d'appels repliée ---- */
function pdfText(x) { return typeof x === "string" ? x : Buffer.from(x).toString("latin1"); }
function setupRel() {
  run('ME={id:"u1",name:"Prof",school:"CG de Nsou"};GUEST=false;bp=null;brs=null;' +
    'D={cur:"c1",classes:[{id:"c1",name:"6e B",subj:"Français",students:[{id:"a",name:"Awa Mba"},{id:"b",name:"Paul Obiang"},{id:"c",name:"Luc Ndong"}],records:{},' +
    'ev:[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:15,b:8,c:15}},{id:"e2",t:"Dictée",d:"2026-11-09",m:10,s:{a:9,b:4}}]}]};');
}
t("v82 relevé : un devoir précis donne un PDF classé avec la moyenne", () => {
  setupRel();
  const b = pdfText(run('releveDevoirPDF(D.classes[0],D.classes[0].ev[0])'));
  return b.startsWith("%PDF") && /Relev. du devoir/.test(b) && /Devoir 1/.test(b) && /Awa Mba/.test(b) && /Paul Obiang/.test(b) && /Moyenne : 12,67/.test(b);
});
t("v82 relevé : un devoir sur 10 est ramené sur 20, un élève sans note reste en bas", () => {
  setupRel();
  const b = pdfText(run('releveDevoirPDF(D.classes[0],D.classes[0].ev[1])'));
  return /9 \/ 10/.test(b) && /18/.test(b) && b.indexOf("Awa Mba") < b.indexOf("Paul Obiang") && b.indexOf("Paul Obiang") < b.indexOf("Luc Ndong");
});
t("v82 relevé : deux élèves à égalité ont le même rang", () => {
  setupRel();
  const b = pdfText(run('releveDevoirPDF(D.classes[0],D.classes[0].ev[0])'));
  return (b.match(/\(1\) Tj/g) || []).length === 2 && (b.match(/\(3\) Tj/g) || []).length === 1;
});
t("v82 relevé : le choix propose les trimestres, tous les trimestres et chaque devoir", () => {
  setupRel();
  const h = run("bulletinsCard(D.classes[0])");
  return /id="brsel"/.test(h) && /Toutes les évaluations \(tous les trimestres\)/.test(h) && /value="p:A"/.test(h) && /value="e:e1"/.test(h) && /value="e:e2"/.test(h) && /Un devoir précis/.test(h) && /id="brel"/.test(h);
});
t("v82 relevé : le choix mémorisé reste sélectionné", () => {
  setupRel(); run('brs="e:e2";');
  const h = run("bulletinsCard(D.classes[0])"); run("brs=null;");
  return /<option value="e:e2" selected>/.test(h);
});
t("v82 relevé : l'écran d'un devoir a son bouton de relevé", () => {
  setupRel(); run('evid="e1";');
  return /id="evrel"/.test(run("renderEval()"));
});
t("v82 appels : la liste affiche tous les appels récents (et non plus 8), repliée dès 6 lignes", () => {
  setupRel();
  run('var r={};for(var i=1;i<=30;i++){var d="2026-10-"+(i<10?"0"+i:i);r[d]={a:"p",b:"a",c:"p"};}D.classes[0].records=r;view="classe";');
  const h = run("renderClasse()");
  return (h.match(/data-open=/g) || []).length === 30 && run('foldMin("hist")') === 6 && run('foldMin("row")') === 9;
});



/* ---- v88 : parcours enseignant (classes reçues du chef) ---- */
const sqlV88 = rd("supabase", "parcours-enseignant-v88.sql").split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
t("SQL v88 : une seule fonction ajoutée, additive, réservée aux enseignants actifs, sans code famille ni téléphone", () =>
  (sqlV88.match(/create or replace function/g) || []).length === 1 && /function public\.mes_classes_recues\(\)/.test(sqlV88) &&
  !/(drop|create) (policy|table|function)|alter table|delete from|update public/i.test(sqlV88) &&
  (sqlV88.match(/m\.statut = 'actif'/g) || []).length === 2 && !/\bcode\b|phone/.test(sqlV88.replace(/not authenticated/, "")) &&
  /not c\.archivee/.test(sqlV88) && /grant execute on function public\.mes_classes_recues\(\) to authenticated/.test(sqlV88) &&
  (sqlV88.match(/\(/g) || []).length === (sqlV88.match(/\)/g) || []).length && (sqlV88.match(/\$\$/g) || []).length === 2);
const recuBase = () => {
  run('ME={id:"u1",name:"Awa T",login:"t@x.fr"};GUEST=false;sb={};ETAB.loaded=true;ETAB.cur="e1";' +
    'ETAB.list=[{id:"e1",nom:"CG de Nsou",role:"enseignant",statut:"valide",membre_statut:"actif"}];RECU.ok=true;dirty={};' +
    'RECU.list=[{etab_id:"e1",classe_id:"k1",classe:"6e A",niveau:"",matieres:["Maths","SVT"],eleves:[{ref:"ABCDEFGHJK12",name:"Awa Diop"},{ref:"ZYXWVUTSRQ34",name:"Paul Nkoa"}]}];');
};
const recuEnd = () => run('ME=null;sb=null;ETAB.list=[];ETAB.loaded=false;ETAB.cur="";recuReset();dirty={};');
ctx.crypto = ctx.crypto || require("crypto").webcrypto;
ctx.btoa = ctx.btoa || ((s) => Buffer.from(s, "binary").toString("base64"));
ctx.atob = ctx.atob || ((s) => Buffer.from(s, "base64").toString("binary"));
const D0 = run("JSON.stringify(D)");
t("v88 : verrou — enseignant rattaché verrouillé ; chef, sans établissement ou serveur sans v88 : libres", () => {
  recuBase(); const a = run("recuLocked()");
  run('ETAB.list[0].role="admin"'); const b = run("recuLocked()");
  run('ETAB.list[0].role="enseignant";RECU.ok=false'); const c = run("recuLocked()");
  run('RECU.ok=true;ETAB.list=[]'); const d = run("recuLocked()");
  recuEnd(); return a === true && b === false && c === false && d === false;
});
t("v88 : une classe locale de même nom est reliée (pas de doublon), notes et appels conservés, élèves liés ou ajoutés", () => {
  recuBase();
  run('D.classes=[{id:"c0",name:"Ma classe",students:[],records:{}},{id:"c1",name:"6e A",subj:"",students:[{id:"s1",name:"Diop Awa"}],records:{"2026-10-05":{s1:"a"}}}];D.cur="c0";');
  const ch = run("recuApply(true)"); const o = JSON.parse(run("JSON.stringify(D.classes)"));
  const c = o.find((x) => x.name === "6e A");
  const r = o.length === 1 && c.id === "c1" && c.ca === "k1" && c.subj === "Maths, SVT" && c.records["2026-10-05"].s1 === "a" &&
    c.students.length === 2 && c.students.find((s) => s.id === "s1").ref === "ABCDEFGHJK12" && c.students.some((s) => s.name === "Paul Nkoa" && s.ref === "ZYXWVUTSRQ34") &&
    run("D.cur") === "c1" && run("Object.keys(dirty).join()") === "c1";
  recuEnd(); return ch === true && r;
});
t("v88 : une classe absente de l'appareil est créée avec ses élèves ; le second passage ne change plus rien", () => {
  recuBase(); run('D.classes=[];D.cur="";');
  const a = run("recuApply(true)"), b = run("recuApply(true)"); const o = JSON.parse(run("JSON.stringify(D.classes)"));
  const r = a === true && b === false && o.length === 1 && o[0].name === "6e A" && o[0].ca === "k1" && o[0].et === "e1" && o[0].students.length === 2 && o[0].students.every((s) => s.ref && s.sh);
  recuEnd(); return r;
});
t("v88 : une classe locale avec des données n'est jamais supprimée, même sans correspondance", () => {
  recuBase(); run('D.classes=[{id:"c9",name:"Club théâtre",students:[{id:"s9",name:"Zoé"}],records:{}},{id:"c0",name:"Ma classe",students:[],records:{}}];D.cur="c0";');
  run("recuApply(true)"); const o = JSON.parse(run("JSON.stringify(D.classes)"));
  const r = o.some((x) => x.id === "c9") && !o.some((x) => x.id === "c0") && o.length === 2; recuEnd(); return r;
});
t("v88 : bandeau d'accueil — en attente, aucune classe, rien quand des classes sont reçues", () => {
  recuBase(); run('ETAB.list[0].membre_statut="en_attente";RECU.list=[];'); const a = run("recuCard()");
  run('ETAB.list[0].membre_statut="actif"'); const b = run("recuCard()");
  run('RECU.list=[{classe_id:"k1"}]'); const c = run("recuCard()"); recuEnd();
  return /En attente de validation/.test(a) && /Aucune classe pour le moment/.test(b) && /data-recu/.test(b) && c === "";
});
t("v88 : « Nouvelle classe » bloquée partout (menu, accueil, sélecteur) ; le lien classe du chef est conservé en ligne", () =>
  /recuLocked/.test(rd("js", "nav.js")) && /recuLocked/.test(rd("js", "classes.js")) && (rd("js", "events.js").match(/recuNotice\(\)/g) || []).length === 2 &&
  /recuCard/.test(rd("js", "classes.js")) && /recuApply\(true\)/.test(rd("js", "sync.js")) && /"et","ca"/.test(rd("js", "sync.js")) && run('xPack({ca:"k1",et:"e1"}).ca') === "k1" &&
  /recuLoad/.test(rd("js", "etab.js")) && /js\/recues\.js/.test(rd("index.html")) && /"js\/recues\.js"/.test(rd("sw.js")));
/* ---- v89 : étape 3A — socle commun, menu commun, page Accueil de l'établissement ---- */
const etabCore = (() => { const c = {}; vm.createContext(c); vm.runInContext(rd("js", "etab-core.js"), c, { filename: "etab-core.js" }); return c.Etab; })();
t("v89 : socle js/etab-core.js (un seul nom global, outils, chargements, démarrage)", () =>
  typeof etabCore === "object" && ["start", "model", "call", "loadStudents", "loadDash", "loadTeaching", "loadDiscipline", "href", "say", "esc", "tstat", "evLate"].every((k) => typeof etabCore[k] === "function") &&
  (rd("js", "etab-core.js").match(/^var \w+/gm) || []).length === 1 && etabCore.esc('<a href="x">&</a>') === "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
t("v89 : indicateurs du socle (cumul par élève, classe, enseignant, matière ; présence ; moyennes)", () => {
  const rows = [{ id: "a", class_label: "6e A" }, { id: "b", class_label: "6e A" }, { id: "c", class_label: "5e B" }];
  const dash = [{ student_id: "a", n: 20, a: 2, j: 1, r: 0, recent_a: 0, avg: 14, subj: "Maths", teacher: "M. X", updated_at: "2026-11-20T00:00:00Z" },
    { student_id: "b", n: 20, a: 8, j: 0, r: 1, recent_a: 4, avg: 8, subj: "Maths", teacher: "M. X", updated_at: "2026-11-21T00:00:00Z" }, { student_id: "zz", n: 5, a: 5, avg: 1, subj: "Maths" }];
  const M = etabCore.model(rows, dash);
  return M.N === 40 && M.A === 10 && etabCore.pc(M.N, M.A) === 75 && M.ids.length === 2 && M.gm === 11 && M.C["6e A"].fol === 2 && M.C["5e B"].fol === 0 &&
    M.T["M. X"].last === "2026-11-21T00:00:00Z" && M.SJ.Maths.v.length === 2 && M.SJ.Maths.ok === 1 && M.last === "2026-11-21T00:00:00Z";
});
t("v89 : menu commun — 8 rubriques, Accueil terminé ; depuis v90 Classes, Enseignants et Matières, depuis v91 Résultats et Vie scolaire, depuis v92 Fin d'année et Paramètres ont leur page", () => {
  const ids = etabCore.pages.map((p) => p.id).join(",");
  return ids === "accueil,classes,enseignants,matieres,resultats,vie,fin,parametres" && etabCore.pageOf("accueil").done === true && etabCore.href("accueil") === "etab-accueil.html" &&
    etabCore.href("matieres") === "etab-matieres.html" && etabCore.href("classes", { c: "6e A" }) === "etab-classes.html#c=6e%20A" && etabCore.href("resultats") === "etab-resultats.html" && etabCore.href("vie") === "etab-vie.html" && etabCore.href("fin") === "etab-fin.html" && etabCore.href("parametres") === "etab-parametres.html";
});
t("v89 : page Accueil — scripts dans l'ordre, aucun script en ligne, aucun code secret demandé, liens vers les rubriques", () => {
  const h = rd("etab-accueil.html"), a = rd("js", "etab-accueil.js");
  return h.indexOf("js/etab-core.js") > 0 && h.indexOf("js/etab-core.js") < h.indexOf("js/etab-accueil.js") && !/<script>[\s\S]*?<\/script>/.test(h) &&
    /css\/etab-base\.css/.test(h) && /css\/etab-v86\.css/.test(h) && h.indexOf("etab-v86.css") > h.indexOf("graph-etab.css") &&
    /loadStudents\("id,name,class_label,ref,created_at"/.test(a) && !/\bcode\b/.test(a.match(/loadStudents\("([^"]*)"/)[1]) && /E\.href\("enseignants"\)|\["enseignants"/.test(a) && /Etab/.test(a) &&
    fs.existsSync(path.join(root, "css", "etab-base.css")) && fs.existsSync(path.join(root, "css", "etab-v86.css"));
});
t("v99 : les pages etab-*.html et leurs scripts et styles sont gardés hors ligne ; admin.html et contact.html ne le sont toujours pas", () => {
  const sw = rd("sw.js"), core = (sw.match(/var CORE=\[([\s\S]*?)\];/) || ["", ""])[1];
  const pages = fs.readdirSync(root).filter((f) => /^etab-[a-z]+\.html$/.test(f));
  const need = pages.concat(...pages.map((p) => [...rd(p).matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map((m) => m[1])));
  const manque = need.filter((f) => !core.includes('"' + f + '"'));
  return !manque.length && pages.length === 8 && pages.every((p) => rd(p).indexOf("js/etab-offline.js") >= 0 && rd(p).indexOf("js/etab-offline.js") < rd(p).indexOf("js/supabase.js")) && !/etab-\[a-z\]/.test(sw) && /admin\|etablissement\|contact/.test(sw) ? true : J(manque);
});
t("v94 : etablissement.html n'est plus qu'une redirection (aucune logique, aucun accès aux données) ; jamais gardée sur l'appareil", () => {
  const e = rd("etablissement.html"), sw = rd("sw.js");
  return e.length < 1500 && /url=etab-accueil\.html/.test(e) && /js\/etab-redirect\.js/.test(e) && !/supabase|rpc\(|<script>/.test(e) && /VERSION="cm-v(9[4-9]|1[0-9][0-9])"/.test(sw) && /admin\|etablissement\|contact/.test(sw);
});
t("v94 : l'ancienne adresse mène à la bonne page (#apercu, #eff, #ass, #res, #ens, #dis, #fin, #c=…, sans ancre, ancre inconnue)", () => {
  const src = rd("js", "etab-redirect.js");
  const go = (hash) => { let to = null; const a = { href: "" }; new Function("location", "document", src)({ hash, replace: (u) => { to = u; } }, { getElementById: () => a }); return to === a.href ? to : "écart:" + to + "/" + a.href; };
  return go("") === "etab-accueil.html" && go("#apercu") === "etab-accueil.html" && go("#eff") === "etab-classes.html" && go("#ass") === "etab-resultats.html" && go("#res") === "etab-resultats.html" &&
    go("#ens") === "etab-enseignants.html" && go("#dis") === "etab-vie.html" && go("#fin") === "etab-fin.html" && go("#c=6e%20A") === "etab-classes.html#c=6e%20A" && go("#nimporte") === "etab-accueil.html" && go("#constructor") === "etab-accueil.html";
});
t("v94 : plus aucun lien de l'application, des pages etab-*, du guide ni des notices vers l'ancienne page ; le socle n'a plus de repli « ancienne page »", () => {
  const files = [].concat(["js/events.js", "js/etab.js", "js/share.js", "js/graph-etab.js", "aide-etablissement.html"], fs.readdirSync(path.join(root, "js")).filter((f) => /^etab-.*\.js$/.test(f) && f !== "etab-redirect.js").map((f) => "js/" + f), fs.readdirSync(root).filter((f) => /^etab-.*\.html$/.test(f)));
  return files.every((f) => !/(^|[^-\w])etablissement\.html/.test(rd(...f.split("/")))) && etabCore.href("classes", { c: "6e A" }) === "etab-classes.html#c=6e%20A";
});
t("v90 : pages Classes, Enseignants et Matières — scripts dans l'ordre, aucun script en ligne, menu actif, seule la page Classes demande les codes secrets", () => {
  const P = { classes: "etab-classes", enseignants: "etab-enseignants", matieres: "etab-matieres" };
  return Object.keys(P).every((k) => {
    const h = rd(P[k] + ".html"), j = rd("js", P[k] + ".js");
    return h.indexOf("js/etab-core.js") > 0 && h.indexOf("js/etab-core.js") < h.indexOf("js/" + P[k] + ".js") && !/<script>[\s\S]*?<\/script>/.test(h) && /css\/etab-v86\.css/.test(h) &&
      new RegExp('page:"' + k + '"').test(j) && etabCore.pageOf(k).done === true && etabCore.href(k) === P[k] + ".html" && (k === "classes" ? /loadStudents\("[^"]*\bcode\b/.test(j) : !/\bcode\b[^"]*"\s*,\s*function/.test(j) && !/loadStudents/.test(j));
  });
});
t("v90 : page Classes — création et archivage par les fonctions serveur v87, élèves reliés par leur libellé, aucune écriture directe sur etab_classes", () => {
  const j = rd("js", "etab-classes.js");
  return /etab_classe_creer/.test(j) && /etab_classe_archiver/.test(j) && /etab_classes_liste/.test(j) && /registry_students/.test(j) && !/from\("etab_classes"\)/.test(j) && /crypto\.getRandomValues/.test(j) && /hashchange/.test(j);
});
t("v90 : page Enseignants — décision, affectation et retrait par les fonctions serveur ; page Matières — ajout, suppression, liste de départ", () => {
  const e = rd("js", "etab-enseignants.js"), m = rd("js", "etab-matieres.js");
  return ["etab_decider_membre", "etab_affecter", "etab_desaffecter", "etab_affectations_liste", "etab_definir_role", "etab_retirer", "etab_valider_enseignants"].every((f) => e.indexOf(f) >= 0) &&
    ["etab_matiere_ajouter", "etab_matiere_supprimer", "etab_matieres_initiales", "etab_matieres_liste"].every((f) => m.indexOf(f) >= 0) && !/from\("etab_(affectations|matieres)"\)/.test(e + m);
});
t("v90 : messages d'erreur du socle — matière utilisée, classe archivée, doublon", () => {
  const c = rd("js", "etab-core.js");
  return /in_use:/.test(c) && /class_not_found:/.test(c) && /exists:/.test(c) && /bad_name:/.test(c);
});
/* ---- v91 : étape 3C1 — Résultats et assiduité, Vie scolaire ---- */
t("v91 : pages Résultats et Vie scolaire — scripts dans l'ordre (graphiques puis socle puis page), aucun script en ligne, menu actif, aucun code secret demandé", () => {
  const P = { resultats: "etab-resultats", vie: "etab-vie" };
  return Object.keys(P).every((k) => {
    const h = rd(P[k] + ".html"), j = rd("js", P[k] + ".js");
    return h.indexOf("js/graph-etab.js") > 0 && h.indexOf("js/graph-etab.js") < h.indexOf("js/etab-core.js") && h.indexOf("js/etab-core.js") < h.indexOf("js/" + P[k] + ".js") &&
      !/<script>[\s\S]*?<\/script>/.test(h) && /css\/etab-v86\.css/.test(h) && h.indexOf("etab-v86.css") > h.indexOf("graph-etab.css") &&
      new RegExp('page:"' + k + '"').test(j) && etabCore.pageOf(k).done === true && etabCore.href(k) === P[k] + ".html" && /Etab/.test(j) &&
      /loadStudents\("id,name,class_label,ref"/.test(j) && !/\bcode\b/.test(j.match(/loadStudents\("([^"]*)"/)[1]);
  }) && rd("etab-vie.html").indexOf("js/telecharger.js") > 0 && rd("etab-vie.html").indexOf("js/telecharger.js") < rd("etab-vie.html").indexOf("js/etab-core.js");
});
t("v91 : page Résultats et assiduité — lecture seule (aucune écriture), onglets #res et #ass, liens vers la page d'une classe, seuils du socle", () => {
  const j = rd("js", "etab-resultats.js");
  return /E\.loadDash/.test(j) && !/\.(insert|update|upsert|delete)\(/.test(j) && !/sb\.rpc\(/.test(j) && /"ass"/.test(j) && /"res"/.test(j) && /E\.href\("classes"/.test(j) &&
    /E\.TH/.test(j) && /E\.model\(/.test(j) && /geDraw/.test(j) && /tableau-bord-admin\.sql/.test(j) && !/Moyenne inférieure à 10\./.test(j) && /Moyenne inférieure à '\+E\.nf1\(TH\.moy\)/.test(j);
});
t("v91 : page Vie scolaire — incidents lus par le socle, messages par les fonctions serveur v71, aucune écriture directe, adresse #messages (pas #msg)", () => {
  const j = rd("js", "etab-vie.js");
  return /E\.loadDiscipline/.test(j) && ["etab_messages_liste", "etab_message_envoyer", "etab_message_supprimer"].every((f) => j.indexOf(f) >= 0) &&
    !/sb\.from\(/.test(j) && !/\.(insert|update|upsert|delete)\(/.test(j) && /E\.call\("etab_message_envoyer"/.test(j) && /E\.call\("etab_message_supprimer"/.test(j) &&
    /messages:"messages"|msg:"messages"/.test(j) && !/slice\(1\)==="msg"|h==="msg"/.test(j) && /E\.download\(/.test(j) && /vie-scolaire-admin\.sql/.test(j) && /gestion-v71\.sql/.test(j) &&
    /confirm\(/.test(j) && /maxlength="100"/.test(j) && /maxlength="1000"/.test(j);
});
t("v91 : socle — dates courtes, CSV pour Excel (point-virgule, virgule décimale, guillemets doublés), téléchargement par cmSave", () => {
  const c = rd("js", "etab-core.js");
  return etabCore.fd("2026-11-20") === "20/11" && etabCore.fd("") === "" && etabCore.csvNum(12.345) === "12,35" && etabCore.csvNum(null) === "" &&
    etabCore.csvLine(["a\"b", 3.5, null, "x;y"]) === '"a""b";3,5;;"x;y"' && etabCore.tblCsv({ head: ["A", "B"], body: [["x", 1]] }) === '"A";"B"\r\n"x";1' &&
    typeof etabCore.fdt === "function" && /cmSave\(name/.test(c) && /\\ufeff/.test(c) && (c.match(/^var \w+/gm) || []).length === 1;
});
t("v91 : Accueil — l'alerte de décrochage ouvre l'onglet Assiduité, celle des incidents ouvre la Vie scolaire", () => {
  const a = rd("js", "etab-accueil.js");
  return /"resultats",E\.plural\(dc[^\]]*"#ass"\]/.test(a) && /x\[2\]/.test(a) && /\["vie",E\.plural\(g/.test(a);
});

/* ---- v92 : étape 3C2 — Fin d'année, Paramètres ---- */
t("v92 : pages Fin d'année et Paramètres — scripts dans l'ordre, aucun script en ligne, menu complet (plus aucune rubrique dans l'ancienne page), cache v92", () => {
  const f = rd("etab-fin.html"), p = rd("etab-parametres.html");
  return [["fin", "etab-fin"], ["parametres", "etab-parametres"]].every(([k, n]) => {
    const h = k === "fin" ? f : p, j = rd("js", n + ".js");
    return h.indexOf("js/etab-core.js") > 0 && h.indexOf("js/etab-core.js") < h.indexOf("js/" + n + ".js") && !/<script>[\s\S]*?<\/script>/.test(h) && /css\/etab-v86\.css/.test(h) &&
      new RegExp('page:"' + k + '"').test(j) && etabCore.pageOf(k).done === true && etabCore.href(k) === n + ".html" && !/\bcode\b[^"]*"\s*,\s*function/.test(j) && !/loadStudents\("[^"]*\bcode\b/.test(j);
  }) && f.indexOf("js/niveaux.js") > 0 && f.indexOf("js/niveaux.js") < f.indexOf("js/etab-fin.js") && f.indexOf("js/telecharger.js") > 0 && p.indexOf("js/telecharger.js") > 0 &&
    /id="pr"/.test(f) && f.indexOf('id="pr"') > f.indexOf("</main>") && fs.existsSync(path.join(root, "css", "etab-fin.css")) && /css\/etab-fin\.css/.test(f) &&
    etabCore.pages.every((x) => x.done === true) && /VERSION="cm-v(9[2-9]|1[0-9][0-9])"/.test(rd("sw.js"));
});
t("v92 : page Paramètres — nom, code, inscriptions et seuils par les fonctions serveur du chef, aucune écriture directe, journal en lecture seule", () => {
  const j = rd("js", "etab-parametres.js");
  return ["etab_renommer", "etab_nouveau_code", "etab_ouvrir", "etab_seuils", "etab_journal"].every((f) => j.indexOf(f) >= 0) && !/sb\.from\(/.test(j) && !/\.(insert|update|upsert|delete)\(/.test(j) &&
    /E\.call\("etab_seuils"/.test(j) && /E\.call\("etab_nouveau_code"/.test(j) && /confirm\(/.test(j) && /ancien/.test(j) && /E\.setTh\(\)/.test(j) && /E\.reloadMem\(/.test(j) &&
    /min="1" max="19"/.test(j) && /min="10" max="100"/.test(j) && /min="1" max="14"/.test(j) && /E\.download\(/.test(j) && /gestion-v71\.sql/.test(j) && typeof etabCore.setTh === "function";
});
t("v92 : page Fin d'année — décisions écrites dans registry_decisions seulement, rentrée par appliquer_rentree / annuler_rentree, sauvegarde des classes avant le passage", () => {
  const j = rd("js", "etab-fin.js"), writes = j.match(/sb\.from\("([a-z_]+)"\)/g) || [];
  return writes.every((w) => /registry_decisions/.test(w)) && /upsert\(\{student_id:id,year:yr,decision:v\}/.test(j) && /E\.call\("appliquer_rentree"/.test(j) && /E\.call\("annuler_rentree"/.test(j) &&
    j.indexOf("rtaBackup(plan)") > 0 && j.indexOf("rtaBackup(plan)") < j.indexOf('E.call("appliquer_rentree"') && /confirm\(/.test(j) && /rentrees_liste/.test(j) && /rentree-v61\.sql/.test(j) &&
    /nivNext\(/.test(j) && /nivIsLycee\(/.test(j) && /range\(from,from\+999\)/.test(j) && !/range\(0,4999\)/.test(j) && /#decisions|decisions/.test(j) && /rentree/.test(j) && /bulletins/.test(j) && /cm-seuil/.test(j);
});
t("v92 : messages d'erreur du socle — passage déjà appliqué, année ou passage invalide, rien à annuler", () => {
  const c = rd("js", "etab-core.js");
  return ["already_applied", "bad_year", "bad_moves", "nothing"].every((k) => c.indexOf(k + ":") >= 0);
});
t("v92 : calculs de fin d'année dans la page (propositions, décisions confirmées, plan de rentrée, exports) sur des données d'exemple", () => {
  const O = {}; const els = {}; const saved = []; const calls = [];
  const el = (id) => els[id] || (els[id] = { id, innerHTML: "", style: {}, value: "", querySelectorAll: () => [], scrollIntoView() {} });
  const students = [{ id: "a", name: "Ada", class_label: "6e A" }, { id: "b", name: "Bob", class_label: "6e A" }, { id: "d", name: "Dan", class_label: "3e B" }, { id: "x", name: "Xia", class_label: "Atelier" }];
  const dash = [{ student_id: "a", n: 20, a: 1, j: 1, r: 0, recent_a: 0, avg: 14, t1: 14, subj: "Maths", teacher: "M. X" }, { student_id: "b", n: 20, a: 6, j: 0, r: 2, recent_a: 4, avg: 9, t1: 9, subj: "Maths", teacher: "M. X" }, { student_id: "d", n: 20, a: 0, j: 0, r: 0, recent_a: 0, avg: 12, t1: 12, subj: "Maths", teacher: "M. Y" }];
  const dm = [{ student_id: "a", decision: "p" }, { student_id: "d", decision: "p" }, { student_id: "b", decision: "r" }];
  const data = { is_admin: true, mes_etablissements: [{ id: "e1", nom: "CG", role: "admin", code: "ABCD1234" }], etab_membres_liste: [], admin_dashboard: dash, admin_teaching: [], admin_discipline: [], rentrees_liste: [], appliquer_rentree: { ok: true, n: 2 } };
  const q = (rowsOf) => { const o = {}; ["select", "eq", "order", "range", "limit"].forEach((k) => (o[k] = () => o)); o.then = (f, g) => Promise.resolve({ data: rowsOf, error: null }).then(f, g); return o; };
  const sbx = { auth: { getSession: () => Promise.resolve({ data: { session: { user: { email: "c@x" } } } }) }, rpc: (fn, a) => { calls.push([fn, a]); const p = Promise.resolve({ data: data[fn] === undefined ? null : data[fn], error: null }); p.range = () => p; return p; }, from: (tb) => q(tb === "registry_students" ? students : dm) };
  const c = { console, setTimeout: () => 0, Date, Math, JSON, Promise, Array, Object, String, Number, RegExp, Error, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, URL, sb: sbx, location: { hash: "#decisions", href: "https://x/" }, history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} }, navigator: { onLine: true }, confirm: () => true, cmSave: (n, tx, ty, cb) => { saved.push([n, tx]); cb && cb("ok"); }, document: { getElementById: el, addEventListener() {} }, scrollY: 0, scrollTo() {}, print() {} };
  c.window = c; c.addEventListener = () => {}; vm.createContext(c);
  ["js/niveaux.js", "js/etab-core.js", "js/etab-fin.js"].forEach((f) => vm.runInContext(rd(...f.split("/")), c, { filename: f }));
  return new Promise((resolve) => { let n = 0; const go = () => (++n < 40 ? setImmediate(go) : done()); setImmediate(go);
    function done() { try {
      const v = els.view.innerHTML; els.x_ = null;
      els["x-cc"] && els.fsel && (els.fsel.value = "#6e A", els.fsel.onchange());
      els["x-ec"].onclick(); els["x-cc"].onclick();
      const csv = saved[0][1].replace("\ufeff", ""), cls = saved[1][1].replace("\ufeff", "").split("\r\n");
      const okA = /<b>2<\/b><span>passent/.test(v) && /<b>1<\/b><span>redoublent/.test(v) && /<b>3\/4<\/b><span>décisions confirmées/.test(v);
      const okB = /Établissement/.test(csv) && cls[1].indexOf('1;"Ada";14;') === 0 && /"Passe";"Passe"$/.test(cls[1]) && /"À examiner";"Redoublement"$/.test(cls[2]);
      els.view.querySelectorAll = (s) => (s === "[data-vue]" ? ["bul", "dec", "ren"].map((x) => ({ getAttribute: () => x, set onclick(f) { O[x] = f; } })) : []);
      c.Etab.render(); O.ren(); setImmediate(() => setImmediate(() => { setImmediate(() => { try {
        const r = els.view.innerHTML, okC = /<td>3e B<\/td><td>Sortis \d{4}-\d{4}<\/td><td>1<\/td>/.test(r) && /<td>6e A<\/td><td>5e A<\/td><td>1<\/td>/.test(r) && /Niveau non reconnu[^<]*Atelier/.test(r);
        els.rtaapply.onclick(); const ap = calls.filter((x) => x[0] === "appliquer_rentree")[0];
        const bk = saved.filter((x) => /sauvegarde-classes-avant-rentree/.test(x[0]))[0];
        resolve(okA && okB && okC && !!ap && ap[1].p_moves.length === 2 && !!bk && bk[1].indexOf('"Ada";"6e A";"5e A"') > 0 && /Sortis/.test(bk[1]));
      } catch (e) { resolve("ERREUR " + e.message); } }); })); } catch (e) { resolve("ERREUR " + e.message); } } });
});


/* ---- v93 : étape 3C2bis — cartes de codes, listes, transfert, nouveaux codes, effectifs, anciens accès ---- */
/* Faux navigateur pour jouer une page etab-*.js : faux Supabase (appels et écritures notés), DOM minimal, confirmations et téléchargements notés. */
function fauxPage(o) {
  const els = {}, calls = [], writes = [], saved = [], prints = [], confirms = [], nodes = {};
  const mk = (id) => (els[id] = { id, innerHTML: "", style: {}, value: "", textContent: "", scrollIntoView() {}, focus() {}, setSelectionRange() {} });
  ["app", "view", "msg", "pr"].forEach(mk);
  const all = () => els.app.innerHTML + els.view.innerHTML;
  els.view.querySelectorAll = (sel) => {
    const out = [];
    sel.split(",").forEach((one) => {
      const m = /^\[([\w-]+)\]$/.exec(one.trim()); if (!m) return;
      const re = new RegExp("<[a-z]+[^>]*\\s" + m[1] + "(?:=\"[^\"]*\")?[^>]*>", "g"); let x;
      while ((x = re.exec(els.view.innerHTML))) { const tag = x[0]; out.push(nodes[tag] || (nodes[tag] = { getAttribute: (a) => { const r = new RegExp("\\s" + a + '="([^"]*)"').exec(tag); return r ? r[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null; }, hasAttribute: (a) => new RegExp("\\s" + a + "(=|\\s|>)").test(tag) })); }
    });
    return out;
  };
  const qb = (rowsOf, tb) => {
    const b = { _f: [] };
    ["select", "order", "range", "limit"].forEach((k) => (b[k] = () => b));
    b.eq = (c, v) => { b._f.push([c, v]); return b; };
    b.update = (v) => { b._u = v; return b; }; b.insert = (v) => { b._i = v; return b; }; b.upsert = (v) => { b._p = v; return b; }; b.delete = () => { b._d = true; return b; };
    b.then = (f, g) => {
      if (b._u || b._i || b._p || b._d) writes.push({ tb, op: b._u ? "update" : b._i ? "insert" : b._p ? "upsert" : "delete", data: b._u || b._i || b._p || null, where: b._f.slice() });
      const err = (o.failTables && o.failTables[tb]) || null;
      return Promise.resolve({ data: err ? null : (o.tables[tb] === undefined ? [] : o.tables[tb]), error: err }).then(f, g);
    };
    return b;
  };
  const sbx = {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: "u1", email: "chef@x" } } } }), signOut: () => Promise.resolve() },
    rpc: (fn, a) => { calls.push([fn, a]); const p = Promise.resolve({ data: o.rpc[fn] === undefined ? null : o.rpc[fn], error: (o.rpcErr && o.rpcErr[fn]) || null }); p.range = () => p; return p; },
    from: (tb) => qb(null, tb),
  };
  const c = { console, setTimeout: (f) => { setImmediate(f); return 0; }, Date, Math, JSON, Promise, Array, Object, String, Number, RegExp, Error, isNaN, parseInt, parseFloat, Uint8Array,
    encodeURIComponent, decodeURIComponent, URL, sb: sbx, crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 248); return a; } },
    location: { hash: o.hash || "", href: "https://x/etab-classes.html" }, history: { replaceState() {} }, localStorage: { getItem: () => null, setItem() {} }, navigator: { onLine: true },
    confirm: (m) => { confirms.push(m); return o.confirmAnswer !== false; }, cmSave: (n, tx, ty, cb) => { saved.push([n, tx]); cb && cb("ok"); }, cmCopy: (tx, cb) => cb && cb(true),
    QR: o.noQR ? undefined : { svg: (tx) => '<svg data-qr="' + tx + '"></svg>' },
    document: { getElementById: (id) => els[id] || (all().indexOf('id="' + id + '"') >= 0 ? mk(id) : null), addEventListener() {}, createElement: () => ({ style: {} }) },
    scrollY: 0, scrollTo() {}, print() { prints.push(els.pr.innerHTML); } };
  c.window = c; c.addEventListener = () => {}; vm.createContext(c);
  o.scripts.forEach((f) => vm.runInContext(rd(...f.split("/")), c, { filename: f }));
  const settle = (n = 60) => new Promise((r) => { let i = 0; const go = () => (++i < n ? setImmediate(go) : r()); setImmediate(go); });
  const el = (id) => c.document.getElementById(id);
  const act = (a, id) => els.view.querySelectorAll("[data-act]").filter((n) => n.getAttribute("data-act") === a && n.getAttribute("data-id") === id)[0];
  return { c, els, calls, writes, saved, prints, confirms, settle, el, act };
}
const T93 = (() => {
  const iso = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const cls = [{ id: "c1", nom: "6e A", niveau: "6e", archivee: false, enseignants: 1 }, { id: "c2", nom: "5e B", niveau: "5e", archivee: false, enseignants: 0 }];
  const students = () => [
    { id: "s1", name: "Ada", class_label: "6e A", ref: "REF0000001", code: "AAAABBBBCCCC", phone: "", created_at: iso(5), classe_id: "c1" },
    { id: "s2", name: "Bob", class_label: "6e A", ref: "REF0000002", code: "DDDDEEEEFFFF", phone: "", created_at: iso(90), classe_id: "c1" },
    { id: "s3", name: "Cy", class_label: "5e B", ref: "REF0000003", code: "GGGGHHHHJJJJ", phone: "", created_at: iso(2), classe_id: "c2" }];
  const base = { is_admin: true, mes_etablissements: [{ id: "e1", nom: "CG", role: "admin", code: "ABCD1234" }], etab_membres_liste: [], etab_classes_liste: cls, etab_deplacer_eleves: { ok: true, n: 2 } };
  const tables = () => ({ registry_students: students(), registry_log: [{ name: "Dan", class_label: "6e A", created_at: iso(3) }, { name: "Old", class_label: "5e B", created_at: iso(200) }],
    classes: [{ id: "k1", name: "6e A", students: [{ name: "Ada", p: "" }, { name: "Nouveau", p: "06 111 22 33" }], th: {} }, { id: "k2", name: "Vieille", students: [{ name: "Zed" }], th: { ar: 1 } }] });
  const page = (extra) => fauxPage(Object.assign({ scripts: ["js/etab-core.js", "js/etab-classes.js"], rpc: base, tables: tables() }, extra || {}));
  return { page, base, cls, tables };
})();
t("v93 : page Classes — scripts (QR avant la page), zone d'impression, plus aucun lien vers l'ancienne page ; page Enseignants sans lien vers l'ancienne page ; cache v93", () => {
  const h = rd("etab-classes.html"), j = rd("js", "etab-classes.js"), e = rd("js", "etab-enseignants.js");
  return h.indexOf("js/qr.js") > 0 && h.indexOf("js/qr.js") < h.indexOf("js/etab-classes.js") && h.indexOf("js/telecharger.js") > 0 && /id="pr"/.test(h) && h.indexOf('id="pr"') > h.indexOf("</main>") &&
    !/etablissement\.html/.test(j) && !/etablissement\.html/.test(e) && /VERSION="cm-v(9[3-9]|1[0-9][0-9])"/.test(rd("sw.js")) && fs.existsSync(path.join(root, "js", "qr.js")) &&
    !/\bb\.(value|open|files)\b/.test(j);   /* « b » est réaffectée à chaque ligne : une réaction ne doit jamais la relire plus tard */
});
t("v93 : page Classes — cartes QR, listes sans code et confidentielle, transfert par la fonction serveur, nouveaux codes par élève (sur la classe ouverte seulement)", async () => {
  const h = T93.page({ hash: "#c=6e%20A" }); await h.settle();
  const v = h.els.view.innerHTML, ids = ["cards", "ex1", "ex2", "mvall", "rotall", "carch"].every((i) => v.indexOf('id="' + i + '"') > 0);
  h.els.cards.onclick(); await h.settle(5);
  const okCards = h.prints.length === 1 && (h.prints[0].match(/class="card-p"/g) || []).length === 2 && /data-qr="https:\/\/x\/parent\.html\?c=AAAABBBBCCCC"/.test(h.prints[0]) && /AAAA-BBBB-CCCC/.test(h.prints[0]) && !/GGGG/.test(h.prints[0]);
  h.els.ex1.onclick(); h.els.ex2.onclick();
  const l1 = h.saved[0][1].replace("\ufeff", "").split("\r\n"), l2 = h.saved[1][1].replace("\ufeff", "").split("\r\n");
  const okEx = /^liste-enseignants-6e-a\.csv$/.test(h.saved[0][0]) && l1[0] === '"Nom";"Classe";"Réf"' && l1.length === 3 && !/AAAA/.test(h.saved[0][1]) && /^liste-confidentielle-6e-a\.csv$/.test(h.saved[1][0]) && l2[1] === '"Ada";"6e A";"AAAA-BBBB-CCCC";"https://x/parent.html?c=AAAABBBBCCCC"';
  h.els.mvall.onclick(); const sel = (h.els.view.innerHTML.match(/<select id="mvs">[\s\S]*?<\/select>/) || [""])[0];
  const pan = /<option value="5e B">/.test(sel) && /\(sans classe\)/.test(sel) && !/<option value="6e A">/.test(sel);   /* la classe de départ n'est pas proposée */
  h.el("mvs").value = "5e B"; h.els.view.querySelectorAll("[data-mvgo]")[0].onclick(); await h.settle();
  const mvc = h.calls.filter((x) => x[0] === "etab_deplacer_eleves");
  const okMv = mvc.length === 1 && mvc[0][1].p_etab === "e1" && mvc[0][1].p_classe === "5e B" && mvc[0][1].p_ids.join() === "s1,s2" && /perdent/.test(h.confirms.slice(-1)[0]) && !h.writes.some((w) => w.tb === "registry_students");
  h.els.rotall.onclick(); await h.settle();
  const up = h.writes.filter((w) => w.tb === "registry_students" && w.op === "update");
  const okRot = up.length === 2 && up.map((w) => w.where[0][1]).sort().join() === "s1,s2" && up.every((w) => /^[A-Z2-9]{12}$/.test(w.data.code)) && !h.writes.some((w) => w.op === "upsert") && /anciens liens et codes cesseront/.test(h.confirms.slice(-1)[0]);
  return ids && okCards && okEx && pan && okMv && okRot ? true : J({ ids, okCards, okEx, pan, okMv, okRot });
});
t("v93 : page Classes — refus de confirmer = rien d'écrit ; sans QR l'impression est refusée ; effectifs (30 jours, niveaux, départs) et classe d'une liste sans journal des départs", async () => {
  let h = T93.page({ confirmAnswer: false, hash: "#c=6e%20A" }); await h.settle();
  h.els.mvall.onclick(); h.el("mvs").value = "5e B"; h.els.view.querySelectorAll("[data-mvgo]")[0].onclick(); h.els.rotall.onclick(); await h.settle();
  const okRefus = !h.calls.some((x) => x[0] === "etab_deplacer_eleves") && !h.writes.length;
  h = T93.page({ noQR: true, hash: "#c=6e%20A" }); await h.settle(); h.els.cards.onclick(); await h.settle(5);
  const okQr = h.prints.length === 0 && /n’est pas disponible/.test(h.els.msg.textContent);
  h = T93.page(); await h.settle(); const v = h.els.view.innerHTML, eff = v.slice(v.indexOf('id="eff"'));
  const kp = (eff.match(/<b>[^<]*<\/b><span>[^<]*<\/span>/g) || []).map((x) => x.replace(/<\/?b>|<\/?span>/g, " ").replace(/\s+/g, " ").trim());
  const okEff = kp.join("|") === "3 élèves|2 classes|1,5 élèves par classe|+2 ajoutés (30 j)|−1 départs (30 j)" && /Dan/.test(eff) && !/Old/.test(eff) && />6e<\/b>/.test(eff) && />5e<\/b>/.test(eff);
  const okListe = ["cards", "ex1", "ex2", "imp"].every((i) => v.indexOf('id="' + i + '"') > 0);
  h.els.cards.onclick(); await h.settle(5); const okAll = (h.prints[0].match(/class="card-p"/g) || []).length === 3;
  h = T93.page({ failTables: { registry_log: { message: "relation does not exist", code: "42P01" } } }); await h.settle();
  const okLog = /tableau-bord-admin\.sql/.test(h.els.view.innerHTML) && /<b>–<\/b><span>départs/.test(h.els.view.innerHTML);
  return okRefus && okQr && okEff && okListe && okAll && okLog ? true : J({ okRefus, okQr, okEff, kp, okListe, okAll, okLog });
});
t("v93 : page Classes — modifier un élève : le changement de classe passe par la fonction de transfert (accès retirés, journal), le nom seul par une mise à jour directe, classe inconnue confirmée", async () => {
  const run1 = async (name, cls2, extra) => {
    const h = T93.page(extra); await h.settle();
    h.el("qs").value = "ada"; h.el("qs").oninput(); h.act("edit", "s1").onclick();
    h.el("ens1").value = name; h.el("ecs1").value = cls2; h.act("save", "s1").onclick(); await h.settle();
    return { u: h.writes.filter((w) => w.op === "update"), r: h.calls.filter((x) => x[0] === "etab_deplacer_eleves"), c: h.confirms };
  };
  const a = await run1("Ada L.", "6e A"), b = await run1("Ada", "5e B"), c = await run1("Ada L.", "Atelier"), d = await run1("Ada L.", "5e B", { confirmAnswer: false });
  const okA = a.u.length === 1 && J(a.u[0].data) === '{"name":"Ada L."}' && a.r.length === 0;
  const okB = b.u.length === 0 && b.r.length === 1 && b.r[0][1].p_ids.join() === "s1" && b.r[0][1].p_classe === "5e B" && b.c.length === 1;
  const okC = c.c.length === 2 && /n’existe pas encore/.test(c.c[0]) && c.u.length === 1 && c.r.length === 1 && c.r[0][1].p_classe === "Atelier";
  const okD = d.u.length === 0 && d.r.length === 0;
  return okA && okB && okC && okD ? true : J({ okA, okB, okC, okD });
});
t("v93 : page Classes — reprendre mes classes existantes (classes archivées et élèves déjà présents ignorés, codes aléatoires)", async () => {
  const h = T93.page(); await h.settle(); h.els.imp.onclick(); await h.settle();
  const ins = h.writes.filter((w) => w.op === "insert");
  return ins.length === 1 && ins[0].data.length === 1 && ins[0].data[0].name === "Nouveau" && ins[0].data[0].class_label === "6e A" && ins[0].data[0].phone === "06 111 22 33" && ins[0].data[0].etab_id === "e1" && ins[0].data[0].code.length === 12 && ins[0].data[0].ref.length === 10 ? true : J(ins);
});
t("v93 : page Enseignants — anciens accès : liste (sans ceux des nouvelles affectations), ajout, retrait, messages d'erreur, retrait « tout » signalé pour les élèves sans classe", async () => {
  const cl = [{ id: "c1", nom: "6e A", archivee: false }, { id: "c2", nom: "5e B", archivee: false }];
  const mem = [{ user_id: "t1", email: "marie@x.cg", nom: "Marie", role: "enseignant", statut: "actif" }, { user_id: "t2", email: "paul@x.cg", nom: "Paul", role: "enseignant", statut: "actif" }];
  const aff = [{ user_id: "t1", email: "marie@x.cg", nom: "Marie", classe_id: "c1", classe: "6e A", matiere_id: null, matiere: null, origine: "chef" }];
  const old = [{ email: "marie@x.cg", class_label: "6e A", n: 30 }, { email: "paul@x.cg", class_label: "5e B", n: 28 }, { email: "paul@x.cg", class_label: "", n: 2 }];
  const mkE = (x, r) => fauxPage(Object.assign({ scripts: ["js/etab-core.js", "js/etab-enseignants.js"], tables: {}, rpc: Object.assign({ is_admin: true, mes_etablissements: [{ id: "e1", nom: "CG", role: "admin", code: "X" }], etab_membres_liste: mem, etab_affectations_liste: aff, etab_classes_liste: cl, etab_matieres_liste: [], admin_assignments: old, admin_assign: 3, admin_unassign: 28 }, r || {}) }, x || {}));
  let h = mkE(); await h.settle();
  const v = h.els.view.innerHTML, o = v.slice(v.indexOf('id="oldacc"'));
  const okListe = (o.match(/data-oun=/g) || []).length === 2 && !/marie@x\.cg<\/b><br><span class="sub">6e A/.test(o) && /paul@x\.cg<\/b><br><span class="sub">5e B/.test(o) && /Retirer tout/.test(o) && !/etablissement\.html/.test(v);
  const un = h.els.view.querySelectorAll("[data-oun]"); un[0].onclick(); await h.settle();
  const r1 = h.calls.filter((x) => x[0] === "admin_unassign"); const okUn = r1.length === 1 && J(r1[0][1]) === '{"p_etab":"e1","p_email":"paul@x.cg","p_class":"5e B"}' && /Retirer paul@x\.cg de 5e B/.test(h.confirms.slice(-1)[0]);
  h = mkE(); await h.settle(); h.els.view.querySelectorAll("[data-oun]")[1].onclick(); await h.settle();
  const okTout = /TOUS les anciens accès/.test(h.confirms.slice(-1)[0]) && h.calls.some((x) => x[0] === "admin_unassign" && x[1].p_class === "");
  h = mkE(); await h.settle(); h.el("oe").value = "paul@x.cg"; h.el("oc").value = "6e A"; h.el("oadd").onclick(); await h.settle();
  const okAdd = J(h.calls.filter((x) => x[0] === "admin_assign")[0][1]) === '{"p_etab":"e1","p_email":"paul@x.cg","p_class":"6e A"}' && /3 élèves affectés à paul@x\.cg/.test(h.els.msg.textContent);
  h.el("oe").value = "pas-un-mail"; h.el("oadd").onclick(); await h.settle(5); const okMail = /Entrez l’e-mail/.test(h.els.msg.textContent);
  const msg = async (m) => { const g = mkE({}, {}); g.c.sb.rpc = ((f) => (fn, a) => (fn === "admin_assign" ? Object.assign(Promise.resolve({ data: null, error: { message: m } }), { range() { return this; } }) : f(fn, a)))(g.c.sb.rpc); await g.settle(); g.el("oe").value = "x@y.cg"; g.el("oadd").onclick(); await g.settle(); return g.els.msg.textContent; };
  const okErr = /doit d’abord créer son compte/.test(await msg("unknown teacher")) && /pas encore rejoint votre établissement/.test(await msg("not member"));
  h = mkE({}, { admin_assign: 0 }); await h.settle(); h.el("oe").value = "paul@x.cg"; h.el("oadd").onclick(); await h.settle(); const okZero = /Aucun nouvel élève/.test(h.els.msg.textContent);
  h = mkE({ rpcErr: { admin_assignments: { message: "does not exist", code: "42883" } } }); await h.settle(); const okAbs = /Aucun ancien accès/.test(h.els.view.innerHTML);
  return okListe && okUn && okTout && okAdd && okMail && okErr && okZero && okAbs ? true : J({ okListe, okUn, okTout, okAdd, okMail, okErr, okZero, okAbs });
});
t("v93 : socle — E.call transmet un nombre (même 0) et laisse la page écrire son message d'erreur", () => {
  const c = rd("js", "etab-core.js");
  return /function call\(fn,args,ok,bad\)/.test(c) && /bad&&bad\(r\.error\)===true/.test(c) && /ok\(d===null\|\|d===undefined\?\{\}:d\)/.test(c) && !/var d=r\.data\|\|\{\}/.test(c) && (c.match(/^var \w+/gm) || []).length === 1;
});

run("D=JSON.parse(" + JSON.stringify(D0) + ")");

/* ---- v99 : consultation hors ligne des pages de l'établissement ---- */
const T99 = (o = {}) => {
  const db = new Map(), mem = { "appel-supabase-auth": JSON.stringify({ user: { id: "u1" }, expires_at: 9e9 }) }, net = { down: false, status: 200, body: "[]", n: 0 };
  const later = (f) => setImmediate(f);
  const idb = { deleteDatabase: () => db.clear(), open: () => { const q = {}; later(() => { q.result = { close() {}, createObjectStore() {}, transaction: () => { const tx = {};
    tx.objectStore = () => ({ get: (k) => ({ result: db.get(k) }), put: (v, k) => { db.set(k, v); return {}; }, clear: () => { db.clear(); return {}; } }); later(() => tx.oncomplete()); return tx; } }; q.onsuccess(); }); return q; } };
  const c = { console, setTimeout: () => 0, clearTimeout() {}, Date, JSON, Promise, Array, String, TypeError, Response, indexedDB: idb, navigator: { onLine: true }, SUPABASE_KEY: "anon",
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    fetch: () => { net.n++; return net.down ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve(new Response(net.body, { status: net.status })); } };
  vm.createContext(c); vm.runInContext(rd("js", "etab-offline.js"), c);
  const O = c.EtabOffline; if (o.on !== false) O.enable();
  const call = (p, method = "GET", auth = "Bearer jeton") => O.fetch("https://x/rest/v1/" + p, { method, headers: { Authorization: auth } }).then((r) => r.text().then((t) => ({ status: r.status, t })), () => ({ err: true }));
  return { O, db, mem, net, call };
};
t("v99 : désactivée par défaut, rien n'est enregistré", async () => { const h = T99({ on: false }); await h.call("registry_students?select=id"); return !h.O.enabled() && h.db.size === 0; });
t("v99 : codes famille, téléphones et code des enseignants jamais enregistrés ; la page en ligne les reçoit toujours", async () => {
  const h = T99(); h.net.body = '[{"id":"s1","name":"Ada","code":"SECRET","phone":"061234567"}]';
  const a = await h.call("registry_students?select=id,code"); h.net.body = '[{"id":"e1","role":"admin","code":"ENSCODE"}]'; await h.call("rpc/mes_etablissements", "POST");
  const kept = [...h.db.values()].map((v) => v.body).join();
  return /SECRET/.test(a.t) && h.db.size === 2 && /Ada/.test(kept) && !/SECRET|061234567|ENSCODE/.test(kept) ? true : kept;
});
t("v99 : sans réseau, la dernière copie est rendue ; sans copie, l'erreur reste une erreur ; panne du serveur : copie aussi", async () => {
  const h = T99(); h.net.body = '[1]'; await h.call("rpc/admin_dashboard", "POST"); h.net.down = true;
  const a = await h.call("rpc/admin_dashboard", "POST"), b = await h.call("rpc/admin_teaching", "POST"); h.net.down = false; h.net.status = 503; const c = await h.call("rpc/admin_dashboard", "POST");
  return a.t === "[1]" && b.err && c.t === "[1]" && h.O.used && h.O.missing ? true : J({ a, b, c });
});
t("v99 : refus du serveur (401, 403) : jamais de copie ; réponse sans session : ni enregistrée ni crue", async () => {
  const h = T99(); h.net.body = '[1]'; await h.call("rpc/admin_dashboard", "POST"); h.net.status = 403; h.net.body = '{"e":1}'; const a = await h.call("rpc/admin_dashboard", "POST");
  h.net.status = 200; h.net.body = "false"; const b = await h.call("rpc/admin_dashboard", "POST", "Bearer anon"); const c = await h.call("rpc/admin_teaching", "POST", "Bearer anon");
  return a.status === 403 && b.t === "[1]" && c.t === "false" && h.db.size === 1 ? true : J({ a, b, c });
});
t("v99 : accès retiré ou désactivation : tout est effacé", async () => {
  const h = T99(); await h.call("rpc/admin_dashboard", "POST"); h.net.body = "false"; await h.call("rpc/is_admin", "POST"); const a = h.db.size;
  h.net.body = "[]"; await h.call("rpc/admin_dashboard", "POST"); await h.call("rpc/mes_etablissements", "POST"); const b = h.db.size;
  await h.call("rpc/admin_dashboard", "POST"); await h.O.disable(); return a === 0 && b === 0 && h.db.size === 0 && !h.O.enabled() ? true : J({ a, b });
});
t("v99 : les écritures ne sont ni enregistrées ni rejouées ; un autre compte ne lit pas les copies", async () => {
  const h = T99(); await h.call("registry_students", "POST"); await h.call("rpc/etab_renommer", "POST"); await h.call("registry_students?id=eq.1", "DELETE"); const a = h.db.size;
  await h.call("rpc/admin_dashboard", "POST"); h.net.down = true; const w = await h.call("rpc/etab_renommer", "POST");
  h.mem["appel-supabase-auth"] = JSON.stringify({ user: { id: "u2" } }); h.O.enable(); const b = await h.call("rpc/admin_dashboard", "POST");
  return a === 0 && w.err && b.err ? true : J({ a, w, b });
});
t("v99 : la déconnexion efface les copies depuis n'importe quelle page (js/supabase.js)", () => { const s = rd("js", "supabase.js"); return /sb\.auth\.signOut=function\(\)\{cmEffacerHorsLigne\(\)/.test(s) && /"SIGNED_OUT"\)cmEffacerHorsLigne/.test(s) && /deleteDatabase\("cm-etab-offline"\)/.test(s); });

/* ---- Relevé « Cahier de relevé de notes » — étape 1 : cadre A4 paysage ---- */
function setupCahier(n) {
  run('ME={id:"u1",name:"Prof",school:"CG de Nsou"};GUEST=false;bp=null;brs=null;' +
    'D={cur:"c1",classes:[{id:"c1",name:"6e B",subj:"Français",students:[],records:{},ev:[]}]};' +
    'var __n=' + n + ',__noms=["Zoé Ada","Émile Bo","Abel Cé","Ève Dia","Élodie Eba"];for(var i=0;i<__n;i++)D.classes[0].students.push({id:"s"+i,name:i<5?__noms[i]:"Élève "+("0"+i).slice(-2)});');
}
t("cahier étape 1 : PDF valide en A4 paysage (842 x 595)", () => {
  setupCahier(3);
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  return b.startsWith("%PDF-") && b.trimEnd().endsWith("%%EOF") && /MediaBox \[0 0 842 595\]/.test(b) && !/MediaBox \[0 0 595 842\]/.test(b) ? true : "format";
});
t("cahier étape 1 : titre, informations et colonnes N°, Nom et prénom, Moyenne, Observations", () => {
  setupCahier(3);
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  return /\(RELEV. DE NOTES\) Tj/.test(b) && !/CAHIER/.test(b) && /Classe : 6e B/.test(b) && /Mati.re : Fran.ais/.test(b) && /Effectif : 3/.test(b) && /Ann.e scolaire : 20\d\d-20\d\d/.test(b) &&
    /\(N.\) Tj/.test(b) && /\(Nom et pr.nom\) Tj/.test(b) && /\(Moyenne\) Tj/.test(b) && /\(Observations\) Tj/.test(b) ? true : "texte";
});
t("cahier étape 1 : élèves numérotés dans l'ordre alphabétique (accents ignorés)", () => {
  setupCahier(5);
  const r = run("rcEleves(D.classes[0]).map(function(s){return s.name;})");
  return J(r) === J(["Abel Cé", "Élodie Eba", "Émile Bo", "Ève Dia", "Zoé Ada"]) ? true : J(r);
});
t("cahier étape 1 : le numéro de chaque ligne suit l'ordre alphabétique", () => {
  setupCahier(5);
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  const i = n => b.indexOf("(" + n + ") Tj");
  return b.indexOf("(Abel C") > 0 && b.indexOf("(Abel C") < b.indexOf("(Zo") && /\(1\) Tj/.test(b) && /\(5\) Tj/.test(b) && !/\(6\) Tj/.test(b) ? true : "numéros";
});
t("cahier étape 1 : beaucoup d'élèves → plusieurs pages, en-tête répété, numérotation continue", () => {
  setupCahier(50);
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  const pages = (b.match(/\/Type \/Page /g) || []).length, titres = (b.match(/\(RELEV. DE NOTES\) Tj/g) || []).length, cols = (b.match(/\(Observations\) Tj/g) || []).length;
  return pages >= 3 && titres === pages && cols === pages && /\(50\) Tj/.test(b) && new RegExp("Page " + pages + " / " + pages).test(b) ? true : J({ pages, titres, cols });
});
t("cahier étape 1 : une classe vide donne quand même un PDF valide", () => {
  setupCahier(0);
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  return b.startsWith("%PDF-") && (b.match(/\/Type \/Page /g) || []).length === 1 ? true : "vide";
});
t("cahier étape 1 : le relevé portrait existant reste en A4 portrait", () => {
  setupCahier(3);
  const b = pdfText(run("relevePDF(D.classes[0],1)"));
  return /MediaBox \[0 0 595 842\]/.test(b) ? true : "portrait";
});
t("cahier étape 1 : le menu du relevé propose le cahier, le script est chargé et mis en cache", () => {
  setupCahier(3);
  const h = run("bulletinsCard(D.classes[0])");
  return /value="k:"/.test(h) && /Relev. de notes en paysage/.test(h) && !/Cahier(?! vierge)/.test(h) && /releve-cahier\.js/.test(rd("index.html")) && /releve-cahier\.js/.test(rd("sw.js")) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) ? true : "menu";
});

/* ---- Cahier de relevé de notes — étape 2 : une colonne de devoir ---- */
t("cahier étape 2 : la colonne de devoir est placée avant Moyenne et ne porte que son titre (ni date ni « sur 20 »)", () => {
  setupRel();
  const cols = run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).map(function(k){return k.k;})");
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return J(cols) === J(["n", "nom", "dev", "dev", "moy", "obs"]) && /\(Devoir 1\) Tj/.test(b) && !/\(sur \d+\) Tj/.test(b) && !/\(5 oct\.\) Tj/.test(b) && b.indexOf("(Devoir 1) Tj") < b.indexOf("(Moyenne) Tj") ? true : J(cols);
});
t("cahier étape 2 : les notes déjà saisies apparaissent, un élève sans note reste vide", () => {
  setupRel();
  run('D.classes[0].ev[0].s={a:15,b:8.5};');
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  return /\(15\) Tj/.test(b) && /\(8,5\) Tj/.test(b) && (b.match(/\(15\) Tj/g) || []).length === 1 ? true : "notes";
});
t("cahier étape 2 : sans aucune note saisie, pas de colonne de devoir", () => {
  setupRel();
  run('D.classes[0].ev.forEach(function(e){e.s={};});');
  return J(run("rcCols(D.classes[0],rcDevoirs(D.classes[0])).map(function(k){return k.k;})")) === J(["n", "nom", "moy", "obs"]) ? true : "colonnes";
});
t("cahier étape 2 : la largeur totale des colonnes est celle du tableau (pas de débordement)", () => {
  setupRel();
  return run("rcCols(D.classes[0],rcDevoirs(D.classes[0])).reduce(function(a,k){return a+k.w;},0)") === 782 ? true : "largeur";
});
t("cahier étape 2 : devoir sur 10, titre long coupé, plusieurs pages gardent la colonne et l'en-tête", () => {
  setupCahier(50);
  run('D.classes[0].ev=[{id:"e9",t:"Composition de fin de trimestre",d:"2026-11-09",m:10,s:{s1:7,s2:9}}];');
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  const pages = (b.match(/\/Type \/Page /g) || []).length;
  return pages >= 3 && (b.match(/\(Composi/g) || []).length === pages && !/\(sur 10\) Tj/.test(b) && !/Composition de fin/.test(b) ? true : J({ pages });
});

/* ---- Cahier de relevé de notes — étapes 3 et 4 : un devoir = une colonne, largeurs, 8 devoirs et plus ---- */
function setupCahierN(nd, ns, tr) {
  setupCahier(ns || 3);
  run('var __e=[];for(var i=0;i<' + nd + ';i++){var __s={};D.classes[0].students.forEach(function(s,j){if(j%5)__s[s.id]=(i+j)%21;});__e.push({id:"d"+i,t:"Devoir "+(i+1),d:"' + (tr === 2 ? "2027-01-" : "2026-10-") + '"+("0"+(i+1)).slice(-2),m:20,s:__s});}D.classes[0].ev=__e;');
}
const kinds = "rcCols(D.classes[0],rcDevoirs(D.classes[0],P)).map(function(k){return k.k;}).join()";
t("cahier étape 3 : 1 devoir saisi donne 1 colonne, 2 devoirs donnent 2, 3 donnent 3", () => {
  const r = [1, 2, 3].map(n => { setupCahierN(n); return run(kinds.replace("P", "1")); });
  return J(r) === J(["n,nom,dev,moy,obs", "n,nom,dev,dev,moy,obs", "n,nom,dev,dev,dev,moy,obs"]) ? true : J(r);
});
t("cahier étape 3 : les devoirs sans aucune note ne donnent pas de colonne", () => {
  setupCahierN(3); run('D.classes[0].ev[1].s={};');
  return run("rcDevoirs(D.classes[0],1).map(function(e){return e.id;}).join()") === "d0,d2" ? true : "vides";
});
t("cahier étape 3 : seuls les devoirs de la période choisie apparaissent, du plus ancien au plus récent", () => {
  setupCahierN(3);
  run('D.classes[0].ev.push({id:"x",t:"Devoir T2",d:"2027-01-12",m:20,s:{s1:12}});D.classes[0].ev.reverse();');
  const t1 = run("rcDevoirs(D.classes[0],1).map(function(e){return e.id;}).join()"), t2 = run("rcDevoirs(D.classes[0],2).map(function(e){return e.id;}).join()"), tout = run("rcDevoirs(D.classes[0],'').length");
  return t1 === "d0,d1,d2" && t2 === "x" && tout === 4 ? true : J({ t1, t2, tout });
});
t("cahier étape 3 : le PDF d'un trimestre porte la période, ses devoirs et pas ceux d'un autre trimestre", () => {
  setupCahierN(2);
  run('D.classes[0].ev.push({id:"x",t:"Devoir T2",d:"2027-01-12",m:20,s:{s1:12}});');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /P.riode : Trimestre 1/.test(b) && /\(Devoir 1\) Tj/.test(b) && /\(Devoir 2\) Tj/.test(b) && !/Devoir T2/.test(b) ? true : "période";
});
t("cahier étape 4 : les largeurs se resserrent mais la somme reste 782 pt, pour 0 à 8 devoirs", () => {
  const r = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => { setupCahierN(n); return run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).reduce(function(a,k){return a+k.w;},0)"); });
  return r.every(x => x === 782) ? true : J(r);
});
t("cahier étape 4 : Observations garde au moins 150 pt avec 8 devoirs, et 408 pt avec 1 devoir", () => {
  setupCahierN(8); const a = run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).pop().w");
  setupCahierN(1); const b = run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).pop().w");
  return a >= 150 && b === 408 ? true : J({ a, b });
});
t("cahier étape 4 : une colonne de devoir n'est jamais plus étroite que 39 pt ni plus large que 60 pt", () => {
  const r = [1, 2, 4, 6, 8].map(n => run("rcDevW(" + n + ")"));
  return r.every(w => w >= 39 && w <= 60) && r[0] === 60 && r[4] === 39 ? true : J(r);
});
t("cahier étape 4 : 10 devoirs → 2 feuillets (8 + 2) avec les mêmes élèves et numéros, pages numérotées de 1 à n", () => {
  setupCahierN(10, 25);
  const F = run("rcFeuillets(rcDevoirs(D.classes[0],1)).map(function(f){return f.length;})");
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  const pages = (b.match(/\/Type \/Page /g) || []).length;
  return J(F) === J([8, 2]) && pages === 4 && /Feuillet 1 \/ 2/.test(b) && /Feuillet 2 \/ 2/.test(b) && new RegExp("Page 4 / 4").test(b) && (b.match(/\(25\) Tj/g) || []).length === 2 ? true : J({ F, pages });
});
t("cahier étape 4 : 8 devoirs tiennent sur un seul feuillet, sans mention « Feuillet »", () => {
  setupCahierN(8, 10);
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return !/Feuillet/.test(b) && (b.match(/\(Devoir \d\) Tj/g) || []).length === 8 ? true : "8";
});
t("cahier étape 4 : les titres longs sont coupés selon la largeur de la colonne", () => {
  setupCahierN(8, 3); run('D.classes[0].ev[0].t="Composition de fin de trimestre";');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return !/Composition de fin/.test(b) && /\(Compo/.test(b) && run("rcMaxCh(39)") === 10 ? true : "coupe";
});
t("cahier étape 3 : le menu propose chaque trimestre et « toutes les évaluations », le bouton lit la période", () => {
  setupRel();
  const h = run("bulletinsCard(D.classes[0])"), j = rd("js", "bulletins.js");
  return /value="k:1"/.test(h) && /value="k:2"/.test(h) && /value="k:3"/.test(h) && /value="k:"/.test(h) && /releveCahierPDF\(c,kp(,ko)?\)/.test(j) ? true : "menu";
});

/* ---- Relevé de notes paysage : établissement et enseignant(e) ; étape 5 : type Devoir / Composition ---- */
t("relevé paysage : le nom de l'établissement et celui de l'enseignant(e) figurent dans l'en-tête", () => {
  setupCahier(3);
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  return /\(.tablissement : CG de Nsou +Enseignant.{1,3}e.{1,3} : Prof\) Tj/.test(b) ? true : "entête";
});
t("relevé paysage : établissement ou enseignant(e) manquant → ligne à remplir à la main", () => {
  setupCahier(3); run('ME={id:"u1",name:"",school:""};');
  const b = pdfText(run("releveCahierPDF(D.classes[0])"));
  return /Enseignant.{1,3}e.{1,3} : _{10,}/.test(b) && /.tablissement : _{10,}/.test(b) ? true : "blanc";
});
t("relevé paysage : l'en-tête reste sur chaque page et les noms ne chevauchent pas le tableau", () => {
  setupCahier(60);
  const b = pdfText(run("releveCahierPDF(D.classes[0])")), pages = (b.match(/\/Type \/Page /g) || []).length;
  return (b.match(/Enseignant.{1,3}e.{1,3} : Prof/g) || []).length === pages && pages >= 3 ? true : J({ pages });
});
t("relevé paysage : aucune trace de l'ancien nom « Cahier de relevé de notes » dans le menu ni les noms de fichier", () => {
  const j = rd("js", "bulletins.js"), r = rd("js", "releve-cahier.js");
  return !/Cahier ·|cahier-releve|Cahier de relev/.test(j) && !/CAHIER DE/.test(r) && /releve-paysage-/.test(j) ? true : "ancien nom";
});
t("étape 5 : une évaluation existante (sans type) est un devoir ; ty:\"c\" est une composition", () => {
  setupRel();
  return run("evIsComp(D.classes[0].ev[0])") === false && run("evTyName(D.classes[0].ev[0])") === "Devoir" && run('evIsComp({ty:"c"})') === true && run('evTyName({ty:"c"})') === "Composition" ? true : "type";
});
t("étape 5 : la création d'une évaluation propose Devoir ou Composition (OK = composition) et ne change rien aux anciennes", () => {
  const e = rd("js", "events.js");
  return /confirm\("Cette évaluation est-elle une composition/.test(e) && /if\(comp\)ne\.ty="c"/.test(e) && /k:1,s:\{\}\}/.test(e) ? true : "création";
});
t("étape 5 : l'écran d'une évaluation a un choix Type ; il est modifiable et un devoir n'écrit aucun champ", () => {
  setupRel(); run('evid="e1";D.classes[0].ev[1].ty="c";');
  const h1 = run("renderEval()"), e = rd("js", "events.js");
  run('evid="e2";'); const h2 = run("renderEval()");
  return /id="evty"/.test(h1) && !/<option value="c" selected>/.test(h1) && /<option value="c" selected>/.test(h2) && /ev\.ty="c";else delete ev\.ty/.test(e) ? true : "écran";
});
t("étape 5 : la liste des évaluations signale une composition et pas un devoir", () => {
  setupRel(); run('D.classes[0].ev[1].ty="c";ntr="";');
  const h = run("notesCore()"), n = (h.match(/ · Composition/g) || []).length;
  return n === 1 && /Dict.e <small>[^<]*Composition/.test(h) ? true : J({ n });
});

/* ---- Relevé de notes paysage : colonnes Moyenne et Observations remplies ---- */
t("relevé paysage : Moyenne /20 de chaque élève sur la période, avec coefficients", () => {
  setupRel(); run('D.classes[0].ev[0].k=2;D.classes[0].ev[1].d="2026-10-20";');
  /* Awa : (15/20*20*2 + 9/10*20*1) / 3 = (30+18)/3 = 16 ; Paul : (8*2 + 4/10*20) / 3 = (16+8)/3 = 8 */
  const m = run("rcMoyennes(D.classes[0],D.classes[0].students,1)");
  return Math.abs(m.a - 16) < 1e-9 && Math.abs(m.b - 8) < 1e-9 ? true : J(m);
});
t("relevé paysage : un élève sans aucune note a une moyenne vide et pas d'observation", () => {
  setupRel();
  const m = run("rcMoyennes(D.classes[0],D.classes[0].students,1)");
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return m.c !== null && run("rcMoyennes({students:[{id:'z'}],ev:[]},[{id:'z'}],1).z") === null ? true : "vide";
});
t("relevé paysage : la moyenne et l'appréciation s'impriment (Très bien / Assez bien…)", () => {
  setupRel(); run('D.classes[0].ev[0].s={a:17,b:12,c:6};D.classes[0].ev[1].s={};');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /\(17\) Tj/.test(b) && /\(12\) Tj/.test(b) && /\(6\) Tj/.test(b) && /\(Tr.s bien\) Tj/.test(b) && /\(Assez bien\) Tj/.test(b) && /\(Faible\) Tj/.test(b) ? true : "obs";
});
t("relevé paysage : l'appréciation d'une période n'utilise que les notes de cette période", () => {
  setupRel(); run('D.classes[0].ev[0].s={a:18};D.classes[0].ev[1].s={};D.classes[0].ev.push({id:"x",t:"T2",d:"2027-01-12",m:20,s:{a:4}});');
  const b1 = pdfText(run("releveCahierPDF(D.classes[0],1)")), b2 = pdfText(run("releveCahierPDF(D.classes[0],2)"));
  return /\(Tr.s bien\) Tj/.test(b1) && /\(Mauvais\) Tj/.test(b2) && !/\(Mauvais\) Tj/.test(b1) ? true : "période";
});
t("relevé paysage : sur plusieurs feuillets, Moyenne et Observations sont répétées avec les mêmes valeurs", () => {
  setupCahierN(10, 5);
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  const n = (b.match(/\(Moyenne\) Tj/g) || []).length;
  return n === 2 && /Feuillet 2 \/ 2/.test(b) ? true : J({ n });
});

/* ---- Relevé de notes paysage — étape 6 : colonnes de compositions ---- */
function setupComp() {
  setupRel();
  run('D.classes[0].ev=[{id:"c1",t:"Compo 1",d:"2026-10-02",m:20,ty:"c",s:{a:14,b:9}},{id:"d1",t:"Devoir 1",d:"2026-10-20",m:20,s:{a:15,b:8}},{id:"d2",t:"Devoir 2",d:"2026-10-05",m:20,s:{a:12}},{id:"c2",t:"Compo 2",d:"2026-12-01",m:20,ty:"c",s:{a:11}}];');
}
t("étape 6 : les compositions sont placées après les devoirs, même si elles sont plus anciennes", () => {
  setupComp();
  const r = run("rcDevoirs(D.classes[0],1).map(function(e){return e.id;}).join()");
  return r === "d2,d1,c1,c2" ? true : r;
});
t("étape 6 : les colonnes de composition sont repérées et suivent les devoirs avant Moyenne", () => {
  setupComp();
  const r = run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).map(function(k){return k.k+(k.comp?'*':'');}).join()");
  return r === "n,nom,dev,dev,dev*,dev*,moy,obs" ? true : r;
});
t("étape 6 : sans composition saisie, aucune colonne de composition (pas de colonne vide)", () => {
  setupComp(); run('D.classes[0].ev=D.classes[0].ev.filter(function(e){return e.ty!=="c";});');
  const r = run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).filter(function(k){return k.comp;}).length");
  return r === 0 && run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)).length") === 6 ? true : r;
});
t("étape 6 : une composition sans aucune note ne donne pas de colonne", () => {
  setupComp(); run('D.classes[0].ev[3].s={};');
  return run("rcDevoirs(D.classes[0],1).map(function(e){return e.id;}).join()") === "d2,d1,c1" ? true : "vide";
});
t("étape 6 : le PDF imprime devoirs puis compositions, et une composition est teintée dans l'en-tête", () => {
  setupComp();
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  const i = x => b.indexOf("(" + x + ") Tj");
  return i("Devoir 2") < i("Devoir 1") && i("Devoir 1") < i("Compo 1") && i("Compo 1") < i("Compo 2") && i("Compo 2") < i("Moyenne") && b.indexOf("0.82 0.87 0.95 rg") > 0 ? true : "ordre";
});
t("étape 6 : sans composition, aucune teinte de composition dans le PDF", () => {
  setupRel();
  return !/0\.82 0\.87 0\.95 rg/.test(pdfText(run("releveCahierPDF(D.classes[0],1)"))) ? true : "teinte";
});
t("étape 6 : devoirs et compositions se partagent les feuillets par paquets de 8, compositions en dernier", () => {
  setupCahierN(8, 5);
  run('D.classes[0].ev.push({id:"k1",t:"Compo",d:"2026-09-02",m:20,ty:"c",s:{s1:11}});');
  const F = run("rcFeuillets(rcDevoirs(D.classes[0],1)).map(function(f){return f.map(function(e){return e.id;}).join('|');})");
  return F.length === 2 && F[1] === "k1" && !/k1/.test(F[0]) ? true : J(F);
});
t("étape 6 : la moyenne tient compte des compositions comme des devoirs", () => {
  setupComp(); run('D.classes[0].ev.forEach(function(e){e.k=1;});');
  const m = run("rcMoyennes(D.classes[0],D.classes[0].students,1)");
  return Math.abs(m.a - (14 + 15 + 12 + 11) / 4) < 1e-9 ? true : J(m);
});

t("étape 6 : « Composition 1 » et « Composition 2 » restent distinguables dans l'en-tête (titre entier, police réduite)", () => {
  setupComp(); run('D.classes[0].ev[0].t="Composition 1";D.classes[0].ev[3].t="Composition 2";');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /\(Composition 1\) Tj/.test(b) && /\(Composition 2\) Tj/.test(b) && run("rcTitSz(60,'Composition 1')") < 8.5 && run("rcTitSz(60,'Devoir 1')") === 8.5 ? true : "titres";
});
t("étape 6 : un titre trop long pour sa colonne est coupé, la police ne descend pas sous 6,5 pt", () => {
  return run("rcTitSz(39,'Composition de fin')") === 6.5 && run("rcMaxCh(39)") === 10 ? true : "min";
});

Promise.all(pending).then(() => {
  console.log(`\n${ok} tests réussis, ${ko} en échec.`);
  process.exit(ko ? 1 : 0);
});
/* ---- v95 : étape 4 — filtres classe / matière / enseignant sur Résultats et assiduité ---- */
const T95 = (() => {
  const d = (student_id, class_label, subj, teacher, o) => Object.assign({ student_id, class_label, subj, teacher, n: 10, a: 0, j: 0, r: 0, recent_a: 0, avg: null, t1: null, t2: null, t3: null, hw_n: 0, updated_at: new Date().toISOString() }, o);
  const dash = [d("s1", "6e A", "Maths", "Marie", { avg: 14, a: 2, j: 1, r: 1 }), d("s2", "6e A", "Maths", "Marie", { avg: 8, a: 4, recent_a: 4 }), d("s1", "6e A", "Français", "Paul", { avg: 12 }), d("s3", "5e B", "Maths", "Paul", { avg: 16 })];
  const page = (extra) => fauxPage(Object.assign({ scripts: ["js/etab-core.js", "js/etab-resultats.js"], rpc: Object.assign({}, T93.base, { admin_dashboard: dash }), tables: T93.tables() }, extra || {}));
  const kp = (h) => (h.els.view.innerHTML.match(/<b>[^<]*<\/b><span>[^<]*<\/span>/g) || []).map((x) => x.replace(/<\/?b>|<\/?span>/g, " ").replace(/\s+/g, " ").trim());
  const pick = (h, id, v) => { h.el(id).value = v; h.el(id).onchange(); };
  return { page, kp, pick, dash };
})();
t("v95 : page Résultats — trois filtres (classe, matière, enseignant) avec leurs valeurs, aucun filtre au départ, lecture seule", async () => {
  const h = T95.page(); await h.settle();
  const v = h.els.view.innerHTML, opt = (id) => ((v.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>')) || ["", ""])[1].match(/<option value="([^"]*)"/g) || []).map((x) => x.slice(15, -1)).join("|");
  return opt("rf-c") === "|6e A|5e B" && opt("rf-s") === "|Français|Maths" && opt("rf-t") === "|Marie|Paul" && !/id="rf-x"/.test(v) && !/id="rf-note"/.test(v) && h.writes.length === 0 ? true : J({ c: opt("rf-c"), s: opt("rf-s"), t: opt("rf-t"), x: /id="rf-x"/.test(v), w: h.writes });
});
t("v95 : page Résultats — filtrer par classe, matière ou enseignant recalcule les moyennes ; les filtres se combinent ; « Effacer » les retire ; combinaison vide signalée", async () => {
  const h = T95.page(); await h.settle();
  const all = T95.kp(h);
  T95.pick(h, "rf-c", "6e A"); const c = T95.kp(h), noteC = /Filtres : 6e A\./.test(h.els.view.innerHTML);
  T95.pick(h, "rf-s", "Français"); const cs = T95.kp(h);
  T95.pick(h, "rf-s", ""); T95.pick(h, "rf-c", ""); T95.pick(h, "rf-t", "Paul"); const tp = T95.kp(h), hasX = /id="rf-x"/.test(h.els.view.innerHTML);
  T95.pick(h, "rf-c", "5e B"); T95.pick(h, "rf-s", "Français"); const none = /id="rf-none"/.test(h.els.view.innerHTML) && /id="rf-c"/.test(h.els.view.innerHTML);
  h.el("rf-x").onclick(); const back = T95.kp(h), gone = !/id="rf-x"/.test(h.els.view.innerHTML);
  const j = (a) => a.join("|");
  return /^12,3 moyenne/.test(all[0]) && /^10,5 moyenne/.test(c[0]) && noteC && /^12 moyenne/.test(cs[0]) && /^14 moyenne/.test(tp[0]) && hasX && none && j(back) === j(all) && gone ? true : J({ all, c, cs, tp, noteC, hasX, none, back, gone });
});
t("v95 : page Résultats — filtres aussi sur l'onglet Assiduité (présence, absences) ; l'onglet gardé après un filtre ; filtre devenu inconnu effacé", async () => {
  const h = T95.page({ hash: "#ass" }); await h.settle();
  const all = T95.kp(h); T95.pick(h, "rf-s", "Maths"); T95.pick(h, "rf-t", "Marie");
  const f = T95.kp(h), ass = /Présence par classe/.test(h.els.view.innerHTML) && !/Par matière/.test(h.els.view.innerHTML);
  return /^\d+(,\d)? % présence/.test(all[0]) && /^6 absences/.test(f[1]) && /^10 absences/.test(all[1]) === false && ass && !/5e B<\/b>/.test(h.els.view.innerHTML.slice(h.els.view.innerHTML.indexOf("Présence par classe"), h.els.view.innerHTML.indexOf("Risque de décrochage"))) ? true : J({ all, f, ass });
});
t("v95 : page Résultats — graphiques alimentés par les élèves filtrés ; scripts et comptes ; cache v95", () => {
  const j = rd("js", "etab-resultats.js");
  return /geDraw\(\{M:M,scope:FL\.scope\(\),rows:FL\.view\(\)\.rows/.test(j) && !/rows:E\.rows/.test(j) && !/\.(insert|update|upsert|delete)\(/.test(j) && !/sb\.rpc\(/.test(j) && /VERSION="cm-v(9[5-9]|1[0-9][0-9])"/.test(rd("sw.js"));
});

/* ---- v96 : étape 4 (suite) — classe × matière, provenance des données ---- */
t("v96 : page Résultats — tableau classe × matière (moyennes, cases vides, rouge sous le seuil), qui suit les filtres ; absent de l'onglet Assiduité", async () => {
  const h = T95.page(); await h.settle();
  const cells = () => { const x = (h.els.view.innerHTML.match(/<table class="xtab"[\s\S]*?<\/table>/) || [""])[0]; return { head: (x.match(/<th>[^<]*<\/th>/g) || []).map((a) => a.slice(4, -5)).join("|"), rows: (x.match(/<tr><th scope="row">[\s\S]*?<\/tr>/g) || []).map((r) => r.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).join("|"), bad: (x.match(/class="xb"/g) || []).length }; };
  const a = cells(); T95.pick(h, "rf-t", "Paul"); const b = cells(); T95.pick(h, "rf-t", ""); T95.pick(h, "rf-s", "Français"); const c = cells();
  const h2 = T95.page({ hash: "#ass" }); await h2.settle();
  const h3 = T95.page({ rpc: Object.assign({}, T93.base, { admin_dashboard: [Object.assign({}, T95.dash[1], { avg: 6 })] }) }); await h3.settle();
  const bad1 = (h3.els.view.innerHTML.match(/<td class="xb"[^>]*>6<\/td>/g) || []).length;
  return a.head === "Classe|Français|Maths" && a.rows === "6e A 12 11|5e B – 16" && a.bad === 0 && b.rows === "6e A 12 –|5e B – 16" && bad1 === 1 && c.head === "Classe|Français" && !/class="xtab"/.test(h2.els.view.innerHTML) ? true : J({ a, b, c });
});
t("v96 : page Résultats — provenance des données : une ligne par matière et enseignant, suivis, classes, dernière publication, rouge au-delà de 30 jours ; suit les filtres ; présente sur les deux onglets", async () => {
  const old = new Date(Date.now() - 60 * 864e5).toISOString();
  const dash = T95.dash.map((x) => (x.teacher === "Paul" && x.subj === "Maths" ? Object.assign({}, x, { updated_at: old }) : x));
  const h = T95.page({ rpc: Object.assign({}, T93.base, { admin_dashboard: dash }) }); await h.settle();
  const prov = () => (h.els.view.innerHTML.match(/<details class="card" id="prov">[\s\S]*?<\/details>/) || [""])[0];
  const lines = () => (prov().match(/<div class="dr">[\s\S]*?<\/div>/g) || []).map((r) => r.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const a = lines(), staleA = (prov().match(/tg bad/g) || []).length;
  T95.pick(h, "rf-c", "5e B"); const b = lines();
  const h2 = T95.page({ hash: "#ass" }); await h2.settle();
  return a.length === 3 && /^Français · Paul 1 suivi d’élève · 6e A /.test(a[0]) && /^Maths · Marie 2 suivis d’élèves · 6e A /.test(a[1]) && /^Maths · Paul 1 suivi d’élève · 5e B il y a 60 jours/.test(a[2]) && staleA === 1 && b.length === 1 && /^Maths · Paul/.test(b[0]) && /id="prov"/.test(h2.els.view.innerHTML) ? true : J({ a, staleA, b });
});
t("v96 : page Résultats — lecture seule, cache v96 ; les noms de matière et d'enseignant sont échappés", async () => {
  const j = rd("js", "etab-resultats.js");
  const dash = [Object.assign({}, T95.dash[0], { subj: "<b>X</b>", teacher: "<i>Y</i>" })];
  const h = T95.page({ rpc: Object.assign({}, T93.base, { admin_dashboard: dash }) }); await h.settle();
  const v = h.els.view.innerHTML;
  return !/\.(insert|update|upsert|delete)\(/.test(j) && /VERSION="cm-v(9[6-9]|1[0-9][0-9])"/.test(rd("sw.js")) && !/<b>X<\/b>|<i>Y<\/i>/.test(v) && /&lt;b&gt;X&lt;\/b&gt;/.test(v) ? true : J({ ok: v.length });
});

/* ---- v98 : journal déroulant, filtres sur l'Accueil, moyenne générale expliquée ---- */
const T98 = {
  acc: (dash, extra) => fauxPage(Object.assign({ scripts: ["js/etab-core.js", "js/etab-accueil.js"], rpc: Object.assign({}, T93.base, { admin_dashboard: dash || T95.dash }), tables: T93.tables() }, extra || {})),
  par: (n) => fauxPage({ scripts: ["js/etab-core.js", "js/etab-parametres.js"], rpc: Object.assign({}, T93.base, { etab_journal: Array.from({ length: n }, (_, i) => ({ event: "classe_affectee", name: "ens" + i + "@x.fr", class_label: "6e A", created_at: new Date(Date.now() - i * 6e4).toISOString(), detail: "n" + i, acteur: "chef@x.fr" })) }), tables: T93.tables() }),
};
t("v98 : Paramètres — journal replié au départ (10 actions), « Voir plus » par 20, « Réduire », ouverture mémorisée, export gardé", async () => {
  const h = T98.par(25); await h.settle();
  const jn = () => (h.els.view.innerHTML.match(/<details class="card" id="jnl"[^>]*>[\s\S]*?<\/details>/) || [""])[0];
  const lines = () => (jn().match(/<div class="dr"/g) || []).length;
  const a = { closed: !/ open/.test(jn().slice(0, 40)), n: lines(), more: /id="jmore"/.test(jn()), sum: /25 actions/.test(jn()), exp: /id="xjnl"/.test(jn()) };
  h.el("jmore").onclick(); const b = { n: lines(), more: /id="jmore"/.test(jn()), less: /id="jless"/.test(jn()) };
  h.el("jless").onclick(); const c = lines();
  h.el("jnl").open = true; h.el("jnl").ontoggle(); h.el("jmore").onclick(); const d = /<details class="card" id="jnl" open/.test(jn());
  const small = T98.par(4); await small.settle(); const s4 = (small.els.view.innerHTML.match(/<div class="dr"/g) || []).length === 4 && !/id="jmore"/.test(small.els.view.innerHTML);
  return a.closed && a.n === 10 && a.more && a.sum && a.exp && b.n === 25 && !b.more && b.less && c === 10 && d && s4 ? true : J({ a, b, c, d, s4 });
});
t("v98 : Accueil — filtres classe / matière / enseignant : présence, moyenne, effectifs et « par classe » recalculés ; alertes et graphiques suivent ; effacer ; combinaison vide", async () => {
  const h = T98.acc(); await h.settle();
  const all = T95.kp(h), hasBar = /id="rf-c"/.test(h.els.view.innerHTML) && /id="rf-s"/.test(h.els.view.innerHTML) && /id="rf-t"/.test(h.els.view.innerHTML);
  T95.pick(h, "rf-c", "6e A"); const c = T95.kp(h), note = /Filtres : 6e A\./.test(h.els.view.innerHTML), rows = (h.els.view.innerHTML.match(/<div class="dr">|<a class="dr"/g) || []).length;
  T95.pick(h, "rf-s", "Français"); const cs = T95.kp(h);
  h.el("rf-x").onclick(); const back = T95.kp(h).join("|") === all.join("|");
  T95.pick(h, "rf-c", "5e B"); T95.pick(h, "rf-s", "Français"); const none = /id="rf-none"/.test(h.els.view.innerHTML) && /id="rf-c"/.test(h.els.view.innerHTML);
  return hasBar && /^3 élèves/.test(all[0]) && /^2 classes/.test(all[1]) && /^85 % présence/.test(all[4]) && /^12,3 moyenne générale/.test(all[5]) && /^2 élèves/.test(c[0]) && /^1 classe$/.test(c[1]) && /^80 % présence/.test(c[4]) && /^10,5 moyenne générale/.test(c[5]) && note && rows >= 1 &&
    /^2 élèves/.test(cs[0]) && /^50 % élèves suivis/.test(cs[3]) && /^12 moyenne \/20/.test(cs[5]) && back && none ? true : J({ hasBar, all, c, note, rows, cs, back, none });
});
t("v98 : moyenne générale expliquée — nombre de matières publiées, avertissement quand une seule matière, « de la matière X seulement » sous filtre (Accueil et Résultats)", async () => {
  const one = T95.dash.filter((x) => x.subj === "Maths");
  const h1 = T98.acc(one); await h1.settle();
  const warn = /id="rf-gen"[^>]*>Une seule matière a publié des moyennes \(<b>Maths<\/b>\)/.test(h1.els.view.innerHTML);
  const h2 = T98.acc(); await h2.settle();
  const multi = /id="rf-gen"[^>]*>Moyenne générale : moyenne des matières de chaque élève \(2 matières publiées : Français, Maths\)/.test(h2.els.view.innerHTML);
  T95.pick(h2, "rf-s", "Maths"); const sub = /id="rf-gen"[^>]*>Moyenne de la matière <b>Maths<\/b> seulement/.test(h2.els.view.innerHTML) && /moyenne \/20<\/span>/.test(h2.els.view.innerHTML) && !/moyenne générale \/20/.test(h2.els.view.innerHTML);
  const h3 = T95.page(); await h3.settle();
  const res = /id="rf-gen"/.test(h3.els.view.innerHTML);
  return warn && multi && sub && res ? true : J({ warn, multi, sub, res });
});
t("v98 (v118) : jauge de présence — sous-titre = seuil d’alerte (le périmètre est rappelé sous le graphique) ; Accueil sans écriture, cache v98", () => {
  const geCards = new Function("Charts", rd("js", "graph-etab.js") + ";return geCards;")({ palette: ["a", "b", "c", "d", "e"] });
  const x = (scope) => geCards({ t: "apercu", M: { N: 100, A: 10, C: {}, means: [] }, TH: { pres: 80, moy: 10 }, pc: (n, a) => 100 - (a / n) * 100, rows: [], sortCls: () => 0, mean: () => null, scope }).filter((c) => c.k === "GaugeChart")[0].s;
  const j = rd("js", "etab-accueil.js");
  return x() === "Seuil d’alerte 80 %" && x("6e A · Maths") === "Seuil d’alerte 80 %" && /scope:FL\.scope\(\)/.test(j) && !/\.(insert|update|upsert|delete)\(/.test(j) && !/sb\.rpc\(/.test(j) && /VERSION="cm-v(9[8-9]|1[0-9][0-9])"/.test(rd("sw.js"));
});

/* ---- v100 : graphique « Évolution mois par mois » ---- */
const T100 = (() => {
  const src = rd("js", "graphiques.js");
  const S = [{ id: "a" }, { id: "b" }];
  const E = (d, a, b) => ({ d, m: 20, k: 1, s: { a, b } });
  const mk = (name, evs) => ({ id: name, name, students: S, records: {}, evs });
  const make = (list) => {
    const c = { console, Math, Date, JSON, Object, Array, String, Number, document: {}, evs: (x) => x.evs, liveCls: () => list, th: () => ({ o: null }), today: () => "2026-11-26",
      nf: (x) => String(x).replace(".", ","), dstr: (d) => d.toISOString().slice(0, 10), isArch: () => false, D: { classes: list }, inRange: () => true, GR: { m: {} } };
    c.window = c; vm.createContext(c); vm.runInContext(src + ";this.GR_B=GR_B;this.GR_R=GR_R;", c); return c;
  };
  return { make, mk, E };
})();
t("v100 : « mois par mois » — 4 classes affichées (plus limité à 3), sans recopie des moyennes d'un mois à l'autre", () => {
  const { make, mk, E } = T100;
  const cls = [mk("6e B", [E("2026-11-10", 3, 4)]), mk("3e", [E("2026-10-12", 5, 6), E("2026-11-09", 7, 8)]), mk("6e A", [E("2026-11-03", 8, 7)]), mk("5e", [E("2026-11-05", 10, 12)])];
  const d = make(cls).GR_B.months(cls[0], ["a", "b", "c", "d", "e", "f", "g"]);
  const v = (n) => d.series.filter((s) => s.name === n)[0].values;
  return d.series.length === 4 && d.gaps === true && J(v("6e B")) === "[null,3.5]" && J(v("3e")) === "[5.5,7.5]" && J(v("5e")) === "[null,11]" && J(d.labels) === '["Oct","Nov"]' ? true : J(d);
});
t("v100 : « mois par mois » — un seul mois avec des notes : message avec les moyennes au lieu d'une courbe ; jusqu'à 6 classes", () => {
  const { make, mk, E } = T100;
  const cls = [mk("6e B", [E("2026-11-10", 3, 4)]), mk("3e", [E("2026-11-09", 7, 8)])];
  const d = make(cls).GR_B.months(cls[0], ["a", "b", "c", "d", "e", "f", "g"]);
  const six = ["A", "B", "C", "D", "E", "F", "G"].map((n) => mk(n, [E("2026-11-09", 10, 12)]));
  const d6 = make(six).GR_B.months(six[0], ["a", "b", "c", "d", "e", "f", "g"]);
  return /Notes sur un seul mois \(Nov\)/.test(d.empty) && /6e B 3,5/.test(d.empty) && /3e 7,5/.test(d.empty) && d6.series.length === 6 ? true : J({ e: d.empty, n: d6.series.length });
});
t("v100 : « mois par mois » — la phrase de lecture ne compare plus un mois à sa copie ; sous-titre « 6 derniers mois » ; LineChart accepte les trous (gaps)", () => {
  const { make } = T100, c = make([]);
  const d = { labels: ["Oct", "Nov"], goal: { value: 10, label: "Seuil" }, series: [{ name: "6e B", values: [null, 3.4] }, { name: "3e", values: [5, 7] }] };
  const txt = J(c.GR_R.months({}, d));
  const g = rd("js", "graphiques.js"), ch = rd("js", "graphiques", "charts.js");
  return /n’a des notes que sur un mois/.test(txt) && !/passe de/.test(txt) && /6 derniers mois/.test(g) && !/depuis la rentrée/.test(g) && /o\.gaps && v === null \? null/.test(ch) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) ? true : txt;
});

/* ---- v101 : « Répartition des moyennes » — choix de la matière et liste des élèves par niveau ---- */
t("v101 (v118) : répartition des moyennes — moyennes par matière conservées par élève, matière choisie par le filtre de la page, liste des élèves au clic", () => {
  const core = rd("js", "etab-core.js"), g = rd("js", "graph-etab.js");
  return /bs:\{\}/.test(core) && /st\.bs\[sj\]/.test(core) && /geBuildMoy/.test(g) && !/Toutes les matières/.test(g) && /ch\.pin=function/.test(g) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) ? true : "manque";
});

t("v102 (v118) : « Moyenne par classe » — la matière vient du filtre de la page, plus de menu propre (geBuildCls)", () => {
  const g = rd("js", "graph-etab.js");
  return /geBuildCls/.test(g) && !/toutes les matières/.test(g) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) ? true : "manque";
});

/* ---- Relevé de notes paysage — étape 7 : colonne « Place », options « Inclure les places » et « Inclure les compositions » ---- */
t("étape 7 : sans option, pas de colonne Place (comme avant) ; avec « places », elle suit Moyenne avant Observations", () => {
  setupComp();
  const k = (o) => run("rcCols(D.classes[0],rcDevoirs(D.classes[0],1)," + o + ").map(function(k){return k.k;}).join()");
  return k("undefined") === "n,nom,dev,dev,dev,dev,moy,obs" && k("{places:true}") === "n,nom,dev,dev,dev,dev,moy,place,obs" ? true : J([k("undefined"), k("{places:true}")]);
});
t("étape 7 : la largeur totale des colonnes reste celle du tableau, Observations garde la place restante", () => {
  setupComp();
  const w = run("(function(){var c=rcCols(D.classes[0],rcDevoirs(D.classes[0],1),{places:true}),t=0,o=0;c.forEach(function(k){t+=k.w;if(k.k===\"obs\")o=k.w;});return[t,o>60];})()");
  return w[0] === 782 && w[1] === true ? true : J(w);
});
t("étape 7 : « Inclure les compositions » décoché retire les colonnes de composition ; coché ou absent, elles restent", () => {
  setupComp();
  const r = (o) => run("rcDevoirs(D.classes[0],1," + o + ").map(function(e){return e.id;}).join()");
  return r("{comps:false}") === "d2,d1" && r("{comps:true}") === "d2,d1,c1,c2" && r("undefined") === "d2,d1,c1,c2" ? true : J([r("{comps:false}"), r("{comps:true}"), r("undefined")]);
});
t("étape 7 : la place est le rang dans la classe, deux élèves à égalité ont la même place, sans moyenne = case vide", () => {
  setupRel();
  run('D.classes[0].ev=[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:15,b:15,c:8}}];');
  const r = run("(function(){var m=rankMap(D.classes[0],1);return[m.a.r,m.b.r,m.c.r];})()");
  const pdf = pdfText(run("releveCahierPDF(D.classes[0],1,{places:true})"));
  const sans = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return J(r) === "[1,1,3]" && /\(Place\) Tj/.test(pdf) && !/\(Place\) Tj/.test(sans) && /\(3\) Tj/.test(pdf) ? true : J(r);
});
t("étape 7 : élève sans note : aucune place affichée pour lui, les autres gardent la leur", () => {
  setupRel();
  run('D.classes[0].ev=[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:15,b:8}}];');
  const pdf = pdfText(run("releveCahierPDF(D.classes[0],1,{places:true})"));
  return (pdf.match(/\(2\) Tj/g) || []).length === 2 && !/\(3\) Tj/.test(pdf.replace(/\(3\) Tj\n[^]*?$/, "")) || /\(Place\) Tj/.test(pdf) ? true : "sans note";
});
t("étape 7 : les deux cases à cocher sont dans la carte du relevé, la première décochée et la seconde cochée par défaut, et le bouton les transmet", () => {
  setupRel();
  const h = run("bulletinsCard(D.classes[0])"), b = rd("js", "bulletins.js");
  return /id="brpl"(?![^>]*checked)/.test(h) && /id="brcp"[^>]*checked/.test(h) && /Inclure les places/.test(h) && /Inclure les compositions/.test(h) && /ko=\{places:brPl,comps:brCp\}/.test(b) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) ? true : "carte";
});
t("étape 7 : le relevé portrait et le relevé d'un devoir ne changent pas", () => {
  setupRel();
  const a = pdfText(run("relevePDF(D.classes[0],1)")), d = pdfText(run("releveDevoirPDF(D.classes[0],D.classes[0].ev[0])"));
  return !/\(Place\) Tj/.test(a) && !/\(Place\) Tj/.test(d) ? true : "autres relevés";
});

/* ---- Relevé de notes paysage — étape 8 : grilles d'appréciation (aucun rendu) ---- */
const g8 = (f, v, b) => run(f + "(" + v + "," + b + ")");
t("étape 8 : grille du maître sur 20, toutes les limites", () => {
  const att = { 0: "Nul", 3: "Nul", 4: "Mauvais", 5: "Mauvais", 6: "Faible", 8: "Faible", 9: "Insuffisant", 10: "Moyen", 11: "Passable", 12: "Assez bien", 14: "Assez bien", 15: "Bien", 16: "Bien", 17: "Très bien", 18: "Très bien", 19: "Excellent", 20: "Excellent" };
  const bad = Object.keys(att).filter(k => g8("rcMaitre", k, 20) !== att[k]);
  return bad.length === 0 ? true : bad.join();
});
t("étape 8 : grille du maître sur 10, toutes les limites", () => {
  const att = { 0: "Nul", 2: "Nul", 3: "Faible", 4: "Insuffisant", 5: "Moyen", 6: "Passable", 7: "Assez bien", 8: "Bien", 9: "Très bien", 10: "Excellent" };
  const bad = Object.keys(att).filter(k => g8("rcMaitre", k, 10) !== att[k]);
  return bad.length === 0 ? true : bad.join();
});
t("étape 8 : les décimales gardent la partie entière (3,99 reste nul sur 20 ; 11,99 passable ; 14,999 arrondi à 15,00 donne bien ; 8,99 sur 10 bien)", () => {
  const r = [g8("rcMaitre", 3.99, 20), g8("rcMaitre", 11.99, 20), g8("rcMaitre", 14.999, 20), g8("rcMaitre", 8.99, 10), g8("rcMaitre", 2.5, 10)];
  return J(r) === J(["Nul", "Passable", "Bien", "Bien", "Nul"]) ? true : J(r);
});
t("étape 8 : une moyenne de 15 obtenue par calcul flottant (14,999999999999998) donne « Bien »", () => {
  return g8("rcMaitre", "14.999999999999998", 20) === "Bien" ? true : g8("rcMaitre", "14.999999999999998", 20);
});
t("étape 8 : appréciation de l'enseignant sur 10, toutes les limites", () => {
  const att = [[0, "Blâme"], [4.99, "Blâme"], [5, "Encouragement"], [6.99, "Encouragement"], [7, "Félicitation"], [8.99, "Félicitation"], [9, "Excellent"], [10, "Excellent"]];
  const bad = att.filter(a => g8("rcEnseignant", a[0], 10) !== a[1]).map(a => a[0]);
  return bad.length === 0 ? true : bad.join();
});
t("étape 8 : valeurs hors cadre — vide sans note, bornées à 0 et au barème, pas d'appréciation d'enseignant sur 20", () => {
  const r = [g8("rcMaitre", "null", 20), g8("rcMaitre", "undefined", 10), g8("rcMaitre", -2, 20), g8("rcMaitre", 25, 20), g8("rcMaitre", 12, 15), g8("rcEnseignant", 14, 20), g8("rcEnseignant", "null", 10), g8("rcEnseignant", 12, 10)];
  return J(r) === J(["", "", "Nul", "Excellent", "", "", "", "Excellent"]) ? true : J(r);
});
/* ---- Relevé de notes paysage — étape 9 : colonne Observations remplie avec la grille du barème ---- */
t("étape 9 : copies sur 20 — grille sur 20 du maître, sans appréciation de l'enseignant ni mention de barème", () => {
  setupRel(); run('D.classes[0].ev=[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:15,b:8,c:19.5}}];');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return run("rcBareme(D.classes[0],1)") === 20 && /\(Bien\) Tj/.test(b) && /\(Faible\) Tj/.test(b) && /\(Excellent\) Tj/.test(b) && !/Bl.me|Encouragement|F.licitation|Bar.me/.test(b) ? true : "sur 20";
});
t("étape 9 : copies toutes sur 10 — grille sur 10 + appréciation de l'enseignant, moyenne affichée sur 10", () => {
  setupRel(); run('D.classes[0].ev=[{id:"e1",t:"Dictée",d:"2026-10-05",m:10,s:{a:7.5,b:4,c:9.5}}];');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return run("rcBareme(D.classes[0],1)") === 10 && /Assez bien . F.licitation/.test(b) && /Insuffisant . Bl.me/.test(b) && /Tr.s bien . Excellent/.test(b) && /Bar.me : sur 10/.test(b) && /\(7,5\) Tj/.test(b) && /\(4\) Tj/.test(b) ? true : "sur 10";
});
t("étape 9 : barème mélangé (10 et 20) ou aucune évaluation : grille sur 20", () => {
  setupRel();
  const r = run("rcBareme(D.classes[0],1)");
  run('D.classes[0].ev=[];');
  return r === 20 && run("rcBareme(D.classes[0],1)") === 20 && run("rcObs(null,20)") === "" && run("rcObs(12,20)") === "Assez bien" && run("rcObs(14,10)") === "Assez bien . F.licitation".replace(" . ", " · ").replace("F.licitation", "Félicitation") ? true : "mélange";
});
t("étape 9 : un élève sans note a une case Observations vide ; la grille suit la moyenne arrondie", () => {
  setupRel(); run('D.classes[0].ev=[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:14.999999999999998}}];');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return (b.match(/\(Bien\) Tj/g) || []).length === 1 && !/\(Assez bien\) Tj/.test(b) ? true : "arrondi";
});
t("étape 9 : l'ancienne échelle de l'appli n'est plus utilisée dans le relevé paysage (12 = assez bien, 10 = moyen)", () => {
  setupRel(); run('D.classes[0].ev=[{id:"e1",t:"Devoir 1",d:"2026-10-05",m:20,s:{a:10,b:11}}];');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /\(Moyen\) Tj/.test(b) && /\(Passable\) Tj/.test(b) ? true : "échelle";
});

/* ---- Relevé de notes paysage — étape 10 : en-tête à remplir ---- */
t("étape 10 : tout est renseigné — l'en-tête reprend établissement, enseignant(e), matière, année scolaire et effectif, sans ligne à remplir", () => {
  setupCahier(3);
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /Établissement : CG de Nsou|.tablissement : CG de Nsou/.test(b) && /Enseignant\\\(e\\\) : Prof/.test(b) && /Mati.re : Fran.ais/.test(b) && /Effectif : 3/.test(b) && /Ann.e scolaire : 20\d\d-20\d\d/.test(b) && !/____/.test(b) ? true : "plein";
});
t("étape 10 : établissement, enseignant(e) et matière vides — chacun devient une ligne « ______ »", () => {
  setupCahier(3);
  run('ME={id:"u1",name:"",school:""};D.classes[0].subj="";');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /tablissement : _{10,}/.test(b) && /Enseignant\\\(e\\\) : _{10,}/.test(b) && /Mati.re : _{6,}/.test(b) && /Effectif : 3/.test(b) && /Ann.e scolaire : 20\d\d-20\d\d/.test(b) && /Classe : 6e B/.test(b) ? true : "vide";
});
t("étape 10 : un champ rempli d'espaces ou absent compte comme vide ; un seul champ vide ne touche pas les autres", () => {
  setupCahier(2);
  run('ME={id:"u1",name:"   "};D.classes[0].subj="Maths";');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /tablissement : _{10,}/.test(b) && /Enseignant\\\(e\\\) : _{10,}/.test(b) && /Mati.re : Maths/.test(b) && !/Mati.re : _/.test(b) ? true : "espaces";
});
t("étape 10 : classe sans élève — effectif 0 ; année scolaire, période et feuillet restent présents avec les lignes à remplir", () => {
  setupCahier(0);
  run('ME={id:"u1"};D.classes[0].subj=undefined;');
  const b = pdfText(run("releveCahierPDF(D.classes[0],2)"));
  return /Effectif : 0/.test(b) && /Ann.e scolaire : 20\d\d-20\d\d/.test(b) && /P.riode : Trimestre 2/.test(b) && /Mati.re : _/.test(b) ? true : "classe vide";
});
t("étape 10 : la ligne vide est répétée sur chaque page du relevé", () => {
  setupCahier(50);
  run('ME={id:"u1",name:"",school:""};');
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  const pages = (b.match(/\/Type \/Page /g) || []).length, n = (b.match(/Enseignant\\\(e\\\) : _{10,}/g) || []).length;
  return pages >= 3 && n === pages ? true : J({ pages, n });
});

/* ---- Relevé de notes paysage — étape 11 : « tous les trimestres », « cahier vierge », finitions ---- */
function setup3T(n) {
  setupCahier(n || 3);
  run('D.classes[0].ev=[{id:"a",t:"AAA",d:"2026-10-05",m:20,s:{s0:15,s1:8}},{id:"b",t:"BBB",d:"2027-01-12",m:20,s:{s0:12}}];');
}
t("étape 11 : « tous les trimestres » donne trois sections dans l'ordre, chacune avec son en-tête, même sans évaluation", () => {
  setup3T();
  const b = pdfText(run("releveCahierPDF(D.classes[0],undefined,{tous:true})"));
  const i1 = b.indexOf("Trimestre 1"), i2 = b.indexOf("Trimestre 2"), i3 = b.indexOf("Trimestre 3");
  const titres = (b.match(/\(RELEV. DE NOTES\) Tj/g) || []).length, pages = (b.match(/\/Type \/Page /g) || []).length;
  return i1 > 0 && i2 > i1 && i3 > i2 && titres === 3 && pages === 3 && /Page 1 \/ 3/.test(b) && /Page 3 \/ 3/.test(b) ? true : J({ i1, i2, i3, titres, pages });
});
t("étape 11 : chaque section ne montre que les devoirs de son trimestre", () => {
  setup3T();
  const b = pdfText(run("releveCahierPDF(D.classes[0],undefined,{tous:true})"));
  const i2 = b.indexOf("Trimestre 2"), i3 = b.indexOf("Trimestre 3");
  const s1 = b.slice(0, i2), s2 = b.slice(i2, i3), s3 = b.slice(i3);
  return /\(AAA\) Tj/.test(s1) && !/BBB/.test(s1) && /\(BBB\) Tj/.test(s2) && !/AAA/.test(s2) && !/AAA|BBB/.test(s3) ? true : "sections";
});
t("étape 11 : trois sections avec beaucoup d'élèves — pages numérotées de façon continue, en-tête sur chaque page", () => {
  setup3T(50);
  const b = pdfText(run("releveCahierPDF(D.classes[0],undefined,{tous:true,places:true})"));
  const pages = (b.match(/\/Type \/Page /g) || []).length, titres = (b.match(/\(RELEV. DE NOTES\) Tj/g) || []).length;
  return pages >= 9 && titres === pages && new RegExp("Page " + pages + " / " + pages).test(b) && (b.match(/\(Place\) Tj/g) || []).length === pages ? true : J({ pages, titres });
});
t("étape 11 : un relevé d'un seul trimestre ne change pas (une seule section, une seule période)", () => {
  setup3T();
  const b = pdfText(run("releveCahierPDF(D.classes[0],1)"));
  return /Trimestre 1/.test(b) && !/Trimestre 2/.test(b) && (b.match(/\/Type \/Page /g) || []).length === 1 ? true : "seul";
});
t("étape 11 : cahier vierge — élèves numérotés, 8 colonnes de devoir vides, aucune note, moyenne, place ni observation", () => {
  setup3T(5);
  run('D.classes[0].ev.forEach(function(e){e.m=10;});');
  const k = run("rcCols(D.classes[0],rcBlancs(),{places:true}).map(function(k){return k.k;}).join()");
  const b = pdfText(run("releveCahierPDF(D.classes[0],undefined,{vierge:true,places:true})"));
  return k === "n,nom,dev,dev,dev,dev,dev,dev,dev,dev,moy,place,obs" && /\(Moyenne\) Tj/.test(b) && /\(Place\) Tj/.test(b) && /\(Observations\) Tj/.test(b) &&
    /\(Abel C/.test(b) && /\(5\) Tj/.test(b) && !/AAA|BBB/.test(b) && !/Mati.re : _/.test(b) && !/P.riode/.test(b) && !/Bar.me/.test(b) &&
    !/\((Nul|Faible|Moyen|Passable|Bien|Assez bien|Mauvais|Insuffisant|Excellent)\) Tj/.test(b) && (b.match(/\/Type \/Page /g) || []).length === 1 ? true : "vierge";
});
t("étape 11 : cahier vierge d'une classe sans élève — PDF valide ; l'en-tête à remplir reste présent", () => {
  setupCahier(0);
  run('ME={id:"u1"};');
  const b = pdfText(run("releveCahierPDF(D.classes[0],undefined,{vierge:true})"));
  return b.startsWith("%PDF-") && b.trimEnd().endsWith("%%EOF") && /Effectif : 0/.test(b) && /tablissement : _/.test(b) ? true : "vide";
});
t("étape 11 : le menu propose « les 3 trimestres » et « Cahier vierge », le bouton les transmet et nomme le fichier", () => {
  setupRel();
  const h = run("bulletinsCard(D.classes[0])"), j = rd("js", "bulletins.js");
  return /value="k:T"/.test(h) && /value="k:V"/.test(h) && /3 trimestres/.test(h) && /Cahier vierge/.test(h) && /ko\.tous=true/.test(j) && /ko\.vierge=true/.test(j) && /cahier-vierge-/.test(j) && /3-trimestres/.test(j) ? true : "menu";
});
t("étape 11 : cache et fiche de nouveautés — releve-cahier.js chargé et mis en cache, version à jour", () => {
  return /releve-cahier\.js/.test(rd("index.html")) && /releve-cahier\.js/.test(rd("sw.js")) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(path.join(__dirname, "..", "NOUVEAUTES-v113.md")) ? true : "cache";
});

/* ---- Bloc 2 — étape 12 : panneau de sélection de plusieurs classes (page Enseignants) ---- */
const mk12 = (cl, extra, mats) => fauxPage(Object.assign({ scripts: ["js/etab-core.js", "js/etab-enseignants.js"], tables: {}, rpc: {
  is_admin: true, mes_etablissements: [{ id: "e1", nom: "CG", role: "admin", code: "X" }],
  etab_membres_liste: [{ user_id: "t1", email: "marie@x.cg", nom: "Marie", role: "enseignant", statut: "actif" }, { user_id: "t2", email: "paul@x.cg", nom: "Paul", role: "enseignant", statut: "actif" }],
  etab_affectations_liste: [{ user_id: "t1", email: "marie@x.cg", nom: "Marie", classe_id: "c2", classe: "6e A", matiere_id: null, matiere: null, origine: "chef" }],
  etab_classes_liste: cl, etab_matieres_liste: mats || [], admin_assignments: [] } }, extra || {}));
const CL12 = [{ id: "c1", nom: "5e B", archivee: false }, { id: "c2", nom: "6e A", archivee: false }, { id: "c3", nom: "6e B", archivee: false }, { id: "c4", nom: "Tle D", archivee: false }, { id: "c5", nom: "Atelier", archivee: false }, { id: "c6", nom: "6e C", archivee: true }];
const q12 = (h, a, f) => h.els.view.querySelectorAll("[" + a + "]").filter((n) => f(n.getAttribute(a)));
t("étape 12 : chaque enseignant a un panneau « Donner plusieurs classes », classes groupées par niveau dans l'ordre, archivées exclues, rien de coché", async () => {
  const h = mk12(CL12); await h.settle();
  const v = h.els.view.innerHTML, i = (k) => v.indexOf("<b>" + k + "</b>");
  const box1 = q12(h, "data-lotc", (x) => x.indexOf("t1|") === 0).length, box2 = q12(h, "data-lotc", (x) => x.indexOf("t2|") === 0).length;
  return (v.match(/Donner plusieurs classes/g) || []).length === 2 && i("6e") > 0 && i("6e") < i("5e") && i("5e") < i("Tle") && i("Tle") < i("Atelier") && box1 === 5 && box2 === 5 &&
    !/data-lotc="t1\|c6"/.test(v) && (v.match(/Aucune classe sélectionnée/g) || []).length === 2 && !/ checked>/.test(v.replace(/data-lotc/g, "")) && (v.match(/Tout cocher/g) || []).length === 2 ? true : J({ box1, box2 });
});
t("étape 12 : les classes déjà reçues par l'enseignant sont signalées, pas les autres", async () => {
  const h = mk12(CL12); await h.settle();
  const v = h.els.view.innerHTML, a = v.indexOf('data-lotp="t1"'), b = v.indexOf('data-lotp="t2"');
  return (v.slice(a, b).match(/déjà reçue/g) || []).length === 1 && !/déjà reçue/.test(v.slice(b)) ? true : "déjà reçue";
});
t("étape 12 : cocher une classe met à jour le compteur de cet enseignant seulement, et le panneau reste ouvert", async () => {
  const h = mk12(CL12); await h.settle();
  const n = q12(h, "data-lotc", (x) => x === "t1|c1")[0]; n.checked = true; n.onchange(); await h.settle();
  const v = h.els.view.innerHTML, a = v.indexOf('data-lotp="t1"'), b = v.indexOf('data-lotp="t2"');
  return /1 classe sélectionnée/.test(v.slice(a, b)) && /Aucune classe sélectionnée/.test(v.slice(b)) && /data-lotc="t1\|c1"[^>]*checked/.test(v) && /<details[^>]*data-lotp="t1"[^>]* open/.test(v) && /1 \/ 1/.test(v) ? true : "cocher";
});
t("étape 12 : « Tout cocher » sélectionne toutes les classes, puis devient « Tout décocher »", async () => {
  const h = mk12(CL12); await h.settle();
  q12(h, "data-lotall", (x) => x === "t1")[0].onclick(); await h.settle();
  const v1 = h.els.view.innerHTML, a = v1.indexOf('data-lotp="t1"'), b = v1.indexOf('data-lotp="t2"'), p1 = v1.slice(a, b);
  const okAll = /5 classes sélectionnées/.test(p1) && /Tout décocher/.test(p1) && (p1.match(/ checked>/g) || []).length === 5 && /Aucune classe sélectionnée/.test(v1.slice(b));
  q12(h, "data-lotall", (x) => x === "t1")[0].onclick(); await h.settle();
  const v2 = h.els.view.innerHTML, p2 = v2.slice(v2.indexOf('data-lotp="t1"'), v2.indexOf('data-lotp="t2"'));
  return okAll && /Aucune classe sélectionnée/.test(p2) && /Tout cocher/.test(p2) && !/ checked>/.test(p2) ? true : J({ okAll });
});
t("étape 12 : cocher / décocher un niveau sélectionne ses classes (6e = 2 classes), le compteur du niveau suit", async () => {
  const h = mk12(CL12); await h.settle();
  q12(h, "data-lotniv", (x) => x === "t1|6e")[0].onclick(); await h.settle();
  const v = h.els.view.innerHTML, p = v.slice(v.indexOf('data-lotp="t1"'), v.indexOf('data-lotp="t2"'));
  const ok1 = /2 classes sélectionnées/.test(p) && /data-lotc="t1\|c2"[^>]*checked/.test(p) && /data-lotc="t1\|c3"[^>]*checked/.test(p) && !/data-lotc="t1\|c1"[^>]*checked/.test(p) && /2 \/ 2/.test(p) && /data-lotniv="t1\|6e">Décocher</.test(p);
  q12(h, "data-lotniv", (x) => x === "t1|6e")[0].onclick(); await h.settle();
  const v2 = h.els.view.innerHTML;
  return ok1 && /Aucune classe sélectionnée/.test(v2.slice(v2.indexOf('data-lotp="t1"'), v2.indexOf('data-lotp="t2"'))) ? true : "niveau";
});
t("étape 12 : décocher une classe quand tout est coché ; aucun appel d'affectation n'est envoyé (étape 13)", async () => {
  const h = mk12(CL12); await h.settle();
  q12(h, "data-lotall", (x) => x === "t2")[0].onclick(); await h.settle();
  const n = q12(h, "data-lotc", (x) => x === "t2|c5")[0]; n.checked = false; n.onchange(); await h.settle();
  const v = h.els.view.innerHTML, p = v.slice(v.indexOf('data-lotp="t2"'));
  return /4 classes sélectionnées/.test(p) && /Tout cocher/.test(p) && !h.calls.some((x) => /affecter|desaffecter/.test(x[0])) ? true : "sans envoi";
});
t("étape 12 : sans aucune classe, pas de panneau ; la page garde ses fonctions (Affecter, Retirer)", async () => {
  const h = mk12([]); await h.settle();
  const v = h.els.view.innerHTML, h2 = mk12(CL12);
  await h2.settle();
  return !/Donner plusieurs classes/.test(v) && /data-give=/.test(h2.els.view.innerHTML) && /data-un=/.test(h2.els.view.innerHTML) && /Donner une classe/.test(h2.els.view.innerHTML) ? true : "sans classe";
});
t("étape 12 : version et cache", () => /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(path.join(__dirname, "..", "NOUVEAUTES-v114.md")) ? true : "cache");

/* ---- Bloc 2 — étape 13 : « Affecter N classes » (en lot) ---- */
const MAT13 = [{ id: "m1", nom: "Français" }, { id: "m2", nom: "Maths" }];
const mk13 = (extra, wrap) => { const h = mk12(CL12, Object.assign({}, extra), MAT13); if (wrap) h.c.sb.rpc = wrap(h.c.sb.rpc); return h; };
const pick13 = async (h, uid, ids) => { for (const id of ids) { const n = q12(h, "data-lotc", (x) => x === uid + "|" + id)[0]; n.checked = true; n.onchange(); await h.settle(); } };
const go13 = (h, uid) => q12(h, "data-lotgo", (x) => x === uid)[0];
const aff13 = (h) => h.calls.filter((x) => x[0] === "etab_affecter").map((x) => x[1]);
t("étape 13 : le bouton indique le nombre de classes cochées et reste inactif sans sélection", async () => {
  const h = mk13(); await h.settle();
  const v0 = h.els.view.innerHTML, off = /<button[^>]*data-lotgo="t1"[^>]* disabled>Affecter</.test(v0);
  await pick13(h, "t1", ["c1", "c3", "c4"]);
  const v = h.els.view.innerHTML;
  return off && /data-lotgo="t1">Affecter 3 classes</.test(v) && /data-lotgo="t2"[^>]* disabled>Affecter</.test(v) ? true : J({ off });
});
t("étape 13 : un clic envoie une demande etab_affecter par classe cochée, dans l'ordre, sans matière quand aucune n'est choisie", async () => {
  const h = mk13(); await h.settle();
  await pick13(h, "t2", ["c1", "c3", "c4"]);
  go13(h, "t2").onclick(); await h.settle(200);
  const a = aff13(h);
  return a.length === 3 && J(a.map((x) => x.p_classe)) === '["c3","c1","c4"]' && a.every((x) => x.p_user === "t2" && x.p_etab === "e1" && !("p_matiere" in x)) && /3 classes affectées à Paul\./.test(h.els.msg.textContent) ? true : J({ a, m: h.els.msg.textContent });
});
t("étape 13 : la matière choisie est envoyée avec chaque classe ; la sélection est vidée et les affectations rechargées", async () => {
  const h = mk13(); await h.settle();
  await pick13(h, "t2", ["c1", "c3"]);
  h.el("lmt2").value = "m2"; q12(h, "data-lotm", (x) => x === "t2")[0].onchange();
  const n0 = h.calls.filter((x) => x[0] === "etab_affectations_liste").length;
  go13(h, "t2").onclick(); await h.settle(200);
  const a = aff13(h), v = h.els.view.innerHTML, p = v.slice(v.indexOf('data-lotp="t2"'));
  return a.length === 2 && a.every((x) => x.p_matiere === "m2") && /Aucune classe sélectionnée/.test(p) && h.calls.filter((x) => x[0] === "etab_affectations_liste").length === n0 + 1 ? true : J({ a, n0 });
});
t("étape 13 : une classe déjà reçue avec la même matière est sautée (et signalée) ; avec une autre matière elle est envoyée", async () => {
  const h = mk13(); await h.settle();   /* Marie a déjà c2 sans matière */
  await pick13(h, "t1", ["c1", "c2", "c3"]);
  go13(h, "t1").onclick(); await h.settle(200);
  const a = aff13(h), m1 = h.els.msg.textContent;
  const g = mk13(); await g.settle();
  await pick13(g, "t1", ["c2"]); g.el("lmt1").value = "m1";
  go13(g, "t1").onclick(); await g.settle(200);
  return J(a.map((x) => x.p_classe)) === '["c3","c1"]' && /2 classes affectées à Marie \(1 déjà reçue\)/.test(m1) && aff13(g).length === 1 && aff13(g)[0].p_matiere === "m1" ? true : J({ m1, n: aff13(g).length });
});
t("étape 13 : si toutes les classes cochées sont déjà reçues, aucun appel et un message clair", async () => {
  const h = mk13(); await h.settle();
  await pick13(h, "t1", ["c2"]);
  go13(h, "t1").onclick(); await h.settle(100);
  return aff13(h).length === 0 && /déjà affectée à Marie/.test(h.els.msg.textContent) ? true : h.els.msg.textContent;
});
t("étape 13 : une classe refusée ne bloque pas les suivantes ; seule la sélection réussie est vidée ; le message nomme l'échec", async () => {
  const h = mk13({}, (f) => (fn, a) => (fn === "etab_affecter" && a.p_classe === "c3" ? Object.assign(Promise.resolve({ data: null, error: { message: "boom" } }), { range() { return this; } }) : f(fn, a)));
  await h.settle();
  await pick13(h, "t2", ["c1", "c3", "c4"]);
  go13(h, "t2").onclick(); await h.settle(200);
  const v = h.els.view.innerHTML, p = v.slice(v.indexOf('data-lotp="t2"')), m = h.els.msg.textContent;
  return aff13(h).length === 2 && /2 classes affectées à Paul/.test(m) && /1 échec : 6e B/.test(m) && /1 classe sélectionnée/.test(p) && /data-lotc="t2\|c3"[^>]*checked/.test(p) ? true : J({ m });
});
t("étape 13 : un refus du serveur (membre retiré) est expliqué sans rien affecter", async () => {
  const h = mk13({}, (f) => (fn, a) => (fn === "etab_affecter" ? Object.assign(Promise.resolve({ data: { ok: false, err: "not_member" }, error: null }), { range() { return this; } }) : f(fn, a)));
  await h.settle();
  await pick13(h, "t2", ["c1", "c3"]);
  go13(h, "t2").onclick(); await h.settle(200);
  const m = h.els.msg.textContent;
  return /Aucune classe affectée/.test(m) && /2 échecs/.test(m) && /plus membre/.test(m) && /2 classes sélectionnées/.test(h.els.view.innerHTML) ? true : m;
});
t("étape 13 : sans internet, l'envoi s'arrête et dit combien de classes n'ont pas été envoyées", async () => {
  const h = mk13({}, (f) => (fn, a) => (fn === "etab_affecter" && a.p_classe === "c4" ? Promise.reject(new Error("net")) : f(fn, a)));
  await h.settle();
  await pick13(h, "t2", ["c1", "c3", "c4", "c5"]);
  go13(h, "t2").onclick(); await h.settle(200);
  const m = h.els.msg.textContent;
  return aff13(h).length === 2 && /2 classes affectées à Paul/.test(m) && /pas d’internet/.test(m) && /1 classe non envoyée/.test(m) ? true : J({ m, n: aff13(h).length });
});
t("étape 13 : sans classe cochée, rien n'est envoyé ; un deuxième clic pendant l'envoi est ignoré", async () => {
  const h = mk13(); await h.settle();
  go13(h, "t2").onclick(); await h.settle(20);
  const none = aff13(h).length === 0 && /Cochez au moins une classe/.test(h.els.msg.textContent);
  await pick13(h, "t2", ["c1", "c3"]);
  const b = go13(h, "t2"); b.onclick(); b.onclick(); await h.settle(200);
  return none && aff13(h).length === 2 ? true : J({ none, n: aff13(h).length });
});
t("étape 13 : version et cache", () => /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(path.join(__dirname, "..", "NOUVEAUTES-v115.md")) ? true : "cache");

/* ---- Bloc 2 — étape 14 : « Retirer N classes » (en lot) ---- */
const AFF14 = [
  { user_id: "t1", email: "marie@x.cg", nom: "Marie", classe_id: "c2", classe: "6e A", matiere_id: null, matiere: null, origine: "chef" },
  { user_id: "t1", email: "marie@x.cg", nom: "Marie", classe_id: "c1", classe: "5e B", matiere_id: "m1", matiere: "Français", origine: "chef" },
  { user_id: "t1", email: "marie@x.cg", nom: "Marie", classe_id: "c1", classe: "5e B", matiere_id: "m2", matiere: "Maths", origine: "chef" },
  { user_id: "t1", email: "marie@x.cg", nom: "Marie", classe_id: "c3", classe: "6e B", matiere_id: "m1", matiere: "Français", origine: "chef" },
  { user_id: "t2", email: "paul@x.cg", nom: "Paul", classe_id: "c4", classe: "Tle D", matiere_id: "m2", matiere: "Maths", origine: "chef" }];
const mk14 = (extra, wrap) => {
  const h = fauxPage(Object.assign({ scripts: ["js/etab-core.js", "js/etab-enseignants.js"], tables: {}, rpc: {
    is_admin: true, mes_etablissements: [{ id: "e1", nom: "CG", role: "admin", code: "X" }],
    etab_membres_liste: [{ user_id: "t1", email: "marie@x.cg", nom: "Marie", role: "enseignant", statut: "actif" }, { user_id: "t2", email: "paul@x.cg", nom: "Paul", role: "enseignant", statut: "actif" }],
    etab_affectations_liste: AFF14, etab_classes_liste: CL12, etab_matieres_liste: MAT13, admin_assignments: [] } }, extra || {}));
  if (wrap) h.c.sb.rpc = wrap(h.c.sb.rpc);
  return h;
};
const rm14 = (h, uid) => q12(h, "data-lotrm", (x) => x === uid)[0];
const des14 = (h) => h.calls.filter((x) => x[0] === "etab_desaffecter").map((x) => x[1]);
t("étape 14 : le bouton « Retirer » indique le nombre de classes cochées et reste inactif sans sélection", async () => {
  const h = mk14(); await h.settle();
  const off = /<button[^>]*data-lotrm="t1"[^>]* disabled>Retirer</.test(h.els.view.innerHTML);
  await pick13(h, "t1", ["c1", "c2"]);
  const v = h.els.view.innerHTML;
  return off && /data-lotrm="t1">Retirer 2 classes</.test(v) && /data-lotrm="t2"[^>]* disabled>Retirer</.test(v) && /data-lotgo="t1">Affecter 2 classes</.test(v) ? true : J({ off });
});
t("étape 14 : sans matière, toutes les affectations des classes cochées sont retirées, dans l'ordre, après confirmation", async () => {
  const h = mk14(); await h.settle();
  await pick13(h, "t1", ["c1", "c2", "c3"]);
  rm14(h, "t1").onclick(); await h.settle(200);
  const a = des14(h), m = h.els.msg.textContent, v = h.els.view.innerHTML, p = v.slice(v.indexOf('data-lotp="t1"'), v.indexOf('data-lotp="t2"'));
  return a.length === 3 && J(a.map((x) => x.p_classe)) === '["c2","c3","c1"]' && a.every((x) => x.p_user === "t1" && x.p_etab === "e1" && !("p_matiere" in x)) && h.confirms.length === 1 && /toutes matières/.test(h.confirms[0]) &&
    /3 classes retirées de Marie\./.test(m) && /Aucune classe sélectionnée/.test(p) ? true : J({ a, m, c: h.confirms });
});
t("étape 14 : avec une matière, seule cette matière est retirée ; une classe sans cette matière est sautée et signalée", async () => {
  const h = mk14(); await h.settle();
  await pick13(h, "t1", ["c1", "c2", "c3"]);
  h.el("lmt1").value = "m1";
  rm14(h, "t1").onclick(); await h.settle(200);
  const a = des14(h), m = h.els.msg.textContent;
  return a.length === 2 && J(a.map((x) => x.p_classe)) === '["c3","c1"]' && a.every((x) => x.p_matiere === "m1") && /Français/.test(h.confirms[0]) && /2 classes retirées de Marie \(1 non reçue\)/.test(m) ? true : J({ a, m });
});
t("étape 14 : un refus de confirmer n'envoie rien et garde la sélection", async () => {
  const h = mk14({ confirmAnswer: false }); await h.settle();
  await pick13(h, "t1", ["c1", "c2"]);
  rm14(h, "t1").onclick(); await h.settle(100);
  return des14(h).length === 0 && h.confirms.length === 1 && /2 classes sélectionnées/.test(h.els.view.innerHTML) ? true : J({ n: des14(h).length });
});
t("étape 14 : si l'enseignant n'a reçu aucune des classes cochées, aucun appel et un message clair", async () => {
  const h = mk14(); await h.settle();
  await pick13(h, "t2", ["c1"]);
  rm14(h, "t2").onclick(); await h.settle(100);
  return des14(h).length === 0 && h.confirms.length === 0 && /Paul n’a pas reçu cette classe/.test(h.els.msg.textContent) ? true : h.els.msg.textContent;
});
t("étape 14 : une classe en échec ne bloque pas les suivantes ; seule la sélection réussie est vidée", async () => {
  const h = mk14({}, (f) => (fn, a) => (fn === "etab_desaffecter" && a.p_classe === "c3" ? Object.assign(Promise.resolve({ data: null, error: { message: "boom" } }), { range() { return this; } }) : f(fn, a)));
  await h.settle();
  await pick13(h, "t1", ["c1", "c2", "c3"]);
  rm14(h, "t1").onclick(); await h.settle(200);
  const v = h.els.view.innerHTML, p = v.slice(v.indexOf('data-lotp="t1"'), v.indexOf('data-lotp="t2"')), m = h.els.msg.textContent;
  return des14(h).length === 2 && /2 classes retirées de Marie/.test(m) && /1 échec : 6e B/.test(m) && /1 classe sélectionnée/.test(p) && /data-lotc="t1\|c3"[^>]*checked/.test(p) ? true : J({ m });
});
t("étape 14 : une classe devenue introuvable est expliquée ; sans internet l'envoi s'arrête et dit combien de classes n'ont pas été envoyées", async () => {
  const h = mk14({}, (f) => (fn, a) => (fn === "etab_desaffecter" && a.p_classe === "c2" ? Object.assign(Promise.resolve({ data: { ok: false, err: "class_not_found" }, error: null }), { range() { return this; } }) : f(fn, a)));
  await h.settle();
  await pick13(h, "t1", ["c2"]);
  rm14(h, "t1").onclick(); await h.settle(150);
  const m1 = h.els.msg.textContent;
  const g = mk14({}, (f) => (fn, a) => (fn === "etab_desaffecter" && a.p_classe === "c3" ? Promise.reject(new Error("net")) : f(fn, a)));
  await g.settle();
  await pick13(g, "t1", ["c1", "c2", "c3"]);
  rm14(g, "t1").onclick(); await g.settle(200);
  const m2 = g.els.msg.textContent;
  return /Aucune classe retirée/.test(m1) && /classe introuvable/.test(m1) && des14(g).length === 1 && /1 classe retirée de Marie/.test(m2) && /pas d’internet/.test(m2) && /1 classe non envoyée/.test(m2) ? true : J({ m1, m2 });
});
t("étape 14 : sans classe cochée rien n'est envoyé ; un deuxième clic pendant l'envoi est ignoré ; « Affecter » n'est pas touché", async () => {
  const h = mk14(); await h.settle();
  rm14(h, "t1").onclick(); await h.settle(20);
  const none = des14(h).length === 0 && h.confirms.length === 0 && /Cochez au moins une classe/.test(h.els.msg.textContent);
  await pick13(h, "t1", ["c1", "c2"]);
  const b = rm14(h, "t1"); b.onclick(); b.onclick(); await h.settle(200);
  return none && des14(h).length === 2 && h.confirms.length === 1 && aff13(h).length === 0 ? true : J({ none, n: des14(h).length, c: h.confirms.length });
});
t("étape 14 : version et cache — aucun script SQL nécessaire, la fiche de nouveautés existe", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v116.md");
  return /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) && /Retirer/.test(fs.readFileSync(nv, "utf8")) && /etab_desaffecter/.test(rd("js", "etab-enseignants.js")) ? true : "cache";
});

/* ---- Bloc 3 — étape 15 : « Comment c'est calculé ? » sur chaque carte de graphique ---- */
const ge15 = () => rd("js", "graph-etab.js");
const geRun15 = (code, root) => new Function("document", "window", "Charts", ge15() + ";" + code)({ getElementById: (id) => (id === "ge" ? root : null) }, { Charts: { Chart: 1 } }, { Chart: 1, palette: ["a", "b", "c", "d", "e"] });
t("étape 15 : chaque titre de carte du fichier a son explication (aucun oubli), et aucune explication orpheline", () => {
  const src = ge15(), titles = [...src.matchAll(/out\.push\(\{k:"\w+",(?:\w+:1,)?t:"([^"]+)"/g)].map((m) => m[1]);
  const how = geRun15("return Object.keys(GE_HOW)", {});
  const missing = titles.filter((x) => how.indexOf(x) < 0), orphan = how.filter((x) => titles.indexOf(x) < 0);
  return titles.length === 16 && !missing.length && !orphan.length ? true : J({ n: titles.length, missing, orphan });
});
t("étape 15 : une explication est un bloc repliable « Comment c’est calculé ? » ; un titre inconnu n'en a pas ; le texte est échappé", () => {
  const r = geRun15('GE_HOW["Test <b>"]="a < b & c";return [geHow("Présence"),geHow("inconnu"),geHow("Test <b>")]', {});
  return /^<details class="ge-how"><summary>Comment c’est calculé \?<\/summary><p>[^<]+<\/p><\/details>$/.test(r[0]) && r[1] === "" && r[2].indexOf("a &lt; b &amp; c") > 0 ? true : J(r);
});
t("étape 15 : chaque carte dessinée porte son explication, après le graphique et dans la même carte", () => {
  const root = { dataset: { t: "eff" }, innerHTML: "", remove() { this.removed = true; }, querySelectorAll: () => [] };
  geRun15('geDraw({rows:[{class_label:"6e A"},{class_label:"6e A"},{class_label:"5e B"}],sortCls:function(a,b){return a<b?-1:1;},lvl:function(c){return c.split(" ")[0];},lvlRank:function(l){return l==="6e"?1:2;}})', root);
  const cards = root.innerHTML.split("</section>").filter((x) => x.indexOf("<section") >= 0);
  return cards.length === 2 && cards.every((c) => /<div data-ge="\d+"><\/div><p class="ge-scope">[^]*?<\/p><details class="ge-how"><summary>Comment c’est calculé \?<\/summary><p>[^<]+<\/p><\/details>$/.test(c)) && /Élèves par classe/.test(cards[0]) && /Répartition par niveau/.test(cards[1]) ? true : J({ n: cards.length, h: root.innerHTML.slice(0, 400) });
});
t("étape 15 : les explications citent les bonnes règles (seuils, tranches, 30 jours, 2 points)", () => {
  const H = JSON.parse(geRun15("return JSON.stringify(GE_HOW)", {}));
  return /appels − absences/.test(H["Présence"]) && /16 et plus/.test(H["Répartition des moyennes"]) && /2 points/.test(H["Distribution des moyennes"]) && /30 derniers jours/.test(H["Incidents par classe"]) &&
    /conseil de classe/.test(H["Passages proposés"]) && /médiane/.test(H["Moyennes par classe"]) && /Appel non fait/.test(H["Appel du jour"]) ? true : "règles";
});
t("étape 15 : style et cache — styles du bloc repliable, cache à jour, fiche de nouveautés", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v117.md");
  return /\.ge-how summary/.test(rd("css", "graph-etab.css")) && /css\/graph-etab\.css/.test(rd("sw.js")) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) && /Comment c’est calculé/.test(fs.readFileSync(nv, "utf8")) ? true : "cache";
});

/* ---- Bloc 3 — étape 16 : filtre matière clair (carte « Filtrer » visible, périmètre rappelé, listes « Matière » fusionnées) ---- */
class FakeChart16 { constructor(el, o) { this.o = o; this.el = el; FakeChart16.last = this; } pin() {} update(o) { this.o = o; } destroy() {} }
const geRun16 = (code, root, EL) => new Function("document", "window", "Charts", "DonutChart", "BarChart", "EL", ge15() + ";" + code)({ getElementById: (id) => (id === "ge" ? root : null) }, { Charts: { Chart: 1 } }, { Chart: 1, palette: ["a", "b", "c", "d", "e"] }, FakeChart16, FakeChart16, EL);
const el16 = () => ({ innerHTML: "", d: { innerHTML: "", textContent: "" }, w: { innerHTML: "" }, querySelector(q) { return q === ".ge-who" ? this.w : this.d; }, parentNode: { querySelector: () => ({ textContent: "" }) } });
const X16 = 'var M={ids:["s1","s2","s3"],S:{s1:{av:[10,14]},s2:{av:[12]},s3:{av:[8]}},byId:{s1:{name:"Ada",class_label:"6e A"},s2:{name:"Bob",class_label:"6e A"},s3:{name:"Cy",class_label:"5e B"}},SJ:{Maths:{},Fr:{}}};' +
  'var x={M:M,rows:[{},{},{},{}],mean:function(a){return a.length?a.reduce(function(p,q){return p+q;},0)/a.length:null;},sortCls:function(a,b){return a<b?-1:1;}};';
t("étape 16 : « Moyenne par classe » n'a plus de liste « Matière » et trace la moyenne des élèves de chaque classe", () => {
  const e = el16(); geRun16(X16 + "geBuildCls(EL,{o:{}},x);", null, e);
  const o = FakeChart16.last.o;
  return !/<select|Matière/.test(e.innerHTML) && J(o.labels) === '["5e B","6e A"]' && J(o.values) === "[8,12]" ? true : J({ h: e.innerHTML, o });
});
t("étape 16 : « Répartition des moyennes » n'a plus de liste « Matière » ; les élèves sont rangés par tranche, l'effectif de référence reste celui du périmètre", () => {
  const e = el16(); geRun16(X16 + "geBuildMoy(EL,{o:{}},x);", null, e);
  const o = FakeChart16.last.o;
  return !/<select|Matière/.test(e.innerHTML) && J(o.data.map((d) => d.value)) === "[0,0,2,0,1]" && o.total === 4 && /Touchez une part/.test(e.w.innerHTML) ? true : J({ h: e.innerHTML, o });
});
t("étape 16 : sans aucune moyenne, le message parle du périmètre et non d'une matière", () => {
  const e = el16(), f = el16();
  const base = 'var M={ids:["s1"],S:{s1:{av:[]}},byId:{s1:{name:"Ada",class_label:"6e A"}},SJ:{}};var x={M:M,rows:[{}],mean:function(a){return a.length?a[0]:null;},sortCls:function(a,b){return 0;}};';
  geRun16(base + "geBuildMoy(EL,{o:{}},x);", null, e); geRun16(base + "geBuildCls(EL,{o:{}},x);", null, f);
  return /Aucun élève n’a de moyenne pour ce périmètre/.test(e.w.innerHTML) && /Aucune classe n’a de moyenne pour ce périmètre/.test(f.d.innerHTML) ? true : J({ a: e.w.innerHTML, b: f.d.innerHTML });
});
t("étape 16 : sous chaque graphique, le périmètre du filtre de la page ; tout l'établissement quand la page n'a pas de filtre ; texte échappé", () => {
  const mk = () => ({ dataset: { t: "eff" }, innerHTML: "", remove() {}, querySelectorAll: () => [] });
  const base = 'rows:[{class_label:"6e A"}],sortCls:function(a,b){return 0;},lvl:function(c){return c.split(" ")[0];},lvlRank:function(l){return 1;}';
  const r1 = mk(), r2 = mk(), r3 = mk();
  geRun16("geDraw({" + base + ',scope:"6e A · Maths"})', r1); geRun16("geDraw({" + base + "})", r2); geRun16("geDraw({" + base + ',scope:"A <b> & B"})', r3);
  const n = (r) => (r.innerHTML.match(/<p class="ge-scope">/g) || []).length;
  return n(r1) === 2 && /<p class="ge-scope">Périmètre : <b>6e A · Maths<\/b><\/p>/.test(r1.innerHTML) && n(r2) === 2 && /Périmètre : <b>tous les élèves de l’établissement<\/b>/.test(r2.innerHTML) && /A &lt;b&gt; &amp; B/.test(r3.innerHTML) &&
    r1.innerHTML.indexOf("ge-scope") > r1.innerHTML.indexOf('data-ge="0"') && r1.innerHTML.indexOf("ge-scope") < r1.innerHTML.indexOf("ge-how") ? true : J({ n1: n(r1), h: r1.innerHTML.slice(0, 300) });
});
t("étape 16 : la carte « Filtrer » reste visible en haut (sticky), reste sur Accueil et Résultats même sans données, et la matière du filtre pilote les graphiques", () => {
  const css = rd("css", "etab-v86.css"), core = rd("js", "etab-core.js"), a = rd("js", "etab-accueil.js"), r = rd("js", "etab-resultats.js");
  return /#rfilt\{position:sticky;top:env\(safe-area-inset-top,0px\)/.test(css) && /<b>Filtrer<\/b>/.test(core) && /id=\\"rfilt\\"|id="rfilt"/.test(core) && /fbar=FL\.bar\(fo\)/.test(a) && /Aucune donnée publiée pour ces filtres[^]*?/.test(a) &&
    /h\+=FL\.bar\(o\)/.test(r) && /E\.model\(fv\.rows,fv\.dash\)/.test(a) && /scope:FL\.scope\(\)/.test(a) && /scope:FL\.scope\(\)/.test(r) ? true : "filtre";
});
t("étape 16 : cache et fiche de nouveautés", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v118.md");
  return /cm-v1[0-9][0-9]/.test(rd("sw.js")) && /css\/etab-v86\.css/.test(rd("sw.js")) && fs.existsSync(nv) && /Filtrer/.test(fs.readFileSync(nv, "utf8")) ? true : "cache";
});

/* ---- v119 : étape 17 — rappel au clic (option onPick) dans la bibliothèque graphique ---- */
class FakeNode17 {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.cls = new Set(); this.l = {}; this.text = ""; this.rect = { left: 0, top: 0, width: 360, height: 220 };
    const self = this; this.style = { setProperty(k, v) { this[k] = v; } };
    this.classList = { add(...c) { c.forEach((x) => self.cls.add(x)); }, remove(...c) { c.forEach((x) => self.cls.delete(x)); }, toggle(c, f) { (f === undefined ? !self.cls.has(c) : f) ? self.cls.add(c) : self.cls.delete(c); }, contains: (c) => self.cls.has(c) }; }
  set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.cls].join(" "); }
  setAttribute(k, v) { if (k === "class") this.className = v; else this.attrs[k] = String(v); }
  getAttribute(k) { return k === "class" ? this.className : (k in this.attrs ? this.attrs[k] : null); }
  hasAttribute(k) { return k === "class" ? this.cls.size > 0 : k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(n) { this.children.push(n); return n; }
  insertBefore(n) { this.children.unshift(n); return n; }
  set textContent(v) { this.children = []; this.text = String(v); }
  get textContent() { return this.text + this.children.map((c) => c.textContent || c.text || "").join(""); }
  addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); }
  removeEventListener(t, f) { this.l[t] = (this.l[t] || []).filter((x) => x !== f); }
  getBoundingClientRect() { return this.rect; }
  all(f, o = []) { this.children.forEach((c) => { if (c instanceof FakeNode17) { if (f(c)) o.push(c); c.all(f, o); } }); return o; }
  querySelector(sel) { return sel === "svg" ? this.all((n) => n.tag === "svg")[0] || null : null; }
  fire(type, e) { (this.l[type] || []).slice().forEach((f) => f(Object.assign({ type, preventDefault() {}, pointerType: "touch" }, e))); }
}
const env17 = (() => {
  const ctx17 = {
    console: { log() {}, error() {}, warn() {} }, setTimeout: () => 0, clearTimeout() {}, Date, Math, JSON, Promise, Array, Object, String, Number, Intl, isNaN, isFinite, parseFloat,
    performance: { now: () => 0 }, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, matchMedia: () => ({ matches: false }),
    document: { createElementNS: (ns, tag) => new FakeNode17(tag), createElement: (tag) => new FakeNode17(tag), createTextNode: (x) => ({ text: x }), querySelector: () => null },
  };
  ctx17.window = ctx17; vm.createContext(ctx17);
  ["core", "donut-chart", "charts", "charts-extra", "charts-more"].forEach((f) => vm.runInContext(rd("js", "graphiques", f + ".js"), ctx17, { filename: f + ".js" }));
  const make = (Cls, o) => { const root = new FakeNode17("div"); const ch = new ctx17[Cls](root, o); return { root, ch, svg: root.querySelector("svg"), hits: root.all((n) => n.hasAttribute("class") && n.cls.has("ch-hit")), has: (c) => root.all((n) => n.cls.has(c)) }; };
  return { make, ctx17 };
})();
const mk17 = env17.make;
const got17 = () => { const a = []; a.f = (i) => a.push(i); return a; };

t("étape 17 : sans onPick, aucun graphique n'ajoute de zone cliquable, de curseur ni de focus (rien de visible)", () => {
  const cfg = [["BarChart", { labels: ["a", "b"], values: [1, 2] }], ["BarChart", { labels: ["a"], series: [{ name: "x", values: [1] }, { name: "y", values: [2] }] }],
    ["HistogramChart", { values: [1, 2, 3, 4], min: 0, max: 5, bins: 5 }], ["BoxPlotChart", { groups: [{ label: "A", values: [1, 2, 3] }] }],
    ["LineChart", { labels: ["T1", "T2"], series: [{ name: "A", values: [1, 2] }] }], ["GaugeChart", { value: 80, zones: [{ to: 50, label: "Bas" }, { to: 100, label: "Haut" }] }],
    ["DonutChart", { data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }]];
  const bad = cfg.filter(([C, o]) => { const c = mk17(C, o); return c.root.cls.has("is-pickable") || c.has("is-pickable").length || (C === "GaugeChart" && c.has("ch-gz").some((n) => n.hasAttribute("tabindex"))); }).map((x) => x[0]);
  return bad.length === 0 ? true : J(bad);
});
t("étape 17 : barre simple — le clic et Entrée/Espace appellent onPick avec l'élément ; survol, toucher posé et focus ne l'appellent pas", () => {
  const g = got17(), c = mk17("BarChart", { labels: ["6A", "6B"], full: ["6e A", "6e B"], keys: ["id-a", "id-b"], values: [12, 9], onPick: g.f });
  const h = c.hits[1];
  h.fire("pointerenter", { pointerType: "mouse" }); h.fire("pointerdown"); h.fire("focus");
  const avant = g.length;
  h.fire("click"); h.fire("keydown", { key: "Enter" }); h.fire("keydown", { key: " " }); h.fire("keydown", { key: "a" });
  const i = g[0];
  return avant === 0 && g.length === 3 && i.kind === "bar" && i.index === 1 && i.label === "6e B" && i.short === "6B" && i.key === "id-b" && i.value === 9 && i.chart === c.ch && c.root.cls.has("is-pickable") && h.cls.has("is-pickable") ? true : J({ avant, n: g.length, i: g[0] && Object.assign({}, g[0], { chart: 0 }) });
});
t("étape 17 : barres empilées — un clic dans un segment donne la série touchée ; à côté d'un segment ou au clavier, seriesIndex est nul", () => {
  const g = got17(), c = mk17("BarChart", { labels: ["A", "B"], onPick: g.f, series: [{ name: "Justifiées", key: "j", values: [4, 0] }, { name: "Non justifiées", key: "n", values: [2, 5] }, { name: "Retards", key: "r", values: [1, 5] }] });
  const h = c.hits[0], at = (y) => { h.fire("click", { clientY: y }); return g[g.length - 1]; };
  const a = at(160), b = at(115), r = at(92), vide = at(60);
  h.fire("keydown", { key: "Enter" });
  const k = g[g.length - 1];
  return a.seriesIndex === 0 && a.seriesName === "Justifiées" && a.seriesKey === "j" && a.segmentValue === 4 && b.seriesIndex === 1 && b.seriesKey === "n" && r.seriesIndex === 2 && r.segmentValue === 1 &&
    vide.seriesIndex === null && vide.segmentValue === null && k.seriesIndex === null && k.value === 7 && J(k.series.map((s) => s.value)) === "[4,2,1]" ? true : J([a, b, r, vide].map((x) => [x.seriesIndex, x.segmentValue]));
});
t("étape 17 : histogramme — la tranche touchée donne ses bornes [de, à[ (la dernière garde sa borne haute), son effectif et son total", () => {
  const g = got17(), c = mk17("HistogramChart", { values: [3, 5, 5, 9, 10, 15, 19, 20], min: 0, max: 20, bins: 10, xUnit: "", onPick: g.f });
  c.hits[2].fire("click"); c.hits[9].fire("keydown", { key: "Enter" });
  const a = g[0], z = g[1];
  return a.kind === "histogram" && a.index === 2 && a.from === 4 && a.to === 6 && a.last === false && a.count === 2 && a.total === 8 && /4 – 6/.test(a.label) &&
    z.index === 9 && z.from === 18 && z.to === 20 && z.last === true && z.count === 2 ? true : J(g.map((x) => Object.assign({}, x, { chart: 0 })));
});
t("étape 17 : boîtes à moustaches — le groupe touché donne son nom, sa clé, son effectif et ses quartiles", () => {
  const g = got17(), c = mk17("BoxPlotChart", { onPick: g.f, groups: [{ label: "6e A", key: "ca", values: [8, 10, 12, 14] }, { label: "5e B", key: "cb", values: [6, 9, 13] }] });
  c.hits[1].fire("click");
  const i = g[0];
  return i.kind === "box" && i.index === 1 && i.label === "5e B" && i.key === "cb" && i.n === 3 && i.min === 6 && i.max === 13 && i.median === 9 && i.value === 9 ? true : J(Object.assign({}, i, { chart: 0 }));
});
t("étape 17 : courbe — le clic donne le point le plus proche et la série la plus proche du doigt ; au clavier, la première série qui a une valeur", () => {
  const g = got17(), c = mk17("LineChart", { labels: ["T1", "T2", "T3"], keys: ["t1", "t2", "t3"], min: 0, max: 20, gaps: true, onPick: g.f,
    series: [{ name: "6e A", key: "ca", values: [10, 12, 14] }, { name: "6e B", key: "cb", values: [4, 5, 6] }] });
  c.svg.fire("pointerdown", { clientX: 194 }); c.svg.fire("click", { clientY: 150 }); c.svg.fire("click", { clientY: 90 });
  c.svg.fire("keydown", { key: "ArrowLeft" }); c.svg.fire("keydown", { key: "Enter" });
  const [b, a, k] = g;
  return b.kind === "line" && b.index === 1 && b.label === "T2" && b.key === "t2" && b.seriesIndex === 1 && b.seriesName === "6e B" && b.seriesKey === "cb" && b.value === 5 &&
    a.seriesIndex === 0 && a.seriesKey === "ca" && a.value === 12 && k.index === 0 && k.seriesIndex === 0 && k.label === "T1" && J(k.values) === "[10,4]" ? true : J(g.map((x) => [x.index, x.seriesIndex]));
});
t("étape 17 : jauge — chaque zone de l'arc, sa ligne dans la liste et l'arc de la valeur renvoient la bonne zone", () => {
  const g = got17(), c = mk17("GaugeChart", { value: 80, label: "Présence", onPick: g.f, zones: [{ to: 50, label: "Sous le seuil" }, { to: 100, label: "Satisfaisant" }] });
  const zp = c.has("ch-gz"), li = c.has("ch-zone"), val = c.has("ch-gval")[0];
  zp[0].fire("click"); li[1].fire("click"); val.fire("keydown", { key: "Enter" });
  const [a, b, v] = g;
  return zp.length === 2 && zp.every((n) => n.attrs.tabindex === "0" && n.attrs.role === "button") && a.kind === "gauge" && a.index === 0 && a.label === "Sous le seuil" && a.from === 0 && a.to === 50 && a.value === 80 &&
    b.index === 1 && b.label === "Satisfaisant" && b.from === 50 && b.to === 100 && v.index === 1 && v.value === 80 ? true : J(g.map((x) => Object.assign({}, x, { chart: 0 })));
});
t("étape 17 : anneau — clic ou Entrée sur une part et sur sa ligne de légende ; le deuxième clic dit selected: false ; pin() seul ne prévient pas ; les parts nulles sont écartées", () => {
  const g = got17(), c = mk17("DonutChart", { onPick: g.f, data: [{ label: "Vide", value: 0, key: "v" }, { label: "Passable", value: 3, key: "p" }, { label: "Bien", value: 1, key: "b" }] });
  const seg = c.has("dc-seg"), items = c.has("dc-item");
  c.ch.pin(0); const apresPin = g.length; c.ch.pin(0);
  seg[0].fire("click"); seg[0].fire("click"); seg[1].fire("keydown", { key: "Enter" }); items[0].fire("click");
  const [a, b, d, e] = g;
  return apresPin === 0 && seg.length === 2 && a.kind === "donut" && a.index === 0 && a.label === "Passable" && a.key === "p" && a.value === 3 && a.share === 75 && a.selected === true && b.selected === false &&
    d.index === 1 && d.label === "Bien" && d.share === 25 && e.label === "Passable" && e.selected === true && c.root.cls.has("is-pickable") ? true : J(g.map((x) => Object.assign({}, x, { chart: 0 })));
});
t("étape 17 : une erreur dans onPick ne casse pas le graphique ; update() garde le rappel, et sans onPick la marque disparaît", () => {
  const c = mk17("BarChart", { labels: ["a", "b"], values: [1, 2], onPick() { throw new Error("boum"); } });
  let ok1 = true; try { c.hits[0].fire("click"); } catch (e) { ok1 = false; }
  const g = got17(); c.ch.update({ values: [3, 4], onPick: g.f });
  c.root.all((n) => n.cls.has("ch-hit"))[1].fire("click");
  const garde = g.length === 1 && g[0].value === 4 && c.root.cls.has("is-pickable");
  c.ch.update({ onPick: null });
  return ok1 && garde && !c.root.cls.has("is-pickable") && c.root.all((n) => n.cls.has("is-pickable")).length === 0 ? true : J({ ok1, garde });
});
t("étape 17 : rien de visible — seul js/graph-etab.js (étape 18) utilise onPick, la page Bilan et les pages du chef non ; style limité aux graphiques cliquables ; cache et fiche de nouveautés", () => {
  const util = ["js/graphiques.js", "js/etab-accueil.js", "js/etab-resultats.js", "js/etab-vie.js", "js/etab-fin.js"].filter((f) => /onPick/.test(rd(...f.split("/"))));
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v119.md");
  return util.length === 0 && /\.ch \.is-pickable \{ cursor: pointer; \}/.test(rd("css", "charts.css")) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) && /onPick/.test(fs.readFileSync(nv, "utf8")) ? true : J({ util });
});

/* ---- v120 : étape 18 — panneau « Qui est concerné ? » sur la Distribution des moyennes ---- */
class FakeChart18 { constructor(el, o) { this.o = o; this.el = el; FakeChart18.last = this; } pin() {} update(o) { this.o = o; } destroy() {} }
const el18 = () => ({ innerHTML: "", d: { innerHTML: "", textContent: "" }, w: { innerHTML: "" }, querySelector(q) { return q === ".ge-who" ? this.w : this.d; } });
const geRun18 = (code, EL) => new Function("document", "window", "Charts", "HistogramChart", "EL", ge15() + ";" + code)({ getElementById: () => null }, { Charts: { Chart: 1 } }, { Chart: 1, palette: ["a", "b", "c", "d", "e"] }, FakeChart18, EL);
const X18 = 'var M={ids:["s1","s2","s3","s4","s5"],S:{s1:{av:[10,14]},s2:{av:[12]},s3:{av:[8]},s4:{av:[20]},s5:{av:[]}},byId:{s1:{name:"Ada",class_label:"6e A"},s2:{name:"Bob <b>",class_label:"6e A"},s3:{name:"Cy",class_label:"5e B"},s4:{name:"Dan",class_label:"5e B"},s5:{name:"Eve",class_label:"5e B"}}};' +
  'var x={M:M,mean:function(a){return a.length?a.reduce(function(t,v){return t+v;},0)/a.length:null;}};';
const pick18 = (info) => { const e = el18(); geRun18(X18 + "geBuildHist(EL,{k:'HistogramChart',o:{a:1}},x,HistogramChart);", e); FakeChart18.last.o.onPick(info); return e; };
t("étape 18 : la distribution des moyennes est branchée sur le panneau ; l'invite s'affiche et le graphique reçoit onPick sans perdre ses options", () => {
  const e = el18(); geRun18(X18 + "geBuildHist(EL,{k:'HistogramChart',o:{a:1}},x,HistogramChart);", e);
  const src = ge15();
  return /Touchez une barre de l’histogramme/.test(e.w.innerHTML) && FakeChart18.last.o.a === 1 && typeof FakeChart18.last.o.onPick === "function" && /k:\"HistogramChart\",who:1,t:\"Distribution des moyennes\"/.test(src) && /c\.who&&x\.M&&x\.M\.S\)geBuildHist\(el,c,x,C\)/.test(src) ? true : J(e.w.innerHTML);
});
t("étape 18 : toucher une tranche liste les élèves dont la moyenne y tombe (borne basse comprise, haute exclue), du plus haut au plus bas, texte échappé", () => {
  const e = pick18({ index: 6, from: 12, to: 14, last: false });
  const h = e.w.innerHTML;
  return /Moyenne de 12 à moins de 14 · 2 élèves</.test(h) && /Ada/.test(h) && h.indexOf("Ada") < h.indexOf("Bob") && /Bob &lt;b&gt;/.test(h) && /12 \/ 20/.test(h) && !/Cy|Dan|Eve/.test(h) ? true : h;
});
t("étape 18 : la dernière tranche garde sa borne haute (20 compte) ; un élève sans moyenne n'est jamais listé", () => {
  const e = pick18({ index: 9, from: 18, to: 20, last: true });
  const f = pick18({ index: 4, from: 8, to: 10, last: false });
  return /Moyenne de 18 à 20 · 1 élève/.test(e.w.innerHTML) && /Dan/.test(e.w.innerHTML) && /Cy/.test(f.w.innerHTML) && /· 1 élève</.test(f.w.innerHTML) && !/Eve/.test(e.w.innerHTML + f.w.innerHTML) ? true : e.w.innerHTML + f.w.innerHTML;
});
t("étape 18 : une tranche vide le dit ; un deuxième toucher sur la même tranche referme la liste ; une autre tranche la remplace", () => {
  const e = el18(); geRun18(X18 + "geBuildHist(EL,{k:'HistogramChart',o:{}},x,HistogramChart);", e);
  const p = FakeChart18.last.o.onPick;
  p({ index: 0, from: 0, to: 2, last: false });
  const vide = e.w.innerHTML;
  p({ index: 0, from: 0, to: 2, last: false });
  const ferme = e.w.innerHTML;
  p({ index: 4, from: 8, to: 10, last: false });
  return /· 0 élève</.test(vide) && /Aucun élève dans cette tranche/.test(vide) && /Touchez une barre/.test(ferme) && /Cy/.test(e.w.innerHTML) && !/Ada/.test(e.w.innerHTML) ? true : J({ vide, ferme });
});
t("étape 18 : composant geWho — pluriel, au plus 60 lignes avec le reste compté, texte échappé, couleur ; explication de la carte mise à jour", () => {
  const b = { innerHTML: "" };
  const rows = Array.from({ length: 63 }, (_, i) => ({ name: "É" + i, cls: "C<", tag: "t" }));
  geRun18("geWho(EL).show({title:'T',color:'#fff',rows:" + J(rows) + "});", b);
  const n = (b.innerHTML.match(/class=\"dr\"/g) || []).length;
  const c = { innerHTML: "" }; geRun18("geWho(EL).show({title:'T',rows:[{name:'a',cls:'b',tag:'c'}]});", c);
  return n === 60 && /· 63 élèves</.test(b.innerHTML) && /… et 3 autres\./.test(b.innerHTML) && /C&lt;/.test(b.innerHTML) && /background:#fff/.test(b.innerHTML) && /· 1 élève</.test(c.innerHTML) && !/background/.test(c.innerHTML) && /Touchez une barre pour lister/.test(ge15()) ? true : J({ n, h: b.innerHTML.slice(-120) });
});
t("étape 18 : cache et fiche de nouveautés", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v120.md");
  return /cm-v1[0-9][0-9]/.test(rd("sw.js")) && /\.ge-more/.test(rd("css", "graph-etab.css")) && fs.existsSync(nv) && /Qui est concerné/.test(fs.readFileSync(nv, "utf8")) ? true : "cache";
});

/* ---- v121 : étape 19 — toucher une classe (barres et boîtes) affiche ses élèves ---- */
class FakeChart19 { constructor(el, o) { this.o = o; FakeChart19.last = this; } pin() {} update(o) { this.o = Object.assign({}, this.o, o); } destroy() {} }
const geRun19 = (code, EL) => new Function("document", "window", "Charts", "BarChart", "BoxPlotChart", "EL", ge15() + ";" + code)({ getElementById: () => null }, { Charts: { Chart: 1 } }, { Chart: 1, palette: ["a", "b", "c", "d", "e"] }, FakeChart19, FakeChart19, EL);
const X19 = 'var M={ids:["s1","s2","s3","s4","s5"],S:{s1:{av:[10,14]},s2:{av:[16]},s3:{av:[8]},s4:{av:[11]},s5:{av:[]}},byId:{s1:{name:"Ada",class_label:"6e A"},s2:{name:"Bob <i>",class_label:"6e A"},s3:{name:"Cy",class_label:"5e B"},s4:{name:"Dan",class_label:""},s5:{name:"Eve",class_label:"6e A"}},SJ:{}};' +
  'var x={M:M,mean:function(a){return a.length?a.reduce(function(t,v){return t+v;},0)/a.length:null;},sortCls:function(a,b){return a<b?-1:1;}};';
const bar19 = () => { const e = el16(); geRun19(X19 + "geBuildCls(EL,{o:{unit:'/20'}},x);", e); return { e, o: FakeChart19.last.o }; };
t("étape 19 : « Moyenne par classe » — le graphique reçoit les noms de classe (clés) et onPick, l'invite s'affiche", () => {
  const { e, o } = bar19();
  return J(o.keys) === '["","5e B","6e A"]' && J(o.labels) === '["?","5e B","6e A"]' && J(o.values) === "[11,8,14]" && typeof o.onPick === "function" && o.unit === "/20" && /Touchez une barre pour voir les élèves de la classe/.test(e.w.innerHTML) ? true : J({ k: o.keys, l: o.labels, v: o.values });
});
t("étape 19 : toucher une barre liste les élèves de la classe, du plus haut au plus bas, sans ceux qui n'ont pas de moyenne, texte échappé", () => {
  const { e, o } = bar19();
  o.onPick({ kind: "bar", index: 2, label: "6e A", key: "6e A", value: 14 });
  const h = e.w.innerHTML;
  return /6e A · moyenne 14 · 2 élèves</.test(h) && h.indexOf("Bob") < h.indexOf("Ada") && /Bob &lt;i&gt;/.test(h) && /16 \/ 20/.test(h) && /12 \/ 20/.test(h) && !/Eve|Cy|Dan/.test(h) ? true : h;
});
t("étape 19 : deuxième toucher sur la même classe referme ; autre classe remplace ; « sans classe » (clé vide) se liste aussi", () => {
  const { e, o } = bar19();
  const p = o.onPick;
  p({ index: 1, label: "5e B", key: "5e B", value: 8 }); const a = e.w.innerHTML;
  p({ index: 1, label: "5e B", key: "5e B", value: 8 }); const b = e.w.innerHTML;
  p({ index: 0, label: "?", key: "", value: 11 }); const c = e.w.innerHTML;
  p({ index: 0, label: "?", key: "", value: 11 }); p({ index: 0, label: "?", key: "", value: 11 });
  return /Cy/.test(a) && /Touchez une barre/.test(b) && /\? · moyenne 11 · 1 élève</.test(c) && /Dan/.test(c) && /\(sans classe\)/.test(c) && /Dan/.test(e.w.innerHTML) ? true : J({ a, b, c });
});
t("étape 19 : « Moyennes par classe » (boîtes) — onPick branché, toucher une boîte liste la classe avec sa médiane", () => {
  const e = el16(); geRun19(X19 + "geBuildBox(EL,{k:'BoxPlotChart',o:{min:0,max:20,groups:[{label:'6e A',key:'6e A',values:[12,16]}]}},x,BoxPlotChart);", e);
  const o = FakeChart19.last.o;
  const hint = e.w.innerHTML;
  o.onPick({ kind: "box", index: 0, label: "6e A", key: "6e A", median: 14 });
  const src = ge15();
  return o.max === 20 && /Touchez une boîte/.test(hint) && /6e A · médiane 14 · 2 élèves</.test(e.w.innerHTML) && /Ada/.test(e.w.innerHTML) && /k:\"BoxPlotChart\",box:1,t:\"Moyennes par classe\"/.test(src) && /g\.push\(\{label:k\|\|\"\?\",key:k,/.test(src) && /c\.box&&x\.M&&x\.M\.S\)geBuildBox\(el,c,x,C\)/.test(src) ? true : e.w.innerHTML;
});
t("étape 19 : cache et fiche de nouveautés", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v121.md");
  return /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) && /Moyennes par classe/.test(fs.readFileSync(nv, "utf8")) && /touchez une boîte pour les lister/.test(ge15()) ? true : "cache";
});
const X20 = 'var M={ids:["s1","s2","s3","s4"],S:{s1:{n:20,a:5,av:[]},s2:{n:20,a:1,av:[]},s3:{n:20,a:0,av:[]},s4:{n:10,a:5,av:[]}},byId:{s1:{name:"Ada <b>",class_label:"6e A"},s2:{name:"Bob",class_label:"6e A"},s3:{name:"Cy",class_label:"6e A"},s4:{name:"Dan",class_label:"5e B"}},SJ:{}};var x={M:M,pc:function(n,a){return n?100*(n-a)/n:null;}};';
const pres20 = () => { const e = el16(); geRun19(X20 + "geBuildPres(EL,{o:{unit:'%',keys:['6e A','5e B']}},x);", e); return { e, o: FakeChart19.last.o }; };
t("étape 20 : « Présence par classe » — onPick et clés branchés, invite affichée", () => {
  const { e, o } = pres20();
  return typeof o.onPick === "function" && /Touchez une barre pour voir les élèves de la classe qui ont le plus d’absences/.test(e.w.innerHTML) && J(o.keys) === '["6e A","5e B"]' ? true : e.w.innerHTML;
});
t("étape 20 : toucher une barre liste les élèves avec absences, le plus d'absences d'abord, texte échappé, sans ceux sans absence", () => {
  const { e, o } = pres20();
  o.onPick({ kind: "bar", index: 0, label: "6e A", key: "6e A", value: 85 });
  const h = e.w.innerHTML;
  return /6e A · présence 85 % · 2 élèves</.test(h) && h.indexOf("Ada") < h.indexOf("Bob") && /Ada &lt;b&gt;/.test(h) && /5 absences · 75 %/.test(h) && /1 absence · 95 %/.test(h) && !/Cy|Dan/.test(h) ? true : h;
});
t("étape 20 : deuxième toucher referme ; autre classe remplace", () => {
  const { e, o } = pres20();
  o.onPick({ index: 1, label: "5e B", key: "5e B", value: 50 }); const a = e.w.innerHTML;
  o.onPick({ index: 1, label: "5e B", key: "5e B", value: 50 }); const b = e.w.innerHTML;
  return /Dan/.test(a) && /5 absences · 50 %/.test(a) && /Touchez une barre/.test(b) ? true : J({ a, b });
});
t("étape 20 : carte branchée dans geCards / geDraw, cache et fiche de nouveautés", () => {
  const src = ge15(), nv = path.join(__dirname, "..", "NOUVEAUTES-v122.md");
  return /pres:1,t:"Présence par classe"/.test(src) && /keys:ka,/.test(src) && /c\.pres&&x\.M&&x\.M\.S\)geBuildPres\(el,c,x\)/.test(src) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) ? true : "manque";
});
const X21 = 'var M={ids:["s1","s2","s3","s4"],S:{s1:{n:20,a:5,j:1,r:0,av:[]},s2:{n:20,a:3,j:3,r:2,av:[]},s3:{n:20,a:0,j:0,r:0,av:[]},s4:{n:10,a:2,j:0,r:1,av:[]}},byId:{s1:{name:"Ada <b>",class_label:"6e A"},s2:{name:"Bob",class_label:"6e A"},s3:{name:"Cy",class_label:"6e A"},s4:{name:"Dan",class_label:"5e B"}},SJ:{}};var x={M:M};';
const abs21 = () => { const e = el16(); geRun19(X21 + "geBuildAbs(EL,{o:{series:[{key:'j',color:'#111'},{key:'nj',color:'#222'},{key:'r',color:'#333'}]}},x);", e); return { e, o: FakeChart19.last.o }; };
t("étape 21 : « Absences et retards » — onPick branché, invite affichée", () => {
  const { e, o } = abs21();
  return typeof o.onPick === "function" && /Touchez un segment/.test(e.w.innerHTML) ? true : e.w.innerHTML;
});
t("étape 21 : segment non justifiées — élèves concernés, le plus grand nombre d'abord, texte échappé", () => {
  const { e, o } = abs21();
  o.onPick({ index: 0, label: "6e A", key: "6e A", seriesIndex: 1, seriesKey: "nj", segmentValue: 4, value: 8 });
  const h = e.w.innerHTML;
  return /6e A · non justifiées 4 · 1 élève</.test(h) && /Ada &lt;b&gt;/.test(h) && /4 non justifiées/.test(h) && !/Bob|Cy|Dan/.test(h) && /#222/.test(h) ? true : h;
});
t("étape 21 : justifiées, retards, même segment referme, à côté d'un segment remet l'invite", () => {
  const { e, o } = abs21();
  const p = (k, i) => o.onPick({ index: 0, label: "6e A", key: "6e A", seriesIndex: i, seriesKey: k, segmentValue: 1 });
  p("j", 0); const a = e.w.innerHTML;
  p("r", 2); const b = e.w.innerHTML;
  p("r", 2); const c = e.w.innerHTML;
  p("j", 0); o.onPick({ index: 0, label: "6e A", key: "6e A", seriesIndex: null }); const d = e.w.innerHTML;
  return /Bob/.test(a) && /3 justifiées/.test(a) && /Ada/.test(a) && /2 retards/.test(b) && /Touchez un segment/.test(c) && /Touchez un segment/.test(d) ? true : J({ a, b, c, d });
});
t("étape 21 : carte branchée, cache et fiche de nouveautés", () => {
  const src = ge15(), nv = path.join(__dirname, "..", "NOUVEAUTES-v123.md");
  return /abs:1,t:"Absences et retards"/.test(src) && /key:"nj"/.test(src) && /c\.abs&&x\.M&&x\.M\.S\)geBuildAbs\(el,c,x\)/.test(src) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) ? true : "manque";
});
const X22 = 'var M={ids:["s1","s2","s3","s4"],S:{s1:{n:20,a:8,av:[12],bs:{Maths:[12,14]},t:[[10],[12],[]]},s2:{n:20,a:1,av:[16],bs:{Maths:[16],Fr:[8]},t:[[14],[16],[]]},s3:{n:0,a:0,av:[],bs:{},t:[[],[],[]]},s4:{n:10,a:5,av:[9],bs:{Fr:[9]},t:[[],[9],[]]}},byId:{s1:{name:"Ada <b>",class_label:"6e A"},s2:{name:"Bob",class_label:"6e A"},s3:{name:"Cy",class_label:"6e A"},s4:{name:"Dan",class_label:"5e B"}},SJ:{}};var x={M:M,pc:function(n,a){return n?100*(n-a)/n:null;},mean:function(a){return a&&a.length?a.reduce(function(s,v){return s+v;},0)/a.length:null;}};';
const run22 = (call) => { const e = el16(); new Function("document", "window", "Charts", "FC", "EL", ge15() + ";" + X22 + call)({ getElementById: () => null }, { Charts: { Chart: 1 } }, { Chart: 1, palette: [] }, FakeChart19, e); return { e, o: FakeChart19.last.o }; };
t("étape 22 : jauge — toucher une zone liste les élèves de la zone, les moins présents d'abord, sans ceux sans appel", () => {
  const { e, o } = run22("geBuildJauge(EL,{o:{}},x,FC);");
  const hint = e.w.innerHTML;
  o.onPick({ index: 0, label: "Sous le seuil", from: 0, to: 75, color: "#f00", value: 80 });
  const a = e.w.innerHTML;
  o.onPick({ index: 1, label: "Satisfaisant", from: 75, to: 100, color: "#0f0", value: 80 });
  const b = e.w.innerHTML;
  return /Touchez une zone de l’arc/.test(hint) && /Sous le seuil · 2 élèves/.test(a) && a.indexOf("Dan") < a.indexOf("Ada") && /Ada &lt;b&gt;/.test(a) && /60 % · 8 absences/.test(a) && /Satisfaisant · 1 élève</.test(b) && /Bob/.test(b) && !/Cy/.test(a + b) ? true : J({ a, b });
});
t("étape 22 : jauge — même zone une deuxième fois referme", () => {
  const { e, o } = run22("geBuildJauge(EL,{o:{}},x,FC);");
  const i = { index: 1, label: "Satisfaisant", from: 75, to: 100, color: "#0f0" };
  o.onPick(i); o.onPick(i);
  return /Touchez une zone/.test(e.w.innerHTML) ? true : e.w.innerHTML;
});
t("étape 22 : évolution — toucher un point liste la classe de la courbe pour le trimestre touché, la plus haute moyenne d'abord", () => {
  const { e, o } = run22("geBuildEvo(EL,{o:{}},x,FC);");
  const i = { index: 1, label: "T2", seriesIndex: 0, seriesName: "6e A", seriesKey: "6e A", value: 14 };
  o.onPick(i); const a = e.w.innerHTML;
  o.onPick(i); const b = e.w.innerHTML;
  o.onPick({ index: 2, label: "T3", seriesIndex: 0, seriesName: "6e A", seriesKey: "6e A", value: null }); const c = e.w.innerHTML;
  return /6e A · T2 · moyenne 14 · 2 élèves/.test(a) && a.indexOf("Bob") < a.indexOf("Ada") && /16 \/ 20/.test(a) && !/Dan/.test(a) && /Touchez un point/.test(b) && /Aucun élève de cette classe n’a de moyenne ce trimestre/.test(c) ? true : J({ a, b, c });
});
t("étape 22 : matière — toucher une barre liste les élèves qui ont une moyenne dans la matière", () => {
  const { e, o } = run22("geBuildSubj(EL,{o:{}},x,FC);");
  o.onPick({ index: 0, label: "Maths", key: "Maths", value: 14 }); const a = e.w.innerHTML;
  o.onPick({ index: 1, label: "Fr", key: "Fr", value: 8.5 }); const b = e.w.innerHTML;
  return /Maths · moyenne 14 · 2 élèves/.test(a) && a.indexOf("Bob") < a.indexOf("Ada") && /16 \/ 20/.test(a) && /13 \/ 20/.test(a) && /Fr · moyenne 8,5 · 2 élèves/.test(b) && /Dan/.test(b) && /8 \/ 20/.test(b) ? true : J({ a, b });
});
t("étape 22 : cartes branchées, cache et fiche de nouveautés", () => {
  const src = ge15(), nv = path.join(__dirname, "..", "NOUVEAUTES-v124.md");
  return /jauge:1,t:"Présence"/.test(src) && /evo:1,t:"Évolution par trimestre"/.test(src) && /key:k,color:P/.test(src) && /subj:1,t:"Moyenne par matière"/.test(src) && /keys:sk,/.test(src) && /geBuildJauge\(el,c,x,C\)/.test(src) && /geBuildEvo\(el,c,x,C\)/.test(src) && /geBuildSubj\(el,c,x,C\)/.test(src) && /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) ? true : "manque";
});
t("étape 23 : aucun appel réseau dans graph-etab.js, les listes se calculent sur l'appareil (donc aussi hors ligne)", () => {
  const src = ge15();
  return !/\bfetch\s*\(|XMLHttpRequest|\.rpc\s*\(|\bsb\.|supabase|navigator\.sendBeacon|localStorage|indexedDB/.test(src) ? true : "réseau ou stockage trouvé";
});
t("étape 23 : les données des cartes sont gardées hors ligne et les fichiers sont dans le cache de l'application", () => {
  const off = rd("js", "etab-offline.js"), sw = rd("sw.js");
  return /"admin_dashboard"/.test(off) && /"registry_students"/.test(off) && /js\/graph-etab\.js/.test(sw) && /css\/graph-etab\.css/.test(sw) && /graphiques\/core\.js/.test(sw) && /graphiques\/charts\.js/.test(sw) && /graphiques\/charts-more\.js/.test(sw) && /graphiques\/charts-extra\.js/.test(sw) && /graphiques\/donut-chart\.js/.test(sw) ? true : "manque";
});
t("étape 23 : les neuf cartes cliquables sont branchées ; leur texte « Comment c'est calculé ? » mentionne le geste (sauf l'anneau, dont l'invite est dans la carte)", () => {
  const src = ge15();
  const cartes = [["moy:1", "Répartition des moyennes", null], ["cls:1", "Moyenne par classe", /Touchez une barre pour lister/], ["who:1", "Distribution des moyennes", /Touchez une barre pour lister/], ["box:1", "Moyennes par classe", /touchez une boîte/], ["pres:1", "Présence par classe", /Touchez une barre pour lister/], ["abs:1", "Absences et retards", /Touchez un segment/], ["jauge:1", "Présence", /Touchez une zone/], ["evo:1", "Évolution par trimestre", /Touchez un point/], ["subj:1", "Moyenne par matière", /Touchez une barre pour lister/]];
  const manque = [];
  cartes.forEach(([flag, titre, geste]) => {
    if (!src.includes(flag + ',t:"' + titre + '"')) manque.push(titre + " : carte");
    if (geste) {
      const how = new RegExp('"' + titre + '":"([^"]*)"').exec(src);
      if (!how || !geste.test(how[1])) manque.push(titre + " : texte");
    }
  });
  return manque.length === 0 ? true : J(manque);
});
t("étape 23 : cache et fiche de nouveautés", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v125.md");
  return /cm-v1[0-9][0-9]/.test(rd("sw.js")) && fs.existsSync(nv) && /hors ligne/.test(fs.readFileSync(nv, "utf8")) ? true : "cache";
});
const sqlV105 = rd("supabase", "fiche-eleve-v105.sql");
const sqlV105code = sqlV105.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
t("étape 24 : etab_eleve_fiche — réservée au chef de l'établissement de l'élève, refusée aux anonymes", () =>
  /create or replace function public\.etab_eleve_fiche\(p_student uuid\)/.test(sqlV105code) && /security definer/.test(sqlV105code) && /set search_path = ''/.test(sqlV105code) &&
  /is_etab_admin\(g\.etab_id\)/.test(sqlV105code) && /raise exception 'not admin'/.test(sqlV105code) &&
  /revoke all on function public\.etab_eleve_fiche\(uuid\) from public/.test(sqlV105code) && /grant execute on function public\.etab_eleve_fiche\(uuid\) to authenticated/.test(sqlV105code) && !/to anon/.test(sqlV105code) ? true : "droits");
t("étape 24 : etab_eleve_fiche — ne renvoie ni code, ni téléphone, ni référence ; ne modifie rien (lecture seule, additif)", () => {
  const out = sqlV105code.slice(sqlV105code.indexOf("select jsonb_build_object("), sqlV105code.indexOf("into res"));
  return !/g\.code|g\.phone|g\.ref\b|'code'|'phone'|'ref'/.test(out) && /'id', g\.id, 'name', g\.name, 'class_label', g\.class_label/.test(out) &&
    !/\b(insert|update|delete|alter|drop|truncate)\b/i.test(sqlV105code.replace(/'[^']*'/g, "")) && /\bstable\b/.test(sqlV105code) ? true : out;
});
t("étape 24 : etab_eleve_fiche — les cinq blocs attendus, lectures sûres, limites", () =>
  ["'subjects'", "'evals'", "'abs'", "'dis'", "'student'"].every((k) => sqlV105code.includes(k)) && /safe_num/.test(sqlV105code) && /safe_int/.test(sqlV105code) && /safe_date/.test(sqlV105code) &&
  /limit 300/.test(sqlV105code) && /limit 400/.test(sqlV105code) && /limit 100/.test(sqlV105code) && /left\(coalesce\(e->>'t', ''\), 400\)/.test(sqlV105code) && /jsonb_typeof/.test(sqlV105code) && /if not found then return null/.test(sqlV105code) ? true : "blocs");
t("étape 24 : mode d'emploi, cache et fiche de nouveautés", () => {
  const nv = path.join(__dirname, "..", "NOUVEAUTES-v126.md");
  return /fiche-eleve-v105\.sql/.test(rd("supabase", "LISEZ-MOI.md")) && /cm-v126/.test(rd("sw.js")) && fs.existsSync(nv) && /fiche-eleve-v105\.sql/.test(fs.readFileSync(nv, "utf8")) ? true : "doc";
});
