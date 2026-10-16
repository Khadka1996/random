import { Sim, result } from '../engine.js';

export default {
  id: 'lost-update',
  title: 'Lost update',
  tagline: 'Two workers read, add one, write back. Hundreds of increments vanish, silently.',
  tags: ['concurrency', 'data-integrity', 'race-condition'],
  severity: 'critical',
  duration: 20,
  xLabel: 'seconds',
  charts: [{ title: 'Counter: what workers believe vs what is stored', series: [{ key: 'acked', label: 'increments acknowledged' }, { key: 'stored', label: 'value in the database' }], unit: 'count' }],
  why: 'Read-modify-write is not atomic. Both workers read 41, both write 42, and one increment is gone. Nothing errors, so the data is simply wrong.',
  spot: 'Counters, balances or stock levels that drift below what the logs say happened. It only shows under concurrency, so it passes every single-user test.',
  fix: 'Make the write conditional (compare-and-swap on a version), use an atomic increment, or take a row lock. Retry when the condition fails.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const PER_WORKER = 500;
    const store = { value: 0, version: 0 };
    let acked = 0;
    let lost = 0;
    let retries = 0;
    let firstLost = false;

    function worker(id, remaining) {
      if (remaining === 0) return;
      const readValue = store.value;
      const readVersion = store.version;
      const think = 0.004 + sim.rand() * 0.012; // time between read and write
      sim.after(think, () => {
        if (fixed) {
          if (store.version !== readVersion) {
            retries++;
            return worker(id, remaining); // conflict: re-read and try again
          }
          store.value = readValue + 1;
          store.version++;
        } else {
          if (store.value !== readValue) {
            lost++;
            if (!firstLost) {
              firstLost = true;
              sim.note('fail', `Worker ${id} overwrites a newer value. One increment disappears and nothing errors.`);
            }
          }
          store.value = readValue + 1;
          store.version++;
        }
        acked++;
        sim.after(sim.rand() * 0.03, () => worker(id, remaining - 1)); // idle time between operations
      });
    }

    worker('A', PER_WORKER);
    worker('B', PER_WORKER);
    sim.every(0.5, 20, () => {
      sim.sample('acked', acked);
      sim.sample('stored', store.value);
    });
    sim.run(20);

    const expected = PER_WORKER * 2;
    sim.note(store.value === expected ? 'ok' : 'fail', `Final value ${store.value}, expected ${expected}.`);
    return result(
      sim,
      { 'expected': expected, 'stored': store.value, 'increments lost': expected - store.value, 'conflict retries': retries },
      { name: 'Every acknowledged increment is stored', holds: store.value === expected, detail: `${store.value} stored vs ${expected} acknowledged` },
    );
  },
};
