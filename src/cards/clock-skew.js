import { Sim, result } from '../engine.js';

export default {
  id: 'clock-skew',
  title: 'Clock skew',
  tagline: 'Last-write-wins trusts wall clocks. One server is 3 seconds slow, so newer data loses to older data.',
  tags: ['distributed-systems', 'time', 'replication'],
  severity: 'high',
  duration: 60,
  xLabel: 'seconds',
  charts: [{ title: 'Writes that were overwritten by an older write', series: [{ key: 'anomalies', label: 'wrong winners (cumulative)' }], unit: 'writes' }],
  why: 'Replicas resolve conflicts by comparing timestamps. If one machine clock runs behind, its newest writes carry older timestamps and are discarded when they meet another replica. Both replicas then agree on the wrong value.',
  spot: 'Users say a change "reverted itself". It happens only when two different nodes handled consecutive writes. Replicas agree with each other, yet disagree with what users did.',
  fix: 'Use a hybrid logical clock (or version vectors): a new write must be stamped later than anything the node has already seen, no matter what its wall clock says.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const SKEW = [0, -3]; // node B runs 3s behind
    const REPL_DELAY = 0.2;
    const nodes = [0, 1].map(() => ({ rec: null, seen: 0 }));
    let anomalies = 0;
    let lastReal = null;
    let noted = false;

    const discarded = new Set();
    function merge(node, incoming) {
      node.seen = Math.max(node.seen, incoming.ts);
      const cur = node.rec;
      if (!cur) {
        node.rec = incoming;
        return;
      }
      const win = incoming.ts > cur.ts ? incoming : cur;
      const lose = win === incoming ? cur : incoming;
      // timestamps picked a winner. Was the loser actually the newer write in real time?
      if (lose.real > win.real && !discarded.has(lose)) {
        discarded.add(lose);
        anomalies++;
        if (!noted) {
          noted = true;
          sim.note('fail', `t=${sim.now.toFixed(1)}s: a newer write is discarded because the other node's clock is ${Math.abs(SKEW[1])}s slow. Nothing errors.`);
        }
      }
      node.rec = win;
    }

    function write(i, value) {
      const node = nodes[i];
      const wall = sim.now + SKEW[i];
      const ts = fixed ? Math.max(wall, node.seen + 0.001) : wall; // HLC-style: always later than anything seen
      node.seen = Math.max(node.seen, ts);
      const rec = { value, ts, real: sim.now };
      lastReal = rec;
      merge(node, rec);
      sim.after(REPL_DELAY, () => merge(nodes[1 - i], rec));
    }

    let k = 0;
    for (let t = 1; t < 60; t += 1) {
      const target = sim.rand() < 0.5 ? 0 : 1;
      sim.at(t + sim.rand() * 0.4, () => write(target, `v${++k}`));
    }
    sim.every(1, 60, () => sim.sample('anomalies', anomalies));
    sim.run(60);

    const agree = nodes[0].rec.value === nodes[1].rec.value;
    const correct = nodes[0].rec.value === lastReal.value && agree;
    sim.note(correct ? 'ok' : 'fail', `Replicas ${agree ? 'agree' : 'disagree'}. Final value ${nodes[0].rec.value}, latest real write ${lastReal.value}.`);
    return result(
      sim,
      { writes: k, 'wrong winners': anomalies, 'final value': nodes[0].rec.value, 'latest write': lastReal.value },
      { name: 'The newest real write always wins', holds: anomalies === 0 && correct, detail: `${anomalies} writes were overwritten by older ones` },
    );
  },
};
