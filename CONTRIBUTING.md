# Contributing a card

Thank you. A card is one failure mode, modelled small, with its fix. The bar is: **a reader should understand the failure within 30 seconds of watching the replay.**

## The recipe

1. Pick an idea from [`docs/card-ideas.md`](docs/card-ideas.md), or propose one with the *Card request* issue template.
2. `cp templates/new-card.js src/cards/<id>.js` and fill it in.
3. Register it in `src/cards/index.js`.
4. `npm test` and `node bin/proofbook.js run <id>`, then look at it in the browser.
5. Open a pull request.

## Card checklist

- [ ] **One invariant, stated in plain words** ("Each order is charged exactly once").
- [ ] **Break violates it, fix holds it** for seeds 1 to 5 (the tests check this).
- [ ] **Deterministic.** Use `sim.rand()`, never `Math.random()`, `Date.now()` or real timers.
- [ ] **Minimal.** Model only what is needed to show the mechanism. Under about 120 lines is typical.
- [ ] **The fix is one change**, not a different architecture.
- [ ] **2 to 4 events** that narrate the story, written as a sentence a human would say.
- [ ] **`why`, `spot`, `fix`** are filled in. `spot` should describe what an on-call engineer would actually see.
- [ ] **Honest.** If a number is illustrative, do not dress it up as a measurement.

## Rules of the engine

- Time is virtual. `sim.after(delay, fn)` and `sim.at(t, fn)` schedule work; `sim.run(until)` executes it.
- `sim.sample(name, value)` records a chart point. Sample on a fixed cadence with `sim.every`.
- `sim.note(kind, message)` adds a narrated event. Kinds: `fault`, `fail`, `ok`, `info`.
- Return `result(sim, summary, invariant)`.

## Style

Plain JavaScript (ES modules), no dependencies, no build step. Keep it readable: someone should be able to learn the failure by reading the card file.
