/**
 * The slide puzzle (chapter 4, `PuzzleKind` 'containers'). docs/chapters/04: levers pull freight containers along
 * rails until each stands in its goal slot. Plain TypeScript.
 *
 * Each rail holds one piece that sits in one of `slots` positions. E on a lever's examinable pulls it: the rail's
 * piece moves one slot on (wrapping from the last slot to 0) over `TUNING.world.pushSlideMs`. The piece is solid to
 * Andrew (`blocks`), and the lever refuses a pull while he stands where the piece would sweep. When every rail is in
 * its goal slot (checked as each slide ends) the puzzle completes. A half-finished puzzle is not saved: a load rebuilds
 * it at the starting slots, as the push puzzles do.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { SlidePuzzlePlacement, SlideRail } from '../core/chapter';
import type { GameEventBus, PuzzleDef, Reward, TileCoord, Vec2 } from '../core/types';
import { TILE } from './grid';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

interface LiveRail {
  readonly def: SlideRail;
  slot: number;
  /** The slot it is sliding from while `slideMs` > 0. */
  fromSlot: number;
  slideMs: number;
  /** Times the lever has been pulled (odd = down). */
  pulls: number;
}

export class SlidePuzzle extends PuzzleBase {
  private rails: LiveRail[];
  pulls = 0;

  constructor(
    def: PuzzleDef,
    readonly placement: SlidePuzzlePlacement,
    host: SectionHost,
    private readonly eventBus: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, eventBus, reward);
    this.rails = placement.rails.map((r) => liveRail(r));
  }

  /** The slot each rail's piece is in (or heading for). */
  slots(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.rails.map((r) => [r.def.id, r.slot]));
  }

  slotOf(railId: string): number | undefined {
    return this.rails.find((r) => r.def.id === railId)?.slot;
  }

  sliding(railId?: string): boolean {
    return this.rails.some((r) => (railId === undefined || r.def.id === railId) && r.slideMs > 0);
  }

  /** The lever (if any) whose examinable is `examinableId`. */
  leverFor(examinableId: string): SlidePuzzlePlacement['levers'][number] | undefined {
    return this.placement.levers.find((l) => l.examinableId === examinableId);
  }

  /** How many times a rail's lever has been pulled (odd = down). */
  pullsOf(railId: string): number {
    return this.rails.find((x) => x.def.id === railId)?.pulls ?? 0;
  }

  /** Pixel top-left and size of each piece for drawing, interpolated while it slides. */
  pieceDraw(): readonly { readonly railId: string; readonly frame: string; readonly pos: Vec2; readonly width: number; readonly height: number }[] {
    return this.rails.map((r) => {
      const to = slotOrigin(r.def, r.slot);
      let pos = { x: to.col * TILE, y: to.row * TILE };
      if (r.slideMs > 0) {
        const from = slotOrigin(r.def, r.fromSlot);
        const t = 1 - r.slideMs / TUNING.world.pushSlideMs;
        pos = { x: (from.col + (to.col - from.col) * t) * TILE, y: (from.row + (to.row - from.row) * t) * TILE };
      }
      const f = footprintSize(r.def);
      return { railId: r.def.id, frame: r.def.frame, pos, width: f.width * TILE, height: f.height * TILE };
    });
  }

  /** Whether a tile is covered by a piece: where it stands, or the whole stretch it is sliding over. */
  blocks(col: number, row: number): boolean {
    return this.rails.some((r) => {
      const slots = r.slideMs > 0 ? sweptBetween(r.def, r.fromSlot, r.slot) : [r.slot];
      return slots.some((s) => covers(r.def, s, col, row));
    });
  }

  /** Pulls the lever for `railId`. `playerPos` refuses the pull if Andrew stands where the piece would sweep. */
  pull(railId: string, playerPos?: Vec2): boolean {
    if (this.isComplete()) return false;
    const r = this.rails.find((x) => x.def.id === railId);
    if (!r || r.slideMs > 0) return false;
    const next = (r.slot + 1) % r.def.slots;
    if (next === r.slot) return false;
    if (playerPos && sweptBetween(r.def, r.slot, next).some((s) => coversPoint(r.def, s, playerPos))) return false;
    this.start();
    r.fromSlot = r.slot;
    r.slot = next;
    r.slideMs = TUNING.world.pushSlideMs;
    r.pulls++;
    this.pulls++;
    this.eventBus.emit(GameEvents.SlidePulled, { puzzleId: this.def.id, railId, slot: next });
    return true;
  }

  update(dtMs: number): void {
    let finished = false;
    for (const r of this.rails) {
      if (r.slideMs <= 0) continue;
      r.slideMs = Math.max(0, r.slideMs - dtMs);
      if (r.slideMs === 0) finished = true;
    }
    if (finished && !this.isComplete() && this.goalMet()) this.solved();
  }

  goalMet(): boolean {
    return this.rails.every((r) => this.placement.goal[r.def.id] === r.slot && r.slideMs <= 0);
  }

  /** Rebuilding from a save: done, with every piece in its goal slot. */
  override restoreComplete(): void {
    super.restoreComplete();
    this.applySolution();
  }

  override reset(): void {
    if (this.isComplete()) return;
    this.rails = this.placement.rails.map((r) => liveRail(r));
    this.pulls = 0;
  }

  protected applySolution(): void {
    for (const r of this.rails) {
      r.slot = this.placement.goal[r.def.id] ?? r.slot;
      r.fromSlot = r.slot;
      r.slideMs = 0;
    }
  }
}

function liveRail(def: SlideRail): LiveRail {
  return { def, slot: def.start, fromSlot: def.start, slideMs: 0, pulls: 0 };
}

/** Slots a piece passes over going `from` to `to`: both ends and all between (a wrap back to 0 sweeps the whole rail). */
function sweptBetween(def: SlideRail, from: number, to: number): number[] {
  if (to < from) return Array.from({ length: def.slots }, (_, i) => i);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Size of a piece in tiles as it lies on the map. */
function footprintSize(r: SlideRail): { width: number; height: number } {
  return r.axis === 'across' ? { width: r.length, height: r.breadth } : { width: r.breadth, height: r.length };
}

/** Top-left tile of slot `s` (slot 0 at `origin`, each slot a piece-length on). */
export function slotOrigin(r: SlideRail, s: number): TileCoord {
  return r.axis === 'across' ? { col: r.origin.col + s * r.length, row: r.origin.row } : { col: r.origin.col, row: r.origin.row + s * r.length };
}

function covers(r: SlideRail, slot: number, col: number, row: number): boolean {
  const o = slotOrigin(r, slot);
  const f = footprintSize(r);
  return col >= o.col && row >= o.row && col < o.col + f.width && row < o.row + f.height;
}

function coversPoint(r: SlideRail, slot: number, p: Vec2): boolean {
  const o = slotOrigin(r, slot);
  const f = footprintSize(r);
  const half = TUNING.player.bodyWidth / 2;
  return p.x + half > o.col * TILE && p.x - half < (o.col + f.width) * TILE && p.y + half > o.row * TILE && p.y - half < (o.row + f.height) * TILE;
}
