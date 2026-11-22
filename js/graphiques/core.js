/*!
 * Charts core — utilitaires et classe de base partagés par tous les graphiques.
 * À charger AVANT donut-chart.js, charts.js et charts-extra.js.
 *
 * Fournit : Charts.config(), Charts.palette, Charts.Chart (classe de base).
 * Chaque graphique dispose de : update(options), setState('loading'|'error'|'empty'|'ready'), destroy().
 */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const Charts = (global.Charts = global.Charts || {});
  let uid = 0;

  /* ----------------------------------------------------------- configuration */
  const settings = {
    locale: 'fr-FR',
    texts: {
      empty: 'Aucune donnée à afficher',
      emptyHint: 'Les données apparaîtront ici dès qu’elles seront disponibles.',
      loading: 'Chargement du graphique…',
      error: 'Impossible d’afficher ce graphique',
      retry: 'Réessayer',
      avg: 'Moy.',
      less: 'Moins',
      more: 'Plus',
      record: 'Record',
      total: 'Total',
      income: 'Entrée',
      outcome: 'Sortie',
      cumul: 'cumul',
      goal: 'Objectif',
      exceeded: 'objectif dépassé',
      conversion: '% de conversion',
      shareOfTotal: 'du total',
      avgOver: 'moyenne sur {n} jours',
      activeDays: '{a} jours actifs sur {n}',
      day: 'Jour',
      series: 'Série',
      item: 'Élément',
      step: 'Étape',
      values: 'Valeurs',
      size: 'Taille',
      items: 'éléments',
      mean: 'Moyenne',
      median: 'Médiane',
      min: 'Min',
      max: 'Max',
      count: 'Effectif',
      value: 'Valeur',
      label: 'Libellé',
      interval: 'Intervalle',
      group: 'Groupe',
      exportCsv: 'Exporter en CSV',
      exportSvg: 'Exporter en SVG',
      exportPng: 'Exporter en PNG'
    }
  };

  /** Réglage global : Charts.config({ locale: 'fr-CG', texts: { avg: 'Moyenne' } }) */
  Charts.config = function (o) {
    if (!o) return settings;
    if (o.locale) settings.locale = o.locale;
    if (o.texts) Object.assign(settings.texts, o.texts);
    return settings;
  };

  /** Palette partagée : tous les graphiques piochent ici quand aucune couleur n’est donnée. */
  Charts.palette = ['#8b7cff', '#35d6c9', '#ff6b9a', '#ffc15a', '#38bdf8', '#b6f23c', '#94a3b8'];
  Charts.colors = { up: '#35d6c9', down: '#ff6b9a', total: '#8b7cff', accent: '#8b7cff' };

  /* --------------------------------------------------------------- utilitaires */
  const fmtCache = {};
  function formatter(locale, max) {
    const k = locale + '|' + max;
    return fmtCache[k] || (fmtCache[k] = new Intl.NumberFormat(locale, { maximumFractionDigits: max }));
  }
  const reduceMotion = () => !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const finite = (v, fallback) =>
    typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : fallback;
  const maxOf = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity);
  const minOf = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const ratio = (a, b) => (b > 0 ? a / b : 0);
  const pct = (a, b) => Math.round(ratio(a, b) * 100);
  const el = (r) => (typeof r === 'string' ? document.querySelector(r) : r);

  function $s(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function $h(tag, cls, parent, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function mix(hex, t) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
    const n = parseInt(h, 16), m = (c) => Math.round(c + (255 - c) * t);
    return 'rgb(' + m(n >> 16) + ',' + m((n >> 8) & 255) + ',' + m(n & 255) + ')';
  }

  /**
   * Échelle « propre » avec ligne de base à zéro. Gère les valeurs négatives,
   * les séries toutes nulles et les plages dégénérées (jamais de division par zéro).
   */
  function niceRange(lo, hi, ticks) {
    ticks = ticks || 4;
    lo = Math.min(0, isFinite(lo) ? lo : 0);
    hi = Math.max(0, isFinite(hi) ? hi : 0);
    if (hi === lo) hi = ticks; // tout est à 0 : on affiche une échelle 0…4
    const raw = (hi - lo) / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw - 1e-12);
    const r = (v) => +v.toPrecision(12);
    const min = r(Math.floor(lo / step + 1e-9) * step), max = r(Math.ceil(hi / step - 1e-9) * step);
    return { min, max, step: r(step), count: Math.max(1, Math.round((max - min) / step)) };
  }
  /** Plage imposée par l’appelant (ex. yMax: 20), sinon plage automatique. */
  function fixedRange(lo, hi, forcedMax, ticks) {
    ticks = ticks || 4;
    const min = Math.min(0, lo);
    if (!(forcedMax > min)) return niceRange(lo, hi, ticks);
    return { min, max: forcedMax, step: (forcedMax - min) / ticks, count: ticks };
  }
  /** Plage sans ligne de base à zéro (nuages de points) : min imposé, max imposé ou déduit. */
  function spanRange(lo, hi, forcedMin, forcedMax, ticks) {
    ticks = ticks || 4;
    if (forcedMin == null && forcedMax == null) return null;
    const a = forcedMin != null ? forcedMin : lo;
    let b = forcedMax != null ? forcedMax : hi;
    const r = (v) => +v.toPrecision(12);
    if (!(b > a)) b = a + ticks;
    if (forcedMin != null && forcedMax != null) return { min: r(a), max: r(b), step: r((b - a) / ticks), count: ticks };
    const raw = (b - a) / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw - 1e-12);
    return { min: r(a), max: r(a + step * ticks), step: r(step), count: ticks };
  }
  /** Quantile par interpolation linéaire sur un tableau trié (q entre 0 et 1). */
  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  const scale = (r, v, a, b) => a + (1 - (v - r.min) / (r.max - r.min)) * (b - a);

  /** Courbe lissée (Catmull-Rom) sans dépassement vertical. Nécessite au moins 2 points. */
  function smooth(p) {
    let d = 'M' + p[0][0] + ',' + p[0][1];
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
      const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, lo, hi);
      const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6, lo, hi);
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6) + ',' + c1y + ' ' + (p2[0] - (p3[0] - p1[0]) / 6) + ',' + c2y + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }

  /* ------------------------------------------------------------ classe de base */
  class Chart {
    constructor(root, options) {
      this.root = el(root);
      if (!this.root) { console.error('[Charts] conteneur introuvable :', root); return; }
      this.o = Object.assign({}, this.constructor.defaults, options);
      this.id = 'ch' + ++uid;
      this._reset();
      this.state = this.o.state || 'ready';
      this.mount();
    }

    /* ---- formatage (locale et textes configurables, globalement ou par graphique) */
    get locale() { return this.o.locale || settings.locale; }
    t(key) { return (this.o.texts && this.o.texts[key]) || settings.texts[key]; }
    num(v, max) { return formatter(this.locale, max != null ? max : this.o.decimals != null ? this.o.decimals : 1).format(v); }
    /** Étiquettes d’axe : 2 décimales au plus, notation compacte au-delà de 10 000. */
    axis(v) {
      const a = Math.abs(v), s = v < 0 ? '−' : '';
      if (a >= 1e6) return s + formatter(this.locale, 1).format(a / 1e6) + '\u00a0M';
      if (a >= 1e4) return s + Math.round(a / 1e3) + '\u00a0k';
      return s + formatter(this.locale, 2).format(a);
    }
    signed(v, max) { return (v > 0 ? '+' : v < 0 ? '−' : '') + this.num(Math.abs(v), max); }

    /* ---- cycle de vie */
    _reset() { this._timers = []; this._frames = []; this._observers = []; this._listeners = []; }
    cleanup() {
      this._timers.forEach(clearTimeout);
      this._frames.forEach(cancelAnimationFrame);
      this._observers.forEach((o) => o.disconnect());
      this._listeners.forEach((l) => l[0].removeEventListener(l[1], l[2], l[3]));
      if (this.teardown) this.teardown();
      this._reset();
    }
    on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); this._listeners.push([target, ev, fn, opts]); }
    later(fn, ms) { const id = setTimeout(fn, ms); this._timers.push(id); return id; }
    raf(fn) { const id = requestAnimationFrame(fn); this._frames.push(id); return id; }
    raf2(fn) { this.raf(() => this.raf(fn)); }
    /** Lance l’animation d’entrée seulement quand le graphique devient visible à l’écran. */
    reveal(fn) {
      if (reduceMotion() || !('IntersectionObserver' in global)) { this.raf2(fn); return; }
      let started = false;
      const go = () => { if (started) return; started = true; io.disconnect(); this.raf2(fn); };
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) go();
      }, { threshold: 0.2 });
      io.observe(this.root);
      this._observers.push(io);
      this.later(go, 2500);   // repli : l'animation démarre même si le navigateur n'envoie rien
    }
    get motion() { return !reduceMotion(); }

    mount() {
      this.cleanup();
      const r = this.root;
      r.textContent = '';
      r.classList.add('ch');
      (this.constructor.cls || []).forEach((c) => r.classList.add(c));
      r.removeAttribute('aria-busy');
      this._built = false;
      this.tableData = null;
      if (this.state === 'loading') return this.showState('loading');
      if (this.state === 'error') return this.showState('error', this.message);
      let ok = false;
      try { ok = this.prepare(); } catch (e) { console.error('[Charts]', e); this.state = 'error'; return this.showState('error'); }
      if (!ok) { this.state = 'empty'; return this.showState('empty', this.message); }
      try { this.build(); this._built = true; this.fitText(); } catch (e) {
        console.error('[Charts]', e);
        this.cleanup(); r.textContent = ''; this.state = 'error'; this.showState('error');
      }
    }
    /**
     * Mesure l'échelle réelle du SVG (--ch-k = pixels écran par unité du dessin) pour que les textes
     * ne descendent jamais sous 10 px à l'écran, même sur un petit téléphone.
     */
    fitText() {
      const root = this.root;
      const apply = () => {
        const s = root.querySelector('svg');
        if (!s || !s.viewBox || !s.viewBox.baseVal || !s.viewBox.baseVal.width) return;
        const w = s.getBoundingClientRect().width;
        if (w) root.style.setProperty('--ch-k', (w / s.viewBox.baseVal.width).toFixed(3));
      };
      apply();
      if ('ResizeObserver' in global) {
        const ro = new ResizeObserver(apply);
        ro.observe(root);
        this._observers.push(ro);
      }
    }
    showState(kind, message) {
      const r = this.root;
      r.textContent = '';
      const box = $h('div', 'ch-state is-' + kind, r);
      box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
      if (kind === 'loading') {
        r.setAttribute('aria-busy', 'true');
        $h('span', 'ch-sr', box, this.t('loading'));
        for (let i = 0; i < 3; i++) $h('div', 'ch-skel', box).style.width = [92, 68, 80][i] + '%';
        return;
      }
      $h('div', 'ch-state-ico', box, kind === 'error' ? '!' : '∅').setAttribute('aria-hidden', 'true');
      $h('div', 'ch-state-t', box, message || this.t(kind));
      if (kind === 'empty') $h('div', 'ch-state-h', box, this.t('emptyHint'));
      if (kind === 'error' && typeof this.o.onRetry === 'function') {
        const b = $h('button', 'ch-btn', box, this.t('retry'));
        b.type = 'button';
        b.addEventListener('click', () => this.o.onRetry(this));
      }
    }

    /** setState('loading') pendant un chargement, setState('error', 'message') en cas d’échec. */
    setState(kind, message) { this.state = kind; this.message = message; this.mount(); return this; }
    /** update({ values: [...] }) fusionne les options et redessine. */
    update(patch) {
      if (patch) Object.assign(this.o, patch);
      this.state = 'ready'; this.message = undefined;
      this.mount();
      return this;
    }
    destroy() {
      if (!this.root) return;
      this.cleanup();
      this.root.textContent = '';
      this.root.classList.remove('ch');
      (this.constructor.cls || []).forEach((c) => this.root.classList.remove(c));
      this._built = false;
    }

    /* ---- alternative accessible : tableau de données + exports */
    /**
     * Ajoute un tableau de données masqué visuellement (lecteurs d'écran) et le mémorise
     * pour l'export CSV. Chaque graphique l'appelle une fois dans build().
     */
    dataTable(caption, cols, rows) {
      this.tableData = { caption, cols, rows };
      const t = $h('table', '', $h('div', 'ch-sr', this.root));
      $h('caption', '', t, caption);
      const hr = $h('tr', '', $h('thead', '', t));
      cols.forEach((c) => { $h('th', '', hr, c).scope = 'col'; });
      const tb = $h('tbody', '', t);
      rows.forEach((r) => {
        const tr = $h('tr', '', tb);
        r.forEach((c, i) => {
          const cell = $h(i === 0 ? 'th' : 'td', '', tr, c == null ? '' : String(c));
          if (i === 0) cell.scope = 'row';
        });
      });
      return t;
    }
    /** Contenu CSV (séparateur « ; » pour Excel en français), sans BOM. */
    toCSV() {
      const t = this.tableData;
      if (!t) return '';
      const esc = (v) => { v = v == null ? '' : String(v); return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      return [t.cols].concat(t.rows).map((r) => r.map(esc).join(';')).join('\r\n');
    }
    /**
     * SVG autonome : les styles calculés (couleurs des jetons, polices) sont recopiés
     * en ligne pour que le fichier s'affiche partout, hors de la page.
     */
    toSVG() {
      const src = this.root && this.root.querySelector('svg');
      if (!src || !src.viewBox || !src.viewBox.baseVal) return '';
      const clone = src.cloneNode(true), pad = 12;
      const props = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
        'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline'];
      const a = [src].concat(Array.prototype.slice.call(src.querySelectorAll('*')));
      const b = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')));
      a.forEach((n, i) => {
        const cs = getComputedStyle(n);
        props.forEach((p) => b[i].style.setProperty(p, cs.getPropertyValue(p)));
        b[i].removeAttribute('tabindex');
        b[i].removeAttribute('class');
      });
      const vb = src.viewBox.baseVal, w = vb.width + pad * 2, h = vb.height + pad * 2;
      const bg = getComputedStyle(this.root.closest('.card') || document.body).backgroundColor;
      clone.setAttribute('xmlns', NS);
      clone.setAttribute('viewBox', [vb.x - pad, vb.y - pad, w, h].join(' '));
      clone.setAttribute('width', w); clone.setAttribute('height', h);
      clone.style.cssText = '';
      const rect = document.createElementNS(NS, 'rect');
      ['x', 'y'].forEach((k, i) => rect.setAttribute(k, (i ? vb.y : vb.x) - pad));
      rect.setAttribute('width', w); rect.setAttribute('height', h);
      rect.setAttribute('fill', bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff');
      clone.insertBefore(rect, clone.firstChild);
      return new XMLSerializer().serializeToString(clone);
    }
    /** Image PNG (Promise<Blob>) ; scale = 2 par défaut pour les écrans haute densité. */
    toPNG(scale) {
      const svg = this.toSVG();
      return new Promise((resolve, reject) => {
        if (!svg) return reject(new Error('Aucun graphique SVG à exporter'));
        const m = /viewBox="[^"]*? [^"]*? ([\d.]+) ([\d.]+)"/.exec(svg), k = scale || 2;
        const w = m ? +m[1] : 360, h = m ? +m[2] : 240, img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export PNG impossible'))), 'image/png');
        };
        img.onerror = () => reject(new Error('Export PNG impossible'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    }
    /** export('csv' | 'svg' | 'png', 'nom-de-fichier') : télécharge le fichier. */
    export(kind, name) {
      const base = String(name || this.o.label || 'graphique').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'graphique';
      const save = (blob, ext) => {
        const a = document.createElement('a'), url = URL.createObjectURL(blob);
        a.href = url; a.download = base + '.' + ext;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      kind = String(kind).toLowerCase();
      if (kind === 'csv') { const t = this.toCSV(); if (t) save(new Blob(['\ufeff' + t], { type: 'text/csv;charset=utf-8' }), 'csv'); return Promise.resolve(); }
      if (kind === 'svg') { const t = this.toSVG(); if (t) save(new Blob([t], { type: 'image/svg+xml' }), 'svg'); return Promise.resolve(); }
      if (kind === 'png') return this.toPNG().then((b) => save(b, 'png'));
      return Promise.reject(new Error('Format inconnu : ' + kind));
    }

    /* ---- éléments communs */
    head() {
      const h = $h('div', 'ch-head', this.root), l = $h('div', '', h);
      const big = $h('div', 'ch-big', l), sub = $h('div', 'ch-sub', l), badge = $h('span', 'ch-badge', h);
      sub.setAttribute('aria-live', 'polite');
      return { big, sub, badge };
    }
    setBig(node, value, unit) {
      node.textContent = value;
      if (unit) $h('small', '', node, unit);
    }
    badge(node, delta, text) {
      if (delta == null) { node.style.display = 'none'; return; }
      node.style.display = '';
      node.className = 'ch-badge' + (delta < 0 ? ' neg' : '');
      node.textContent = text;
    }
    legend(items) {
      const lg = $h('ul', 'ch-legend', this.root);
      items.forEach((it) => {
        const s = $h('li', '', lg);
        $h('i', '', s).style.background = it.color;
        s.appendChild(document.createTextNode(it.name));
      });
      return lg;
    }
    /** Grille horizontale + étiquettes de l’axe Y pour une plage { min, max, step, count }. */
    grid(svg, P, W, H, range, fmt) {
      const g = $s('g', { class: 'ch-grid' }, svg), f = fmt || ((v) => this.axis(v));
      for (let k = 0; k <= range.count; k++) {
        const v = range.min + k * range.step, yy = scale(range, v, P.t, H - P.b);
        $s('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, class: Math.abs(v) < 1e-9 && range.min < 0 ? 'is-zero' : '' }, g);
        $s('text', { x: P.l - 8, y: yy, class: 'ch-axis', 'text-anchor': 'end', 'dominant-baseline': 'central' }, svg).textContent = f(v);
      }
    }
  }

  Charts.Chart = Chart;
  Charts.util = { $s, $h, mix, niceRange, fixedRange, spanRange, scale, smooth, quantile, clamp, finite, maxOf, minOf, sum, ratio, pct, formatter, reduceMotion };
})(typeof window !== 'undefined' ? window : this);
