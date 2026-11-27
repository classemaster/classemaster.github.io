/*!
 * Charts — LineChart (courbes + aire), BarChart (capsules), RingsChart (anneaux concentriques)
 * SVG pur, sans dépendance. Nécessite js/core.js, css/tokens.css et css/charts.css.
 */
(function (global) {
  'use strict';

  const Charts = global.Charts;
  const U = Charts.util;
  const { $s, $h, mix, niceRange, fixedRange, spanRange, scale, smooth, clamp, finite, maxOf, minOf, pct } = U;
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------- ligne d'objectif */
  // goal: 12  ou  goal: { value: 12, label: 'Objectif' }
  function goalOf(chart, g) {
    if (g == null) return null;
    const obj = typeof g === 'object' ? g : { value: g }, v = finite(obj.value, null);
    return v == null ? null : { value: v, label: obj.label != null ? String(obj.label) : chart.t('goal') };
  }
  function drawGoal(chart, svg, goal, P, W, y) {
    if (!goal) return;
    const yy = y(goal.value);
    $s('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, class: 'ch-goal' }, svg);
    $s('text', { x: P.l + 4, y: yy - 6, class: 'ch-goal-t', 'text-anchor': 'start' }, svg).textContent = goal.label + ' ' + chart.num(goal.value);
  }

  /* ------------------------------------------------------------------ */
  class LineChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      const labels = Array.isArray(o.labels) ? o.labels.map(String) : [];
      const series = (Array.isArray(o.series) ? o.series : []).map((s, k) => ({
        name: String(s.name != null ? s.name : 'Série ' + (k + 1)),
        key: s.key, // identifiant libre, renvoyé tel quel à onPick (seriesKey)
        color: s.color || Charts.palette[k % Charts.palette.length],
        dashed: !!s.dashed, // série de comparaison (période précédente…) : trait pointillé, sans aire
        values: (Array.isArray(s.values) ? s.values : []).map((v) => (o.gaps && v === null ? null : finite(v, 0))) // gaps: true -> un null reste un trou (mois sans note)
      }));
      const n = Math.max(labels.length, ...series.map((s) => s.values.length), 0);
      if (!n || !series.length) return false;
      for (let i = labels.length; i < n; i++) labels.push(String(i + 1));
      series.forEach((s) => { while (s.values.length < n) s.values.push(o.gaps ? null : 0); });
      this.d = { labels, series, n, goal: goalOf(this, o.goal) };
      return true;
    }

    build() {
      const o = this.o, { labels, series, n, goal } = this.d, unit = o.unit == null ? '' : o.unit;
      const W = 360, H = 230, P = { t: 12, r: 14, b: 28, l: 42 };
      const all = series.reduce((a, s) => a.concat(s.values.filter((v) => v !== null)), []).concat(goal ? [goal.value] : []);
      // min : échelle sans zéro (ex. notes de 10 à 14) ; sans min, la ligne de base reste à 0
      const range = spanRange(minOf(all), maxOf(all), o.min, o.max, 4) || fixedRange(minOf(all), maxOf(all), o.max, 4);
      const x = (i) => (n > 1 ? P.l + (i * (W - P.l - P.r)) / (n - 1) : P.l + (W - P.l - P.r) / 2);
      const y = (v) => scale(range, v, P.t, H - P.b);
      const base = y(clamp(0, range.min, range.max)), id = this.id;

      const hd = this.head();
      if (series.length > 1) this.legend(series);
      const wrap = $h('div', 'ch-wrap', this.root);
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Courbe', class: 'ch-scrub', tabindex: 0 }, wrap);
      const defs = $s('defs', {}, svg);
      series.forEach((se, k) => {
        const g = $s('linearGradient', { id: id + 'g' + k, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        $s('stop', { offset: '0', 'stop-color': se.color, 'stop-opacity': 0.34 }, g);
        $s('stop', { offset: '1', 'stop-color': se.color, 'stop-opacity': 0 }, g);
      });

      this.grid(svg, P, W, H, range);
      drawGoal(this, svg, goal, P, W, y);
      const every = Math.ceil(n / 7);
      labels.forEach((l, i) => {
        if (i % every === 0 || i === n - 1 && (n - 1) % every === 0)
          $s('text', { x: x(i), y: H - 8, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = l;
      });

      const animated = [];
      series.forEach((se, k) => {
        // une série peut avoir des trous (null) : on la trace par tronçons, un point seul devient un repère
        const runs = []; let cr = null;
        se.values.forEach((v, i) => { if (v === null) { cr = null; } else { if (!cr) { cr = []; runs.push(cr); } cr.push([x(i), y(v)]); } });
        runs.forEach((r) => {
          if (r.length === 1) {
            $s('circle', { cx: r[0][0], cy: r[0][1], r: 7, fill: se.color, 'fill-opacity': 0.25 }, svg);
            $s('circle', { cx: r[0][0], cy: r[0][1], r: 3.5, fill: se.color }, svg);
            return;
          }
          const d = smooth(r);
          const area = se.dashed ? null : $s('path', { d: d + ' L' + r[r.length - 1][0] + ',' + base + ' L' + r[0][0] + ',' + base + 'Z', fill: 'url(#' + id + 'g' + k + ')' }, svg);
          const line = $s('path', { d, fill: 'none', stroke: se.color, 'stroke-width': se.dashed ? 2 : 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, class: 'ch-line' }, svg);
          if (se.dashed) { line.style.strokeDasharray = '0.022 0.018'; line.style.opacity = 0.8; }
          animated.push({ area, line, k, dashed: se.dashed });
        });
      });

      // Repères du maximum et du minimum de la première série (option extremes: true)
      if (o.extremes && n > 1) {
        const v0 = series[0].values, v0n = v0.filter((v) => v !== null), hi = maxOf(v0n), lo = minOf(v0n);
        if (v0n.length > 1 && hi !== lo) [[v0.indexOf(hi), hi, -10], [v0.lastIndexOf(lo), lo, 17]].forEach((m) => {
          const i = m[0], cx = x(i), anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
          $s('circle', { cx, cy: y(m[1]), r: 4, class: 'ch-ext', stroke: series[0].color }, svg);
          $s('text', { x: cx + (anchor === 'start' ? -2 : anchor === 'end' ? 2 : 0), y: y(m[1]) + m[2], class: 'ch-ext-t', 'text-anchor': anchor }, svg).textContent = this.num(m[1]);
        });
      }

      const cursor = $s('g', { class: 'ch-cursor' }, svg);
      const guide = $s('line', { y1: P.t, y2: H - P.b, class: 'ch-guide' }, cursor);
      const dots = series.map((se) => $s('circle', { r: 5.5, class: 'ch-dot', stroke: se.color }, cursor));
      const tip = $h('div', 'ch-tip', wrap);
      const lastIdx = (() => { for (let i = n - 1; i >= 0; i--) if (series[0].values[i] !== null) return i; return n - 1; })();
      let cur = lastIdx;
      const numOr = (v) => (v === null ? '–' : this.num(v));

      const select = (i) => {
        cur = i;
        const gx = x(i), vals = series.map((se) => se.values[i]);
        guide.setAttribute('x1', gx); guide.setAttribute('x2', gx);
        dots.forEach((c, k) => { c.style.display = vals[k] === null ? 'none' : ''; if (vals[k] !== null) { c.setAttribute('cx', gx); c.setAttribute('cy', y(vals[k])); } });
        const shown = vals.filter((v) => v !== null);
        tip.style.left = clamp((gx / W) * 100, 31, 69) + '%';
        tip.style.top = (shown.length ? Math.min.apply(null, shown.map(y)) / H : 0.2) * 100 + '%';
        tip.textContent = '';
        $h('div', 'ch-tip-h', tip, labels[i]);
        series.forEach((se, k) => {
          const r = $h('div', 'ch-tip-r', tip);
          $h('i', '', r).style.background = se.color;
          $h('span', '', r, se.name);
          $h('b', '', r, numOr(vals[k]));
        });
        this.setBig(hd.big, numOr(vals[0]), vals[0] === null ? '' : unit);
        hd.sub.textContent = series[0].name + ' · ' + labels[i] + (vals[0] === null ? ' (pas de note)' : '');
        const prev = i > 0 ? series[0].values[i - 1] : 0;
        if (prev && vals[0] !== null) { // variation relative, avec une base négative ou nulle on ne l'affiche pas
          const p = Math.round(((vals[0] - prev) / Math.abs(prev)) * 100);
          this.badge(hd.badge, p, (p < 0 ? '▼ ' : '▲ ') + Math.abs(p) + '\u00a0%');
        } else this.badge(hd.badge, null);
      };
      const move = (e) => {
        const r = svg.getBoundingClientRect();
        if (!r.width || n === 1) return select(0);
        const vx = ((e.clientX - r.left) / r.width) * W;
        select(clamp(Math.round(((vx - P.l) / (W - P.l - P.r)) * (n - 1)), 0, n - 1));
      };
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerdown', move);
      svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') select(lastIdx); });
      svg.addEventListener('keydown', (e) => { // la courbe se parcourt aussi au clavier
        const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'Home' ? -n : e.key === 'End' ? n : 0;
        if (!step) return;
        e.preventDefault();
        select(clamp(cur + step, 0, n - 1));
      });
      select(lastIdx);
      // onPick : toucher la courbe renvoie le point le plus proche { kind:'line', index, label, key, values, series:[{name,key,value}] }
      // et la série la plus proche du doigt (seriesIndex, seriesName, seriesKey, value) ; au clavier : la première série qui a une valeur
      this.bindPick(svg, (e) => {
        const vals = series.map((se) => se.values[cur]);
        if (vals.every((v) => v === null)) return null;
        let k = vals.findIndex((v) => v !== null);
        const vy = this.clickY(e, svg, H);
        if (vy != null) {
          let best = Infinity;
          vals.forEach((v, q) => { if (v !== null && Math.abs(y(v) - vy) < best) { best = Math.abs(y(v) - vy); k = q; } });
        }
        return {
          kind: 'line', index: cur, label: labels[cur], key: this.keyAt(cur), values: vals, value: vals[k],
          seriesIndex: k, seriesName: series[k].name, seriesKey: series[k].key,
          series: series.map((se, q) => ({ name: se.name, key: se.key, value: vals[q] }))
        };
      });

      this.dataTable(o.label || 'Courbe', [this.t('label')].concat(series.map((s) => s.name)),
        labels.map((l, i) => [l].concat(series.map((s) => s.values[i]))));

      if (!this.motion) { wrap.classList.add('is-ready'); return; }
      animated.forEach(({ area, line, dashed }) => { if (!dashed) line.style.strokeDashoffset = 1; line.style.opacity = 0; if (area) area.style.opacity = 0; });
      this.reveal(() => {
        animated.forEach(({ area, line, k, dashed }) => {
          line.style.transition = (dashed ? '' : 'stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1) ' + k * 160 + 'ms, ') + 'opacity .5s ' + k * 160 + 'ms';
          if (!dashed) line.style.strokeDashoffset = 0;
          line.style.opacity = dashed ? 0.8 : 1;
          if (area) { area.style.transition = 'opacity 1s ease ' + (450 + k * 160) + 'ms'; area.style.opacity = 1; }
        });
        this.later(() => wrap.classList.add('is-ready'), 1100);
      });
    }
  }
  LineChart.defaults = { unit: '', label: 'Courbe', extremes: false, goal: null, gaps: false };
  LineChart.cls = [];

  /* ------------------------------------------------------------------ */
  class BarChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      let values, stack = null;
      if (Array.isArray(o.series) && o.series.length) { // barres empilées : une série = un empilement (valeurs ≥ 0)
        stack = o.series.map((s, k) => ({
          name: String(s.name != null ? s.name : this.t('series') + ' ' + (k + 1)),
          key: s.key, // identifiant libre, renvoyé tel quel à onPick (seriesKey)
          color: s.color || Charts.palette[k % Charts.palette.length],
          values: (Array.isArray(s.values) ? s.values : []).map((v) => Math.max(0, finite(v, 0)))
        }));
        const n = Math.max(...stack.map((s) => s.values.length), 0);
        if (!n) return false;
        stack.forEach((s) => { while (s.values.length < n) s.values.push(0); });
        values = Array.from({ length: n }, (_, i) => stack.reduce((t, s) => t + s.values[i], 0));
      } else values = (Array.isArray(o.values) ? o.values : []).map((v) => finite(v, 0));
      if (!values.length) return false;
      const labels = values.map((_, i) => String((o.labels || [])[i] != null ? o.labels[i] : i + 1));
      const full = values.map((_, i) => String((o.full || o.labels || [])[i] != null ? (o.full || o.labels)[i] : labels[i]));
      this.d = { values, labels, full, stack, goal: goalOf(this, o.goal) };
      return true;
    }

    build() {
      const o = this.o, { values, labels, full, stack, goal } = this.d, unit = o.unit == null ? '' : o.unit, color = o.color || Charts.palette[0];
      const n = values.length, id = this.id;
      const W = 360, H = 220, P = { t: 40, r: 8, b: 30, l: 8 };
      const range = fixedRange(minOf(values), Math.max(maxOf(values), goal ? goal.value : -Infinity), o.max, 4);
      const slot = (W - P.l - P.r) / n, bw = Math.min(30, slot * 0.56);
      const base = H - P.b, ch = base - P.t;
      const y = (v) => scale(range, v, P.t, base);
      const zero = y(0);
      const avg = values.reduce((a, b) => a + b, 0) / n;
      // Géométrie réelle d'une barre : aucune hauteur minimale artificielle (sauf 2 px pour une valeur non nulle).
      const geo = (v) => {
        if (v === 0) return { top: zero, h: 0 };
        const h = Math.max(2, Math.abs(y(v) - zero));
        return v > 0 ? { top: zero - h, h } : { top: zero, h };
      };

      const hd = this.head();
      hd.badge.style.display = 'none';
      if (stack) this.legend(stack);
      const wrap = $h('div', 'ch-wrap', this.root);
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Barres' }, wrap);
      const defs = $s('defs', {}, svg);
      const g = $s('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      $s('stop', { offset: '0', 'stop-color': mix(color, 0.35) }, g);
      $s('stop', { offset: '1', 'stop-color': color }, g);

      if (range.min < 0) $s('line', { x1: P.l, x2: W - P.r, y1: zero, y2: zero, class: 'ch-zero' }, svg);
      $s('line', { x1: P.l, x2: W - P.r, y1: y(avg), y2: y(avg), class: 'ch-avg' }, svg);
      if (goal) { // l'objectif passe sous les barres : trait plein de la couleur d'accent
        const gy = y(goal.value);
        $s('line', { x1: P.l, x2: W - P.r, y1: gy, y2: gy, class: 'ch-goal' }, svg);
        $s('text', { x: P.l + 4, y: gy - 6, class: 'ch-goal-t', 'text-anchor': 'start' }, svg).textContent = goal.label + ' ' + this.num(goal.value);
      }

      const bars = [], texts = [];
      values.forEach((v, i) => {
        const cx = P.l + slot * (i + 0.5), b = geo(v);
        $s('rect', { x: cx - bw / 2, y: P.t, width: bw, height: ch, rx: bw / 2, class: 'ch-track' }, svg);
        let bar;
        if (stack) { // segments empilés, découpés dans la capsule de la barre
          const cp = $s('clipPath', { id: id + 'c' + i }, defs);
          $s('rect', { x: cx - bw / 2, y: b.top, width: bw, height: b.h, rx: Math.min(bw / 2, b.h / 2) }, cp);
          bar = $s('g', { class: 'ch-bar', 'clip-path': 'url(#' + id + 'c' + i + ')' }, svg);
          let cum = 0;
          stack.forEach((se) => {
            const sv = se.values[i];
            if (!sv) return;
            const y1 = y(cum + sv), y0 = y(cum);
            $s('rect', { x: cx - bw / 2, y: y1, width: bw, height: Math.max(0, y0 - y1), fill: se.color }, bar);
            cum += sv;
          });
        } else bar = $s('rect', { x: cx - bw / 2, y: b.top, width: bw, height: b.h, rx: Math.min(bw / 2, b.h / 2), class: 'ch-bar' }, svg);
        bar.style.transformOrigin = v < 0 ? '50% 0%' : '50% 100%';
        bar.style.transitionDelay = (this.motion ? i * 70 : 0) + 'ms';
        bars.push(bar);
        const tx = $s('text', { x: cx, y: H - 8, class: 'ch-axis', 'text-anchor': 'middle' }, svg);
        tx.textContent = labels[i];
        texts.push(tx);
        const hit = $s('rect', {
          x: P.l + slot * i, y: 0, width: slot, height: H, class: 'ch-hit', tabindex: 0, role: 'button',
          'aria-label': full[i] + ' : ' + this.num(v) + ' ' + unit + (stack ? ' (' + stack.map((se) => se.name + ' ' + this.num(se.values[i])).join(', ') + ')' : '')
        }, svg);
        ['pointerdown', 'focus'].forEach((ev) => hit.addEventListener(ev, () => select(i)));
        hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
        // onPick : barre simple -> { kind:'bar', index, label, short, key, value } ; barres empilées : le segment touché
        // (seriesIndex, seriesName, seriesKey, segmentValue), ou seriesIndex null si on touche à côté d'un segment ou au clavier
        this.bindPick(hit, (e) => {
          const info = { kind: 'bar', index: i, label: full[i], short: labels[i], key: this.keyAt(i), value: values[i] };
          if (stack) {
            let k = null;
            const vy = this.clickY(e, svg, H);
            if (vy != null) {
              const v = range.min + (1 - (vy - P.t) / (base - P.t)) * (range.max - range.min);
              let cum = 0;
              for (let q = 0; q < stack.length; q++) {
                const sv = stack[q].values[i];
                if (sv && v >= cum && v <= cum + sv) { k = q; break; }
                cum += sv;
              }
            }
            info.seriesIndex = k;
            info.seriesName = k == null ? undefined : stack[k].name;
            info.seriesKey = k == null ? undefined : stack[k].key;
            info.segmentValue = k == null ? null : stack[k].values[i];
            info.series = stack.map((se) => ({ name: se.name, key: se.key, value: se.values[i] }));
          }
          return info;
        });
      });

      const note = $h('div', 'ch-note', wrap);
      const item = (cls, text) => { const s = $h('span', 'ch-note-i', note); $h('i', cls, s); s.appendChild(document.createTextNode(text)); };
      item('', this.t('avg') + ' ' + this.num(avg) + (unit ? ' ' + unit : ''));
      if (goal) item('is-goal', goal.label + ' ' + this.num(goal.value) + (unit ? ' ' + unit : ''));

      const bubble = $s('g', { class: 'ch-bubble' }, svg);
      const bg = $s('rect', { width: 62, height: 26, rx: 13, class: 'ch-bubble-bg' }, bubble);
      const bt = $s('text', { x: 31, y: 13.5, class: 'ch-bubble-t', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, bubble);

      const select = (i) => {
        const cx = P.l + slot * (i + 0.5), b = geo(values[i]);
        bars.forEach((el, k) => {
          if (stack) el.classList.toggle('is-dim', k !== i); else el.style.fill = k === i ? 'url(#' + id + 'g)' : '';
          texts[k].classList.toggle('is-sel', k === i);
        });
        bt.textContent = this.num(values[i]) + ' ' + unit;
        const w = Math.max(62, bt.textContent.length * 7.4 + 22);
        bg.setAttribute('width', w); bg.setAttribute('x', 31 - w / 2);
        bubble.style.transform = 'translate(' + clamp(cx - 31, w / 2 - 31 + 2, W - w / 2 - 31 - 2) + 'px,' + (b.top - 36) + 'px)';
        this.setBig(hd.big, this.num(values[i]), unit);
        hd.sub.textContent = full[i] + (stack ? ' · ' + stack.map((se) => se.name + ' ' + this.num(se.values[i])).join(' · ') : '');
      };
      const cur = finite(o.current, n - 1);
      this.dataTable(o.label || 'Barres', [this.t('label')].concat(stack ? stack.map((se) => se.name).concat(this.t('total')) : [this.t('value')]),
        full.map((f, i) => [f].concat(stack ? stack.map((se) => se.values[i]).concat(values[i]) : [values[i]])));
      select(clamp(Math.round(cur), 0, n - 1));
      this.reveal(() => bars.forEach((b) => b.classList.add('is-in')));
    }
  }
  BarChart.defaults = { unit: '', label: 'Barres', goal: null };
  BarChart.cls = [];

  /* ------------------------------------------------------------------ */
  class RingsChart extends Charts.Chart {
    prepare() {
      const rings = (Array.isArray(this.o.rings) ? this.o.rings : []).map((r, k) => {
        const value = Math.max(0, finite(r.value, 0)), goal = finite(r.goal, 0);
        return {
          label: String(r.label != null ? r.label : 'Objectif ' + (k + 1)), unit: r.unit || '',
          color: r.color || Charts.palette[k % Charts.palette.length],
          value, goal, p: goal > 0 ? value / goal : 0 // p peut dépasser 1 : objectif dépassé
        };
      });
      if (!rings.length) return false;
      this.d = { rings };
      return true;
    }

    build() {
      const o = this.o, rings = this.d.rings, n = rings.length, id = this.id, title = o.title || 'Objectifs';
      const S = 220, c = S / 2, r0 = 100;
      let th = 14, gap = 6;
      // On garde ~44 unités de rayon libres au centre pour le pourcentage ; beaucoup d'anneaux : ils s'affinent.
      const step = n > 1 ? Math.min(th + gap, (r0 - (th / 2 + 44)) / (n - 1)) : 0;
      if (n > 1 && step < th + 2) th = Math.max(5, step - 2);
      const pcts = rings.map((r) => Math.round(r.p * 100));
      let pinned = null;

      this.root.classList.add('ch-rings');
      const stage = $h('div', 'ch-ring-stage', this.root);
      const svg = $s('svg', { viewBox: '0 0 ' + S + ' ' + S, role: 'img', 'aria-label': title }, stage);
      const defs = $s('defs', {}, svg);
      const center = $h('div', 'ch-ring-center', stage);
      const cBig = $h('div', 'ch-ring-pct', center), cCap = $h('div', 'ch-ring-cap', center);
      cBig.setAttribute('aria-live', 'polite');
      const list = $h('ul', 'ch-rows', this.root);

      const arcs = [], tracks = [], rows = [], overs = [];
      rings.forEach((r, k) => {
        const rad = r0 - k * step, C = TAU * rad;
        const gr = $s('linearGradient', { id: id + 'g' + k, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
        $s('stop', { offset: '0', 'stop-color': r.color }, gr);
        $s('stop', { offset: '1', 'stop-color': mix(r.color, 0.5) }, gr);
        const track = $s('circle', { cx: c, cy: c, r: rad, fill: 'none', stroke: r.color, 'stroke-width': th, class: 'ch-rtrack' }, svg);
        const arc = $s('circle', {
          cx: c, cy: c, r: rad, fill: 'none', stroke: 'url(#' + id + 'g' + k + ')', 'stroke-width': th, 'stroke-linecap': 'round',
          class: 'ch-rarc', transform: 'rotate(-90 ' + c + ' ' + c + ')'
        }, svg);
        const cap = Math.min(1, r.p), dash = cap > 0 ? Math.max(0.01, cap * C - th) : 0;
        arc.style.strokeDasharray = '0.01 ' + C;
        arc.style.strokeDashoffset = -th / 2;
        arc.style.transitionDelay = (this.motion ? k * 160 : 0) + 'ms';
        if (r.p === 0) arc.style.display = 'none'; // objectif à 0 % : on garde seulement la piste
        arcs.push(arc); tracks.push(track);
        if (r.p > 1) { // dépassement : un second tour plus sombre par-dessus l'anneau plein
          const ex = Math.min(1, r.p - 1) * C;
          const over = $s('circle', { cx: c, cy: c, r: rad, fill: 'none', 'stroke-width': th, class: 'ch-rover', transform: 'rotate(-90 ' + c + ' ' + c + ')' }, svg);
          over.style.strokeDasharray = '0 ' + C;
          over._ex = ex; over._C = C;
          overs.push(over);
        }

        const li = $h('li', '', list), b = $h('button', 'ch-row', li);
        b.type = 'button'; b.style.setProperty('--c', r.color);
        $h('i', '', b);
        $h('span', 'ch-row-n', b, r.label);
        $h('span', 'ch-row-v', b, this.num(r.value) + (r.goal > 0 ? ' / ' + this.num(r.goal) : '') + (r.unit ? ' ' + r.unit : '') + (r.p > 1 ? ' · ▲ ' + this.t('exceeded') : ''));
        $h('b', 'ch-row-p', b, pcts[k] + '\u00a0%');
        rows.push(b);
        [track, arc, b].forEach((node) => {
          node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sel(k); });
          node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') sel(pinned); });
          node.addEventListener('click', () => { pinned = pinned === k ? null : k; b.setAttribute('aria-pressed', String(pinned === k)); sel(pinned); });
        });
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('focus', () => sel(k));
        b.addEventListener('blur', () => sel(pinned));
        arc._dash = dash; arc._C = C;
      });

      const sel = (k) => {
        arcs.forEach((a, j) => a.classList.toggle('is-dim', k !== null && j !== k));
        tracks.forEach((t, j) => t.classList.toggle('is-dim', k !== null && j !== k));
        rows.forEach((b, j) => { b.classList.toggle('is-active', j === k); b.classList.toggle('is-dim', k !== null && j !== k); });
        const v = k === null ? Math.round(pcts.reduce((a, b) => a + b, 0) / n) : pcts[k];
        cBig.textContent = v + '\u00a0%';
        cCap.textContent = k === null ? title : rings[k].label;
      };
      sel(null);
      this.dataTable(title, [this.t('label'), this.t('value'), this.t('goal'), '%'], rings.map((r, k) => [r.label, r.value, r.goal, pcts[k]]));
      this.reveal(() => {
        arcs.forEach((a) => { a.classList.add('is-in'); if (a._dash) a.style.strokeDasharray = a._dash + ' ' + (a._C - a._dash); });
        overs.forEach((o2) => { o2.classList.add('is-in'); o2.style.strokeDasharray = o2._ex + ' ' + (o2._C - o2._ex); });
      });
    }
  }
  RingsChart.defaults = { title: 'Objectifs' };
  RingsChart.cls = ['ch-rings'];

  global.LineChart = LineChart;
  global.BarChart = BarChart;
  global.RingsChart = RingsChart;
})(typeof window !== 'undefined' ? window : this);
