/**
 * The kit: what Andrew carries and what sits in his six slots. DESIGN.md 7.1
 * "The kit" and 7.7. Plain TypeScript, no Phaser. Every function takes a `Kit`
 * and returns a new one; the caller emits `kit:changed`, `move:learned` and
 * `weapon:gained` from the result. Meter effects are applied elsewhere: a drink
 * result only says which drink was consumed.
 */

import { TUNING } from '../content/tuning';
import type {
  CarriedDrinkId,
  HotDrinkId,
  Kit,
  KitSlots,
  MoveId,
  OverhaulDrinkId,
  OverhaulTuning,
  SpecialSlotIndex,
  WeaponId,
} from '../core/types';

/** Why the kit said no. The UI maps each code to a text id. */
export type KitRefusal =
  | 'carryFull'
  | 'hotDrinkHeld'
  | 'notHeld'
  | 'notLearned'
  | 'wrongLevel'
  | 'notOwned'
  | 'unchanged'
  | 'unknown';

/** Every drink that counts toward the carry limit, in cycle order. */
export const CARRIED_DRINK_ORDER: readonly CarriedDrinkId[] = ['stout', 'lager', 'lightBeer', 'craftIpa', 'whiskey', 'tequila'];

/** Weapons in cycle order (the order Andrew gets them in). */
export const WEAPON_ORDER: readonly WeaponId[] = ['fists', 'hurley', 'clipboard', 'shillelagh', 'umbrella', 'inflatableAlien', 'securityWand'];

export interface KitChange {
  readonly kit: Kit;
  /** True when `kit` differs from the input; emit `kit:changed`. */
  readonly changed: boolean;
  readonly refusal: KitRefusal | null;
}

export interface DrinkResult extends KitChange {
  /** The drink that was drunk, for the meter module. Null when nothing was drunk. */
  readonly consumed: OverhaulDrinkId | null;
  /** Bottles added by this drink (1 for a beer, 0 otherwise). */
  readonly bottlesAdded: number;
}

export interface LearnResult extends KitChange {
  /** Set when the move was new; emit `move:learned`. */
  readonly learned: MoveId | null;
}

export interface WeaponGainResult extends KitChange {
  /** Set when the weapon was new; emit `weapon:gained`. */
  readonly gained: WeaponId | null;
}

function t(tuning?: OverhaulTuning): OverhaulTuning {
  const o = tuning ?? TUNING.overhaul;
  if (!o) throw new Error('TUNING.overhaul is missing');
  return o;
}

const ok = (kit: Kit): KitChange => ({ kit, changed: true, refusal: null });
const refuse = (kit: Kit, refusal: KitRefusal): KitChange => ({ kit, changed: false, refusal });

/** A fresh kit: fists, nothing else. Bottles are topped up on leaving the bar. */
export function createKit(tuning?: OverhaulTuning): Kit {
  const o = t(tuning);
  return {
    drinks: {},
    carryLimit: o.carry.limit,
    hotDrink: null,
    bottles: 0,
    weapons: ['fists'],
    moves: [],
    slots: { drink: null, specials: [null, null, null, null], melee: 'fists' },
  };
}

/** Drinks carried, counting toward the limit (not the hot drink, not bottles). */
export function carriedCount(kit: Kit): number {
  let n = 0;
  for (const id of CARRIED_DRINK_ORDER) n += kit.drinks[id] ?? 0;
  return n;
}

export const drinkCount = (kit: Kit, id: CarriedDrinkId): number => kit.drinks[id] ?? 0;

export const isFull = (kit: Kit): boolean => carriedCount(kit) >= kit.carryLimit;

/** True when Andrew holds the drink: a count above 0, or the hot drink itself. */
export function holds(kit: Kit, id: OverhaulDrinkId): boolean {
  if (id === 'coffee' || id === 'tea') return kit.hotDrink === id;
  return drinkCount(kit, id) > 0;
}

