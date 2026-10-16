import { Sim, result, mean } from '../engine.js';

export default {
  id: 'retry-storm',
  title: 'Retry storm',
  tagline: 'A 5-second outage that never ends, because every client retries at once.',
  tags: ['resilience', 'networking', 'metastable'],
  severity: 'critical',
  duration: 60,
  xLabel: 'seconds',
  charts: [
    { title: 'Successful requests per second', series: [{ key: 'goodput', label: 'goodput' }], unit: 'req/s' },
    { title: 'Server queue length', series: [{ key: 'queue', label: 'queued requests' }], unit: 'requests' },
  ],
  why: 'When a dependency stalls, clients time out and retry. Retries are extra load on a service that is already struggling, and the server still burns time on requests whose clients gave up. Past a tipping point the system stays broken even after the original fault is gone.',
  spot: 'Traffic to a dependency is several times higher than normal while its success rate is near zero. The outage ended minutes ago but graphs have not recovered. Queue depth or latency only goes up.',
  fix: 'Exponential backoff with full jitter, a retry budget (a hard cap on attempts), a bounded queue that rejects fast, and servers that drop requests whose deadline has already passed.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const CLIENTS = 100;
    const SERVICE_TIME = 1 / 150; // server handles 150 req/s
    const TIMEOUT = fixed ? 1.0 : 0.25;
    const OUTAGE = [10, 15];
    const MAX_ATTEMPTS = 3;
    const QUEUE_CAP = 100;

    const queue = [];
    let busy = false;
    let down = false;
    let ok = 0;
    let wasted = 0;
    let total = 0;
    let lastOk = 0;
    let peakQueue = 0;
    let noted = { collapse: false, recover: false, blown: false };

    function pump() {
      if (busy || down) return;
      let r;
      while ((r = queue.shift())) {
        if (fixed && r.dead) continue; // deadline propagation: skip work nobody awaits
        break;
      }
      if (!r) return;
      busy = true;
      sim.after(SERVICE_TIME, () => {
        busy = false;
        if (!r.dead) {
          r.done = true;
          ok++;
          sim.after(1, () => send(r.client, 0)); // next scheduled request in 1s
        } else wasted++;
        pump();
      });
    }

    function onFail(client, attempt) {
      if (!fixed) return send(client, attempt + 1); // retry immediately, forever
      if (attempt + 1 >= MAX_ATTEMPTS) return sim.after(1, () => send(client, 0)); // budget spent
      const cap = Math.min(8, 0.5 * 2 ** attempt);
      sim.after(sim.rand() * cap, () => send(client, attempt + 1)); // full jitter
    }

    function send(client, attempt) {
      total++;
      const r = { client, dead: false, done: false };
      if (fixed && queue.length >= QUEUE_CAP) return onFail(client, attempt); // fail fast
      queue.push(r);
      peakQueue = Math.max(peakQueue, queue.length);
      pump();
      sim.after(TIMEOUT, () => {
        if (!r.done) {
          r.dead = true;
          onFail(client, attempt);
        }
      });
    }

    for (let c = 0; c < CLIENTS; c++) sim.at(sim.rand(), () => send(c, 0));
    sim.at(OUTAGE[0], () => {
      down = true;
      sim.note('fault', 'Dependency stalls. All requests start timing out.');
    });
    sim.at(OUTAGE[1], () => {
      down = false;
      sim.note('info', 'Dependency is healthy again. The original fault is over.');
      pump();
    });

    sim.every(1, 60, () => {
      const goodput = ok - lastOk;
      lastOk = ok;
      sim.sample('goodput', goodput);
      sim.sample('queue', queue.length);
      if (!noted.blown && queue.length > 300) {
        noted.blown = true;
        sim.note('fail', `Queue passes 300 (${queue.length}). Stale retries now outnumber real work.`);
      }
      if (!noted.collapse && sim.now > OUTAGE[1] + 5 && goodput < 20) {
        noted.collapse = true;
        sim.note('fail', `Still down ${Math.round(sim.now - OUTAGE[1])}s after the fault ended: goodput is ${goodput}/s. Retries keep the system broken.`);
      }
      if (!noted.recover && sim.now > OUTAGE[1] && goodput >= 90) {
        noted.recover = true;
        sim.note('ok', `Back to ${goodput} req/s, ${Math.round(sim.now - OUTAGE[1])}s after the fault ended.`);
      }
    });
    sim.run(60);

    const tail = sim.series.goodput.filter((p) => p.t > 45).map((p) => p.v);
    const finalGoodput = Math.round(mean(tail));
    return result(
      sim,
      { 'steady goodput after outage': `${finalGoodput} req/s`, 'peak queue': peakQueue, 'wasted server work': `${Math.round((100 * wasted) / Math.max(1, ok + wasted))}%`, 'requests sent': total },
      { name: 'System recovers after the outage ends', holds: finalGoodput >= 90, detail: `goodput over the last 15s is ${finalGoodput} req/s (healthy is ~100)` },
    );
  },
};
