import { Sim, result, mean } from '../engine.js';

export default {
  id: 'unbounded-queue',
  title: 'Unbounded queue',
  tagline: 'Producers are faster than the consumer, so the backlog (and every message’s wait) grows forever.',
  tags: ['queues', 'backpressure', 'latency'],
  severity: 'high',
  duration: 60,
  xLabel: 'seconds',
  charts: [
    { title: 'Messages waiting in the queue', series: [{ key: 'depth', label: 'queue depth' }], unit: 'messages' },
    { title: 'How long a message waits before being handled', series: [{ key: 'latency', label: 'wait' }], unit: 'seconds' },
  ],
  why: 'A queue hides a rate mismatch instead of fixing it. When arrivals exceed capacity, the queue absorbs the difference as memory and delay. Every message is still "accepted", but they are all handled too late to matter.',
  spot: 'Queue depth or memory climbs steadily and never returns to zero. Latency of "successful" work keeps increasing. Eventually the process runs out of memory.',
  fix: 'Bound the queue, reject (or shed) when full, and let producers slow down when they see rejections. Backpressure turns hidden delay into an explicit, fast signal.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const CONSUMER_RATE = 100; // msgs/s
    const CAP = 200;
    let rate = 150; // producer wants 150 msgs/s
    const queue = [];
    let busy = false;
    let accepted = 0;
    let rejected = 0;
    let handled = 0;
    let peak = 0;
    let maxWait = 0;
    let waits = [];
    let noted = false;

    function pump() {
      if (busy || !queue.length) return;
      const m = queue.shift();
      busy = true;
      sim.after(1 / CONSUMER_RATE, () => {
        busy = false;
        const w = sim.now - m;
        waits.push(w);
        maxWait = Math.max(maxWait, w);
        handled++;
        if (!noted && w > 5) {
          noted = true;
          sim.note('fail', `A message just waited ${w.toFixed(1)}s in the queue. It is "accepted" but useless by now.`);
        }
        pump();
      });
    }

    function produce() {
      if (fixed && queue.length >= CAP) {
        rejected++;
        rate = Math.max(60, rate * 0.9); // backpressure: producer slows down
      } else {
        queue.push(sim.now);
        accepted++;
        peak = Math.max(peak, queue.length);
        if (fixed) rate = Math.min(150, rate + 0.2);
        pump();
      }
      sim.after(1 / rate, produce);
    }
    sim.at(0, produce);

    sim.every(1, 60, () => {
      sim.sample('depth', queue.length);
      sim.sample('latency', waits.length ? mean(waits) : 0);
      waits = [];
    });
    sim.run(60);
    if (fixed) sim.note('ok', `Queue held at ${peak} (cap ${CAP}). ${rejected} requests were rejected fast so producers could slow down.`);
    else sim.note('fail', `Backlog reached ${peak} messages and was still growing at the end.`);

    return result(
      sim,
      { 'peak queue depth': peak, 'worst wait': `${maxWait.toFixed(1)}s`, accepted, rejected, handled },
      { name: 'No message waits more than 5 seconds', holds: maxWait <= 5, detail: `worst wait was ${maxWait.toFixed(1)}s` },
    );
  },
};
