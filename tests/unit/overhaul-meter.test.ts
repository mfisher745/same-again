/** DESIGN.md 7.1: the overhaul Buzz meter (new module, not yet wired in). */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import type { BeerDef, HotDrinkDef, SpiritDef } from '../../src/core/types';
import {
  adjustMeter,
  createMeter,
  drink,
  levelFor,
  levelTable,
  restValue,
  setInSun,
  snapshot,
  stepMeter,
} from '../../src/systems/meter';
import type { MeterState } from '../../src/systems/meter';

const T = TUNING.overhaul;
if (!T) throw new Error('overhaul tuning missing');
const table = levelTable(1);
const at = (v: number, chapter: 1 | 5 = 1): MeterState => createMeter(chapter, v);
const run = (s: MeterState, ms: number): MeterState => stepMeter(s, ms).state;

describe('levels', () => {
  const cases: [number, number][] = [
    [0, 0],
    [1, 1],
    [34, 1],
    [34.5, 1],
    [35, 2],
    [65, 2],
    [66, 3],
    [90, 3],
    [91, 4],
    [99, 4],
    [100, 4],
  ];
  it.each(cases)('chapter 1 value %f is level %i', (v, level) => {
    expect(levelFor(v, table)).toBe(level);
  });

  it('starts at the bottom of Grand in every chapter and grows by chapter', () => {
    expect(restValue(1)).toBe(35);
    expect(restValue(5)).toBe(43);
    expect(createMeter(10).value).toBe(52);
    expect(levelTable(10).floor).toBe(133);
  });

  it('snapshot reports state, floor and flags', () => {
    const s = snapshot(at(70));
    expect(s).toMatchObject({ value: 70, level: 3, state: 'bitMuch', floor: 100, spiritActive: false, teaHoldActive: false, inSun: false });
  });
});

describe('drain', () => {
  it('is constant, one point every three seconds, with no delay after a drink', () => {
    let s = drink(at(50), 'lightBeer').state;
    expect(s.value).toBe(52);
    s = run(s, 3000);
    expect(s.value).toBeCloseTo(51, 6);
  });

  it('doubles in the sun and returns to normal in the shade', () => {
    const sun = run(setInSun(at(50), true), 3000);
    expect(sun.value).toBeCloseTo(48, 6);
    expect(run(setInSun(sun, false), 3000).value).toBeCloseTo(47, 6);
  });

  it('chapter 1 from the start reaches 0 in under two minutes and reports sober', () => {
    const r = stepMeter(createMeter(1), 120_000);
    expect(r.returned).toBe('sober');
    expect(r.state.value).toBe(0);
    expect(r.state.returnReason).toBe('sober');
  });

  it('reports level changes as it drains across a boundary', () => {
    const r = stepMeter(at(35), 3000);
    expect(r.events).toEqual([{ kind: 'levelChanged', from: 2, to: 1, state: 'buzzed', value: expect.any(Number) }]);
  });

  it('does nothing once the meter has returned', () => {
    const done = stepMeter(at(0.1), 10_000).state;
    const again = stepMeter(done, 10_000);
    expect(again.events).toEqual([]);
    expect(again.state.value).toBe(0);
  });
});

