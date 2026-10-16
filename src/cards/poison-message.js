import { Sim, result } from '../engine.js';

export default {
  id: 'poison-message',
  title: 'Poison message',
  tagline: 'One malformed message fails forever and blocks every healthy message queued behind it.',
  tags: ['queues', 'reliability', 'head-of-line-blocking'],
  severity: 'high',
  duration: 60,
  xLabel: 'seconds',
  charts: [
    { title: 'Messages processed (cumulative)', series: [{ key: 'processed', label: 'processed' }], unit: 'messages' },
    { title: 'Backlog', series: [{ key: 'backlog', label: 'waiting' }], unit: 'messages' },
  ],
  why: 'The consumer retries a failing message immediately and indefinitely. Because the queue is ordered, nothing behind it is ever read. Throughput drops to zero while the consumer reports itself busy and healthy.',
  spot: 'Consumer CPU is high, throughput is flat at zero, and the same error repeats in the logs with the same message id.',
  fix: 'Cap attempts, back off between them, then move the message to a dead-letter queue and keep going. Alert on the DLQ so someone can inspect it.',
  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix';
    const sim = new Sim(seed);
    const POISON = 40;
    const MAX_ATTEMPTS = 3;
    const queue = [];
    const dlq = [];
    let busy = false;
    let processed = 0;
    let attempts = 0;
    let total = 0;
    let noted = false;

    function pump() {
      if (busy || !queue.length) return;
      busy = true;
      const m = queue[0];
      sim.after(0.02, () => {
        busy = false;
        const fails = m.id === POISON;
        if (!fails) {
          queue.shift();
          processed++;
        } else {
          m.tries = (m.tries || 0) + 1;
          attempts++;
          if (!noted) {
            noted = true;
            sim.note('fault', `Message #${POISON} cannot be parsed. Every attempt fails.`);
          }
          if (fixed && m.tries >= MAX_ATTEMPTS) {
            queue.shift();
            dlq.push(m);
            sim.note('ok', `Message #${POISON} moved to the dead-letter queue after ${m.tries} tries. Healthy messages continue.`);
          } else if (!fixed && m.tries === 25) {
            sim.note('fail', `Message #${POISON} has now failed ${m.tries} times in a row, and ${queue.length - 1} messages wait behind it.`);
          }
        }
        pump();
      });
    }

    for (let i = 1; i <= 600; i++) {
      sim.at(i / 20, () => {
        total++;
        queue.push({ id: i });
        pump();
      });
    }
    sim.every(1, 60, () => {
      sim.sample('processed', processed);
      sim.sample('backlog', queue.length);
    });
    sim.run(60);

    const healthy = 599;
    return result(
      sim,
      { 'healthy processed': `${processed} / ${healthy}`, 'dead-lettered': dlq.length, 'failed attempts': attempts, backlog: queue.length },
      { name: 'All healthy messages are processed', holds: processed === healthy, detail: `${processed} of ${healthy} healthy messages processed` },
    );
  },
};
