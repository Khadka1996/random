// Proofbook engine: a tiny deterministic discrete-event simulator.
// Virtual clock + seeded PRNG + event queue. Same seed => identical trace, in Node and in the browser.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Sim {
  constructor(seed = 1) {
    this.now = 0;
    this.rand = mulberry32(seed);
    this.heap = [];
    this.counter = 0;
    this.events = [];
    this.series = {};
  }

  // --- event queue (binary min-heap ordered by time, then insertion order) ---
  _less(a, b) {
    return a.t < b.t || (a.t === b.t && a.n < b.n);
  }
  at(t, fn) {
    const e = { t, n: this.counter++, fn };
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this._less(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  after(delay, fn) {
    this.at(this.now + delay, fn);
  }
  _pop() {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this._less(h[l], h[m])) m = l;
        if (r < h.length && this._less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
  run(until) {
    while (this.heap.length && this.heap[0].t <= until) {
      const e = this._pop();
      this.now = e.t;
      e.fn();
    }
    this.now = until;
  }

  // call fn every `period` virtual seconds, starting at `period`, until `until`
  every(period, until, fn) {
    for (let t = period; t <= until + 1e-9; t += period) this.at(Math.round(t * 1e6) / 1e6, fn);
  }

  // --- recording ---
  note(kind, msg) {
    this.events.push({ t: Math.round(this.now * 1000) / 1000, kind, msg });
  }
  sample(name, v) {
    (this.series[name] ||= []).push({ t: Math.round(this.now * 1000) / 1000, v: Math.round(v * 1000) / 1000 });
  }
}

// Standard result shape every card returns.
export function result(sim, summary, invariant) {
  return { events: sim.events, series: sim.series, summary, invariant };
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