describe('beers', () => {
  const beer = (id: 'stout' | 'lager' | 'lightBeer' | 'craftIpa'): BeerDef => {
    const d = T.drinks[id];
    if (d.kind !== 'beer') throw new Error('not a beer');
    return d;
  };
  it.each([
    ['stout', 15],
    ['lager', 10],
    ['lightBeer', 2],
    ['craftIpa', 20],
  ] as const)('%s adds %i', (id, pts) => {
    expect(beer(id).points).toBe(pts);
    expect(drink(at(40), id).state.value).toBe(40 + pts);
  });

  it('goes one and a half times as far in the sun', () => {
    expect(drink(setInSun(at(40), true), 'stout').state.value).toBe(40 + 22.5);
  });

  it('reports crossing a level up', () => {
    const r = drink(at(60), 'stout');
    expect(r.events).toEqual([{ kind: 'levelChanged', from: 2, to: 3, state: 'bitMuch', value: 75 }]);
  });

  it('reaching the floor reports return reason floor and clamps', () => {
    const r = drink(at(95), 'stout');
    expect(r.returned).toBe('floor');
    expect(r.state.value).toBe(100);
    expect(r.state.returnReason).toBe('floor');
  });

  it('a value exactly at the floor is the floor', () => {
    expect(drink(at(90), 'lager').returned).toBe('floor');
    expect(drink(at(89), 'lager').returned).toBeUndefined();
    expect(drink(at(80), 'lager').returned).toBeUndefined();
  });
});

describe('whiskey', () => {
  const from = (v: number): MeterState => drink(at(v), 'whiskey').state;
  it.each([
    [20, 65],
    [34, 65],
    [35, 90],
    [65, 90],
    [66, 99],
    [90, 99],
    [91, 99],
    [99, 99],
  ])('from %f jumps to %i (top of the next level, top of Fecked from 3 and 4)', (v, to) => {
    expect(from(v).value).toBe(to);
  });

  it('never leaves the player short of the floor', () => {
    expect(drink(at(99), 'whiskey').returned).toBeUndefined();
  });

  it('opens a window: events, no drain, then drain resumes', () => {
    const r = drink(at(50), 'whiskey');
    expect(r.events).toContainEqual({ kind: 'spiritStarted', drinkId: 'whiskey', durationMs: 8000 });
    expect(snapshot(r.state).spiritActive).toBe(true);
    const mid = run(r.state, 7000);
    expect(mid.value).toBe(90);
    const end = stepMeter(mid, 1000);
    expect(end.events).toContainEqual({ kind: 'spiritEnded', drinkId: 'whiskey' });
    expect(end.state.spirit).toBeNull();
    expect(end.state.value).toBe(90);
    expect(run(end.state, 3000).value).toBeCloseTo(89, 6);
  });

  it('drains for the part of a step that falls after the window', () => {
    const s = from(50);
    expect(run(s, 11_000).value).toBeCloseTo(89, 6);
  });

  it('window is one and a half times as long in the sun', () => {
    const r = drink(setInSun(at(50), true), 'whiskey');
    expect(r.events).toContainEqual({ kind: 'spiritStarted', drinkId: 'whiskey', durationMs: 12000 });
    expect(run(r.state, 11_000).spirit).not.toBeNull();
    expect(run(r.state, 12_000).spirit).toBeNull();
  });

  it('does not add a bottle-style drop and leaves no drop at the end', () => {
    expect(run(from(50), 8000).value).toBe(90);
  });
});

describe('tequila', () => {
  it('jumps to the middle of Fecked from anywhere', () => {
    expect(drink(at(10), 'tequila').state.value).toBe(95);
    expect(drink(at(99), 'tequila').state.value).toBe(95);
    expect(drink(at(5, 5), 'tequila').state.value).toBe(111);
  });

  it('has no drain in the window, then drops 30 all at once', () => {
    const r = drink(at(50), 'tequila');
    expect(r.events).toContainEqual({ kind: 'spiritStarted', drinkId: 'tequila', durationMs: 8000 });
    const mid = run(r.state, 7999);
    expect(mid.value).toBe(95);
    const end = stepMeter(mid, 1);
    expect(end.state.value).toBe(65);
    expect(end.events.map((e) => e.kind)).toEqual(['spiritEnded', 'levelChanged']);
  });

  it('a whiskey on top of a tequila ends the tequila first, so the drop is not dodged', () => {
    const s = drink(at(50), 'tequila').state;
    const r = drink(s, 'whiskey');
    expect(r.events.map((e) => e.kind)).toEqual(['spiritEnded', 'levelChanged', 'spiritStarted', 'levelChanged']);
    // 95 - 30 = 65, whiskey from Grand goes to top of Bit much
    expect(r.state.value).toBe(90);
    expect(r.state.spirit?.drinkId).toBe('whiskey');
  });
});

