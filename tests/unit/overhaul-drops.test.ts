/** DESIGN.md 7.1 "Breakables" and "Enemies": a drink or nothing. */

import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/content/tuning';
import { seededRandom } from '../../src/core/random';
import type { Random } from '../../src/core/random';
import { dropRngFor, rollBreakableDrop, rollEnemyDrop } from '../../src/systems/drops';

const D = TUNING.overhaul!.drops;
const fixed = (v: number): Random => ({ next: () => v });

describe('drops: breakables', () => {
  it('the roll bands follow the tuned chances', () => {
    expect(rollBreakableDrop(fixed(0), 'stout')).toBe('stout');
    expect(rollBreakableDrop(fixed(D.breakable.beer - 0.001), 'lager')).toBe('lager');
    expect(rollBreakableDrop(fixed(D.breakable.beer), 'stout')).toBe('whiskey');
    expect(rollBreakableDrop(fixed(D.breakable.beer + D.breakable.whiskey - 0.001), 'stout')).toBe('whiskey');
    expect(rollBreakableDrop(fixed(D.breakable.beer + D.breakable.whiskey), 'stout')).toBeNull();
    expect(rollBreakableDrop(fixed(0.999), 'stout')).toBeNull();
  });

  it('never drops tequila, a hot drink or food over many rolls', () => {
    const rng = seededRandom(7);
    const seen = new Set<string | null>();
    for (let i = 0; i < 5000; i++) seen.add(rollBreakableDrop(rng, 'lightBeer'));
    expect(seen).toEqual(new Set([null, 'lightBeer', 'whiskey']));
  });

  it('is roughly 50% beer, 4% whiskey, rest nothing (no chapter bonus)', () => {
    const rng = seededRandom(42);
    const n = 20000;
    let beer = 0;
    let whiskey = 0;
    for (let i = 0; i < n; i++) {
      const d = rollBreakableDrop(rng, 'stout');
      if (d === 'stout') beer++;
      if (d === 'whiskey') whiskey++;
    }
    expect(beer / n).toBeGreaterThan(0.48);
    expect(beer / n).toBeLessThan(0.52);
    expect(whiskey / n).toBeGreaterThan(0.025);
    expect(whiskey / n).toBeLessThan(0.055);
  });
});

describe('drops: enemies', () => {
  it('no tequila before chapter 7, even on a roll that would be one', () => {
    const r = D.enemy.beer + D.enemy.whiskey + D.enemy.tequila / 2;
    expect(rollEnemyDrop(fixed(r), 'stout', 6)).toBeNull();
    expect(rollEnemyDrop(fixed(r), 'stout', 7)).toBe('tequila');
    expect(rollEnemyDrop(fixed(r), 'stout', 10)).toBe('tequila');
  });

  it('beer, then whiskey, then nothing', () => {
    // Chapter 5 has no beer bonus.
    expect(rollEnemyDrop(fixed(0), 'lager', 5)).toBe('lager');
    expect(rollEnemyDrop(fixed(D.enemy.beer), 'lager', 5)).toBe('whiskey');
    expect(rollEnemyDrop(fixed(D.enemy.beer + D.enemy.whiskey), 'lager', 5)).toBeNull();
  });

  it('the early chapters add their beer bonus to breakables and enemies', () => {
    const bonus = TUNING.overhaul!.dropBeerBonusByChapter!;
    expect(rollBreakableDrop(fixed(D.breakable.beer + bonus[1]! - 0.001), 'stout', 1)).toBe('stout');
    expect(rollBreakableDrop(fixed(D.breakable.beer + bonus[1]! - 0.001), 'stout', 5)).toBeNull();
    expect(rollEnemyDrop(fixed(D.enemy.beer + bonus[2]! - 0.001), 'lager', 2)).toBe('lager');
  });

  it('tequila is rarer than whiskey', () => {
    expect(D.enemy.tequila).toBeLessThan(D.enemy.whiskey);
  });
});

describe('drops: seeding', () => {
  it('the same seed and key give the same drops; another key can differ', () => {
    const a = dropRngFor(123, 'bin-1');
    const b = dropRngFor(123, 'bin-1');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(dropRngFor(123, 'bin-2').next()).not.toBe(dropRngFor(123, 'bin-1').next());
    expect(dropRngFor(124, 'bin-1').next()).not.toBe(dropRngFor(123, 'bin-1').next());
  });
});
