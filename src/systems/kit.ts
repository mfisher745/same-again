/**
 * The kit: what Andrew carries and what sits in his six slots. DESIGN.md 7.1
 * "The kit" and 7.7. Plain TypeScript, no Phaser. Every function takes a `Kit`
 * and returns a new one; the caller emits `kit:changed`, `move:learned` and
 * `weapon:gained` from the result. Meter effects are applied elsewhere: a drink
 * result only says which drink was consumed.
 */

import { TUNING } from '../content/tuning';
import type {
  BeerId,
  CarriedDrinkId,
  HotDrinkId,
  Kit,
  KitSlots,
  MoveId,
  OverhaulDrinkId,
  OverhaulTuning,
  SpecialSlotIndex,
  SpiritId,
  WeaponId,
} from '../core/types';

/** Why the kit said no. The UI maps each code to a text id. */
export type KitRefusal =
  | 'carryFull'
  | 'hotDrinkHeld'
  | 'notHeld'
  | 'notConsumable'
  | 'notLearned'
  | 'wrongLevel'
  | 'notOwned'
  | 'unchanged'
  | 'unknown';

/** Every drink that counts toward the carry limit, in cycle order. */
export const CARRIED_DRINK_ORDER: readonly CarriedDrinkId[] = ['stout', 'lager', 'lightBeer', 'craftIpa', 'whiskey', 'tequila'];

/** Beers, in cycle order: the drink slot's own category. */
export const BEER_ORDER: readonly BeerId[] = ['stout', 'lager', 'lightBeer', 'craftIpa'];

/** Spirits, in slot order: the spirit slot's own category. */
export const SPIRIT_ORDER: readonly SpiritId[] = ['whiskey', 'tequila'];

export const isHotDrink = (id: string): id is HotDrinkId => id === 'coffee' || id === 'tea';
export const isSpirit = (id: string): id is SpiritId => id === 'whiskey' || id === 'tequila';
export const isBeer = (id: string): id is BeerId => (BEER_ORDER as readonly string[]).includes(id);

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
    slots: { drink: null, spirit: null, specials: [null, null, null, null], melee: 'fists' },
    selectedItem: null,
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

/** Beers Andrew holds, in cycle order. */
export const heldBeers = (kit: Kit): BeerId[] => BEER_ORDER.filter((id) => drinkCount(kit, id) > 0);

/** Spirits Andrew holds, in slot order. */
export const heldSpirits = (kit: Kit): SpiritId[] => SPIRIT_ORDER.filter((id) => drinkCount(kit, id) > 0);

const withSlots = (kit: Kit, slots: Partial<KitSlots>): Kit => ({ ...kit, slots: { ...kit.slots, ...slots } });

/** What Q can use: a beer or a hot drink. Spirits are G's. */
const isQDrink = (id: string): id is BeerId | HotDrinkId => isBeer(id) || isHotDrink(id);

/**
 * Keep the beer slot and the spirit slot on something held, and the selection on a held beer or hot drink.
 * A selection that is gone (drunk, or never valid) falls back to the beer slot, then the hot drink, then null.
 */
function settleSlots(kit: Kit): Kit {
  let next = kit;
  const beer = next.slots.drink;
  if (beer === null || !holds(next, beer)) {
    const b = heldBeers(next)[0] ?? null;
    if (b !== beer) next = withSlots(next, { drink: b });
  }
  const spirit = next.slots.spirit ?? null;
  if (spirit === null || !holds(next, spirit)) {
    const sp = heldSpirits(next)[0] ?? null;
    if (sp !== spirit) next = withSlots(next, { spirit: sp });
  }
  const sel = next.selectedItem ?? null;
  if (sel === null || !isQDrink(sel) || !holds(next, sel)) {
    const fallback = (next.slots.drink as BeerId | null) ?? next.hotDrink;
    if (fallback !== sel) next = { ...next, selectedItem: fallback };
  }
  return next;
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
  return ok(settleSlots(next));
}

/** Take the bar's free hot drink. At most one at a time. */
export function takeHotDrink(kit: Kit, id: HotDrinkId): KitChange {
  if (kit.hotDrink !== null) return refuse(kit, 'hotDrinkHeld');
  return ok(settleSlots({ ...kit, hotDrink: id }));
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
  return { ...ok(settleSlots(next)), consumed: id, bottlesAdded };
}

/**
 * Use the selected item (the Q key): a beer or a hot drink. Q never drinks a spirit (that is G). With nothing
 * selected the result is refused `notHeld` (the UI says `ui.use.nothing`); a selection that is not a drink
 * is refused `notConsumable` (`ui.use.notADrink`).
 */