/** Every drink Andrew holds, in cycle order: carried drinks, then the hot drink. */
export function heldDrinks(kit: Kit): OverhaulDrinkId[] {
  const out: OverhaulDrinkId[] = CARRIED_DRINK_ORDER.filter((id) => drinkCount(kit, id) > 0);
  if (kit.hotDrink) out.push(kit.hotDrink);
  return out;
}

const withSlots = (kit: Kit, slots: Partial<KitSlots>): Kit => ({ ...kit, slots: { ...kit.slots, ...slots } });

/** Keep the drink slot on something held; if it is empty and Andrew holds a drink, fill it. */
function settleDrinkSlot(kit: Kit): Kit {
  const held = heldDrinks(kit);
  const cur = kit.slots.drink;
  if (cur !== null && holds(kit, cur)) return kit;
  const next = held[0] ?? null;
  return next === cur ? kit : withSlots(kit, { drink: next });
}

/**
 * Pick up a drink. A carried drink is refused when the kit is full; a hot drink
 * is refused when one is already held. The pickup stays where it is on refusal.
 * The first drink picked up goes into an empty drink slot.
 */
export function pickUpDrink(kit: Kit, id: OverhaulDrinkId): KitChange {
  if (id === 'coffee' || id === 'tea') {
    return takeHotDrink(kit, id);
  }
  if (isFull(kit)) return refuse(kit, 'carryFull');
  const next: Kit = { ...kit, drinks: { ...kit.drinks, [id]: drinkCount(kit, id) + 1 } };
  return ok(settleDrinkSlot(next));
}

/** Take the bar's free hot drink. At most one at a time. */
export function takeHotDrink(kit: Kit, id: HotDrinkId): KitChange {
  if (kit.hotDrink !== null) return refuse(kit, 'hotDrinkHeld');
  return ok(settleDrinkSlot({ ...kit, hotDrink: id }));
}

function consume(kit: Kit, id: OverhaulDrinkId, tuning?: OverhaulTuning): DrinkResult {
  if (!holds(kit, id)) return { ...refuse(kit, 'notHeld'), consumed: null, bottlesAdded: 0 };
  const def = t(tuning).drinks[id];
  let next: Kit;
  if (id === 'coffee' || id === 'tea') {
    next = { ...kit, hotDrink: null };
  } else {
    next = { ...kit, drinks: { ...kit.drinks, [id]: drinkCount(kit, id) - 1 } };
  }
  const bottlesAdded = def.kind === 'beer' ? def.bottlesLeft : 0;
  if (bottlesAdded > 0) next = { ...next, bottles: next.bottles + bottlesAdded };
  return { ...ok(settleDrinkSlot(next)), consumed: id, bottlesAdded };
}

/** Drink what is in the drink slot (the Q key). */
export function drinkSelected(kit: Kit, tuning?: OverhaulTuning): DrinkResult {
  const id = kit.slots.drink;
  if (id === null) return { ...refuse(kit, 'notHeld'), consumed: null, bottlesAdded: 0 };
  return consume(kit, id, tuning);
}

/** Drink any held drink straight from the Tab screen. Does not touch the slot unless it empties. */
export function drinkFromInventory(kit: Kit, id: OverhaulDrinkId, tuning?: OverhaulTuning): DrinkResult {
  return consume(kit, id, tuning);
}

/** Cycle the drink slot through held drinks. `dir` is 1 (forward) or -1. */
export function cycleDrink(kit: Kit, dir: 1 | -1 = 1): KitChange {
  const held = heldDrinks(kit);
  if (held.length === 0) return refuse(kit, 'notHeld');
  const cur = kit.slots.drink;
  const i = cur === null ? -1 : held.indexOf(cur);
  const next = held[(((i + dir) % held.length) + held.length) % held.length] as OverhaulDrinkId;
  if (next === cur) return refuse(kit, 'unchanged');
  return ok(withSlots(kit, { drink: next }));
}

/** Put a held drink in the drink slot (or clear it with null). */
export function assignDrink(kit: Kit, id: OverhaulDrinkId | null): KitChange {
  if (id !== null && !holds(kit, id)) return refuse(kit, 'notHeld');
  if (kit.slots.drink === id) return refuse(kit, 'unchanged');
  return ok(withSlots(kit, { drink: id }));
}

