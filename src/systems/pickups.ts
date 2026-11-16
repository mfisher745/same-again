/**
 * Putting a placed `PickupItem` into the kit. DESIGN.md 7.1 "The kit".
 * Chapter data still names pickups by the old `PickupItem` shape, so this maps
 * them: a drink goes to the kit (up to the carry limit), empties become
 * bottles, and food is gone from the game (it never takes a place in the kit
 * and is not an item any more). Plain TypeScript.
 */

import type { CarriedDrinkId, DrinkId, Kit, PickupItem, PickupRefusal } from '../core/types';
import { pickUpDrink } from './kit';
import { overhaulTuning } from './meter';

/**
 * The carried drink an old `DrinkId` stands for. The overhaul has six carried
 * drinks; poitin and bourbon were strong spirits, so they read as whiskey, and
 * water is not a drink now (null: nothing to carry).
 */
export function carriedFromDrinkId(id: DrinkId | CarriedDrinkId): CarriedDrinkId | null {
  switch (id) {
    case 'stout':
    case 'lager':
    case 'whiskey':
    case 'lightBeer':
    case 'craftIpa':
    case 'tequila':
      return id;
    case 'poitin':
    case 'bourbon':
      return 'whiskey';
    case 'water':
      return null;
  }
}

export interface PickupTake {
  readonly kit: Kit;
  /** What went into the kit (for `pickup:collected`), or null if nothing did. */
  readonly taken: PickupItem | null;
  /** What stays on the ground, or null. */
  readonly leftover: PickupItem | null;
  /** Why nothing (or not everything) was taken. */
  readonly refusal: PickupRefusal | null;
  /** The item is not a thing in the game now (food, water): drop it quietly. */
  readonly inert: boolean;
}

const INERT = (kit: Kit): PickupTake => ({ kit, taken: null, leftover: null, refusal: null, inert: true });

/** Take as much of `item` as fits. A full kit takes none of a drink and the pickup stays. */
export function takeItem(kit: Kit, item: PickupItem): PickupTake {
  switch (item.kind) {
    case 'food':
      return INERT(kit);
    case 'empties': {
      // At the bottle cap an empty stays where it is, with no message (there is no refusal text for it).
      const room = Math.max(0, overhaulTuning().carry.bottleLimit - kit.bottles);
      const n = Math.min(room, item.count);
      if (n <= 0) return { kit, taken: null, leftover: item, refusal: null, inert: false };
      const left = item.count - n;
      return {
        kit: { ...kit, bottles: kit.bottles + n },
        taken: { ...item, count: n },
        leftover: left > 0 ? { ...item, count: left } : null,
        refusal: null,
        inert: false,
      };
    }
    case 'drink': {
      const id = carriedFromDrinkId(item.drinkId);
      if (id === null) return INERT(kit);
      let next = kit;
      let took = 0;
      let refusal: PickupRefusal | null = null;
      for (; took < item.count; took++) {
        const r = pickUpDrink(next, id);
        if (r.refusal) {
          refusal = r.refusal === 'carryFull' ? 'kitFull' : r.refusal === 'spiritsFull' ? 'spiritsFull' : 'hotDrinkHeld';
          break;
        }
        next = r.kit;
      }
      const left = item.count - took;
      return {
        kit: next,
        taken: took > 0 ? { kind: 'drink', drinkId: id, count: took } : null,
        leftover: left > 0 ? { kind: 'drink', drinkId: item.drinkId, count: left } : null,
        refusal: took > 0 ? null : refusal,
        inert: false,
      };
    }
  }
}
