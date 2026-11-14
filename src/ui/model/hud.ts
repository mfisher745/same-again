/**
 * HUD view-model: turns the state source's snapshots into plain numbers and
 * IDs the HUD scene draws. No Phaser. docs/style-guide.md section 4.
 */

import { TUNING } from '../../content/tuning';
import type { AbilityId, BossId, DrinkId, DrunkState, Kit, SpecialAbilityId, TextId } from '../../core/types';
import { heldDrinks } from '../../systems/kit';
import { iconDrink } from '../../systems/pickups';
import { legacyAbilityOf } from '../../systems/playerCombat';
import type { UiStateSource } from '../contract';

export type PipFill = 'full' | 'half' | 'empty';

export interface HudSlotView {
  readonly drinkId: DrinkId | null;
  readonly count: number;
  readonly selected: boolean;
}

/** Why the selected special cannot be used right now. */
export type SpecialReason = 'sober' | 'buzz' | 'recharge';

export interface HudModel {
  /** Health pips: empty now that there is no health (kept so the HUD scene compiles until it is redone). */
  readonly pips: readonly PipFill[];
  readonly buzz: {
    /** 0..1 */
    readonly fraction: number;
    /** Notch positions as 0..1 fractions of the meter: where Buzzed, Grand, Bit much and Fecked begin. */
    readonly notches: readonly number[];
    readonly state: DrunkState;
    readonly stateTextId: TextId;
    /** A spirit window is running; the meter flashes. */
    readonly flashing: boolean;
  };
  readonly heat: { readonly fraction: number } | null;
  readonly slots: readonly [HudSlotView, HudSlotView, HudSlotView];
  readonly empties: number;
  /** Bottle Throw is unlocked: the empties slot is live rather than dimmed. */
  readonly throwUnlocked: boolean;
  /** The melee ability shown with the left mouse button, or null before any is unlocked. */
  readonly melee: AbilityId | null;
  /** The Stumble is unlocked: the dodge slot (Space) is shown. */
  readonly dodgeUnlocked: boolean;
  readonly special: {
    readonly abilityId: SpecialAbilityId | null;
    /** Name, or the "Sober" label when none is selectable. */
    readonly labelTextId: TextId;
    readonly iconAbility: AbilityId | null;
    /** Specials are locked by Buzz state: draw dimmed. */
    readonly locked: boolean;
    /** Show the slot at all: at least one special is unlocked. */
    readonly shown: boolean;
    /** More than one special is unlocked, so R (cycle) is shown too. */
    readonly cyclable: boolean;
    /** Why it cannot be used now, when it cannot. */
    readonly reason: SpecialReason | null;
  };
  /** One flag per call in the game: true if still available, false for an ink stub. */
  readonly calls: readonly boolean[];
  /** 0..1 */
  readonly callHold: number;
  readonly boss: { readonly bossId: BossId; readonly nameTextId: TextId; readonly fraction: number } | null;
  readonly hangover: boolean;
}

/**
 * The drink cell the old HUD draws for each of three places: the drink in the
 * slot first (selected), then the next two held drinks. A stand-in until the
 * HUD is redone for the kit (docs/overhaul-plan.md phase 3).
 */
export function hudDrinkCells(kit: Kit): readonly [HudSlotView, HudSlotView, HudSlotView] {
  const held = heldDrinks(kit);
  const first = kit.slots.drink;
  const order = first === null ? held : [first, ...held.filter((id) => id !== first)];
  const cell = (i: number): HudSlotView => {
    const id = order[i];
    if (id === undefined) return { drinkId: null, count: 0, selected: false };
    const count = id === 'coffee' || id === 'tea' ? 1 : (kit.drinks[id] ?? 0);
    return { drinkId: iconDrink(id), count, selected: i === 0 };
  };
  return [cell(0), cell(1), cell(2)];
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function buildHudModel(source: UiStateSource): HudModel {
  const meter = source.meter();
  const table = source.levelTable();
  const kit = source.kit();
  const boss = source.boss();
  const calls = TUNING.myko.callsPerGame;
  const left = source.mykoCallsLeft();
  // One special cell stands in for the four slots until the HUD is redone: the highest lit slot with a move,
  // else the lowest dark one (docs/overhaul-plan.md phase 3).
  const slots = source.moveSlots().filter((s) => s.moveId !== null);
  const lit = slots.filter((s) => s.lit);
  const shownSlot = lit.length > 0 ? lit[lit.length - 1] : slots[0];
  const moveId = shownSlot?.moveId ?? null;
  let reason: SpecialReason | null = null;
  if (shownSlot) {
    if (!shownSlot.lit) reason = 'sober';
    else if (shownSlot.cooldownLeftMs > 0) reason = 'recharge';
  }
  const cells = hudDrinkCells(kit);
  const floor = Math.max(1, meter.floor);
  return {
    pips: [],
    buzz: {
      fraction: clamp01(meter.value / floor),
      notches: [table.grand.min / floor, table.bitMuch.min / floor, table.fecked.min / floor],
      state: meter.state,
      stateTextId: `ui.buzz.${meter.state}`,
      flashing: meter.spiritActive,
    },
    heat: null,
    slots: cells,
    empties: kit.bottles,
    throwUnlocked: true,
    melee: source.weapon() === 'hurley' ? 'hurley' : 'punchCombo',
    dodgeUnlocked: false,
    special: {
      abilityId: moveId === 'stoutSlam' || moveId === 'borrowedGlove' ? moveId : null,
      labelTextId: moveId === null ? 'ui.hud.noSpecial' : `ability.${moveId}.name`,
      iconAbility: moveId === null ? null : legacyAbilityOf(moveId) === 'punchCombo' ? 'stoutSlam' : legacyAbilityOf(moveId),
      locked: moveId === null || reason !== null,
      shown: slots.length > 0,
      cyclable: false,
      reason,
    },
    calls: Array.from({ length: calls }, (_, i) => i < left),
    callHold: clamp01(source.mykoCallHoldProgress()),
    boss:
      boss === null
        ? null
        : {
            bossId: boss.bossId,
            nameTextId: TUNING.bosses[boss.bossId].nameTextId,
            fraction: clamp01(boss.health.current / Math.max(1, boss.health.max)),
          },
    hangover: false,
  };
}

/**
 * Points along the perimeter of a w x h rectangle, clockwise from the top left,
 * for the Myko call ring. Returns line segments covering `progress` (0..1) of
 * the perimeter.
 */
export function perimeterSegments(
  progress: number,
  w: number,
  h: number,
): Array<readonly [x1: number, y1: number, x2: number, y2: number]> {
  const corners: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
    [0, 0],
  ];
  const total = 2 * (w + h);
  let remaining = clamp01(progress) * total;
  const out: Array<readonly [number, number, number, number]> = [];
  for (let i = 0; i < 4 && remaining > 0; i++) {
    const a = corners[i];
    const b = corners[i + 1];
    if (a === undefined || b === undefined) break;
    const len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    const f = Math.min(1, remaining / len);
    out.push([a[0], a[1], a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    remaining -= len;
  }
  return out;
}
