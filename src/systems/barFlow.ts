/**
 * The return to the bar, as the running chapter lives it. DESIGN.md 7.1 "Back
 * to the bar". The rules (what is kept, what resets) are the pure functions in
 * `barReturn.ts`; this class applies them to a running chapter through a host,
 * so `run.ts` does not grow. There is no death, no game over and no
 * checkpoint: at 0 (`sober`) or at the floor (`floor`) the meter is reset, the
 * finished sections stay finished, the encounter under way starts again, the
 * bottles are topped up and the free hot drink is offered again.
 *
 * The fade, the fall and the smoke are the scene's. This emits `bar:returned`
 * with the reason and keeps `last` for the view to read.
 */

import { GameEvents } from '../core/types';
import type { BarReturnReason, ChapterNumber, GameEventBus, HotDrinkId, ScreenId, SectionId, Vec2 } from '../core/types';
import { arriveAtBar, takeFreeHotDrink } from './barReturn';
import type { BarProgress, HotDrinkOffer } from './barReturn';
import type { Player } from './player';

/** Where the chapter's bar is: its `bar` def, or the chapter's start point while no bar is defined. */
export interface BarLocation {
  readonly screenId: ScreenId;
  readonly position: Vec2;
}

/** What the flow needs from the running chapter. */
export interface BarFlowHost {
  readonly bus: GameEventBus;
  readonly player: Player;
  readonly chapter: ChapterNumber;
  completedSectionIds(): readonly SectionId[];
  /** The encounter, boss, stealth section or puzzle started and not finished, if any. */
  underWaySectionId(): SectionId | null;
  /** Put one unfinished section back at its start. */
  resetSection(id: SectionId): void;
  /** Despawn actors and projectiles of the screen being left. */
  clearWorld(): void;
  barLocation(): BarLocation;
  /** Move Andrew (and Myko) there. */
  placeAt(where: BarLocation): void;
  /** Script flags and run-time state go back to what the last save held. */
  restoreSaved(): void;
  /** Tell the chapter script. */
  scriptReturned(reason: BarReturnReason, resetSectionId: SectionId | null): void;
}

export interface BarReturnRecord {
  readonly reason: BarReturnReason;
  /** How many returns this run has had; the view can tell a new one from the last. */
  readonly count: number;
}

export class BarFlow {
  /** The free coffee or tea on offer in the bar (DESIGN.md 7.1 "The hot drink"). */
  hotDrinkOffer: HotDrinkOffer = { available: true };
  /** The latest return, or null before the first. */
  last: BarReturnRecord | null = null;
  private count = 0;

  constructor(private readonly host: BarFlowHost) {}

  /** The meter reached 0 or the floor. */
  returnToBar(reason: BarReturnReason): void {
    const h = this.host;
    const p = h.player;
    const arrival = arriveAtBar<BarProgress>(
      { chapter: h.chapter, completedSectionIds: [...h.completedSectionIds()], kit: p.kit, underWaySectionId: h.underWaySectionId() },
      reason,
    );
    h.clearWorld();
    if (arrival.resetSectionId) h.resetSection(arrival.resetSectionId);
    h.restoreSaved();
    p.resetForBar(arrival.meter);
    p.setKit(arrival.progress.kit);
    this.hotDrinkOffer = arrival.hotDrinkOffer;
    h.placeAt(h.barLocation());
    this.count += 1;
    this.last = { reason, count: this.count };
    h.bus.emit(GameEvents.BarReturned, { reason });
    h.scriptReturned(reason, arrival.resetSectionId);
  }

  /** Arriving at the chapter's bar by the front door: the offer is open, nothing else changes. */
  arrive(): void {
    this.hotDrinkOffer = { available: true };
  }

  /** Take the free hot drink into the kit. False if refused (one already carried, or the offer is spent). */
  takeHotDrink(id: HotDrinkId): boolean {
    const taken = takeFreeHotDrink(this.host.player.kit, this.hotDrinkOffer, id);
    if (!taken.taken) return false;
    this.host.player.setKit(taken.kit);
    this.hotDrinkOffer = taken.offer;
    return true;
  }
}
