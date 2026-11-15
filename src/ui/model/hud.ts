/**
 * HUD view-model: turns the state source's snapshots into plain numbers and
 * IDs the HUD scene draws. No Phaser. docs/style-guide.md section 4.
 * There is no health: the one Buzz meter, the drink, the four special slots,
 * the weapon, the bottles and Myko's calls. DESIGN.md 7.
 */

import { TUNING } from '../../content/tuning';
import type { BossId, DrunkLevel, DrunkState, MeterSnapshot, MoveId, OverhaulDrinkId, SpecialSlotIndex, SpiritId, TextId, WeaponId } from '../../core/types';
import type { UiStateSource } from '../contract';
import { METER } from '../layout';
import { uiTuning } from '../uiTuning';

export interface HudDrinkView {
  /** The drink in the drink slot, or null when the slot is empty. */
  readonly drinkId: OverhaulDrinkId | null;
  /** How many of it he holds (a hot drink counts 1). */
  readonly count: number;
}

export interface HudSpiritView {
  /** The spirit in the spirit slot (G drinks it at once), or null when the slot is empty. */
  readonly spiritId: SpiritId | null;
  readonly count: number;
}

export interface HudSpecialView {
  readonly slot: SpecialSlotIndex;
  readonly moveId: MoveId | null;
  /** Andrew is at this slot's level: not dark. */
  readonly lit: boolean;
  /** 0..1 of the cooldown still to run (1 just after use, 0 ready). */
  readonly cooldownFraction: number;
  /** Lit, has a move and is off cooldown. */
  readonly ready: boolean;
}

export interface HudModel {
  readonly buzz: {
    /** The chapter script has hidden the meter (chapter 1 until the first pint): draw none of it. */
    readonly hidden: boolean;
    /** 0..1 of the way to the floor. */
    readonly fraction: number;
    /** Where Grand, Bit much and Fecked begin, as 0..1 fractions of the meter. */
    readonly marks: readonly number[];
    readonly level: DrunkLevel;
    readonly state: DrunkState;
    readonly stateTextId: TextId;
    /** A spirit window is running; the meter flashes. */
    readonly flashing: boolean;
    readonly inSun: boolean;
    readonly teaHold: boolean;
    /** Length of the meter in pixels: grows with the chapter's floor. */
    readonly widthPx: number;
    /** 0..1 how flat the colours should be (under the low warning). */
    readonly flatness: number;
  };
  /** What Q drinks: the picked beer or hot drink (else the beer slot). */
  readonly drink: HudDrinkView;
  readonly spirit: HudSpiritView;
  readonly specials: readonly [HudSpecialView, HudSpecialView, HudSpecialView, HudSpecialView];
  readonly weapon: WeaponId;
  readonly bottles: number;
  /** One flag per call in the game: true if still available, false for a spent one. */
  readonly calls: readonly boolean[];
  /** 0..1 */
  readonly callHold: number;
  readonly boss: { readonly bossId: BossId; readonly nameTextId: TextId; readonly fraction: number } | null;
  readonly refusal: { readonly textId: TextId; readonly seq: number } | null;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Pixel length of the meter for a chapter whose floor is `floor`. */
export const meterWidth = (floor: number): number =>
  Math.round(Math.max(METER.minWidth, Math.min(METER.maxWidth, (Number.isFinite(floor) ? floor : 0) * METER.pxPerPoint)));

/**
 * How flat the colours are, 0..1: nothing from `lowWarningBelow` up, then a
 * gentle slide that reaches `flatAtZero` at 0. DESIGN.md 7.1.
 */
export function flatness(meter: MeterSnapshot): number {
  const below = TUNING.overhaul?.lowWarningBelow ?? 10;
  const v = Number.isFinite(meter.value) ? meter.value : 0;
  if (v >= below || below <= 0) return 0;
  return clamp01((1 - Math.max(0, v) / below) * uiTuning().flatAtZero);
}

function drinkView(source: UiStateSource): HudDrinkView {
  const kit = source.kit();
  const sel = kit.selectedItem ?? null;
  const picked = sel !== null && (sel === kit.hotDrink || (kit.drinks as Readonly<Record<string, number | undefined>>)[sel] !== undefined) ? (sel as OverhaulDrinkId) : null;
  const id = picked ?? kit.slots.drink;
  if (id === null) return { drinkId: null, count: 0 };
  const count = id === 'coffee' || id === 'tea' ? (kit.hotDrink === id ? 1 : 0) : (kit.drinks[id] ?? 0);
  return { drinkId: id, count };
}

function spiritView(source: UiStateSource): HudSpiritView {
  const kit = source.kit();
  const id = kit.slots.spirit ?? null;
  return id === null ? { spiritId: null, count: 0 } : { spiritId: id, count: kit.drinks[id] ?? 0 };
}

export function buildHudModel(source: UiStateSource): HudModel {
  const meter = source.meter();
  const table = source.levelTable();
  const boss = source.boss();
  const calls = TUNING.myko.callsPerGame;
  const left = source.mykoCallsLeft();
  const floor = Math.max(1, meter.floor);
  const views = source.moveSlots();
  const specials = ([1, 2, 3, 4] as const).map((slot): HudSpecialView => {
    const v = views.find((x) => x.slot === slot);
    const cooldownFraction = v === undefined || v.cooldownMs <= 0 ? 0 : clamp01(v.cooldownLeftMs / v.cooldownMs);
    const moveId = v?.moveId ?? null;
    const lit = v?.lit ?? false;
    return { slot, moveId, lit, cooldownFraction, ready: moveId !== null && lit && (v?.cooldownLeftMs ?? 0) <= 0 };
  }) as unknown as HudModel['specials'];
  return {
    buzz: {
      hidden: meter.hidden === true,
      fraction: clamp01(meter.value / floor),
      marks: [table.grand.min / floor, table.bitMuch.min / floor, table.fecked.min / floor],
      level: meter.level,
      state: meter.state,
      stateTextId: `ui.buzz.${meter.state}`,
      flashing: meter.spiritActive,
      inSun: meter.inSun,
      teaHold: meter.teaHoldActive,
      widthPx: meterWidth(floor),
      flatness: flatness(meter),
    },
    drink: drinkView(source),
    spirit: spiritView(source),
    specials,
    weapon: source.weapon(),
    bottles: source.kit().bottles,
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
    refusal: source.refusal(),
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
