import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cards } from '../src/cards/index.js';
import { Sim, mulberry32 } from '../src/engine.js';
import { hashRun } from '../bin/proofbook.js';

test('engine: events run in time order, ties keep insertion order', () => {
  const sim = new Sim(1);
  const seen = [];
  sim.at(2, () => seen.push('c'));
  sim.at(1, () => seen.push('a'));
  sim.at(1, () => seen.push('b'));
  sim.after(3, () => seen.push('d'));
  sim.run(10);
  assert.deepEqual(seen, ['a', 'b', 'c', 'd']);
});

test('engine: PRNG is deterministic and differs by seed', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  const c = mulberry32(8);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.notDeepEqual(xs, [c(), c(), c()]);
});

for (const card of cards) {
  test(`${card.id}: has required metadata`, () => {
    for (const k of ['id', 'title', 'tagline', 'why', 'spot', 'fix', 'duration', 'charts']) assert.ok(card[k], `missing ${k}`);
    assert.match(card.id, /^[a-z0-9-]+$/);
  });

  test(`${card.id}: same seed gives an identical trace`, () => {
    assert.equal(hashRun(card.run('break', { seed: 3 })), hashRun(card.run('break', { seed: 3 })));
    assert.equal(hashRun(card.run('fix', { seed: 3 })), hashRun(card.run('fix', { seed: 3 })));
  });

  test(`${card.id}: break violates the invariant, fix holds it (seeds 1-5)`, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      assert.equal(card.run('break', { seed }).invariant.holds, false, `break should violate (seed ${seed})`);
      assert.equal(card.run('fix', { seed }).invariant.holds, true, `fix should hold (seed ${seed})`);
    }
  });

  test(`${card.id}: every chart series is present and non-empty`, () => {
    const r = card.run('break', { seed: 1 });
    for (const ch of card.charts) for (const s of ch.series) assert.ok(r.series[s.key]?.length > 5, `series ${s.key}`);
  });
}
