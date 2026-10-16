import { Sim, result } from '../engine.js';

export default {
  id: 'double-charge',
  title: 'Double charge',
  tagline: 'The payment succeeded but the reply got lost. The client retried, so the customer paid twice.',
  tags: ['payments', 'idempotency', 'networking'],
  severity: 'critical',
  duration: 30,
  xLabel: 'seconds',
  charts: [{ title: 'Orders vs charges made', series: [{ key: 'orders', label: 'orders placed' }, { key: 'charges', label: 'charges taken' }], unit: 'count' }],
  why: 'A timeout does not mean the request failed. It means you do not know. If the server did the work and only the reply was lost, retrying repeats the side effect.',
  spot: 'Customers report duplicate charges or duplicate emails that cluster around network incidents. Charge count is higher than order count.',
  fix: 'Send an idempotency key with every mutating request. The server remembers the key and returns the original result instead of repeating the work.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const ORDERS = 120;
    const TIMEOUT = 0.6;
    const MAX_ATTEMPTS = 3;
    const seen = new Map(); // idempotency key -> stored response
    let charges = 0;
    let orders = 0;
    let doubles = 0;
    const charged = new Set();
    let noted = false;

    function attempt(orderId, n) {
      let answered = false;
      const toServer = 0.05 + sim.rand() * 0.3;
      sim.after(toServer, () => {
        let reply;
        if (fixed && seen.has(orderId)) reply = seen.get(orderId);
        else {
          charges++;
          if (charged.has(orderId)) {
            doubles++;
            if (!noted) {
              noted = true;
              sim.note('fail', `Order ${orderId} is charged again: the first reply was lost, so the client retried.`);
            }
          }
          charged.add(orderId);
          reply = `receipt-${orderId}`;
          if (fixed) seen.set(orderId, reply);
        }
        const lost = sim.rand() < 0.2; // reply dropped by the network
        const back = 0.05 + sim.rand() * 0.3;
        if (!lost) sim.after(back, () => (answered = true));
      });
      sim.after(TIMEOUT, () => {
        if (!answered && n + 1 < MAX_ATTEMPTS) attempt(orderId, n + 1);
      });
    }

    for (let i = 1; i <= ORDERS; i++) {
      sim.at(sim.rand() * 25, () => {
        orders++;
        attempt(i, 0);
      });
    }
    sim.every(1, 30, () => {
      sim.sample('orders', orders);
      sim.sample('charges', charges);
    });
    sim.run(30);

    const extra = charges - ORDERS;
    sim.note(extra === 0 ? 'ok' : 'fail', `${charges} charges for ${ORDERS} orders (${extra} duplicate${extra === 1 ? '' : 's'}).`);
    return result(
      sim,
      { orders: ORDERS, charges, 'duplicate charges': extra, 'refunds owed': `${extra} × payment` },
      { name: 'Each order is charged exactly once', holds: extra === 0, detail: `${charges} charges for ${ORDERS} orders` },
    );
  },
};
