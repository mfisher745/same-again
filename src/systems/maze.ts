/**
 * The chapter 6 crop-circle maze: three marker stones stepped on in the right order. A wrong stone puts all three
 * dark again. Plain TypeScript; `completeNow()` lights them in order and completes.
 */

import { TUNING } from '../content/tuning';
import { GameEvents } from '../core/types';
import type { GameEventBus, PuzzleDef, PuzzleSectionId, Reward, ScreenId, Vec2 } from '../core/types';
import { distance } from './geometry';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

export interface MazeStone {
  readonly id: string;
  /** Centre in screen pixels. */
  readonly position: Vec2;
}

/** `ChapterModule.mazePuzzles` entry. */
export interface MazePuzzlePlacement {
  readonly sectionId: PuzzleSectionId;
  readonly screenId: ScreenId;
  readonly stones: readonly MazeStone[];
  /** Stone ids in the order they must be stepped on (the postcard's pattern). */
  readonly order: readonly string[];
}

export class MazePuzzle extends PuzzleBase {
  private lit: string[] = [];
  private standingOn: string | null = null;

  constructor(
    def: PuzzleDef,
    readonly placement: MazePuzzlePlacement,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, events, reward);
  }

  /** Stone ids lit so far, in the order stepped. */
  litStones(): readonly string[] {
    return this.lit;
  }

  /** Call every tick with Andrew's position (only on the puzzle's screen). */
  update(playerPos: Vec2): void {
    if (this.isComplete()) return;
    const radius = TUNING.investigation.interactRadius;
    const on = this.placement.stones.find((s) => distance(s.position, playerPos) <= radius)?.id ?? null;
    if (on === this.standingOn) return;
    this.standingOn = on;
    if (on === null || this.lit.includes(on)) return;
    this.start();
    const expected = this.placement.order[this.lit.length];
    if (on === expected) {
      this.lit = [...this.lit, on];
      const done = this.lit.length === this.placement.order.length;
      this.events.emit(GameEvents.MazeStone, { puzzleId: this.def.id, stoneId: on, outcome: done ? 'solved' : 'right', lit: this.lit });
      if (done) this.solved();
    } else {
      this.lit = [];
      this.events.emit(GameEvents.MazeStone, { puzzleId: this.def.id, stoneId: on, outcome: 'wrong', lit: this.lit });
    }
  }

  override reset(): void {
    this.lit = [];
    this.standingOn = null;
  }

  protected applySolution(): void {
    this.lit = [...this.placement.order];
  }
}
