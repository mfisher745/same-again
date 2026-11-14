/** DESIGN.md 7.1: a hit moves the meter by its weight; no health. */

import { describe, expect, it } from 'vitest';
import { applyHit, hitDirection, meleeMultiplier } from '../../src/systems/hits';
import { adjustMeter, createMeter, drink } from '../../src/systems/meter';
import type { MeterState } from '../../src/systems/meter';

const at = (v: number): MeterState => createMeter(1, v);

describe('hit direction by level', () => {
  it.each([
    [20, 'down'],
    [34, 'down'],
    [35, 'down'],
    [65, 'down'],
    [66, 'up'],
    [90, 'up'],
    [91, 'up'],
    [95, 'up'],
  ] as const)('at %f an ordinary hit moves the meter %s', (v, dir) => {
    const r = applyHit(at(v), 'ordinary');
    expect(r.direction).toBe(dir);
    expect(r.state.value).toBe(dir === 'down' ? v - 5 : v + 5);
    expect(r.amount).toBe(5);
  });

  it('hitDirection helper', () => {
    expect(hitDirection(1)).toBe('down');
    expect(hitDirection(2)).toBe('down');
    expect(hitDirection(3)).toBe('up');
    expect(hitDirection(4)).toBe('up');
    expect(hitDirection(4, true)).toBe('down');
  });
});

describe('weights', () => {
  it.each([
    ['ordinary', 5],
    ['heavy', 10],
    ['worst', 15],
  ] as const)('%s moves %i', (w, n) => {
    expect(applyHit(at(50), w).state.value).toBe(50 - n);
    expect(applyHit(at(70), w).state.value).toBe(70 + n);
  });
});

describe('outcomes', () => {
  it('a hit at Buzzed that reaches 0 returns sober', () => {
    const r = applyHit(at(5), 'ordinary');
    expect(r.returned).toBe('sober');
    expect(r.state.value).toBe(0);
  });

  it('a hit at Fecked that reaches the floor returns floor', () => {
    const r = applyHit(at(95), 'ordinary');
    expect(r.returned).toBe('floor');
    expect(r.state.value).toBe(100);
    expect(applyHit(at(94), 'ordinary').returned).toBeUndefined();
  });

  it('a worst hit at Bit much can reach the floor from the middle of the level', () => {
    expect(applyHit(at(90), 'worst').returned).toBe('floor');
  });

  it('reports a level change when a hit crosses a boundary', () => {
    const r = applyHit(at(37), 'ordinary');
    expect(r.state.value).toBe(32);
    expect(r.events).toEqual([{ kind: 'levelChanged', from: 2, to: 1, state: 'buzzed', value: 32 }]);
  });

  it('is ignored once the meter has returned', () => {
    const done = adjustMeter(at(5), -5).state;
    const r = applyHit(done, 'heavy');
    expect(r).toMatchObject({ direction: null, amount: 0, events: [] });
    expect(r.state).toBe(done);
  });
});

describe('spirit window', () => {
  it('lowers the meter at any level and doubles the amount', () => {
    const s = drink(at(50), 'whiskey').state; // 90, Bit much, in the window
    const r = applyHit(s, 'ordinary');
    expect(r.direction).toBe('down');
    expect(r.amount).toBe(10);
    expect(r.state.value).toBe(80);
    expect(applyHit(s, 'worst').state.value).toBe(60);
  });

  it('is also doubled (and downward) at Grand and Fecked', () => {
    const w = drink(at(20), 'whiskey').state; // 65, Grand
    expect(applyHit(w, 'heavy')).toMatchObject({ direction: 'down', amount: 20 });
    const q = drink(at(20), 'tequila').state; // 95, Fecked
    const r = applyHit(q, 'ordinary');
    expect(r).toMatchObject({ direction: 'down', amount: 10 });
    expect(r.state.value).toBe(85);
  });

  it('hits are back to normal when the window is over', () => {
    const s: MeterState = { ...drink(at(50), 'whiskey').state, spirit: null };
    expect(applyHit(s, 'ordinary')).toMatchObject({ direction: 'up', amount: 5 });
  });

  it('a doubled hit can still take the meter to 0', () => {
    const s: MeterState = { ...at(8), spirit: { drinkId: 'whiskey', msLeft: 5000, hitMultiplier: 2, dropAfter: 0 } };
    expect(applyHit(s, 'ordinary').returned).toBe('sober');
  });
});

describe('melee multiplier', () => {
  it.each([
    [1, 1],
    [2, 1.5],
    [3, 2],
    [4, 3],
    [0, 1],
  ] as const)('level %i is x%f', (lvl, m) => {
    expect(meleeMultiplier(lvl)).toBe(m);
  });
});
