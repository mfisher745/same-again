/**
 * Pool selection for Myko's remarks on the meter. DESIGN.md 7.5 and 7.1.
 * Pure logic: a trigger goes in, a pool ID (or null) comes out. The caller
 * picks a line from the pool (avoiding the last one) and plays it. The three
 * Myko calls are not handled here.
 *
 * - Silent at 0 (DESIGN.md 3): no pool at all while the meter is empty.
 * - Bar-return lines (`myko.bar.sober`, `myko.bar.floor`) ignore the cooldown.
 * - Every other pool shares one cooldown so he does not chatter. A remark
 *   blocked by the cooldown is dropped, not queued (DESIGN.md 7.5: a remark
 *   waiting too long is dropped).
 * Not wired in yet.
 */

import type { BarReturnReason, ChapterNumber, DrunkLevel, OverhaulTuning, SpiritId } from '../core/types';
import { overhaulTuning } from './meter';

export const MYKO_POOLS = {
  barSober: 'myko.bar.sober',
  barFloor: 'myko.bar.floor',
  low: 'myko.low',
  bitMuch: 'myko.bitMuch',
  fecked: 'myko.fecked',
  whiskey: 'myko.whiskey',
  tequila: 'myko.tequila',
  hotDrink: 'myko.hotDrink',
  meterGrows: 'myko.meterGrows',
} as const;

export type MykoMeterPool = (typeof MYKO_POOLS)[keyof typeof MYKO_POOLS];

/** What happened. Built by the caller from the meter, drink and bar events. */
export type MykoTrigger =
  /** Andrew is back at the bar (after the fade). */
  | { readonly kind: 'barReturn'; readonly reason: BarReturnReason }
  /** From `buzz:levelChanged`. */
  | { readonly kind: 'levelChanged'; readonly from: DrunkLevel; readonly to: DrunkLevel }
  /** From `spirit:started`. */
  | { readonly kind: 'spiritStarted'; readonly drinkId: SpiritId }
  /** Andrew drank his hot drink. */
  | { readonly kind: 'hotDrink' }
  /** A chapter began. From chapter 2 the meter has grown. */
  | { readonly kind: 'chapterStart'; readonly chapter: ChapterNumber }
  /** The meter value, offered each frame or on change, for the low-Buzz remark. */
  | { readonly kind: 'meterValue' };

export interface MykoLinesState {
  /** Time until an ambient remark is allowed again. */
  readonly cooldownMs: number;
  /** The low remark fires once per dip below the warning; re-armed when the meter climbs back. */
  readonly lowArmed: boolean;
}

export interface MykoLineResult {
  readonly state: MykoLinesState;
  /** The pool to draw a line from, or null for silence. */
  readonly poolId: MykoMeterPool | null;
}

export const createMykoLines = (): MykoLinesState => ({ cooldownMs: 0, lowArmed: true });

export const stepMykoLines = (s: MykoLinesState, dtMs: number): MykoLinesState =>
  s.cooldownMs <= 0 ? s : { ...s, cooldownMs: Math.max(0, s.cooldownMs - Math.max(0, dtMs)) };

/** Keep the low remark's arming in step with the meter without speaking (used while the meter is hidden). */
export const syncMykoLow = (s: MykoLinesState, meterValue: number, t: OverhaulTuning = overhaulTuning()): MykoLinesState => {
  if (meterValue <= 0) return s;
  const armed = meterValue >= t.lowWarningBelow;
  return s.lowArmed === armed ? s : { ...s, lowArmed: armed };
};

export const cooldownMs = (t: OverhaulTuning = overhaulTuning()): number => t.mykoLineCooldownMs ?? 12000;

/**
 * Decide whether Myko speaks. `meterValue` is the current meter value; at 0 or
 * below he says nothing, whatever happened.
 */
export function mykoLineFor(
  s: MykoLinesState,
  trigger: MykoTrigger,
  meterValue: number,
  t: OverhaulTuning = overhaulTuning(),
): MykoLineResult {
  const silent: MykoLineResult = { state: s, poolId: null };
  if (meterValue <= 0) return silent;

  // The low remark tracks the dip itself, so handle re-arming before anything is blocked.
  if (trigger.kind === 'meterValue') {
    const low = meterValue < t.lowWarningBelow;
    if (!low) return s.lowArmed ? silent : { state: { ...s, lowArmed: true }, poolId: null };
    if (!s.lowArmed || s.cooldownMs > 0) return silent;
    return { state: { cooldownMs: cooldownMs(t), lowArmed: false }, poolId: MYKO_POOLS.low };
  }

  if (trigger.kind === 'barReturn') {
    const poolId = trigger.reason === 'sober' ? MYKO_POOLS.barSober : MYKO_POOLS.barFloor;
    return { state: { ...s, cooldownMs: cooldownMs(t) }, poolId };
  }

  const poolId = ambientPool(trigger);
  if (poolId === null || s.cooldownMs > 0) return silent;
  return { state: { ...s, cooldownMs: cooldownMs(t) }, poolId };
}

function ambientPool(trigger: Exclude<MykoTrigger, { kind: 'meterValue' | 'barReturn' }>): MykoMeterPool | null {
  switch (trigger.kind) {
    case 'levelChanged':
      // Only on the way up into Bit much or Fecked; coming back down is quiet.
      if (trigger.to <= trigger.from) return null;
      return trigger.to === 3 ? MYKO_POOLS.bitMuch : trigger.to === 4 ? MYKO_POOLS.fecked : null;
    case 'spiritStarted':
      return trigger.drinkId === 'whiskey' ? MYKO_POOLS.whiskey : MYKO_POOLS.tequila;
    case 'hotDrink':
      return MYKO_POOLS.hotDrink;
    case 'chapterStart':
      return trigger.chapter >= 2 ? MYKO_POOLS.meterGrows : null;
  }
}
