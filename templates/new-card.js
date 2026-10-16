// Copy this file to src/cards/<your-id>.js, fill it in, then register it in src/cards/index.js.
import { Sim, result } from '../engine.js';

export default {
  id: 'your-failure-id', // lowercase, hyphenated; becomes the URL and CLI name
  title: 'Your failure',
  tagline: 'One sentence a stranger understands instantly.',
  tags: ['category', 'another'],
  severity: 'high', // critical | high | medium
  duration: 60, // virtual seconds (or whatever unit xLabel names)
  xLabel: 'seconds',

  // What to plot. Keys must match what you pass to sim.sample().
  // With two series in one chart, the first is drawn as a grey dashed reference line.
  charts: [{ title: 'What the reader should watch', series: [{ key: 'metric', label: 'metric' }], unit: 'units' }],

  why: 'The mechanism, in two or three sentences.',
  spot: 'What an on-call engineer would actually see in dashboards and logs.',
  fix: 'The one change that removes the failure.',

  run(variant, { seed = 1 } = {}) {
    const fixed = variant === 'fix'; // flip the remedy on here
    const sim = new Sim(seed); // never use Math.random() or Date.now()

    let metric = 0;

    // model the system with sim.at / sim.after, use sim.rand() for randomness
    sim.every(1, 60, () => {
      sim.sample('metric', metric);
    });

    sim.at(10, () => sim.note('fault', 'Something goes wrong here.'));
    sim.run(60);

    sim.note(fixed ? 'ok' : 'fail', 'A sentence that sums up what happened.');
    return result(
      sim,
      { 'a number worth showing': metric }, // shown in the verdict box
      { name: 'The property that must always hold', holds: fixed, detail: 'evidence for the verdict' },
    );
  },
};
