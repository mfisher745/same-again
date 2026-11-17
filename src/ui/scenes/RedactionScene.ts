/**
 * The lightbox (chapter 5): five copies of one page, each with different words blacked out. Pick three with the mouse
 * and overlay them. The right three show the whole sentence; any other three show a useless one. A wrong set costs
 * nothing. Opened by the HUD scene when `source.activeRedaction()` becomes non-null; Esc steps back.
 *
 * The model says which sheets are held and what each try shows, not which words are hidden: the black bars are
 * drawn here, from a fixed table, so that the three right sheets between them cover every word and every other
 * three leave at least one word hidden.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../art/palette';
import { hasText, text } from '../../content/dialogue';
import type { RedactionView } from '../../systems/redaction';
import { makeLabel, rect, setLabelColour } from '../gfx';
import type { Label } from '../gfx';
import { SheetPicks } from '../model/picks';
import { wrapText } from '../model/wrap';
import { UiSceneKeys } from '../shared';
import type { UiShared } from '../shared';

const CARD = { w: 84, h: 112, gap: 8, x: 14, y: 40 } as const;
const GLYPH_W = 6;
const WORD_LINE_H = 12;
const RESULT_MS = 2600;

/**
 * Which sheets (by position, 0 to 4) black out each of the sentence's words, by word index. The right three are
 * the first, third and fourth: no word is hidden on all three, but every other three share a hidden word.
 */
const HIDDEN_ON: readonly (readonly number[])[] = [
  [0, 1, 2, 4],
  [0, 1, 3, 4],
  [1, 2, 3, 4],
  [0, 1],
  [2, 4],
  [3, 1],
  [0, 4],
  [2],
  [3, 4],
  [0, 2],
  [1, 4],
  [2, 3],
];
/** The two with the coffee rings (the second and the fifth). */
const RINGED: readonly number[] = [1, 4];

interface Card {
  readonly id: string;
  readonly index: number;
  readonly collected: boolean;
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly num: Label;
}

