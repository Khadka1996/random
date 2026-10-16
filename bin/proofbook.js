#!/usr/bin/env node
// proofbook CLI: list | run <id> [--fix|--break] [--seed N] | verify
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cards, byId } from '../src/cards/index.js';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name) => args.includes(`--${name}`);
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : 1;

const c = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m`, cyan: (s) => `\x1b[36m${s}\x1b[0m` };
const BARS = '▁▂▃▄▅▆▇█';

function spark(points, width = 60, max) {
  const vals = points.map((p) => p.v);
  const hi = max ?? Math.max(...vals, 1);
  const step = Math.max(1, Math.ceil(vals.length / width));
  let out = '';
  for (let i = 0; i < vals.length; i += step) {
    const slice = vals.slice(i, i + step);
    const v = slice.reduce((a, b) => a + b, 0) / slice.length;
    out += BARS[Math.min(7, Math.round((v / hi) * 7))];
  }
  return out;
}

function show(card, variant) {
  const r = card.run(variant, { seed });
  const label = variant === 'break' ? c.red('BREAK') : c.green('FIX  ');
  console.log(`\n${label} ${c.bold(card.title)}  ${c.dim(`seed ${seed}`)}`);
  for (const ch of card.charts) {
    for (const s of ch.series) {
      const pts = r.series[s.key];
      console.log(`  ${s.label.padEnd(28)} ${c.cyan(spark(pts, 60, ch.max))}  ${c.dim(`max ${Math.max(...pts.map((p) => p.v))} ${ch.unit}`)}`);
    }
  }
  for (const e of r.events) {
    const tag = { fail: c.red('✗'), ok: c.green('✓'), fault: c.red('!'), info: c.dim('·') }[e.kind] || '·';
    console.log(`  ${tag} ${c.dim(String(e.t).padStart(6) + 's')}  ${e.msg}`);
  }
  for (const [k, v] of Object.entries(r.summary)) console.log(`  ${c.dim(k.padEnd(28))} ${v}`);
  console.log(`  ${r.invariant.holds ? c.green('PASS') : c.red('FAIL')}  ${r.invariant.name}  ${c.dim('(' + r.invariant.detail + ')')}`);
  return r;
}

export function hashRun(r) {
  return createHash('sha256').update(JSON.stringify({ e: r.events, s: r.series, i: r.invariant.holds })).digest('hex').slice(0, 12);
}

function verify() {
  const out = { generated: new Date().toISOString(), node: process.version, seed: 1, cards: [] };
  let bad = 0;
  for (const card of cards) {
    const b = card.run('break', { seed: 1 });
    const f = card.run('fix', { seed: 1 });
    const again = card.run('break', { seed: 1 });
    const deterministic = hashRun(b) === hashRun(again);
    const good = !b.invariant.holds && f.invariant.holds && deterministic;
    if (!good) bad++;
    out.cards.push({ id: card.id, breakViolates: !b.invariant.holds, fixHolds: f.invariant.holds, deterministic, hash: hashRun(b), ok: good });
    console.log(`${good ? c.green('✓') : c.red('✗')} ${card.id.padEnd(18)} break violates: ${!b.invariant.holds}  fix holds: ${f.invariant.holds}  deterministic: ${deterministic}`);
  }
  writeFileSync(new URL('../verified.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(`\n${bad ? c.red(`${bad} card(s) failed`) : c.green(`all ${cards.length} cards verified`)}  → verified.json`);
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (cmd === 'list') {
    console.log(c.bold('Proofbook cards\n'));
    for (const k of cards) console.log(`  ${c.cyan(k.id.padEnd(18))} ${k.tagline}`);
    console.log(`\n  ${c.dim('run one:  node bin/proofbook.js run retry-storm')}`);
  } else if (cmd === 'run') {
    const card = byId[args[1]];
    if (!card) {
      console.error(`Unknown card "${args[1]}". Try: node bin/proofbook.js list`);
      process.exit(1);
    }
    if (flag('fix')) show(card, 'fix');
    else if (flag('break')) show(card, 'break');
    else {
      show(card, 'break');
      show(card, 'fix');
    }
    console.log(`\n${c.bold('Why')}  ${card.why}\n${c.bold('Spot')} ${card.spot}\n${c.bold('Fix')}  ${card.fix}\n`);
  } else if (cmd === 'verify') verify();
  else console.log('Usage:\n  node bin/proofbook.js list\n  node bin/proofbook.js run <card> [--break|--fix] [--seed N]\n  node bin/proofbook.js verify');
}
