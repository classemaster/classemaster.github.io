/*!
 * Charts More — HistogramChart, BoxPlotChart, SparklineChart, ProgressChart
 * SVG pur, sans dépendance. Nécessite js/core.js, css/tokens.css et css/charts.css.
 */
(function (global) {
  'use strict';

  const Charts = global.Charts;
  const U = Charts.util;
  const { $s, $h, mix, niceRange, spanRange, scale, clamp, finite, maxOf, minOf, sum, quantile } = U;
  const colorAt = (c, k) => c || Charts.palette[k % Charts.palette.length];
  const nums = (a) => (Array.isArray(a) ? a : []).map((v) => finite(v, null)).filter((v) => v != null);

  /* ============================================================ HISTOGRAM */
  /**
   * Histogramme d'une série de valeurs brutes (ex. les notes d'une classe).
   * Options : values, bins (nombre, défaut ≈ √n) ou edges ([0, 5, 10, 20]), min, max,
   *           threshold (ex. 10) + thresholdLabel, unit, xUnit, color, label.
   */
  class HistogramChart extends Charts.Chart {
    prepare() {
      const o = this.o, raw = nums(o.values);
      if (!raw.length) return false;
      let edges;
      if (Array.isArray(o.edges) && o.edges.length > 1) edges = o.edges.map(Number).filter(isFinite).sort((a, b) => a - b);
      else {
        const lo = finite(o.min, minOf(raw));
        let hi = finite(o.max, maxOf(raw));
        if (!(hi > lo)) hi = lo + 1;
        const nb = clamp(Math.round(finite(o.bins, Math.ceil(Math.sqrt(raw.length)))), 1, 60);
        edges = Array.from({ length: nb + 1 }, (_, i) => lo + ((hi - lo) * i) / nb);
      }
      if (!edges || edges.length < 2 || !(edges[edges.length - 1] > edges[0])) return false;
      const nb = edges.length - 1, counts = new Array(nb).fill(0);
      let inside = 0;
      raw.forEach((v) => {
        if (v < edges[0] || v > edges[nb]) return;
        let i = nb - 1;
        for (let k = 0; k < nb; k++) if (v < edges[k + 1]) { i = k; break; }
        counts[i]++; inside++;
      });
      if (!inside) return false;
      const sorted = raw.filter((v) => v >= edges[0] && v <= edges[nb]).sort((a, b) => a - b);
      this.d = { edges, counts, total: inside, mean: sum(sorted) / inside, median: quantile(sorted, 0.5) };
      return true;
    }

    build() {
      const o = this.o, { edges, counts, total, mean, median } = this.d, nb = counts.length;
      const unit = o.unit == null ? '' : o.unit, xu = o.xUnit || '', color = o.color || Charts.palette[0];
      const W = 360, H = 230, P = { t: 30, r: 10, b: 32, l: 34 };
      const top = Math.max(maxOf(counts), 1);
      // pas entier (1, 2, 5, 10…) : un effectif ne se coupe pas en demi-élèves
      const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, top / 4))));
      const stp = [1, 2, 5, 10].map((k) => k * mag).find((k) => k >= top / 4 - 1e-9);
      const cnt = Math.max(1, Math.ceil(top / stp));
      const range = { min: 0, max: cnt * stp, step: stp, count: cnt };
      const x = (v) => P.l + ((v - edges[0]) / (edges[nb] - edges[0])) * (W - P.l - P.r);
      const y = (v) => scale(range, v, P.t, H - P.b);
      const th = finite(o.threshold, null), below = Charts.colors.down;
      const range2 = (i) => '[' + this.num(edges[i], 2) + ' – ' + this.num(edges[i + 1], 2) + (i === nb - 1 ? ']' : '[');

      const hd = this.head();
      const wrap = $h('div', 'ch-wrap', this.root);
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Histogramme' }, wrap);
      this.grid(svg, P, W, H, range, (v) => String(Math.round(v)));
      const every = Math.ceil((nb + 1) / 7);
      edges.forEach((e, i) => {
        if (i % every === 0 || i === nb) $s('text', { x: x(e), y: H - 10, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = this.num(e, 2) + xu;
      });

      const bars = [];
      counts.forEach((c, i) => {
        const x0 = x(edges[i]) + 1.5, x1 = x(edges[i + 1]) - 1.5, h = c ? Math.max(2, y(0) - y(c)) : 0;
        const bar = $s('rect', { x: x0, y: y(0) - h, width: Math.max(1, x1 - x0), height: h, rx: Math.min(5, (x1 - x0) / 2, h / 2), class: 'ch-bar' }, svg);
        bar.style.fill = th != null && edges[i + 1] <= th ? below : color;
        bar.style.transitionDelay = (this.motion ? i * 50 : 0) + 'ms';
        bars.push(bar);
        if (c && nb <= 14) $s('text', { x: (x0 + x1) / 2, y: y(0) - h - 6, class: 'ch-wval', 'text-anchor': 'middle' }, svg).textContent = c;
        const hit = $s('rect', { x: x(edges[i]), y: 0, width: Math.max(1, x(edges[i + 1]) - x(edges[i])), height: H, class: 'ch-hit', tabindex: 0, role: 'button', 'aria-label': range2(i) + xu + ' : ' + c + ' ' + unit }, svg);
        hit.addEventListener('pointerdown', () => select(i));
        hit.addEventListener('focus', () => select(i));
        hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
        hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') select(null); });
        hit.addEventListener('blur', () => select(null));
        // onPick : { kind:'histogram', index, label, key, from, to, last, count, total } ; la tranche est [from, to[ ,
        // sauf la dernière (last : vrai) qui garde aussi sa borne haute, comme le comptage du graphique
        this.bindPick(hit, () => ({ kind: 'histogram', index: i, label: range2(i) + xu, key: this.keyAt(i), from: edges[i], to: edges[i + 1], last: i === nb - 1, count: c, total, value: c }));
      });
      if (th != null && th > edges[0] && th < edges[nb]) {
        $s('line', { x1: x(th), x2: x(th), y1: P.t - 6, y2: H - P.b, class: 'ch-goal' }, svg);
        $s('text', { x: x(th) + 5, y: P.t - 10, class: 'ch-goal-t', 'text-anchor': 'start' }, svg).textContent = (o.thresholdLabel || this.t('goal')) + ' ' + this.num(th) + xu;
      }
      const select = (i) => {
        bars.forEach((b, k) => b.classList.toggle('is-dim', i != null && k !== i));
        if (i == null) {
          this.setBig(hd.big, this.num(total, 0), unit);
          hd.sub.textContent = this.t('mean') + ' ' + this.num(mean) + ' · ' + this.t('median') + ' ' + this.num(median);
          this.badge(hd.badge, null);
        } else {
          this.setBig(hd.big, this.num(counts[i], 0), unit);
          hd.sub.textContent = range2(i) + xu;
          const p = Math.round((counts[i] / total) * 100);
          this.badge(hd.badge, 1, p + ' % ' + this.t('shareOfTotal'));
        }
      };
      select(null);
      this.dataTable(o.label || 'Histogramme', [this.t('interval'), this.t('count')], counts.map((c, i) => [range2(i), c]));
      this.reveal(() => bars.forEach((b) => b.classList.add('is-in')));
    }
  }
  HistogramChart.defaults = { unit: '', label: 'Histogramme' };
  HistogramChart.cls = [];

  /* ============================================================== BOXPLOT */
  /**
   * Boîtes à moustaches. Options : groups [{ label, values: [...], color }], min, max, unit, label.
   * Moustaches = dernières valeurs dans 1,5 × l'écart interquartile ; points = valeurs atypiques.
   */
  class BoxPlotChart extends Charts.Chart {
    prepare() {
      const groups = (Array.isArray(this.o.groups) ? this.o.groups : []).map((g, k) => {
        const v = nums(g.values).sort((a, b) => a - b);
        if (!v.length) return null;
        const q1 = quantile(v, 0.25), med = quantile(v, 0.5), q3 = quantile(v, 0.75), iqr = q3 - q1;
        const inliers = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
        return {
          label: String(g.label != null ? g.label : this.t('group') + ' ' + (k + 1)), key: g.key, color: colorAt(g.color, k),
          n: v.length, min: v[0], max: v[v.length - 1], q1, med, q3, mean: sum(v) / v.length,
          lo: inliers[0], hi: inliers[inliers.length - 1], out: v.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr), all: v
        };
      }).filter(Boolean);
      if (!groups.length) return false;
      this.d = { groups };
      return true;
    }

    build() {
      const o = this.o, { groups } = this.d, n = groups.length, unit = o.unit == null ? '' : o.unit;
      const W = 360, H = 250, P = { t: 14, r: 10, b: 34, l: 42 };
      const lo = minOf(groups.map((g) => g.min)), hi = maxOf(groups.map((g) => g.max));
      const range = spanRange(lo, hi, o.min, o.max, 4) || niceRange(lo, hi, 4);
      const y = (v) => scale(range, v, P.t, H - P.b), slot = (W - P.l - P.r) / n, bw = Math.min(46, slot * 0.5);
      const pooled = groups.reduce((a, g) => a.concat(g.all), []).sort((a, b) => a - b);

      const hd = this.head();
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Boîtes à moustaches' }, $h('div', 'ch-wrap', this.root));
      this.grid(svg, P, W, H, range);

      const boxes = [];
      groups.forEach((g, i) => {
        const cx = P.l + slot * (i + 0.5), cap = bw * 0.4;
        const node = $s('g', { class: 'ch-box' }, svg);
        node.style.transitionDelay = (this.motion ? i * 90 : 0) + 'ms';
        $s('line', { x1: cx, x2: cx, y1: y(g.hi), y2: y(g.lo), stroke: g.color, 'stroke-width': 2, 'stroke-linecap': 'round' }, node);
        [g.hi, g.lo].forEach((v) => $s('line', { x1: cx - cap / 2, x2: cx + cap / 2, y1: y(v), y2: y(v), stroke: g.color, 'stroke-width': 2, 'stroke-linecap': 'round' }, node));
        $s('rect', { x: cx - bw / 2, y: y(g.q3), width: bw, height: Math.max(2, y(g.q1) - y(g.q3)), rx: 6, fill: g.color, 'fill-opacity': 0.28, stroke: g.color, 'stroke-width': 2 }, node);
        $s('line', { x1: cx - bw / 2, x2: cx + bw / 2, y1: y(g.med), y2: y(g.med), class: 'ch-median' }, node);
        const m = y(g.mean);
        $s('polygon', { points: [cx, m - 4.5, cx + 4.5, m, cx, m + 4.5, cx - 4.5, m].join(','), class: 'ch-mean' }, node);
        g.out.forEach((v) => $s('circle', { cx, cy: y(v), r: 3.2, fill: 'none', stroke: g.color, 'stroke-width': 1.8 }, node));
        boxes.push(node);
        $s('text', { x: cx, y: H - 12, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = g.label;
        const hit = $s('rect', {
          x: P.l + slot * i, y: 0, width: slot, height: H, class: 'ch-hit', tabindex: 0, role: 'button',
          'aria-label': g.label + ' : ' + this.t('median') + ' ' + this.num(g.med) + ', Q1 ' + this.num(g.q1) + ', Q3 ' + this.num(g.q3) + ', ' + this.t('min') + ' ' + this.num(g.min) + ', ' + this.t('max') + ' ' + this.num(g.max)
        }, svg);
        hit.addEventListener('pointerdown', () => select(i));
        hit.addEventListener('focus', () => select(i));
        hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
        hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') select(null); });
        hit.addEventListener('blur', () => select(null));
        // onPick : { kind:'box', index, label, key (champ key du groupe), n, min, q1, median, q3, max, mean, value (médiane) }
        this.bindPick(hit, () => ({ kind: 'box', index: i, label: g.label, key: g.key, n: g.n, min: g.min, q1: g.q1, median: g.med, q3: g.q3, max: g.max, mean: g.mean, value: g.med }));
      });
      const select = (i) => {
        boxes.forEach((b, k) => b.classList.toggle('is-dim', i != null && k !== i));
        if (i == null) {
          this.setBig(hd.big, this.num(quantile(pooled, 0.5)), unit);
          hd.sub.textContent = this.t('median') + ' · ' + pooled.length + ' ' + this.t('values').toLowerCase();
          this.badge(hd.badge, null);
        } else {
          const g = groups[i];
          this.setBig(hd.big, this.num(g.med), unit);
          hd.sub.textContent = g.label + ' · Q1 ' + this.num(g.q1) + ' – Q3 ' + this.num(g.q3) + ' · ' + this.t('min') + ' ' + this.num(g.min) + ' – ' + this.t('max') + ' ' + this.num(g.max);
          this.badge(hd.badge, 1, 'n = ' + g.n);
        }
      };
      select(null);
      const note = $h('div', 'ch-note', this.root);
      $h('span', 'ch-note-i', note).textContent = '▬ ' + this.t('median');
      $h('span', 'ch-note-i', note).textContent = '◆ ' + this.t('mean').toLowerCase();
      $h('span', 'ch-note-i', note).textContent = '○ atypique';
      this.dataTable(o.label || 'Boîtes à moustaches', [this.t('group'), 'n', this.t('min'), 'Q1', this.t('median'), 'Q3', this.t('max'), this.t('mean')],
        groups.map((g) => [g.label, g.n, g.min, +g.q1.toFixed(2), +g.med.toFixed(2), +g.q3.toFixed(2), g.max, +g.mean.toFixed(2)]));
      this.reveal(() => boxes.forEach((b) => b.classList.add('is-in')));
    }
  }
  BoxPlotChart.defaults = { unit: '', label: 'Boîtes à moustaches' };
  BoxPlotChart.cls = [];

  /* ============================================================ SPARKLINE */
  /**
   * Mini-courbe sans axes, à glisser dans un indicateur ou une ligne de tableau.
   * Options : values, labels, color, fill (true), unit, label. La taille suit celle du conteneur.
   */
  class SparklineChart extends Charts.Chart {
    prepare() {
      const values = nums(this.o.values);
      if (!values.length) return false;
      this.d = { values };
      return true;
    }
    build() {
      const o = this.o, v = this.d.values, n = v.length, id = this.id, unit = o.unit == null ? '' : o.unit;
      const W = 120, H = 36, pad = 4, color = o.color || Charts.palette[0];
      const lo = minOf(v), hi = maxOf(v), flat = hi === lo;
      const x = (i) => (n > 1 ? pad + (i * (W - 2 * pad)) / (n - 1) : W / 2);
      const y = (val) => (flat ? H / 2 : H - pad - ((val - lo) / (hi - lo)) * (H - 2 * pad));
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': (o.label || 'Tendance') + ' : ' + n + ' valeurs, de ' + this.num(lo) + ' à ' + this.num(hi) + ', dernière ' + this.num(v[n - 1]) + unit }, this.root);
      const g = $s('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, $s('defs', {}, svg));
      $s('stop', { offset: '0', 'stop-color': color, 'stop-opacity': 0.3 }, g);
      $s('stop', { offset: '1', 'stop-color': color, 'stop-opacity': 0 }, g);
      let line = null, area = null;
      if (n > 1) {
        const d = v.map((val, i) => (i ? 'L' : 'M') + x(i) + ',' + y(val)).join(' ');
        if (o.fill !== false) area = $s('path', { d: d + ' L' + x(n - 1) + ',' + H + ' L' + x(0) + ',' + H + 'Z', fill: 'url(#' + id + 'g)' }, svg);
        line = $s('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, class: 'ch-line' }, svg);
      }
      $s('circle', { cx: x(n - 1), cy: y(v[n - 1]), r: 3.4, fill: color, stroke: 'var(--ch-card)', 'stroke-width': 1.5 }, svg);
      const labels = Array.isArray(o.labels) ? o.labels : [];
      this.dataTable(o.label || 'Tendance', [this.t('label'), this.t('value')], v.map((val, i) => [labels[i] != null ? labels[i] : i + 1, val]));
      if (!line || !this.motion) return;
      line.style.strokeDashoffset = 1;
      if (area) area.style.opacity = 0;
      this.reveal(() => {
        line.style.transition = 'stroke-dashoffset 1s cubic-bezier(.22,1,.36,1)';
        line.style.strokeDashoffset = 0;
        if (area) { area.style.transition = 'opacity .8s ease .3s'; area.style.opacity = 1; }
      });
    }
  }
  SparklineChart.defaults = { label: 'Tendance' };
  SparklineChart.cls = ['ch-spark'];

  /* ============================================================== PROGRESS */
  /**
   * Barres de progression. Options : items [{ label, value, goal, unit, color }], goal (défaut 100), unit, label.
   * Un dépassement de l'objectif est signalé par « ▲ » et le pourcentage réel.
   */
  class ProgressChart extends Charts.Chart {
    prepare() {
      const o = this.o, defGoal = finite(o.goal, 100);
      const items = (Array.isArray(o.items) ? o.items : []).map((it, k) => {
        const value = Math.max(0, finite(it.value, 0)), goal = finite(it.goal, defGoal);
        return { label: String(it.label != null ? it.label : this.t('item') + ' ' + (k + 1)), value, goal, unit: it.unit != null ? it.unit : o.unit || '', color: colorAt(it.color, k), p: goal > 0 ? value / goal : 0 };
      });
      if (!items.length) return false;
      this.d = { items };
      return true;
    }
    build() {
      const o = this.o, { items } = this.d, fills = [];
      const list = $h('ul', 'ch-prog', this.root);
      list.setAttribute('aria-label', o.label || 'Progression');
      items.forEach((it, k) => {
        const pc = Math.round(it.p * 100), over = it.p > 1, done = it.p >= 1;
        const li = $h('li', 'ch-prog-i' + (over ? ' is-over' : ''), list);
        li.style.setProperty('--c', it.color);
        const row = $h('div', 'ch-prog-r', li);
        $h('span', 'ch-prog-n', row, (done ? '✓ ' : '') + it.label);
        $h('span', 'ch-prog-v', row, this.num(it.value) + (it.goal > 0 ? ' / ' + this.num(it.goal) : '') + (it.unit ? ' ' + it.unit : ''));
        $h('b', 'ch-prog-p', row, (over ? '▲ ' : '') + pc + ' %');
        const track = $h('div', 'ch-prog-t', li);
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-label', it.label);
        track.setAttribute('aria-valuemin', 0);
        track.setAttribute('aria-valuemax', it.goal);
        track.setAttribute('aria-valuenow', Math.min(it.value, it.goal));
        track.setAttribute('aria-valuetext', pc + ' % (' + this.num(it.value) + ' / ' + this.num(it.goal) + ')' + (over ? ', ' + this.t('exceeded') : ''));
        const fill = $h('div', 'ch-prog-f', track);
        fill.style.setProperty('--w', Math.min(1, it.p) * 100 + '%');
        fill.style.transitionDelay = (this.motion ? k * 90 : 0) + 'ms';
        fills.push(fill);
      });
      this.dataTable(o.label || 'Progression', [this.t('label'), this.t('value'), this.t('goal'), '%'], items.map((it) => [it.label, it.value, it.goal, Math.round(it.p * 100)]));
      this.reveal(() => fills.forEach((f) => f.classList.add('is-in')));
    }
  }
  ProgressChart.defaults = { goal: 100, label: 'Progression' };
  ProgressChart.cls = [];

  global.HistogramChart = HistogramChart;
  global.BoxPlotChart = BoxPlotChart;
  global.SparklineChart = SparklineChart;
  global.ProgressChart = ProgressChart;
})(typeof window !== 'undefined' ? window : this);