export class RedactionScene extends Phaser.Scene {
  private view: RedactionView | null = null;
  private sel!: SheetPicks;
  private cards: Card[] = [];
  private confirmBg!: Phaser.GameObjects.Rectangle;
  private confirmLabel!: Label;
  private resultUntil = 0;
  private resultCorrect = false;
  private resultObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly shared: UiShared) {
    super(UiSceneKeys.Redaction);
  }

  create(): void {
    this.cards = [];
    this.resultUntil = 0;
    this.resultObjects = [];
    const view = this.shared.source.activeRedaction();
    this.view = view;
    rect(this, 0, 0, 480, 270, 'ink');
    if (view === null) {
      this.scene.stop();
      return;
    }
    // The game is held while the lightbox is up, like the Tab screen.
    this.shared.overlays.show('redaction');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shared.overlays.hide('redaction'));
    this.sel = new SheetPicks(view.sheets.filter((s) => s.collected).map((s) => s.id));
    makeLabel(this, 240, 12, text(view.promptTextId), 'bone', { anchor: 'centre' });
    const sentence = this.sentenceWords(view);
    view.sheets.forEach((sheet, i) => {
      const x = CARD.x + i * (CARD.w + CARD.gap);
      const bg = rect(this, x, CARD.y, CARD.w, CARD.h, sheet.collected ? 'bone' : 'coal');
      if (sheet.collected) {
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (this.resultUntil === 0 && this.sel.toggle(sheet.id)) this.shared.hooks.play?.('uiMove');
        });
        this.drawSheet(x, i, sentence);
      }
      const num = makeLabel(this, x + 3, CARD.y + 3, '', 'amber', { depth: 6 });
      this.cards.push({ id: sheet.id, index: i, collected: sheet.collected, bg, num });
    });
    this.confirmBg = rect(this, 60, 236, 110, 20, 'coal');
    this.confirmBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
    this.confirmLabel = makeLabel(this, 115, 242, text('ui.deduction.confirm'), 'steel', { anchor: 'centre' });
    const clear = rect(this, 185, 236, 110, 20, 'coal');
    clear.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.resultUntil !== 0) return;
      this.sel.clear();
      this.shared.hooks.play?.('uiMove');
    });
    makeLabel(this, 240, 242, text('ui.deduction.clear'), 'white', { anchor: 'centre' });
    const back = rect(this, 310, 236, 110, 20, 'coal');
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.stepBack());
    makeLabel(this, 365, 242, text('ui.deduction.back'), 'white', { anchor: 'centre' });
    const kb = this.input.keyboard;
    if (kb !== null) {
      const onEsc = (): void => this.stepBack();
      kb.on('keydown-ESC', onEsc);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown-ESC', onEsc));
    }
  }

  /** The page's words: the sentence the right set shows, which is the one thing the model gives us to draw. */
  private sentenceWords(view: RedactionView): string[] {
    const id = this.rightTextId(view);
    return id === null ? [] : text(id).replace(/[“”"]/g, '').split(/\s+/).filter((w) => w.length > 0);
  }

  /** The right sentence is `<prompt id prefix>.right`; the view only names the prompt, so derive it. */
  private rightTextId(view: RedactionView): string | null {
    const id = view.promptTextId.replace(/\.prompt$/, '.right');
    return hasText(id) ? id : null;
  }

  private drawSheet(x: number, index: number, words: readonly string[]): void {
    let cx = 0;
    let cy = 8;
    const maxW = CARD.w - 10;
    const g = this.add.graphics().setDepth(4);
    words.forEach((word, k) => {
      const w = word.length * GLYPH_W;
      if (cx > 0 && cx + w > maxW) {
        cx = 0;
        cy += WORD_LINE_H;
      }
      const wx = x + 5 + cx;
      const wy = CARD.y + cy;
      makeLabel(this, wx, wy, word, 'ink', { depth: 3 });
      if (HIDDEN_ON[k % HIDDEN_ON.length]?.includes(index) === true) {
        g.fillStyle(PALETTE.ink, 1);
        g.fillRect(wx - 1, wy - 1, w + 1, 9);
      }
      cx += w + GLYPH_W;
    });
    if (RINGED.includes(index)) {
      g.lineStyle(2, PALETTE.amber, 0.7);
      g.strokeCircle(x + CARD.w - 22, CARD.y + CARD.h - 24, 13);
    }
  }

  private stepBack(): void {
    if (this.view === null || this.resultUntil !== 0) return;
    this.shared.hooks.play?.('uiMove');
    this.shared.source.closeRedaction();
    this.scene.stop();
  }

  private confirm(): void {
    const view = this.view;
    if (view === null || !this.sel.complete || this.resultUntil !== 0) return;
    const tried = this.shared.source.submitRedaction(view.puzzleId, this.sel.picks());
    if (tried.refused) {
      this.shared.hooks.play?.('refuse');
      this.sel.clear();
      return;
    }
    this.shared.hooks.play?.(tried.correct ? 'uiSelect' : 'refuse');
    this.resultUntil = this.time.now + RESULT_MS;
    this.resultCorrect = tried.correct;
    const panel = rect(this, 0, 156, 480, 70, 'ink', 20);
    const sentence = makeLabel(this, 240, 172, wrapText(text(tried.textId), 64).join('\n'), tried.correct ? 'amberLight' : 'fog', { anchor: 'centre', depth: 21 });
    this.resultObjects = [panel, sentence];
  }

  update(): void {
    if (this.view === null) return;
    if (this.resultUntil !== 0) {
      if (this.time.now < this.resultUntil) return;
      if (this.resultCorrect) {
        this.scene.stop();
        return;
      }
      // A wrong set: the useless sentence goes and he can try again.
      for (const o of this.resultObjects) o.destroy();
      this.resultObjects = [];
      this.resultUntil = 0;
      this.sel.clear();
    }
    for (const c of this.cards) {
      const order = this.sel.order(c.id);
      if (c.collected) c.bg.setFillStyle(PALETTE[order > 0 ? 'amberLight' : 'bone']);
      c.num.setText(order > 0 ? String(order) : '');
    }
    const ready = this.sel.complete;
    this.confirmBg.setFillStyle(PALETTE[ready ? 'amber' : 'coal']);
    setLabelColour(this.confirmLabel, ready ? 'ink' : 'steel');
  }
}