describe('hot drinks', () => {
  it('coffee resets at once, from above or below', () => {
    const a = drink(at(80), 'coffee');
    expect(a.state.value).toBe(35);
    expect(a.events).toEqual([{ kind: 'levelChanged', from: 3, to: 2, state: 'grand', value: 35 }]);
    expect(drink(at(10), 'coffee').state.value).toBe(35);
    expect(drink(at(35), 'coffee').events).toEqual([]);
  });

  it('coffee cancels a spirit window', () => {
    const s = drink(at(50), 'whiskey').state;
    expect(drink(s, 'coffee').state.spirit).toBeNull();
  });

  it('tea eases to the bottom of Grand over its ease time, then holds with no drain', () => {
    const tea = T.drinks.tea as HotDrinkDef;
    expect(tea.reset).toEqual({ kind: 'ease', easeMs: 10000, holdMs: 20000 });
    let s = drink(at(85), 'tea').state;
    expect(s.value).toBe(85);
    s = run(s, 5000);
    expect(s.value).toBeCloseTo(60, 6);
    s = run(s, 5000);
    expect(s.value).toBeCloseTo(35, 6);
    expect(snapshot(s).teaHoldActive).toBe(true);
    s = run(s, 19_000);
    expect(s.value).toBeCloseTo(35, 6);
    expect(snapshot(s).teaHoldActive).toBe(true);
    s = run(s, 1000);
    expect(snapshot(s).teaHoldActive).toBe(false);
    s = run(s, 3000);
    expect(s.value).toBeCloseTo(34, 6);
  });

  it('tea also eases up from below', () => {
    let s = drink(at(15), 'tea').state;
    s = run(s, 10_000);
    expect(s.value).toBeCloseTo(35, 6);
  });

  it('a step that spans ease, hold and drain lands in the right place', () => {
    const s = run(drink(at(85), 'tea').state, 33_000);
    expect(s.value).toBeCloseTo(34, 6);
  });

  it('a hit or beer during the hold moves the meter and the hold continues', () => {
    let s = run(drink(at(85), 'tea').state, 10_000);
    s = drink(s, 'lager').state;
    expect(s.value).toBeCloseTo(45, 6);
    s = run(s, 5000);
    expect(s.value).toBeCloseTo(45, 6);
    expect(snapshot(s).teaHoldActive).toBe(true);
  });

  it('a spirit during tea cancels the tea', () => {
    const s = drink(drink(at(85), 'tea').state, 'tequila').state;
    expect(s.tea).toBeNull();
    expect(s.spirit?.drinkId).toBe('tequila');
  });
});

describe('outcomes', () => {
  it('reaching exactly 0 from a hit is sober', () => {
    const r = adjustMeter(at(5), -5);
    expect(r.returned).toBe('sober');
    expect(r.events).toEqual([{ kind: 'levelChanged', from: 1, to: 0, state: 'sober', value: 0 }]);
  });

  it('a tequila drop that takes the meter to 0 reports sober', () => {
    const s: MeterState = { ...at(20), spirit: { drinkId: 'tequila', msLeft: 10, hitMultiplier: 2, dropAfter: 30 } };
    expect(stepMeter(s, 10).returned).toBe('sober');
  });

  it('drinks after the meter has returned do nothing', () => {
    const done = adjustMeter(at(5), -5).state;
    expect(drink(done, 'stout').state.value).toBe(0);
  });

  it('spirit defs in tuning are what the tests assume', () => {
    const w = T.drinks.whiskey as SpiritDef;
    expect(w.windowMs).toBe(8000);
    expect((T.drinks.tequila as SpiritDef).dropAfterWindow).toBe(30);
  });
});
