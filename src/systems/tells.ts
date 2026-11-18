/**
 * Chapter 7 "who is an alien" (`c7.puzzle.tells`): six costumed figures, three of them aliens wearing alien costumes.
 * Examining a figure shows its tells (the examinable plays its own lines; this model records that it was examined).
 * Once all six are examined the player accuses three. A wrong accusation costs nothing. Which three are aliens is fixed
 * by the chapter (`TellsLayout.aliens`). `completeNow()` marks every figure examined and solves it. Plain TypeScript.
 */

import { GameEvents } from '../core/types';
import type { GameEventBus, PuzzleDef, Reward, TextId } from '../core/types';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

export interface TellsFigure {
  readonly id: string;
  /** The examinable that examines this figure (E on it). Its dialogue lists the tells. */
  readonly examinableId?: string;
  /** Text ids of the figure's tells, for an accuse screen that wants to list them again (optional). */
  readonly tellTextIds?: readonly TextId[];
  /** A name or label for the accuse screen (optional). */
  readonly labelTextId?: TextId;
}

export interface TellsLayout {
  /** Exactly six. */
  readonly figures: readonly TellsFigure[];
  /** The three that are aliens (figure ids). Fixed, not random. */
  readonly aliens: readonly [string, string, string];
  readonly promptTextId: TextId;
  /** Shown for the right three. */
  readonly rightTextId: TextId;
  /** Shown for any other three (embarrassing, free). */
  readonly wrongTextId: TextId;
}

/** What the accuse screen reads. */
export interface TellsView {
  readonly puzzleId: PuzzleDef['id'];
  readonly promptTextId: TextId;
  readonly figures: readonly (TellsFigure & { readonly examined: boolean })[];
  /** How many to accuse. */
  readonly pick: 3;
}

export interface TellsTry {
  readonly correct: boolean;
  readonly textId: TextId;
  /** Refused: not three distinct figures. Nothing is shown. */
  readonly refused: boolean;
}

export class TellsPuzzle extends PuzzleBase {
  private seen = new Set<string>();
  private open = false;
  private picked: string[] = [];

  constructor(
    def: PuzzleDef,
    readonly layout: TellsLayout,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, events, reward);
  }

  figureForExaminable(examinableId: string): TellsFigure | undefined {
    return this.layout.figures.find((f) => f.examinableId === examinableId);
  }

  /** Andrew examined a figure. False if unknown or already examined (nothing changes). */
  examine(figureId: string): boolean {
    if (!this.layout.figures.some((f) => f.id === figureId) || this.seen.has(figureId)) return false;
    this.seen.add(figureId);
    this.start();
    this.events.emit(GameEvents.TellsExamined, { puzzleId: this.def.id, figureId });
    return true;
  }

  examined(): readonly string[] {
    return this.layout.figures.filter((f) => this.seen.has(f.id)).map((f) => f.id);
  }

  allExamined(): boolean {
    return this.seen.size === this.layout.figures.length;
  }

  get isOpen(): boolean {
    return this.open && !this.isComplete();
  }

  /** Opens the accuse screen. Refused (false) until every figure is examined. */
  openScreen(): boolean {
    if (this.isComplete() || !this.allExamined()) return false;
    this.start();
    this.open = true;
    this.picked = [];
    return true;
  }

  closeScreen(): void {
    this.open = false;
    this.picked = [];
  }

  view(): TellsView {
    return {
      puzzleId: this.def.id,
      promptTextId: this.layout.promptTextId,
      figures: this.layout.figures.map((f) => ({ ...f, examined: this.seen.has(f.id) })),
      pick: 3,
    };
  }

  /** The figures ticked so far on the accuse screen (at most two; the third accuses). */
  selection(): readonly string[] {
    return this.picked;
  }

  /**
   * One-at-a-time accusing: ticks or unticks a figure; the third tick accuses and clears the selection. Returns the
   * try when it was the third, else null.
   */
  select(figureId: string): TellsTry | null {
    if (!this.seen.has(figureId)) return null;
    const i = this.picked.indexOf(figureId);
    if (i >= 0) {
      this.picked.splice(i, 1);
      return null;
    }
    this.picked.push(figureId);
    if (this.picked.length < 3) return null;
    const ids = this.picked;
    this.picked = [];
    return this.submit(ids);
  }

  /** The player accuses three. Order does not matter. */
  submit(figureIds: readonly string[]): TellsTry {
    const picked = new Set(figureIds);
    if (picked.size !== 3 || figureIds.length !== 3 || figureIds.some((id) => !this.seen.has(id))) {
      return { correct: false, textId: this.layout.wrongTextId, refused: true };
    }
    const correct = this.layout.aliens.every((id) => picked.has(id));
    const textId = correct ? this.layout.rightTextId : this.layout.wrongTextId;
    this.events.emit(GameEvents.TellsAccused, { puzzleId: this.def.id, figureIds: [...figureIds], correct, textId });
    if (correct) {
      this.open = false;
      this.solved();
    }
    return { correct, textId, refused: false };
  }

  protected applySolution(): void {
    for (const f of this.layout.figures) this.seen.add(f.id);
    this.open = false;
  }
}
