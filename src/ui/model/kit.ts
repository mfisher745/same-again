/**
 * Kit tab model: what the Tab screen lists, which slot takes which kind of
 * entry, and what is in each slot. Plain TypeScript, no Phaser.
 * DESIGN.md 7.1 "The kit", 7.7. Clicking an entry calls `source.selectItem`:
 * there is no "put it here" step.
 */

import type { CarriedDrinkId, HotDrinkId, Kit, MoveId, SpecialLevel, SpecialSlotIndex, TextId, WeaponId } from '../../core/types';
import { CARRIED_DRINK_ORDER, WEAPON_ORDER, carriedCount, isSpirit } from '../../systems/kit';
import { overhaulTuning } from '../../systems/meter';
import type { UiStateSource } from '../contract';

export type KitItem =
  | { readonly kind: 'drink'; readonly id: CarriedDrinkId; readonly count: number }
  | { readonly kind: 'hot'; readonly id: HotDrinkId }
  | { readonly kind: 'weapon'; readonly id: WeaponId }
  | { readonly kind: 'move'; readonly id: MoveId; readonly level: SpecialLevel };

export type KitSlotRef =
  | { readonly kind: 'drink' }
  | { readonly kind: 'spirit' }
  | { readonly kind: 'hot' }
  | { readonly kind: 'melee' }
  | { readonly kind: 'special'; readonly slot: SpecialSlotIndex };

/** The item slots in the order they are drawn: beer, spirit, hot drink, melee. */
export const ITEM_SLOTS: readonly KitSlotRef[] = [{ kind: 'drink' }, { kind: 'spirit' }, { kind: 'hot' }, { kind: 'melee' }];

/** The move slots: specials 1 to 4. */
export const MOVE_SLOTS: readonly KitSlotRef[] = ([1, 2, 3, 4] as const).map((slot) => ({ kind: 'special' as const, slot }));

/** Every slot, items first, then moves. */
export const KIT_SLOTS: readonly KitSlotRef[] = [...ITEM_SLOTS, ...MOVE_SLOTS];

/** Buzz state a special slot needs: slot n is lit from level n up. */
export const SLOT_STATE_TEXT: Readonly<Record<SpecialSlotIndex, TextId>> = {
  1: 'ui.buzz.buzzed',
  2: 'ui.buzz.grand',
  3: 'ui.buzz.bitMuch',
  4: 'ui.buzz.fecked',
};

export interface KitView {
  /** Beers and spirits carried (against the carry limit), in carry order. */
  readonly drinks: readonly Extract<KitItem, { kind: 'drink' }>[];
  readonly beers: readonly Extract<KitItem, { kind: 'drink' }>[];
  readonly spirits: readonly Extract<KitItem, { kind: 'drink' }>[];
  readonly hot: HotDrinkId | null;
  readonly weapons: readonly Extract<KitItem, { kind: 'weapon' }>[];
  readonly moves: readonly Extract<KitItem, { kind: 'move' }>[];
  readonly bottles: number;
  /** Drinks carried against the carry limit. */
  readonly places: { readonly n: number; readonly max: number };
  /** Everything selectable, in the order the lists are drawn. */
  readonly items: readonly KitItem[];
}

export function buildKitView(kit: Kit): KitView {
  const moves = overhaulTuning().moves;
  const drinks = CARRIED_DRINK_ORDER.filter((id) => (kit.drinks[id] ?? 0) > 0).map((id) => ({ kind: 'drink' as const, id, count: kit.drinks[id] ?? 0 }));
  const weapons = WEAPON_ORDER.filter((id) => kit.weapons.includes(id)).map((id) => ({ kind: 'weapon' as const, id }));
  const learned = kit.moves
    .map((id) => ({ kind: 'move' as const, id, level: moves[id]?.level ?? 1 }))
    .sort((a, b) => a.level - b.level);
  const hot = kit.hotDrink === null ? [] : [{ kind: 'hot' as const, id: kit.hotDrink }];
  return {
    drinks,
    beers: drinks.filter((d) => !isSpirit(d.id)),
    spirits: drinks.filter((d) => isSpirit(d.id)),
    hot: kit.hotDrink,
    weapons,
    moves: learned,
    bottles: kit.bottles,
    places: { n: carriedCount(kit), max: kit.carryLimit },
    items: [...drinks, ...hot, ...weapons, ...learned],
  };
}

export const itemKey = (item: KitItem): string => `${item.kind}:${item.id}`;

/** The slot that takes an item. */
export function slotFor(item: KitItem): KitSlotRef {
  switch (item.kind) {
    case 'drink':
      return isSpirit(item.id) ? { kind: 'spirit' } : { kind: 'drink' };
    case 'hot':
      return { kind: 'hot' };
    case 'weapon':
      return { kind: 'melee' };
    case 'move':
      return { kind: 'special', slot: item.level };
  }
}

/** The `ui.kit.slot.*.takes` line for a slot. Its `{key}`, `{state}` and `{n}` are filled by the view. */
export const slotTakesText = (slot: KitSlotRef): TextId => `ui.kit.slot.${slot.kind}.takes`;

/** The slot's title text. */
export const slotTitleText = (slot: KitSlotRef): TextId => (slot.kind === 'special' ? 'ui.kit.slot.special' : `ui.kit.slot.${slot.kind}`);

/** Is the item the one currently in use: Q's selection, the spirit slot, the equipped weapon, or a move in a special slot? */
export function inUse(kit: Kit, item: KitItem): boolean {
  switch (item.kind) {
    case 'drink':
      return isSpirit(item.id) ? (kit.slots.spirit ?? null) === item.id : (kit.selectedItem ?? null) === item.id;
    case 'hot':
      return (kit.selectedItem ?? null) === item.id;
    case 'weapon':
      return kit.slots.melee === item.id;
    case 'move':
      return kit.slots.specials.includes(item.id);
  }
}

/** Click an entry: the kit decides what that does (see `kit.selectItem`). True if anything changed. */
export function chooseItem(source: UiStateSource, item: KitItem): boolean {
  return source.selectItem?.(item.id) ?? false;
}

/** Empty a special slot (right click). The other slots are always filled by clicking. */
export function clearSlot(source: UiStateSource, slot: KitSlotRef): boolean {
  return slot.kind === 'special' ? source.assignMove(slot.slot, null) : false;
}

/** What a slot holds right now, as an item-like pair for drawing. */
export function slotContent(kit: Kit, slot: KitSlotRef): { readonly kind: 'drink' | 'hot' | 'weapon' | 'move'; readonly id: string } | null {
  switch (slot.kind) {
    case 'drink':
      return kit.slots.drink === null ? null : { kind: 'drink', id: kit.slots.drink };
    case 'spirit': {
      const s = kit.slots.spirit ?? null;
      return s === null ? null : { kind: 'drink', id: s };
    }
    case 'hot':
      return kit.hotDrink === null ? null : { kind: 'hot', id: kit.hotDrink };
    case 'melee':
      return { kind: 'weapon', id: kit.slots.melee };
    case 'special': {
      const id = kit.slots.specials[slot.slot - 1];
      return id === null || id === undefined ? null : { kind: 'move', id };
    }
  }
}
