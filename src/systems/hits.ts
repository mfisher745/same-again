/**
 * Hits on Andrew. DESIGN.md 7.1 "Being hit". There is no health: a hit moves
 * the meter by its weight. Down at levels 1 and 2, up at levels 3 and 4. In a
 * whiskey or tequila window every hit lowers the meter, at any level, by
 * double. Flinch and knockback are the caller's. Pure logic, not wired in yet.
 */

import type { DrunkLevel, HitWeight, MeterDirection, OverhaulTuning, SpecialLevel } from '../core/types';
import { adjustMeter, levelFor, levelTable, overhaulTuning } from './meter';
import type { MeterResult, MeterState } from './meter';

export interface HitResult extends MeterResult {
  /** The way the meter moved; null when the hit was ignored (meter already returned). */
  readonly direction: MeterDirection | null;
  /** Points moved, after spirit doubling. 0 when ignored. */
  readonly amount: number;
}

/** Which way a hit moves the meter at this level, outside a spirit window. */
export const hitDirection = (level: DrunkLevel, inSpiritWindow = false): MeterDirection =>
  inSpiritWindow || level <= 2 ? 'down' : 'up';

/** Points a hit of this weight moves the meter right now. */
export function hitAmount(s: MeterState, weight: HitWeight, t: OverhaulTuning = overhaulTuning()): number {
  return t.hitWeights[weight] * (s.spirit ? s.spirit.hitMultiplier : 1);
}

export function applyHit(s: MeterState, weight: HitWeight, t: OverhaulTuning = overhaulTuning()): HitResult {
  if (s.returnReason) return { state: s, events: [], direction: null, amount: 0 };
  const level = levelFor(s.value, levelTable(s.chapter, t));
  const direction = hitDirection(level, s.spirit !== null);
  const amount = hitAmount(s, weight, t);
  const r = adjustMeter(s, direction === 'up' ? amount : -amount, t);
  return { ...r, direction, amount };
}

/** Melee damage multiplier at this level. Sober cannot fight; it reads as ×1. DESIGN.md 7.1. */
export function meleeMultiplier(level: DrunkLevel, t: OverhaulTuning = overhaulTuning()): number {
  return level === 0 ? 1 : t.meleeMultiplierByLevel[level as SpecialLevel];
}
