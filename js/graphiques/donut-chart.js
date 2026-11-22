/*!
 * DonutChart — donut segmenté aux bouts arrondis, SVG pur, sans dépendance.
 * Nécessite js/core.js, css/tokens.css et css/charts.css.
 *
 * Utilisation :
 *   const chart = new DonutChart('#chart', {
 *     unit: 'élèves',           // unité affichée (ex. 'FCFA', 'élèves'…)
 *     total: 42,                // objectif ou effectif de référence (facultatif, alias : budget)
 *     data: [{ label: 'Excellent', value: 5, color: '#35d6c9' }, ...]
 *   });
 *   chart.update({ data: nouvellesDonnees, total: 42 });
 *   chart.update(nouvellesDonnees, 42);   // ancienne forme, toujours acceptée
 *
 * Textes (options.text) : label, caption, of, ofTotal, ofReference.
 */
(function (global) {
  'use strict';

  const Charts = global.Charts;
  const U = Charts.util;
  const { $s, $h, finite } = U;
  const TAU = Math.PI * 2;

  function replay(node) {
    node.classList.remove('swap');
    void node.offsetWidth;
    node.classList.add('swap');
  }

  class DonutChart extends Charts.Chart {
    prepare() {
      const o = this.o;
      const data = (Array.isArray(o.data) ? o.data : [])
        .map((d, i) => ({
          label: String(d.label != null ? d.label : 'Élément ' + (i + 1)),
          value: finite(d.value, 0),
          color: d.color || Charts.palette[i % Charts.palette.length]
        }))
        .filter((d) => d.value > 0); // les valeurs nulles ou négatives n'ont pas de part à afficher
      const total = data.reduce((s, d) => s + d.value, 0);
      if (!data.length || !(total > 0)) return false;
      const ref = finite(o.total != null ? o.total : o.budget, 0);
      this.d = { data, total, ref: ref > 0 ? ref : 0 };
      return true;
    }

    get unit() { return this.o.unit != null ? this.o.unit : this.o.currency != null ? this.o.currency : ''; }
    money(v) { return this.num(v, 0) + (this.unit ? '\u00a0' + this.unit : ''); }
    tx(key) { return (this.o.text && this.o.text[key]) || DonutChart.defaults.text[key]; }

    build() {
      const o = this.o, self = this, { data, total } = this.d;
      const c = o.size / 2, C = TAU * o.radius;
      this.root.style.setProperty('--dc-t', o.thickness);
      this.active = null; this.pinned = null; this.shown = this.shown || 0;

      const stage = $h('div', 'dc-stage', this.root);
      this.svg = $s('svg', { class: 'dc-svg', viewBox: '0 0 ' + o.size + ' ' + o.size, role: 'group', 'aria-label': this.tx('label') }, stage);
      this.ring = $s('g', { transform: 'rotate(-90 ' + c + ' ' + c + ')' }, this.svg);
      this.labels = $s('g', {}, this.svg);

      this.center = $h('div', 'dc-center', stage);
      this.center.setAttribute('aria-live', 'polite');
      this.pill = $h('span', 'dc-pill', this.center);
      $h('i', '', this.pill);
      this.pillText = $h('span', '', this.pill);
      this.caption = $h('span', 'dc-caption', this.center);
      this.amount = $h('strong', 'dc-amount', this.center);
      this.sub = $h('span', 'dc-sub', this.center);
      this.legend = $h('ul', 'dc-legend', this.root);

      this.on(this.root, 'keydown', (e) => { if (e.key === 'Escape') { this.pinned = null; this.setActive(null); } });

      let cum = 0;
      this.segs = []; this.pcts = []; this.items = [];
      data.forEach((d, i) => {
        const frac = d.value / total;
        const p = Math.round(frac * 100);
        const dash = Math.max(0.01, frac * C - o.gap - o.thickness);
        const pos = cum * C + o.gap / 2 + o.thickness / 2;
        const delay = this.motion ? i * 80 : 0;

        const seg = $s('circle', {
          cx: c, cy: c, r: o.radius, fill: 'none', 'stroke-width': o.thickness, 'stroke-linecap': 'round',
          class: 'dc-seg', tabindex: 0, role: 'button', 'aria-pressed': 'false',
          'aria-label': d.label + ' : ' + p + ' %, ' + self.money(d.value)
        }, self.ring);
        seg.style.setProperty('--c', d.color);
        seg.style.stroke = d.color;
        seg.style.strokeDasharray = '0.01 ' + C;
        seg.style.strokeDashoffset = -pos;
        seg.style.transitionDelay = delay + 'ms';

        // Les petits segments (< 4 %) n'ont pas d'étiquette autour de l'anneau : elles se chevaucheraient.
        const mid = (cum + frac / 2) * TAU - Math.PI / 2, rl = o.radius + o.thickness / 2 + 20;
        const t = $s('text', {
          x: c + rl * Math.cos(mid), y: c + rl * Math.sin(mid), class: 'dc-pct',
          'text-anchor': 'middle', 'dominant-baseline': 'central', 'aria-hidden': 'true'
        }, self.labels);
        t.textContent = frac < 0.04 ? '' : p + '\u00a0%';
        t.style.transitionDelay = delay + 300 + 'ms';

        const li = $h('li', '', self.legend);
        const btn = $h('button', 'dc-item', li);
        btn.type = 'button';
        btn.setAttribute('aria-pressed', 'false');
        btn.style.setProperty('--c', d.color);
        $h('span', 'dc-dot', btn);
        $h('span', 'dc-name', btn, d.label);
        $h('span', 'dc-val', btn, self.money(d.value) + ' · ' + p + '\u00a0%');

        [seg, btn].forEach((node) => {
          node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') self.setActive(i); });
          node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') self.setActive(self.pinned); });
          node.addEventListener('focus', () => self.setActive(i));
          node.addEventListener('blur', () => self.setActive(self.pinned));
          node.addEventListener('click', () => self.pin(i));
        });
        seg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.pin(i); } });

        self.segs.push(seg); self.pcts.push(t); self.items.push(btn);
        cum += frac;
      });

      this.reveal(() => {
        this.segs.forEach((seg, i) => {
          const frac = data[i].value / total, dash = Math.max(0.01, frac * C - o.gap - o.thickness);
          seg.classList.add('is-in');
          seg.style.strokeDasharray = dash + ' ' + (C - dash);
          this.pcts[i].classList.add('is-in');
        });
        if (this.motion) this.later(() => this.segs.forEach((s) => { s.style.transitionDelay = ''; }), data.length * 80 + 1100);
      });
      this.paint();
      this.dataTable(this.tx('label'), [this.t('label'), this.t('value') + (this.unit ? ' (' + this.unit + ')' : ''), '%'],
        data.map((d) => [d.label, d.value, Math.round((d.value / total) * 100)]));
    }

    update(a, b) {
      // Ancienne signature : update(data, budget)
      if (Array.isArray(a)) return super.update({ data: a, total: b != null ? b : this.o.total, budget: undefined });
      return super.update(a);
    }

    pin(i) {
      this.pinned = this.pinned === i ? null : i;
      this.segs.forEach((s, k) => s.setAttribute('aria-pressed', String(k === this.pinned)));
      this.items.forEach((s, k) => s.setAttribute('aria-pressed', String(k === this.pinned)));
      this.setActive(this.pinned);
    }

    setActive(i) {
      if (i === this.active) return;
      this.active = i;
      const dim = (k) => i !== null && k !== i;
      this.segs.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-dim', dim(k)); });
      this.pcts.forEach((p, k) => p.classList.toggle('is-dim', dim(k)));
      this.items.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.classList.toggle('is-dim', dim(k)); });
      this.paint();
    }

    paint() {
      const { data, total, ref } = this.d, d = this.active === null ? null : data[this.active];
      if (d) {
        this.center.style.setProperty('--c', d.color);
        this.center.classList.add('has-active');
        this.pillText.textContent = Math.round((d.value / total) * 100) + '\u00a0% ' + this.tx('ofTotal');
        this.caption.textContent = d.label;
        this.sub.textContent = this.unit;
        this.tween(d.value);
      } else {
        this.center.classList.remove('has-active');
        const share = ref ? Math.round((total / ref) * 100) : 100;
        this.pillText.textContent = share + '\u00a0% ' + (ref ? this.tx('ofReference') : this.tx('ofTotal'));
        this.caption.textContent = this.tx('caption');
        this.sub.textContent = ref ? this.tx('of') + ' ' + this.money(ref) : this.unit;
        this.tween(total);
      }
      replay(this.pill); replay(this.caption); replay(this.sub);
    }

    tween(to) {
      cancelAnimationFrame(this._tw);
      const from = this.shown, t0 = performance.now(), self = this;
      if (!this.motion) { this.shown = to; this.amount.textContent = this.num(to, 0); return; }
      (function step(now) {
        const p = Math.min(1, (now - t0) / 500);
        const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
        self.shown = v;
        self.amount.textContent = self.num(v, 0);
        if (p < 1) self._tw = requestAnimationFrame(step);
      })(t0);
    }
    teardown() { cancelAnimationFrame(this._tw); }
  }

  DonutChart.defaults = {
    size: 360, radius: 118, thickness: 22, gap: 8,
    unit: null, total: null,
    text: { label: 'Répartition', caption: 'Total', of: 'sur', ofTotal: 'du total', ofReference: 'de la référence' },
    data: []
  };
  DonutChart.cls = ['dc'];

  global.DonutChart = DonutChart;
  if (typeof module !== 'undefined' && module.exports) module.exports = DonutChart;
})(typeof window !== 'undefined' ? window : this);
