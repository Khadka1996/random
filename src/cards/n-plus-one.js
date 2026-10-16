import { Sim, result } from '../engine.js';

export default {
  id: 'n-plus-one',
  title: 'N+1 queries',
  tagline: 'Loading a list triggers one query for the list and one more for every row. Fast with 5 rows, painful with 500.',
  tags: ['database', 'performance', 'orm'],
  severity: 'medium',
  duration: 100,
  xLabel: 'items on the page',
  charts: [{ title: 'Page load time as the list grows', series: [{ key: 'latency', label: 'load time' }], unit: 'ms' }],
  why: 'Code that looks like a simple loop quietly issues a database round trip per item. Each trip has a fixed network cost, so latency grows in a straight line with the data. It never shows up in a dev database with 5 rows.',
  spot: 'Page time scales with the number of rows. Logs show the same query repeating with a different id. Query count per request is far above the number of tables involved.',
  fix: 'Fetch related rows in one query (JOIN, or WHERE id IN (...)) or use your ORM’s eager-loading. Add a test that asserts the query count.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const RTT = 2.0; // ms per database round trip
    const ROW = 0.05; // ms per row transferred
    const BUDGET = 100; // ms
    let queriesAt100 = 0;
    let lat100 = 0;
    let crossed = false;

    for (let n = 1; n <= 100; n++) {
      sim.at(n, () => {
        const queries = fixed ? 2 : 1 + n;
        const noise = 1 + (sim.rand() - 0.5) * 0.1;
        const ms = (queries * RTT + n * ROW) * noise;
        sim.sample('latency', ms);
        if (!crossed && ms > BUDGET) {
          crossed = true;
          sim.note('fail', `At ${n} items the page needs ${queries} queries and takes ${Math.round(ms)}ms: over the ${BUDGET}ms budget.`);
        }
        if (n === 100) {
          queriesAt100 = queries;
          lat100 = ms;
        }
      });
    }
    sim.run(100);
    if (fixed) sim.note('ok', 'The page needs 2 queries no matter how many items it shows.');

    return result(
      sim,
      { 'queries at 100 items': queriesAt100, 'load time at 100 items': `${Math.round(lat100)}ms` },
      { name: `Page stays under ${BUDGET}ms at 100 items`, holds: lat100 <= BUDGET, detail: `${Math.round(lat100)}ms with ${queriesAt100} queries` },
    );
  },
};
