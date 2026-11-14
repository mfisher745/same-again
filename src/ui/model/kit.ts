/**
 * Kit tab model: what the Tab screen lists, which slot an item goes in, and
 * what assigning does. Plain TypeScript, no Phaser. DESIGN.md 7.1 "The kit", 7.7.
 */

import type { CarriedDrinkId, HotDrinkId, Kit, MoveId, OverhaulDrinkId, SpecialLevel, SpecialSlotIndex, TextId, WeaponId } from '../../core/types';
import { CARRIED_DRINK_ORDER, WEAPON_ORDER, carriedCount } from '../../systems/kit';
import { overhaulTuning } from '../../systems/meter';
import type { UiStateSource } from '../contract';

export type KitItem =
  | { readonly kind: 'drink'; readonly id: CarriedDrinkId; readonly count: number }
  | { readonly kind: 'hot'; readonly id: HotDrinkId }
  | { readonly kind: 'weapon'; readonly id: WeaponId }
  | { readonly kind: 'move'; readonly id: MoveId; readonly level: SpecialLevel };

export type KitSlotRef = { readonly kind: 'drink' } | { readonly kind: 'melee' } | { readonly kind: 'special'; readonly slot: SpecialSlotIndex };

/** The six slots in the order they are drawn: drink, melee, specials 1 to 4. */
export const KIT_SLOTS: readonly KitSlotRef[] = [{ kind: 'drink' }, { kind: 'melee' }, ...([1, 2, 3, 4] as const).map((slot) => ({ kind: 'special' as const, slot }))];

/** Buzz state a special slot needs: slot n is lit from level n up. */
export const SLOT_STATE_TEXT: Readonly<Record<SpecialSlotIndex, TextId>> = {
  1: 'ui.buzz.buzzed',
  2: 'ui.buzz.grand',
  3: 'ui.buzz.bitMuch',
  4: 'ui.buzz.fecked',
};

export interface KitView {
  readonly drinks: readonly Extract<KitItem, { kind: 'drink' }>[];
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
    hot: kit.hotDrink,
    weapons,
    moves: learned,
    bottles: kit.bottles,
    places: { n: carriedCount(kit), max: kit.carryLimit },
    items: [...drinks, ...hot, ...weapons, ...learned],
  };
}

export const itemKey = (item: KitItem): string => `${item.kind}:${item.id}`;

export const isDrink = (item: KitItem): boolean => item.kind === 'drink' || item.kind === 'hot';

export const drinkIdOf = (item: KitItem): OverhaulDrinkId | null => (isDrink(item) ? (item.id as OverhaulDrinkId) : null);

/** The slot an item goes in when no slot is picked. */
export function slotFor(item: KitItem): KitSlotRef {
  switch (item.kind) {
    case 'drink':
    case 'hot':
      return { kind: 'drink' };
    case 'weapon':
      return { kind: 'melee' };
    case 'move':
      return { kind: 'special', slot: item.level };
  }
}

export interface AssignResult {
  readonly ok: boolean;
  /** Text to show when it was refused, with its `{n}` where it has one. */
  readonly refusal: { readonly textId: TextId; readonly n?: number } | null;
}

/** Put `item` in `slot`. A special slot only takes a move of its own level. */
export function assignItem(source: UiStateSource, item: KitItem, slot: KitSlotRef): AssignResult {
  if (slot.kind === 'special') {
    if (item.kind !== 'move' || item.level !== slot.slot) {
      return { ok: false, refusal: { textId: 'ui.kit.wrongLevel', n: item.kind === 'move' ? item.level : slot.slot } };
    }
    return { ok: source.assignMove(slot.slot, item.id), refusal: null };
  }
  if (slot.kind === 'melee') return { ok: item.kind === 'weapon' && source.assignWeapon(item.id), refusal: null };
  const id = drinkIdOf(item);
  return { ok: id !== null && source.assignDrink(id), refusal: null };
}

/** Empty a slot (the drink and special slots; the melee slot always holds something). */
export function clearSlot(source: UiStateSource, slot: KitSlotRef): boolean {
  if (slot.kind === 'special') return source.assignMove(slot.slot, null);
  if (slot.kind === 'drink') return source.assignDrink(null);
  return false;
}

/** What a slot holds right now, as an item-like pair for drawing. */
export function slotContent(kit: Kit, slot: KitSlotRef): { readonly kind: 'drink' | 'weapon' | 'move'; readonly id: string } | null {
  if (slot.kind === 'drink') return kit.slots.drink === null ? null : { kind: 'drink', id: kit.slots.drink };
  if (slot.kind === 'melee') return { kind: 'weapon', id: kit.slots.melee };
  const id = kit.slots.specials[slot.slot - 1];
  return id === null || id === undefined ? null : { kind: 'move', id };
}
