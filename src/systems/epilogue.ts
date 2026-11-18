/**
 * Chapter 10 epilogue support (`docs/chapters/10-disclosure.md`, beats 5 and 7): a scripted card sequence (the world's
 * reaction, the title card, the credits) and the count of Myko calls the whole run used. Plain TypeScript.
 *
 * A card is a caption (text on a card for `durationMs`), a scene (a dialogue sequence the chapter names; the card ends
 * when it has played), a title card or the credits (text ids shown for `durationMs`, or until a key if `durationMs` is
 * 0). The sequence advances itself; `advance()` (a key) skips the card on view. The UI scene draws the current card.
 *
 * The epilogue must not choose between its versions by what is on screen. Use `callsUsed` only to pick which line of
 * dialogue plays (`c10.epilogue.calls.unused` when it is 0); nothing about it is drawn.
 */

import { GameEvents } from '../core/types';
import type { DialogueId, EpilogueCardKind, GameEventBus, MykoCallRecord, TextId } from '../core/types';

export interface EpilogueCard {
  readonly id: string;
  readonly kind: EpilogueCardKind;
  /** Caption and title cards: the text. */
  readonly textId?: TextId;
  /** Credits: the lines, top to bottom. */
  readonly lines?: readonly TextId[];
  /** Scene cards: the dialogue sequence to play. The card ends when it has. */
  readonly sceneId?: DialogueId;
  /** How long a caption, title or credits card stays, ms; 0 stays until `advance()`. Ignored for scenes. */
  readonly durationMs: number;
}

/** How many Myko calls the whole run used, from the save's record (`ChapterContext.mykoCallsUsed`). */
export const callsUsed = (calls: readonly MykoCallRecord[]): number => calls.length;

export interface CardHost {
  readonly bus: GameEventBus;
  /** Plays a dialogue sequence; resolves when it has finished. */
  say(id: DialogueId): Promise<void>;
}

export class CardSequence {
  private i = -1;
  private leftMs = 0;
  private waitingScene = false;
  private resolveDone: () => void = () => undefined;
  readonly done: Promise<void>;
  private finishedFlag = false;

  constructor(
    readonly cards: readonly EpilogueCard[],
    private readonly host: CardHost,
  ) {
    this.done = new Promise<void>((r) => {
      this.resolveDone = r;
    });
  }

  get finished(): boolean {
    return this.finishedFlag;
  }

  get index(): number {
    return this.i;
  }

  /** The card on view, or null before the start and after the end. */
  current(): EpilogueCard | null {
    return this.finishedFlag ? null : this.cards[this.i] ?? null;
  }

  /** Time left on a timed card, ms (0 for a scene or a card that waits for a key). */
  get timeLeftMs(): number {
    return this.leftMs;
  }

  start(): void {
    if (this.i >= 0 || this.finishedFlag) return;
    this.show(0);
  }

  /** A key: skips the card on view. A scene card is skipped by finishing its dialogue, not here. */
  advance(): void {
    const c = this.current();
    if (!c || c.kind === 'scene') return;
    this.show(this.i + 1);
  }

  tick(dtMs: number): void {
    const c = this.current();
    if (!c || c.kind === 'scene' || c.durationMs <= 0) return;
    this.leftMs -= dtMs;
    if (this.leftMs <= 0) this.show(this.i + 1);
  }

  private show(next: number): void {
    this.waitingScene = false;
    const card = this.cards[next];
    if (!card) {
      this.i = this.cards.length;
      this.finishedFlag = true;
      this.host.bus.emit(GameEvents.EpilogueDone, { total: this.cards.length });
      this.resolveDone();
      return;
    }
    this.i = next;
    this.leftMs = card.durationMs;
    this.host.bus.emit(GameEvents.EpilogueCard, { index: next, total: this.cards.length, cardId: card.id, kind: card.kind });
    if (card.kind === 'scene' && card.sceneId) {
      this.waitingScene = true;
      void this.host.say(card.sceneId).then(() => {
        if (this.waitingScene && this.i === next && !this.finishedFlag) this.show(next + 1);
      });
    } else if (card.kind === 'scene') {
      this.show(next + 1);
    }
  }
}
