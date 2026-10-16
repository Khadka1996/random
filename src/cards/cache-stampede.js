import { Sim, result } from '../engine.js';

export default {
  id: 'cache-stampede',
  title: 'Cache stampede',
  tagline: 'One hot key expires and hundreds of requests all rebuild it at the same moment.',
  tags: ['caching', 'database', 'latency'],
  severity: 'high',
  duration: 60,
  xLabel: 'seconds',
  charts: [
    { title: 'Database queue length', series: [{ key: 'dbQueue', label: 'queued queries' }], unit: 'queries' },
    { title: 'Checkout success rate (unrelated feature)', series: [{ key: 'checkout', label: 'success %' }], unit: '%', max: 100 },
  ],
  why: 'A popular entry has a TTL. When it expires, every request that arrives before the first rebuild finishes also misses, and each one runs the expensive query. The database backlog starves unrelated features that share it.',
  spot: 'Periodic spikes in database load that line up with a cache TTL. Unrelated endpoints slow down or time out at the same moment. The pattern repeats every TTL.',
  fix: 'Single-flight: let one request rebuild while others wait for its result. Add jitter to TTLs and serve stale data while revalidating for extra safety.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const TTL = 10;
    const REBUILD = 2.0; // seconds of DB worker time for the expensive query
    const WORKERS = 4;
    const REQ_RATE = 200;
    const CHECKOUT_RATE = 10;

    let free = WORKERS;
    const dbq = [];
    let cacheExp = 5;
    let rebuilding = false;
    let rebuilds = 0;
    let peakQueue = 0;
    const buckets = {}; // checkout outcomes grouped by the second they were born in
    let missBurst = 0;
    let burstOpen = false;

    function dispatch() {
      while (free > 0 && dbq.length) {
        const job = dbq.shift();
        free--;
        sim.after(job.dur, () => {
          free++;
          job.done();
          dispatch();
        });
      }
    }
    const enqueue = (job) => {
      dbq.push(job);
      peakQueue = Math.max(peakQueue, dbq.length);
      dispatch();
    };

    function startRebuild() {
      rebuilds++;
      enqueue({
        dur: REBUILD,
        done() {
          rebuilding = false;
          if (sim.now > cacheExp) cacheExp = sim.now + TTL;
        },
      });
    }

    function request() {
      if (sim.now < cacheExp) return;
      if (!burstOpen) {
        burstOpen = true;
        missBurst = 0;
        sim.after(REBUILD, () => {
          burstOpen = false;
          if (missBurst < 20) return;
          sim.note(fixed ? 'ok' : 'fail', fixed ? `Key expired: ${missBurst} requests missed, but only 1 rebuilt it. The rest waited.` : `Key expired: ${missBurst} requests missed and each started its own ${REBUILD}s rebuild.`);
        });
      }
      missBurst++;
      if (fixed) {
        if (!rebuilding) {
          rebuilding = true;
          startRebuild();
        }
      } else startRebuild();
    }

    function checkout() {
      const born = sim.now;
      const b = (buckets[Math.floor(born)] ||= { all: 0, ok: 0 });
      b.all++;
      enqueue({
        dur: 0.05,
        done() {
          if (sim.now - born <= 1) b.ok++; // a checkout slower than 1s counts as failed
        },
      });
    }

    for (let t = 0; t < 60; t += 1 / REQ_RATE) sim.at(t + sim.rand() / REQ_RATE, request);
    for (let t = 0; t < 60; t += 1 / CHECKOUT_RATE) sim.at(t + sim.rand() / CHECKOUT_RATE, checkout);

    const rates = [];
    sim.every(1, 60, () => {
      // report the bucket born 2s ago: its outcome (success or timeout) is final by now
      const b = buckets[Math.floor(sim.now) - 2];
      const pct = b && b.all ? Math.round((100 * b.ok) / b.all) : 100;
      rates.push(pct);
      sim.sample('dbQueue', dbq.length);
      sim.sample('checkout', pct);
    });
    sim.run(60);

    const worst = Math.min(...rates);
    return result(
      sim,
      { 'cache rebuilds': rebuilds, 'peak DB queue': peakQueue, 'worst checkout success': `${worst}%` },
      { name: 'Unrelated checkout stays healthy (≥95% success every second)', holds: worst >= 95, detail: `worst second had ${worst}% checkout success` },
    );
  },
};
