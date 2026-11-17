/**
 * The chapter 5 redaction puzzle: five loose sheets from one redacted file, three chosen to overlay at the
 * lightbox. The right three show one full sentence; any other three show a different, useless one. Plain TypeScript.
 *
 * The UI shows the sheets (`RedactionView`), lets the player pick three and calls `submitRedaction`.
 * Each try emits `redaction:tried`. A wrong set costs nothing. `completeNow()` collects every sheet and solves it.
 */

import { GameEvents } from '../core/types';
import type { GameEventBus, PuzzleDef, Reward, TextId } from '../core/types';
import { PuzzleBase } from './investigation';
import type { SectionHost } from './sections';

export interface RedactionSheet {
  readonly id: string;
  /** Text id the UI may use to caption the sheet (optional; the art of the blacked-out words is the scene's). */
  readonly captionTextId?: TextId;
}

export interface RedactionLayout {
  /** Exactly five. */
  readonly sheets: readonly RedactionSheet[];
  /** The three that together show the full sentence. */
  readonly correct: readonly [string, string, string];
  /** Shown for the right set (`c5.redacted.right`). */
  readonly rightTextId: TextId;
  /** Shown for any wrong set (`c5.redacted.wrong`). */
  readonly wrongTextId: TextId;
  /** The prompt shown over the lightbox (`c5.redacted.prompt`). */
  readonly promptTextId: TextId;
}

/** What the UI scene reads. */
export interface RedactionView {
  readonly puzzleId: PuzzleDef['id'];
  readonly promptTextId: TextId;
  readonly sheets: readonly (RedactionSheet & { readonly collected: boolean })[];
  /** How many to pick. */
  readonly pick: 3;
}

export interface RedactionTry {
  readonly correct: boolean;
  /** The sentence the overlay shows. */
  readonly textId: TextId;
  /** Refused: not three distinct collected sheets. `correct` is false and nothing is shown. */
  readonly refused: boolean;
}

export class RedactionPuzzle extends PuzzleBase {
  private have = new Set<string>();
  private open = false;

  constructor(
    def: PuzzleDef,
    readonly layout: RedactionLayout,
    host: SectionHost,
    private readonly events: GameEventBus,
    reward?: Reward,
  ) {
    super(def, host, events, reward);
  }

  /** Andrew picked a sheet up. Unknown ids are ignored. Returns false if already held or unknown. */
  collect(sheetId: string): boolean {
    if (!this.layout.sheets.some((s) => s.id === sheetId) || this.have.has(sheetId)) return false;
    this.have.add(sheetId);
    return true;
  }

  collected(): readonly string[] {
    return this.layout.sheets.filter((s) => this.have.has(s.id)).map((s) => s.id);
  }

  allCollected(): boolean {
    return this.have.size === this.layout.sheets.length;
  }

  get isOpen(): boolean {
    return this.open && !this.isComplete();
  }

  openScreen(): void {
    if (this.isComplete()) return;
    this.start();
    this.open = true;
  }

  closeScreen(): void {
    this.open = false;
  }

  view(): RedactionView {
    return {
      puzzleId: this.def.id,
      promptTextId: this.layout.promptTextId,
      sheets: this.layout.sheets.map((s) => ({ ...s, collected: this.have.has(s.id) })),
      pick: 3,
    };
  }

  /** The player overlays three sheets. Order does not matter. */
  submit(sheetIds: readonly string[]): RedactionTry {
    const picked = new Set(sheetIds);
    if (picked.size !== 3 || sheetIds.length !== 3 || sheetIds.some((id) => !this.have.has(id))) {
      return { correct: false, textId: this.layout.wrongTextId, refused: true };
    }
    const correct = this.layout.correct.every((id) => picked.has(id));
    const textId = correct ? this.layout.rightTextId : this.layout.wrongTextId;
    this.events.emit(GameEvents.RedactionTried, { puzzleId: this.def.id, sheetIds: [...sheetIds], correct, textId });
    if (correct) {
      this.open = false;
      this.solved();
    }
    return { correct, textId, refused: false };
  }

  protected applySolution(): void {
    for (const s of this.layout.sheets) this.have.add(s.id);
    this.open = false;
  }
}