export function useSelected(kit: Kit, tuning?: OverhaulTuning): DrinkResult {
  const sel = kit.selectedItem ?? null;
  if (sel === null) return { ...refuse(kit, 'notHeld'), consumed: null, bottlesAdded: 0 };
  if (!isQDrink(sel)) return { ...refuse(kit, 'notConsumable'), consumed: null, bottlesAdded: 0 };
  return consume(kit, sel, tuning);
}

/** Drink the spirit in the spirit slot at once (the G key). Empty slot: refused `notHeld` (`ui.spirit.none`). */
export function useSpirit(kit: Kit, tuning?: OverhaulTuning): DrinkResult {
  const id = kit.slots.spirit ?? null;
  if (id === null) return { ...refuse(kit, 'notHeld'), consumed: null, bottlesAdded: 0 };
  return consume(kit, id, tuning);
}

/**
 * Click an inventory entry in the Tab screen. What it does depends on the entry:
 * - a beer or the hot drink: becomes what Q uses (a beer is also the beer slot);
 * - a spirit: goes in the spirit slot (G drinks it; Q's selection does not change);
 * - a weapon: equipped in the melee slot; a move: put in the special slot of its level, replacing what was there.
 * Q's selection only ever holds a beer or a hot drink, so a click on a weapon or move never changes it.
 */
export function selectItem(kit: Kit, id: string | null, tuning?: OverhaulTuning): KitChange {
  if (id === null) return refuse(kit, 'unchanged');
  if (isQDrink(id)) {
    if (!holds(kit, id)) return refuse(kit, 'notHeld');
    const sameSlot = !isBeer(id) || kit.slots.drink === id;
    if ((kit.selectedItem ?? null) === id && sameSlot) return refuse(kit, 'unchanged');
    const next = { ...kit, selectedItem: id };
    return ok(isBeer(id) ? withSlots(next, { drink: id }) : next);
  }
  if (isSpirit(id)) return assignSpirit(kit, id);
  if ((WEAPON_ORDER as readonly string[]).includes(id)) return assignWeapon(kit, id as WeaponId);
  const def = t(tuning).moves[id as MoveId];
  if (def) return assignMove(kit, def.level, id as MoveId, tuning);
  return refuse(kit, 'unknown');
}

/** The drink Q would drink now, or null (nothing selected). */
export function qTarget(kit: Kit): BeerId | HotDrinkId | null {
  const sel = kit.selectedItem ?? null;
  return sel !== null && isQDrink(sel) && holds(kit, sel) ? sel : null;
}

/** Cycle through held beers (the wheel). The beer slot and Q's selection both move to it. `dir` is 1 or -1. */
export function cycleDrink(kit: Kit, dir: 1 | -1 = 1): KitChange {
  const held = heldBeers(kit);
  if (held.length === 0) return refuse(kit, 'notHeld');
  const cur = kit.slots.drink;
  const i = cur === null ? -1 : held.indexOf(cur as BeerId);
  const next = held[(((i + dir) % held.length) + held.length) % held.length] as BeerId;
  if (next === cur && kit.selectedItem === next) return refuse(kit, 'unchanged');
  return ok({ ...withSlots(kit, { drink: next }), selectedItem: next });
}

/** Put a held spirit in the spirit slot (or clear it with null). Beers cycle with the wheel; hot drinks have no slot to set. */
export function assignSpirit(kit: Kit, id: SpiritId | null): KitChange {
  if (id !== null && !holds(kit, id)) return refuse(kit, 'notHeld');
  if ((kit.slots.spirit ?? null) === id) return refuse(kit, 'unchanged');
  return ok(withSlots(kit, { spirit: id }));
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

/** Beers carried (not spirits). */
export const beerCount = (kit: Kit): number => BEER_ORDER.reduce((n, id) => n + drinkCount(kit, id), 0);

/**
 * Leaving the bar: at least `carry.minBeersOnLeavingBar` beers, the missing ones being `beer` (the region's beer).
 * More than that is kept. The carry limit still holds.
 */
export function topUpBeers(kit: Kit, beer: BeerId, tuning?: OverhaulTuning): KitChange {
  const min = t(tuning).carry.minBeersOnLeavingBar;
  let next = kit;
  while (beerCount(next) < min) {
    const r = pickUpDrink(next, beer);
    if (!r.changed) break;
    next = r.kit;
  }
  return next === kit ? refuse(kit, 'unchanged') : ok(next);
}

/** Everything a bar leaves Andrew with: the minimum beers (region's beer) and the minimum throwing bottles. */
export function topUpForLeaving(kit: Kit, beer: BeerId, tuning?: OverhaulTuning): Kit {
  return topUpBottles(topUpBeers(kit, beer, tuning).kit, tuning).kit;
}

/** True when `kit` has no hot drink and the bar should offer one. */
export const needsHotDrink = (kit: Kit): boolean => kit.hotDrink === null;
