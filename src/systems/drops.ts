/**
 * What breakables and enemies drop: a drink or nothing, never food and never a
 * hot drink. DESIGN.md 7.1 "Breakables" and "Enemies". Plain TypeScript. All
 * chances come from `TUNING.overhaul.drops`; randomness comes from a seeded
 * `Random` so a save's `lootSeed` makes drops repeatable.
 */

import { TUNING } from '../content/tuning';
import { seededRandom } from '../core/random';
import type { Random } from '../core/random';
import type { BeerId, CarriedDrinkId, ChapterNumber, OverhaulTuning, RegionId } from '../core/types';

function tun(tuning?: OverhaulTuning): OverhaulTuning {
  const o = tuning ?? TUNING.overhaul;
  if (!o) throw new Error('TUNING.overhaul is missing');
  return o;
}

/**
 * The beer a region mostly has (DESIGN.md 7.1 drink table): stout in Ireland; the American
 * regions have light beer. Craft IPA and lager come by other means. For creative-director review.
 */
export function regionBeer(region: RegionId): BeerId {
  return region === 'kilnamoe' ? 'stout' : 'lightBeer';
}

/** What a thing held. Null is nothing. The type cannot hold food or a hot drink. */
export type Drop = CarriedDrinkId | null;

/** Walk the cumulative chances once. One random number per roll. */
function roll(rng: Random, table: readonly (readonly [CarriedDrinkId, number])[]): Drop {
  const r = rng.next();
  let acc = 0;
  for (const [id, chance] of table) {
    acc += chance;
    if (r < acc) return id;
  }
  return null;
}

/** A broken object: usually the region's beer, now and then a whiskey, else nothing. */
export function rollBreakableDrop(rng: Random, regionBeer: BeerId, tuning?: OverhaulTuning): Drop {
  const d = tun(tuning).drops.breakable;
  return roll(rng, [
    [regionBeer, d.beer],
    ['whiskey', d.whiskey],
  ]);
}

/** A defeated enemy: the region's beer, rarely a whiskey, and from chapter 7 very rarely a tequila. */
export function rollEnemyDrop(rng: Random, regionBeer: BeerId, chapter: ChapterNumber, tuning?: OverhaulTuning): Drop {
  const d = tun(tuning).drops.enemy;
  const table: (readonly [CarriedDrinkId, number])[] = [
    [regionBeer, d.beer],
    ['whiskey', d.whiskey],
  ];
  if (chapter >= d.tequilaFromChapter) table.push(['tequila', d.tequila]);
  return roll(rng, table);
}

/** A stable generator for one object, from the save's loot seed and the object's id. */
export function dropRngFor(lootSeed: number, key: string): Random {
  let h = 2166136261 ^ (lootSeed >>> 0);
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return seededRandom(h >>> 0);
}