/**
 * Learn a move. `autoAssign` also puts it in its slot if that slot is empty.
 * Learning twice changes nothing.
 */
export function learnMove(kit: Kit, id: MoveId, opts: { autoAssign?: boolean; tuning?: OverhaulTuning } = {}): LearnResult {
  const def = t(opts.tuning).moves[id];
  if (!def) return { ...refuse(kit, 'unknown'), learned: null };
  if (kit.moves.includes(id)) return { ...refuse(kit, 'unchanged'), learned: null };
  let next: Kit = { ...kit, moves: [...kit.moves, id] };
  if (opts.autoAssign && kit.slots.specials[def.level - 1] === null) {
    next = assignMove(next, def.level, id, opts.tuning).kit;
  }
  return { ...ok(next), learned: id };
}

/** Put a learned move of the slot's own level in a special slot, or clear it with null. */
export function assignMove(kit: Kit, slot: SpecialSlotIndex, id: MoveId | null, tuning?: OverhaulTuning): KitChange {
  const specials = [...kit.slots.specials] as [MoveId | null, MoveId | null, MoveId | null, MoveId | null];
  if (id === null) {
    if (specials[slot - 1] === null) return refuse(kit, 'unchanged');
    specials[slot - 1] = null;
    return ok(withSlots(kit, { specials }));
  }
  const def = t(tuning).moves[id];
  if (!def) return refuse(kit, 'unknown');
  if (!kit.moves.includes(id)) return refuse(kit, 'notLearned');
  if (def.level !== slot) return refuse(kit, 'wrongLevel');
  if (specials[slot - 1] === id) return refuse(kit, 'unchanged');
  // A move sits in at most one slot.
  for (let i = 0; i < 4; i++) if (specials[i] === id) specials[i] = null;
  specials[slot - 1] = id;
  return ok(withSlots(kit, { specials }));
}

/** Gain a weapon. Not equipped automatically. Gaining twice changes nothing. */
export function gainWeapon(kit: Kit, id: WeaponId): WeaponGainResult {
  if (kit.weapons.includes(id)) return { ...refuse(kit, 'unchanged'), gained: null };
  const owned = [...kit.weapons, id].sort((a, b) => WEAPON_ORDER.indexOf(a) - WEAPON_ORDER.indexOf(b));
  return { ...ok({ ...kit, weapons: owned }), gained: id };
}

/** Put an owned weapon in the melee slot. */
export function assignWeapon(kit: Kit, id: WeaponId): KitChange {
  if (!kit.weapons.includes(id)) return refuse(kit, 'notOwned');
  if (kit.slots.melee === id) return refuse(kit, 'unchanged');
  return ok(withSlots(kit, { melee: id }));
}

/** Cycle the melee slot through owned weapons in `WEAPON_ORDER` (the R key). */
export function cycleWeapon(kit: Kit, dir: 1 | -1 = 1): KitChange {
  const owned = WEAPON_ORDER.filter((w) => kit.weapons.includes(w));
  if (owned.length < 2) return refuse(kit, 'unchanged');
  const i = owned.indexOf(kit.slots.melee);
  const next = owned[(((i + dir) % owned.length) + owned.length) % owned.length] as WeaponId;
  return ok(withSlots(kit, { melee: next }));
}

/** Take one bottle for a throw. Refused with none. The throw module returns the request; the caller consumes here. */
export function spendBottle(kit: Kit): KitChange {
  if (kit.bottles <= 0) return refuse(kit, 'notHeld');
  return ok({ ...kit, bottles: kit.bottles - 1 });
}

/** Leaving the bar (start of a chapter, after a return): bottles topped up to the minimum. */
export function topUpBottles(kit: Kit, tuning?: OverhaulTuning): KitChange {
  const min = t(tuning).carry.minBottlesOnLeavingBar;
  if (kit.bottles >= min) return refuse(kit, 'unchanged');
  return ok({ ...kit, bottles: min });
}

/** True when `kit` has no hot drink and the bar should offer one. */
export const needsHotDrink = (kit: Kit): boolean => kit.hotDrink === null;
