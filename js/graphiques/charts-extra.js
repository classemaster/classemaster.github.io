/*!
 * Charts Extra — RadarChart, GaugeChart, HeatmapChart, FunnelChart, BubbleChart, WaterfallChart
 * SVG pur, sans dépendance. Nécessite js/core.js, css/tokens.css et css/charts.css.
 */
(function (global) {
  'use strict';

  const Charts = global.Charts;
  const U = Charts.util;
  const { $s, $h, mix, niceRange, fixedRange, spanRange, scale, clamp, finite, maxOf, minOf, sum, ratio, pct } = U;
  const TAU = Math.PI * 2;
  const colorAt = (c, k) => c || Charts.palette[k % Charts.palette.length];

  /* ================================================================== RADAR */
  class RadarChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      const axes = (Array.isArray(o.axes) ? o.axes : []).map(String);
      if (axes.length < 3) { this.message = 'Un radar demande au moins 3 axes'; return false; }
      const max = finite(o.max, 100) > 0 ? finite(o.max, 100) : 100;
      const series = (Array.isArray(o.series) ? o.series : []).map((s, k) => ({
        name: String(s.name != null ? s.name : 'Série ' + (k + 1)), color: colorAt(s.color, k),
        values: axes.map((_, i) => clamp(finite((s.values || [])[i], 0), 0, max))
      }));
      if (!series.length) return false;
      this.message = undefined;
      this.d = { axes, series, max };
      return true;
    }

    build() {
      const o = this.o, { axes, series, max } = this.d, n = axes.length;
      const W = 360, H = 320, cx = 180, cy = 162, R = 104;
      const ang = (i) => (i / n) * TAU - Math.PI / 2;
      const pt = (i, v, rr) => {
        const r = rr != null ? rr : (R * v) / max;
        return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
      };
      const hd = this.head();
      this.legend(series);
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Radar' }, $h('div', 'ch-wrap', this.root));

      for (let k = 1; k <= 4; k++) $s('polygon', { points: axes.map((_, i) => pt(i, (max * k) / 4).join(',')).join(' '), class: 'ch-rgrid' }, svg);
      const lines = axes.map((_, i) => {
        const p = pt(i, max);
        return $s('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'ch-raxis' }, svg);
      });
      const labels = axes.map((a, i) => {
        const p = pt(i, 0, R + 18), c = Math.cos(ang(i));
        const t = $s('text', { x: p[0], y: p[1], class: 'ch-axis', 'text-anchor': c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle', 'dominant-baseline': 'central' }, svg);
        t.textContent = a;
        return t;
      });
      const polys = series.map((se, k) => {
        const g = $s('g', { class: 'ch-poly' }, svg);
        g.style.transformOrigin = cx + 'px ' + cy + 'px';
        g.style.transitionDelay = (this.motion ? k * 160 : 0) + 'ms';
        $s('polygon', { points: se.values.map((v, i) => pt(i, v).join(',')).join(' '), fill: se.color, stroke: se.color }, g);
        se.values.forEach((v, i) => { const p = pt(i, v); $s('circle', { cx: p[0], cy: p[1], r: 3.5, fill: se.color }, g); });
        return g;
      });
      axes.forEach((a, i) => {
        const p = pt(i, 0, R + 18);
        const hit = $s('circle', { cx: p[0], cy: p[1], r: 26, class: 'ch-hit', tabindex: 0, role: 'button', 'aria-label': a + ' : ' + series.map((s) => s.name + ' ' + this.num(s.values[i])).join(', ') }, svg);
        hit.addEventListener('pointerdown', () => select(i));
        hit.addEventListener('focus', () => select(i));
        hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
      });

      const select = (i) => {
        lines.forEach((l, k) => l.classList.toggle('is-sel', k === i));
        labels.forEach((t, k) => t.classList.toggle('is-sel', k === i));
        this.setBig(hd.big, this.num(series[0].values[i]), '/ ' + this.num(max));
        hd.sub.textContent = axes[i] + (series[1] ? ' · ' + series[1].name + ' ' + this.num(series[1].values[i]) : '');
        if (series[1]) {
          const d = series[0].values[i] - series[1].values[i];
          this.badge(hd.badge, d, d === 0 ? '=' : (d < 0 ? '▼ ' : '▲ ') + this.num(Math.abs(d)));
        } else this.badge(hd.badge, null);
      };
      select(series[0].values.indexOf(maxOf(series[0].values)));
      this.dataTable(o.label || 'Radar', [this.t('label')].concat(series.map((s) => s.name)), axes.map((a, i) => [a].concat(series.map((s) => s.values[i]))));
      this.reveal(() => polys.forEach((g) => g.classList.add('is-in')));
    }
  }
  RadarChart.defaults = { max: 100, label: 'Radar' };
  RadarChart.cls = [];

  /* ================================================================== GAUGE */
  class GaugeChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      let min = finite(o.min, 0), max = finite(o.max, 100);
      if (!(max > min)) { this.message = 'La plage de la jauge est invalide (min ≥ max)'; return false; }
      let zones = (Array.isArray(o.zones) ? o.zones : []).map((z, k) => ({ to: clamp(finite(z.to, max), min, max), color: colorAt(z.color, k), label: String(z.label != null ? z.label : '') }));
      zones.sort((a, b) => a.to - b.to);
      if (!zones.length) zones = [{ to: max, color: Charts.colors.accent, label: '' }];
      if (zones[zones.length - 1].to < max) zones.push({ to: max, color: zones[zones.length - 1].color, label: zones[zones.length - 1].label });
      this.message = undefined;
      this.d = { min, max, zones };
      return true;
    }

    build() {
      const o = this.o, { min, max } = this.d, zs = this.d.zones;
      const W = 360, H = 236, cx = 180, cy = 192, R = 128, T = 24;
      const frac = (v) => clamp((v - min) / (max - min), 0, 1);
      const pos = (f, r) => {
        const a = Math.PI * (1 - f), rr = r == null ? R : r;
        return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
      };
      const arc = (f0, f1) => {
        const a = pos(f0), b = pos(f1);
        return 'M' + a[0] + ',' + a[1] + ' A' + R + ',' + R + ' 0 0 1 ' + b[0] + ',' + b[1];
      };
      const unit = o.unit == null ? '' : o.unit;
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': (o.label || 'Jauge') + ' : ' + this.num(finite(o.value, min)) + unit }, $h('div', 'ch-wrap', this.root));

      // onPick : toucher une zone de l'arc (ou sa ligne dans la liste), ou l'arc de la valeur (zone de la valeur actuelle)
      // -> { kind:'gauge', index (zone), label (nom de la zone, sinon celui de la jauge), from, to, color, value (valeur actuelle) }
      const zoneInfo = (k) => ({
        kind: 'gauge', index: k, label: zs[k].label || o.label || 'Jauge', key: this.keyAt(k), from: k ? zs[k - 1].to : min, to: zs[k].to, color: zs[k].color, value: finite(o.value, min)
      });
      const zoneOfValue = () => { const k = zs.findIndex((z) => finite(o.value, min) <= z.to); return k < 0 ? zs.length - 1 : k; };
      let from = min;
      zs.forEach((z, k) => {
        const f0 = frac(from), f1 = frac(z.to);
        from = z.to;
        if (f1 - f0 > 0.013) {
          const zp = $s('path', { d: arc(f0 + 0.006, f1 - 0.006), fill: 'none', stroke: z.color, 'stroke-width': T, class: 'ch-gz' }, svg);
          if (this.pickable) zp.setAttribute('aria-label', (z.label || o.label || 'Jauge') + ' : ' + this.num(k ? zs[k - 1].to : min) + '–' + this.num(z.to) + unit);
          this.bindPick(zp, () => zoneInfo(k));
        }
      });
      for (let k = 0; k <= 10; k++) {
        const a = pos(k / 10, R - T / 2 - 8), b = pos(k / 10, R - T / 2 - (k % 5 ? 12 : 17));
        $s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'ch-gtick' }, svg);
      }
      const val = $s('path', { d: arc(0, 1), fill: 'none', 'stroke-width': T, pathLength: 100, class: 'ch-gval' }, svg);
      val.style.strokeDasharray = '0 100';
      const knob = $s('circle', { r: T / 2 + 4, class: 'ch-gknob' }, svg);
      [val, knob].forEach((n) => {
        if (this.pickable) n.setAttribute('aria-label', (o.label || 'Jauge') + ' : ' + this.num(finite(o.value, min)) + unit);
        this.bindPick(n, () => zoneInfo(zoneOfValue()));
      });
      const big = $s('text', { x: cx, y: cy - 24, class: 'ch-gnum', 'text-anchor': 'middle' }, svg);
      const cap = $s('text', { x: cx, y: cy + 4, class: 'ch-gcap', 'text-anchor': 'middle' }, svg);
      $s('text', { x: cx - R, y: cy + 24, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = this.num(min);
      $s('text', { x: cx + R, y: cy + 24, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = this.num(max);

      const zoneOf = (v) => zs.find((z) => v <= z.to) || zs[zs.length - 1];
      const render = (v) => {
        const f = frac(v), z = zoneOf(v), k = pos(f);
        val.style.strokeDasharray = f * 100 + ' 100';
        val.style.stroke = z.color;
        knob.setAttribute('cx', k[0]); knob.setAttribute('cy', k[1]);
        knob.style.stroke = z.color;
        big.textContent = this.num(v) + unit;
        cap.textContent = z.label;
        cap.style.fill = z.color;
      };
      this.v = this.v != null ? this.v : min;
      this.set = (to) => {
        to = finite(to, min);
        cancelAnimationFrame(this._gr);
        const f0 = this.v, t0 = performance.now();
        if (!this.motion) { this.v = to; render(to); return; }
        const step = (now) => {
          const t = clamp((now - t0) / 1200, 0, 1);
          this.v = f0 + (to - f0) * (1 - Math.pow(1 - t, 3));
          render(this.v);
          if (t < 1) this._gr = requestAnimationFrame(step);
        };
        this._gr = requestAnimationFrame(step);
      };
      render(this.v);

      const named = zs.filter((z) => z.label);
      if (named.length) {
        const lg = $h('ul', 'ch-zones', this.root);
        let lo = min;
        zs.forEach((z, k) => {
          if (z.label) {
            const s = $h('li', 'ch-zone', lg);
            s.style.setProperty('--c', z.color);
            $h('i', '', s); $h('b', '', s, z.label);
            $h('span', '', s, this.num(lo) + '–' + this.num(z.to));
            this.bindPick(s, () => zoneInfo(k));
          }
          lo = z.to;
        });
      }
      this.dataTable(o.label || 'Jauge', [this.t('label'), this.t('value')],
        [[o.label || 'Jauge', finite(o.value, min) + unit]].concat(zs.filter((z) => z.label).map((z) => [z.label, '≤ ' + this.num(z.to) + unit])));
      this.reveal(() => this.set(o.value));
    }

    update(patch) {
      // Mise à jour de la seule valeur : on anime l'aiguille sans tout redessiner.
      if (patch && this._built && Object.keys(patch).length === 1 && 'value' in patch && this.state === 'ready') {
        this.o.value = patch.value;
        this.set(patch.value);
        return this;
      }
      return super.update(patch);
    }
    teardown() { cancelAnimationFrame(this._gr); }
  }
  GaugeChart.defaults = { min: 0, max: 100, value: 0, unit: '', label: 'Jauge' };
  GaugeChart.cls = [];

  /* =============================================================== HEATMAP */
  class HeatmapChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      const values = (Array.isArray(o.values) ? o.values : []).map((v) => (v == null || !isFinite(+v) ? null : Math.max(0, +v)));
      const real = values.filter((v) => v != null);
      if (!real.length) return false;
      let start = null;
      if (o.start) {
        const ymd = String(o.start).split('-').map(Number);
        if (ymd.length === 3 && ymd.every(isFinite)) start = Date.UTC(ymd[0], ymd[1] - 1, ymd[2]);
      }
      this.d = { values, real, start };
      return true;
    }

    build() {
      const o = this.o, { values, real, start } = this.d, unit = o.unit == null ? '' : o.unit, color = o.color || Charts.palette[1];
      const weeks = Math.ceil(values.length / 7), cell = 13, st = 17, L = 16, T0 = 18, DAY = 864e5;
      const W = L + weeks * st, H = T0 + 7 * st;
      const dayFmt = new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
      const monFmt = new Intl.DateTimeFormat(this.locale, { month: 'short', timeZone: 'UTC' });
      const total = sum(real), max = maxOf(real), lo = clamp(finite(o.floor, 0), 0, max);
      const avgMode = o.summary === 'avg', byIndex = {};
      let cur = null;
      const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
      const hd = this.head();
      const show = (i) => {
        if (i == null) {
          this.setBig(hd.big, this.num(avgMode ? total / real.length : total), unit);
          hd.sub.textContent = avgMode
            ? this.t('avgOver').replace('{n}', real.length)
            : this.t('activeDays').replace('{a}', real.filter((v) => v > 0).length).replace('{n}', real.length);
        } else {
          this.setBig(hd.big, this.num(values[i]), unit);
          hd.sub.textContent = dayName(i);
        }
        mark(i);
      };
      const dayName = (i) => (start != null ? dayFmt.format(start + i * DAY) : this.t('day') + ' ' + (i + 1));
      let tip, mark = () => {};
      this.badge(hd.badge, max > 0 ? 1 : null, this.t('record') + ' ' + this.num(max) + ' ' + unit);
      const wrap = $h('div', 'ch-wrap', this.root);
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', tabindex: 0, 'aria-label': (o.label || 'Calendrier d’activité') + ' — flèches pour parcourir les jours' }, wrap);
      svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(null); });
      tip = $h('div', 'ch-tip', wrap);
      tip.style.opacity = 0;

      days.forEach((d, r) => $s('text', { x: 0, y: T0 + r * st + cell / 2, class: 'ch-axis', 'dominant-baseline': 'central' }, svg).textContent = d);
      if (start != null) {
        let lastMonth = -1, lastW = -9;
        for (let w = 0; w < weeks; w++) {
          const mo = new Date(start + w * 7 * DAY).getUTCMonth();
          if (mo !== lastMonth) {
            if (w - lastW >= 3) { $s('text', { x: L + w * st, y: 9, class: 'ch-axis' }, svg).textContent = monFmt.format(start + w * 7 * DAY); lastW = w; }
            lastMonth = mo;
          }
        }
      }
      const levelOf = (v) => (v === 0 ? 0 : max <= lo ? 4 : clamp(Math.ceil(((v - lo) / (max - lo)) * 4), 1, 4));
      const OP = [0.3, 0.5, 0.75, 1], cells = [];
      values.forEach((v, i) => {
        if (v == null) return;
        const w = Math.floor(i / 7), r = i % 7, lvl = levelOf(v);
        const c = $s('rect', { x: L + w * st, y: T0 + r * st, width: cell, height: cell, rx: 4, class: 'ch-cell' }, svg);
        if (lvl) { c.style.fill = color; c.style.fillOpacity = OP[lvl - 1]; }
        c.style.transitionDelay = (this.motion ? w * 22 : 0) + 'ms';
        c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(i); });
        c.addEventListener('pointerdown', () => show(i));
        c.setAttribute('aria-hidden', 'true');
        cells.push(c);
        byIndex[i] = c;
      });
      mark = (i) => {
        if (cur != null && byIndex[cur]) byIndex[cur].classList.remove('is-sel');
        cur = i;
        if (i == null || !byIndex[i]) { tip.style.opacity = 0; return; }
        byIndex[i].classList.add('is-sel');
        tip.textContent = '';
        $h('div', 'ch-tip-h', tip, dayName(i));
        $h('b', '', tip, this.num(values[i]) + (unit ? ' ' + unit : ''));
        const w = Math.floor(i / 7), r = i % 7;
        tip.style.left = clamp(((L + w * st + cell / 2) / W) * 100, 31, 69) + '%';
        tip.style.top = ((T0 + r * st) / H) * 100 + '%';
        tip.style.opacity = 1;
      };
      // Accès clavier : ← → changent de semaine, ↑ ↓ de jour, Début / Fin, Échap
      const valid = [];
      values.forEach((v, i) => { if (v != null) valid.push(i); });
      svg.addEventListener('focus', () => { if (cur == null) show(valid[valid.length - 1]); });
      svg.addEventListener('blur', () => show(null));
      svg.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[e.key];
        if (e.key === 'Escape') return show(null);
        let to = null;
        if (e.key === 'Home') to = valid[0];
        else if (e.key === 'End') to = valid[valid.length - 1];
        else if (step) {
          if (cur == null) to = valid[valid.length - 1];
          else { let j = cur + step; while (j >= 0 && j < values.length && values[j] == null) j += step; if (j >= 0 && j < values.length) to = j; }
        }
        if (to == null) return;
        e.preventDefault();
        show(to);
      });
      show(null);
      this.dataTable(o.label || 'Calendrier d’activité', [this.t('day'), this.t('value')],
        valid.map((i) => [dayName(i), values[i]]));

      const lg = $h('div', 'ch-scale', this.root);
      $h('span', '', lg, this.t('less'));
      [0, 1, 2, 3, 4].forEach((l) => {
        const s = $h('i', '', lg);
        if (l) { s.style.background = color; s.style.opacity = OP[l - 1]; }
      });
      $h('span', '', lg, this.t('more'));
      this.reveal(() => cells.forEach((c) => c.classList.add('is-in')));
    }
  }
  HeatmapChart.defaults = { unit: '', label: 'Calendrier d’activité' };
  HeatmapChart.cls = [];

  /* ================================================================ FUNNEL */
  class FunnelChart extends Charts.Chart {
    prepare() {
      const stages = (Array.isArray(this.o.stages) ? this.o.stages : []).map((s, i) => ({ label: String(s.label != null ? s.label : this.t('step') + ' ' + (i + 1)), value: Math.max(0, finite(s.value, 0)) }));
      if (!stages.length || !(stages[0].value > 0)) { this.message = stages.length ? 'La première étape doit être supérieure à 0' : undefined; return false; }
      this.message = undefined;
      this.d = { stages };
      return true;
    }

    build() {
      const o = this.o, { stages } = this.d, n = stages.length, color = o.color || Charts.palette[0];
      const W = 360, rowH = 60, barH = 42, H = n * rowH - (rowH - barH), bx = 122, bw = 232, cx = bx + bw / 2;
      const first = stages[0].value, last = stages[n - 1].value;
      const widths = stages.map((s) => Math.max(46, (bw * s.value) / first));
      const drop = (i) => Math.round((1 - ratio(stages[i].value, stages[i - 1].value)) * 100);
      const clip = (s) => (s.length > 15 ? s.slice(0, 14) + '…' : s);
      const hd = this.head();
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Entonnoir' }, $h('div', 'ch-wrap', this.root));

      for (let i = 0; i < n - 1; i++) {
        const y1 = i * rowH + barH, y2 = (i + 1) * rowH, a = widths[i] / 2, b = widths[i + 1] / 2;
        $s('polygon', { points: [cx - a, y1, cx + a, y1, cx + b, y2, cx - b, y2].join(','), fill: color, class: 'ch-fcon' }, svg);
      }
      const bars = [];
      stages.forEach((s, i) => {
        const y = i * rowH, w = widths[i];
        const bar = $s('rect', { x: cx - w / 2, y, width: w, height: barH, rx: 12, class: 'ch-fbar', fill: mix(color, Math.min(0.6, (n - 1 - i) * 0.1)) }, svg);
        bar.style.transitionDelay = (this.motion ? i * 110 : 0) + 'ms';
        bars.push(bar);
        $s('text', { x: 0, y: y + barH / 2 - 7, class: 'ch-ftxt', 'dominant-baseline': 'central' }, svg).textContent = clip(s.label);
        $s('text', { x: 0, y: y + barH / 2 + 10, class: 'ch-fval', 'dominant-baseline': 'central' }, svg).textContent = this.num(s.value);
        $s('text', { x: cx, y: y + barH / 2, class: 'ch-fpct', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, svg).textContent = pct(s.value, first) + '\u00a0%';
        if (i) $s('text', { x: W, y: y - (rowH - barH) / 2, class: 'ch-axis', 'text-anchor': 'end', 'dominant-baseline': 'central' }, svg).textContent = '▼ ' + drop(i) + '\u00a0%';
        const hit = $s('rect', { x: 0, y: Math.max(0, y - 9), width: W, height: rowH, class: 'ch-hit', tabindex: 0, role: 'button', 'aria-label': s.label + ' : ' + this.num(s.value) }, svg);
        hit.addEventListener('pointerdown', () => select(i));
        hit.addEventListener('focus', () => select(i));
        hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
        hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') select(null); });
        hit.addEventListener('blur', () => select(null));
      });
      const select = (i) => {
        bars.forEach((b, k) => b.classList.toggle('is-dim', i !== null && k !== i));
        if (i === null) {
          this.setBig(hd.big, this.num(ratio(last, first) * 100, 1), this.t('conversion'));
          hd.sub.textContent = stages[0].label + (n > 1 ? ' → ' + stages[n - 1].label : '');
          this.badge(hd.badge, null);
        } else {
          this.setBig(hd.big, this.num(stages[i].value));
          hd.sub.textContent = stages[i].label + ' · ' + pct(stages[i].value, first) + ' % ' + this.t('shareOfTotal');
          if (i) this.badge(hd.badge, -1, '▼ ' + drop(i) + '\u00a0%'); else this.badge(hd.badge, null);
        }
      };
      select(null);
      this.dataTable(o.label || 'Entonnoir', [this.t('label'), this.t('value'), '%'], stages.map((s) => [s.label, s.value, pct(s.value, first)]));
      this.reveal(() => bars.forEach((b) => b.classList.add('is-in')));
    }
  }
  FunnelChart.defaults = { label: 'Entonnoir' };
  FunnelChart.cls = [];

  /* ================================================================ BUBBLE */
  class BubbleChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      const points = (Array.isArray(o.points) ? o.points : [])
        .map((p, i) => ({ label: String(p.label != null ? p.label : this.t('item') + ' ' + (i + 1)), group: p.group != null ? String(p.group) : '', x: finite(p.x, NaN), y: finite(p.y, NaN), size: Math.max(0, finite(p.size, 0)) }))
        .filter((p) => isFinite(p.x) && isFinite(p.y));
      if (!points.length) return false;
      let groups = (Array.isArray(o.groups) ? o.groups : []).map((g, k) => ({ name: String(g.name), color: colorAt(g.color, k) }));
      if (!groups.length) { // pas de groupes fournis : on les déduit des points
        const names = points.map((p) => p.group).filter((g, i, a) => a.indexOf(g) === i);
        groups = names.map((nm, k) => ({ name: nm || this.t('values'), color: colorAt(null, k) }));
      }
      this.d = { points, groups };
      return true;
    }

    build() {
      const o = this.o, { points, groups } = this.d;
      const W = 360, H = 300, P = { t: 14, r: 18, b: 46, l: 46 };
      const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
      // xMin / yMin : échelle sans zéro (utile quand les valeurs sont groupées, ex. 80–100 %)
      const xr = spanRange(minOf(xs), maxOf(xs), o.xMin, o.xMax, 4) || fixedRange(minOf(xs), maxOf(xs), o.xMax, 4);
      const yr = spanRange(minOf(ys), maxOf(ys), o.yMin, o.yMax, 4) || fixedRange(minOf(ys), maxOf(ys), o.yMax, 4);
      const x = (v) => P.l + ((v - xr.min) / (xr.max - xr.min)) * (W - P.l - P.r), y = (v) => scale(yr, v, P.t, H - P.b);
      const sizes = points.map((p) => p.size), maxS = maxOf(sizes), total = sum(sizes);
      const rad = (s) => 6 + 17 * Math.sqrt(maxS > 0 ? s / maxS : 0);
      const col = (g) => (groups.find((q) => q.name === (g || this.t('values'))) || groups[0]).color;
      const xu = o.xUnit || '', yu = o.yUnit || '', st = o.sizeTitle || this.t('size');

      const hd = this.head();
      hd.badge.style.display = 'none';
      this.legend(groups);
      const wrap = $h('div', 'ch-wrap', this.root);
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Nuage de bulles' }, wrap);
      this.grid(svg, P, W, H, yr, (v) => this.axis(v) + yu);
      for (let k = 0; k <= xr.count; k++) {
        const v = xr.min + k * xr.step, xx = x(v);
        if (k > 0) $s('line', { x1: xx, x2: xx, y1: P.t, y2: H - P.b, class: 'ch-vline' }, svg);
        $s('text', { x: xx, y: H - P.b + 20, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = this.axis(v) + xu;
      }
      $s('text', { x: (P.l + W - P.r) / 2, y: H - 6, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = o.xTitle || '';
      const my = (P.t + H - P.b) / 2;
      $s('text', { x: 10, y: my, class: 'ch-axis', 'text-anchor': 'middle', transform: 'rotate(-90 10 ' + my + ')' }, svg).textContent = o.yTitle || '';

      const tip = $h('div', 'ch-tip', wrap);
      tip.style.opacity = 0;
      const bubs = [];
      points.slice().sort((a, b) => b.size - a.size).forEach((p, i) => {
        const c = $s('circle', {
          cx: x(p.x), cy: y(p.y), r: rad(p.size), fill: col(p.group), stroke: col(p.group), class: 'ch-bub', tabindex: 0, role: 'button',
          'aria-label': p.label + (p.group ? ' (' + p.group + ')' : '') + ' : ' + this.num(p.size)
        }, svg);
        c.style.transitionDelay = (this.motion ? i * 70 : 0) + 'ms';
        bubs.push(c);
        c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(p, c); });
        c.addEventListener('pointerdown', () => select(p, c));
        c.addEventListener('focus', () => select(p, c));
        c.addEventListener('blur', () => select(null));
        c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') select(null); });
      });
      const select = (p, c) => {
        bubs.forEach((b) => b.classList.toggle('is-sel', b === c));
        if (!p) {
          tip.style.opacity = 0;
          this.setBig(hd.big, this.num(total), st.toLowerCase());
          hd.sub.textContent = points.length + ' ' + (o.pointsName || this.t('items'));
          return;
        }
        tip.style.left = clamp((x(p.x) / W) * 100, 31, 69) + '%';
        tip.style.top = ((y(p.y) - rad(p.size)) / H) * 100 + '%';
        tip.style.opacity = 1;
        tip.textContent = '';
        $h('div', 'ch-tip-h', tip, p.label + (p.group ? ' · ' + p.group : ''));
        [[o.xTitle || 'X', this.num(p.x) + xu], [o.yTitle || 'Y', this.num(p.y) + yu], [st, this.num(p.size)]].forEach((r) => {
          const row = $h('div', 'ch-tip-r', tip);
          $h('span', '', row, r[0]); $h('b', '', row, r[1]);
        });
        this.setBig(hd.big, this.num(p.size), st.toLowerCase());
        hd.sub.textContent = p.label + (p.group ? ' · ' + p.group : '');
      };
      select(null);
      this.dataTable(o.label || 'Nuage de bulles', [this.t('label'), this.t('group'), o.xTitle || 'X', o.yTitle || 'Y', st],
        points.map((p) => [p.label, p.group, p.x, p.y, p.size]));
      this.reveal(() => bubs.forEach((b) => b.classList.add('is-in')));
    }
  }
  BubbleChart.defaults = { label: 'Nuage de bulles' };
  BubbleChart.cls = [];

  /* ============================================================== WATERFALL */
  class WaterfallChart extends Charts.Chart {
    prepare() {
      const steps = Array.isArray(this.o.steps) ? this.o.steps : [];
      if (!steps.length) return false;
      let run = 0;
      const rows = steps.map((s, i) => {
        const label = String(s.label != null ? s.label : i + 1), v = finite(s.value, null);
        let a, b;
        if (s.total) { a = 0; b = v != null ? v : run; } else { a = run; b = run + (v != null ? v : 0); }
        run = b;
        return { label, full: s.full ? String(s.full) : label, total: !!s.total, value: s.total ? b : v != null ? v : 0, a, b };
      });
      this.d = { rows };
      return true;
    }

    build() {
      const o = this.o, { rows } = this.d, unit = o.unit == null ? '' : o.unit;
      const up = o.up || Charts.colors.up, down = o.down || Charts.colors.down, totalColor = o.total || Charts.colors.total;
      const n = rows.length, W = 360, H = 252, P = { t: 34, r: 6, b: 34, l: 42 };
      const ext = rows.reduce((a, r) => a.concat([r.a, r.b]), []);
      const range = niceRange(minOf(ext), maxOf(ext), 4); // gère aussi un cumul négatif
      const y = (v) => scale(range, v, P.t, H - P.b), slot = (W - P.l - P.r) / n, bw = Math.min(40, slot * 0.58);
      const maxCh = Math.max(4, Math.floor(slot / 7.6)); // caractères qui tiennent sous une colonne, même à 10 px écran
      const colorOf = (r) => (r.total ? totalColor : r.value >= 0 ? up : down);
      const first = rows[0].b, last = rows[n - 1].b;
      const sym = (r) => (r.total ? this.axis(r.b) : (r.value >= 0 ? '+' : '−') + this.axis(Math.abs(r.value)));

      const hd = this.head();
      const svg = $s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': o.label || 'Cascade' }, $h('div', 'ch-wrap', this.root));
      this.grid(svg, P, W, H, range);

      const bars = [];
      rows.forEach((r, i) => {
        const cx = P.l + slot * (i + 0.5), yt = y(Math.max(r.a, r.b)), h = Math.max(3, Math.abs(y(r.a) - y(r.b)));
        if (i < n - 1) $s('line', { x1: cx + bw / 2, x2: cx + slot - bw / 2, y1: y(r.b), y2: y(r.b), class: 'ch-avg' }, svg);
        const bar = $s('rect', { x: cx - bw / 2, y: yt, width: bw, height: h, rx: Math.min(8, h / 2), class: 'ch-bar' }, svg);
        bar.style.fill = colorOf(r);
        bar.style.transformOrigin = '50% ' + (r.b >= r.a ? '100%' : '0%');
        bar.style.transitionDelay = (this.motion ? i * 90 : 0) + 'ms';
        bars.push(bar);
        $s('text', { x: cx, y: yt - 8, class: 'ch-wval', 'text-anchor': 'middle' }, svg).textContent = sym(r);
        $s('text', { x: cx, y: H - 12, class: 'ch-axis', 'text-anchor': 'middle' }, svg).textContent = r.label.length > maxCh ? r.label.slice(0, maxCh - 1) + '…' : r.label; // libellé complet dans l'infobulle et l'en-tête
        const hit = $s('rect', { x: P.l + slot * i, y: 0, width: slot, height: H, class: 'ch-hit', tabindex: 0, role: 'button', 'aria-label': r.full + ' : ' + this.num(r.total ? r.b : r.value) + ' ' + unit }, svg);
        hit.addEventListener('pointerdown', () => select(i));
        hit.addEventListener('focus', () => select(i));
        hit.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(i); });
        hit.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') select(null); });
        hit.addEventListener('blur', () => select(null));
      });
      const select = (i) => {
        bars.forEach((b, k) => b.classList.toggle('is-dim', i !== null && k !== i));
        if (i === null) {
          this.setBig(hd.big, this.num(last), unit);
          hd.sub.textContent = rows[n - 1].full;
          if (n > 1 && first !== 0) {
            const p = Math.round(((last - first) / Math.abs(first)) * 100);
            this.badge(hd.badge, p, (p < 0 ? '▼ ' : '▲ ') + Math.abs(p) + '\u00a0%');
          } else this.badge(hd.badge, null);
        } else {
          const r = rows[i];
          this.setBig(hd.big, r.total ? this.num(r.b) : this.signed(r.value), unit);
          hd.sub.textContent = r.full + (r.total ? '' : ' · ' + this.t('cumul') + ' ' + this.num(r.b));
          this.badge(hd.badge, !r.total && r.value < 0 ? -1 : 1, r.total ? this.t('total') : r.value < 0 ? this.t('outcome') : this.t('income'));
        }
      };
      select(null);
      this.dataTable(o.label || 'Cascade', [this.t('label'), this.t('value'), this.t('cumul')], rows.map((r) => [r.full, r.total ? r.b : r.value, r.b]));
      this.reveal(() => bars.forEach((b) => b.classList.add('is-in')));
    }
  }
  WaterfallChart.defaults = { unit: '', label: 'Cascade' };
  WaterfallChart.cls = [];

  global.RadarChart = RadarChart;
  global.GaugeChart = GaugeChart;
  global.HeatmapChart = HeatmapChart;
  global.FunnelChart = FunnelChart;
  global.BubbleChart = BubbleChart;
  global.WaterfallChart = WaterfallChart;
})(typeof window !== 'undefined' ? window : this);
