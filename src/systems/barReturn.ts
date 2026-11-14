/**
 * Back to the bar. DESIGN.md 7.1 "Back to the bar". Pure logic: given run
 * progress and why Andrew came back, produce the next state. Used for both
 * a return (reason `sober` or `floor`) and for arriving at a chapter's bar
 * from the start or from a loaded save (reason null).
 *
 * Kept: finished sections (clues, puzzles, passed stealth, beaten encounters,
 * bosses) and everything else on the progress object. Reset: the encounter
 * under way. Buzz goes to the bottom of Grand, bottles are topped up to the
 * leave-the-bar minimum, and one free hot drink is on offer again.
 * Not wired in yet.
 */

import type { BarReturnReason, HotDrinkId, Kit, OverhaulSaveState, OverhaulTuning, SectionId } from '../core/types';
import { topUpBottles as kitTopUpBottles } from './kit';
import { createMeter, overhaulTuning } from './meter';
import type { MeterState } from './meter';

/** The slice of a run the return to the bar reads. Extra fields pass through untouched. */
export interface BarProgress extends Pick<OverhaulSaveState, 'chapter' | 'completedSectionIds' | 'kit'> {
  /** The fight, boss or other encounter Andrew was in the middle of, if any. */
  readonly underWaySectionId: SectionId | null;
}

/** One free coffee or tea per visit to the bar. DESIGN.md 7.1 "The hot drink". */
export interface HotDrinkOffer {
  readonly available: boolean;
}

export interface BarArrival<P extends BarProgress> {
  /** Progress with the kit topped up and nothing under way. */
  readonly progress: P;
  /** A fresh meter at the bottom of Grand. */
  readonly meter: MeterState;
  readonly hotDrinkOffer: HotDrinkOffer;
  /** The section to start again from its beginning, or null if nothing was under way. */
  readonly resetSectionId: SectionId | null;
  /** The `bar:returned` payload; null on a plain arrival. */
  readonly returned: { readonly reason: BarReturnReason } | null;
}

/** Bottles Andrew has on leaving the bar: what he had, or the minimum. The rule lives in `kit.ts`. */
export const topUpBottles = (kit: Kit, t: OverhaulTuning = overhaulTuning()): Kit => kitTopUpBottles(kit, t).kit;

export function arriveAtBar<P extends BarProgress>(progress: P, reason: BarReturnReason | null, t: OverhaulTuning = overhaulTuning()): BarArrival<P> {
  const finished = progress.underWaySectionId !== null && progress.completedSectionIds.includes(progress.underWaySectionId);
  return {
    progress: { ...progress, kit: topUpBottles(progress.kit, t), underWaySectionId: null },
    meter: createMeter(progress.chapter, undefined, t),
    hotDrinkOffer: { available: true },
    resetSectionId: finished ? null : progress.underWaySectionId,
    returned: reason ? { reason } : null,
  };
}

/** Andrew went back to the bar at 0 or at the floor. */
export const returnToBar = <P extends BarProgress>(progress: P, reason: BarReturnReason, t?: OverhaulTuning): BarArrival<P> =>
  arriveAtBar(progress, reason, t);

/** A chapter start or a loaded save: the same arrival, no return. DESIGN.md 7.6. */
export const loadIntoBar = <P extends BarProgress>(progress: P, t?: OverhaulTuning): BarArrival<P> => arriveAtBar(progress, null, t);

export interface HotDrinkTaken {
  readonly taken: boolean;
  readonly kit: Kit;
  readonly offer: HotDrinkOffer;
}

/**
 * Take the free hot drink. Refused if the offer is spent or he already
 * carries one (the carry limit is one at a time).
 */
export function takeFreeHotDrink(kit: Kit, offer: HotDrinkOffer, id: HotDrinkId, t: OverhaulTuning = overhaulTuning()): HotDrinkTaken {
  if (!offer.available || kit.hotDrink !== null || t.carry.hotDrinkLimit < 1) return { taken: false, kit, offer };
  return { taken: true, kit: { ...kit, hotDrink: id }, offer: { available: false } };
}

