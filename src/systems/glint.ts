/**
 * The soft glint on unfinished objectives and clues. DESIGN.md 8: things Andrew can examine are drawn as
 * themselves with a small glint. Plain TypeScript.
 *
 * A chapter marks objectives (`ExaminableDef.objective`, `PropPlacement.objective`, or
 * `ChapterContext.markObjective`). While Andrew is within `TUNING.overhaul.glint.radiusTiles` of an unfinished
 * mark, it pulses now and then, at a random gap in the tuned range. The run emits `objective:glint` for each
 * pulse and the view draws a short sparkle. A finished mark never pulses.
 */

import { TUNING } from '../content/tuning';
import type { ObjectiveMark } from '../core/chapter';
import type { GlintTuning, ScreenId, Vec2 } from '../core/types';

export type { ObjectiveMark };
import type { Random } from '../core/random';
import { distance } from './geometry';
import { TILE } from './grid';

export interface GlintPulse {
  readonly markId: string;
  readonly screenId: ScreenId;
  readonly position: Vec2;
  /** The mark is hard to see: the view may draw a larger sparkle. */
  readonly faint?: true;
}

export function glintTuning(): GlintTuning {
  const g = TUNING.overhaul?.glint;
  if (!g) throw new Error('TUNING.overhaul.glint is missing');
  return g;
}

export class GlintTracker {
  /** Time until the next pulse, by mark id. Only counts down while Andrew is near. */
  private readonly wait = new Map<string, number>();

  constructor(
    private readonly rng: Random,
    private readonly tuning: GlintTuning = glintTuning(),
  ) {}

  private gap(faint: boolean): number {
    const { intervalMsMin: lo, intervalMsMax: hi } = faint ? this.tuning.faint : this.tuning;
    return lo + this.rng.next() * Math.max(0, hi - lo);
  }

  /** Advance by `dtMs`. `marks` are the unfinished marks on the screen Andrew is on. Returns the pulses that fire. */
  tick(dtMs: number, marks: readonly ObjectiveMark[], playerPos: Vec2): GlintPulse[] {
    const out: GlintPulse[] = [];
    for (const m of marks) {
      const faint = m.faint === true;
      const reach = (faint ? this.tuning.faint.radiusTiles : this.tuning.radiusTiles) * TILE;
      if (distance(m.position, playerPos) > reach) continue;
      // First time in range: wait a random gap first, so walking up does not flash at once.
      const left = (this.wait.get(m.id) ?? this.gap(faint)) - dtMs;
      if (left <= 0) {
        out.push({ markId: m.id, screenId: m.screenId, position: m.position, ...(faint ? { faint: true as const } : {}) });
        this.wait.set(m.id, this.gap(faint));
      } else this.wait.set(m.id, left);
    }
    return out;
  }

  /** Forget a mark's timer (it was finished). */
  forget(id: string): void {
    this.wait.delete(id);
  }
}
